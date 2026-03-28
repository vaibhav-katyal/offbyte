import fs from 'fs';
import path from 'path';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import ora from 'ora';
import { detectResourcesFromFrontend } from './resourceDetector.js';

const execAsync = promisify(exec);
const DEFAULT_RULES = {
  requiredContract: ['database', 'framework', 'auth', 'resources'],
  minResources: 1,
  requireAuth: true,
  requiredSecurity: ['validation', 'rateLimit', 'helmet', 'cors'],
  smoke: {
    checkHealth: true,
    checkResourceList: true,
    maxResources: 10,
    timeoutMs: 45000
  }
};

export async function runIndustryContractCheck(projectPath, options = {}) {
  const spinner = options.silent ? null : ora('Industry Mode: validating offline project contract...').start();

  try {
    const rules = loadIndustryRules();
    const contract = buildContractSnapshot(projectPath, options.config || null);
    const issues = [];

    for (const key of rules.requiredContract || []) {
      if (key === 'resources' && contract.resources.length < (rules.minResources || 1)) {
        issues.push(`At least ${rules.minResources || 1} frontend resources are required`);
      }

      if (key === 'database' && !contract.database) {
        issues.push('Database selection is required');
      }

      if (key === 'framework' && !contract.framework) {
        issues.push('Framework selection is required');
      }

      if (key === 'auth' && rules.requireAuth && !contract.auth.enabled) {
        issues.push('Authentication must be enabled for Industry Mode');
      }
    }

    if (!hasSecurity(contract.security, rules.requiredSecurity || [])) {
      issues.push('Security baseline is incomplete (validation/rateLimit/helmet/cors)');
    }

    const report = {
      ok: issues.length === 0,
      mode: 'offline-industry-contract',
      projectPath,
      timestamp: new Date().toISOString(),
      contract,
      issues
    };

    if (spinner) {
      if (report.ok) {
        spinner.succeed('Industry Mode: contract validation passed');
      } else {
        spinner.fail(`Industry Mode: contract validation failed (${issues.length} issue(s))`);
      }
    }

    return report;
  } catch (error) {
    if (spinner) spinner.fail(`Industry Mode: contract validation error - ${error.message}`);
    return {
      ok: false,
      mode: 'offline-industry-contract',
      projectPath,
      timestamp: new Date().toISOString(),
      contract: null,
      issues: [`Unexpected error: ${error.message}`]
    };
  }
}

export async function runIndustrySmoke(projectPath, options = {}) {
  const rules = loadIndustryRules();
  const smokeRules = { ...DEFAULT_RULES.smoke, ...(rules.smoke || {}) };
  const timeoutMs = Number.isInteger(options.timeoutMs) && options.timeoutMs > 0
    ? options.timeoutMs
    : smokeRules.timeoutMs;

  const spinner = options.silent ? null : ora('Industry Mode: running offline smoke checks...').start();

  const backendPath = path.join(projectPath, 'backend');
  const report = {
    ok: false,
    mode: 'offline-industry-smoke',
    projectPath,
    timestamp: new Date().toISOString(),
    health: null,
    endpointChecks: [],
    issue: null
  };

  if (!fs.existsSync(backendPath)) {
    report.issue = 'Backend folder not found.';
    if (spinner) spinner.fail(`Industry Mode: ${report.issue}`);
    return report;
  }

  const port = detectPort(backendPath);
  const resources = detectBackendResources(backendPath).slice(0, smokeRules.maxResources || 10);
  let proc = null;

  try {
    await execAsync('npm install --no-audit --no-fund', {
      cwd: backendPath,
      timeout: 180000,
      maxBuffer: 1024 * 1024 * 10
    });

    proc = spawn('npm', ['run', 'start'], {
      cwd: backendPath,
      shell: true,
      env: {
        ...process.env,
        PORT: String(port)
      }
    });

    const health = await waitForHealth(port, timeoutMs);
    report.health = health;

    if (!health.ok) {
      report.issue = 'Health endpoint did not become ready in time';
      if (spinner) spinner.fail(`Industry Mode: ${report.issue}`);
      return report;
    }

    for (const resource of resources) {
      const url = `http://127.0.0.1:${port}/api/${resource}`;
      try {
        const response = await fetch(url);
        report.endpointChecks.push({
          resource,
          method: 'GET',
          url,
          status: response.status,
          ok: response.ok
        });
      } catch (error) {
        report.endpointChecks.push({
          resource,
          method: 'GET',
          url,
          status: 0,
          ok: false,
          error: error.message
        });
      }
    }

    const endpointsOk = report.endpointChecks.every((check) => check.ok);
    report.ok = health.ok && endpointsOk;

    if (!report.ok && !report.issue) {
      report.issue = 'One or more resource list endpoints failed';
    }

    if (spinner) {
      if (report.ok) {
        spinner.succeed('Industry Mode: smoke checks passed');
      } else {
        spinner.fail(`Industry Mode: smoke checks failed - ${report.issue}`);
      }
    }

    return report;
  } catch (error) {
    report.issue = `Smoke runner error: ${error.message}`;
    if (spinner) spinner.fail(`Industry Mode: ${report.issue}`);
    return report;
  } finally {
    await stopProcess(proc);
  }
}

export function writeIndustryReport(projectPath, report) {
  const backendPath = path.join(projectPath, 'backend');
  const reportsPath = fs.existsSync(backendPath)
    ? path.join(backendPath, 'reports')
    : path.join(projectPath, 'reports');

  if (!fs.existsSync(reportsPath)) {
    fs.mkdirSync(reportsPath, { recursive: true });
  }

  const filePath = path.join(reportsPath, 'offbyte-industry-report.json');
  fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
  return filePath;
}

function buildContractSnapshot(projectPath, config) {
  const backendPath = path.join(projectPath, 'backend');
  const resources = detectResourcesFromFrontend(projectPath);

  const mergedConfig = config || readBackendRuntimeConfig(backendPath);
  const security = inferSecurityFromBackend(backendPath);

  return {
    database: mergedConfig.database || null,
    framework: mergedConfig.framework || null,
    auth: {
      enabled: Boolean(mergedConfig.enableAuth),
      type: mergedConfig.authType || null
    },
    resources: resources.map((resource) => resource.name),
    security,
    backendExists: fs.existsSync(backendPath)
  };
}

function readBackendRuntimeConfig(backendPath) {
  const defaults = {
    database: null,
    framework: null,
    enableAuth: false,
    authType: null
  };

  const packageJsonPath = path.join(backendPath, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      if (deps.express) defaults.framework = 'express';
      if (deps.fastify) defaults.framework = 'fastify';
      if (deps['@nestjs/core']) defaults.framework = 'nestjs';
      if (deps.sequelize) defaults.database = 'sql';
      if (deps.mongoose) defaults.database = 'mongodb';
      if (deps.jsonwebtoken) {
        defaults.enableAuth = true;
        defaults.authType = 'jwt';
      }
    } catch {
      // Ignore malformed package.json.
    }
  }

  return defaults;
}

function inferSecurityFromBackend(backendPath) {
  const serverFile = path.join(backendPath, 'server.js');
  let serverContent = '';
  if (fs.existsSync(serverFile)) {
    serverContent = fs.readFileSync(serverFile, 'utf8');
  }

  const middlewarePath = path.join(backendPath, 'middleware');
  const hasValidation = fs.existsSync(path.join(middlewarePath, 'validation.js'));
  const hasRateLimit = fs.existsSync(path.join(middlewarePath, 'rateLimiter.js'));
  const hasHelmet = /helmet\(/.test(serverContent) || /from ['"]helmet['"]/.test(serverContent);
  const hasCors = /cors\(/.test(serverContent) || /from ['"]cors['"]/.test(serverContent);

  return {
    validation: hasValidation,
    rateLimit: hasRateLimit,
    helmet: hasHelmet,
    cors: hasCors
  };
}

function hasSecurity(security, requiredSecurity) {
  return requiredSecurity.every((key) => Boolean(security[key]));
}

function detectBackendResources(backendPath) {
  const routesPath = path.join(backendPath, 'routes');
  if (!fs.existsSync(routesPath)) {
    return [];
  }

  const files = fs.readdirSync(routesPath);
  return files
    .filter((name) => name.endsWith('.routes.js'))
    .map((name) => name.replace('.routes.js', ''))
    .filter((name) => name !== 'auth' && name !== 'index');
}

function detectPort(backendPath) {
  const envPath = path.join(backendPath, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/^PORT\s*=\s*(\d+)\s*$/m);
    if (match) {
      const parsed = Number.parseInt(match[1], 10);
      if (!Number.isNaN(parsed)) return parsed;
    }
  }

  return 5000;
}

async function waitForHealth(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  const healthPaths = ['/api/health', '/health'];

  while (Date.now() < deadline) {
    for (const healthPath of healthPaths) {
      try {
        const response = await fetch(`http://127.0.0.1:${port}${healthPath}`);
        if (response.ok) {
          return { ok: true, path: healthPath, status: response.status };
        }
      } catch {
        // Continue polling.
      }
    }

    await delay(1000);
  }

  return { ok: false, path: null, status: 0 };
}

async function stopProcess(proc) {
  if (!proc || proc.killed) return;

  try {
    proc.kill('SIGTERM');
  } catch {
    // Ignore kill errors.
  }

  await delay(350);

  if (!proc.killed && proc.exitCode === null) {
    if (process.platform === 'win32') {
      try {
        await execAsync(`taskkill /PID ${proc.pid} /T /F`);
      } catch {
        // Ignore taskkill failures.
      }
    } else {
      try {
        proc.kill('SIGKILL');
      } catch {
        // Ignore kill failures.
      }
    }
  }
}

function loadIndustryRules() {
  const cwdPath = path.join(process.cwd(), 'industry-mode.json');
  if (fs.existsSync(cwdPath)) {
    return mergeRules(cwdPath);
  }

  const currentFile = fileURLToPath(import.meta.url);
  const projectRootPath = path.resolve(path.dirname(currentFile), '..', '..', 'industry-mode.json');
  if (fs.existsSync(projectRootPath)) {
    return mergeRules(projectRootPath);
  }

  return DEFAULT_RULES;
}

function mergeRules(filePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return {
      ...DEFAULT_RULES,
      ...parsed,
      smoke: {
        ...DEFAULT_RULES.smoke,
        ...(parsed.smoke || {})
      }
    };
  } catch {
    return DEFAULT_RULES;
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function printIndustryReport(report) {
  const statusLabel = report.ok ? chalk.green('PASS') : chalk.red('FAIL');
  console.log(chalk.cyan('\nIndustry Mode Report'));
  console.log(`Status: ${statusLabel}`);

  if (report.mode === 'offline-industry-contract') {
    console.log(`Resources detected: ${report.contract?.resources?.length || 0}`);
    if (!report.ok) {
      for (const issue of report.issues || []) {
        console.log(chalk.yellow(`- ${issue}`));
      }
    }
    return;
  }

  if (report.mode === 'offline-industry-smoke') {
    console.log(`Health: ${report.health?.ok ? 'ok' : 'failed'}`);
    console.log(`Endpoint checks: ${report.endpointChecks.length}`);
    if (!report.ok) {
      console.log(chalk.yellow(`Issue: ${report.issue || 'unknown issue'}`));
    }
  }
}

export default {
  runIndustryContractCheck,
  runIndustrySmoke,
  writeIndustryReport,
  printIndustryReport
};
