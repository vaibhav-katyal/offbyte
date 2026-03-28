import fs from 'fs';
import path from 'path';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';
import ora from 'ora';

const execAsync = promisify(exec);

export async function verifyGeneratedBackend(projectPath, options = {}) {
  const backendPath = path.join(projectPath, 'backend');
  const timeoutMs = Number.isInteger(options.timeoutMs) && options.timeoutMs > 0 ? options.timeoutMs : 45000;
  const maxAttempts = Number.isInteger(options.maxAttempts) && options.maxAttempts > 0 ? options.maxAttempts : 2;

  const report = {
    ok: false,
    backendPath,
    attempts: 0,
    fixesApplied: [],
    healthEndpoint: null,
    port: null,
    issue: null
  };

  if (!fs.existsSync(backendPath)) {
    report.issue = 'Backend folder not found.';
    return report;
  }

  const packageJsonPath = path.join(backendPath, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    report.issue = 'backend/package.json not found.';
    return report;
  }

  const installSpinner = ora('Phase-2: Installing backend dependencies...').start();
  try {
    await execAsync('npm install --no-audit --no-fund', {
      cwd: backendPath,
      timeout: 180000,
      maxBuffer: 1024 * 1024 * 10
    });
    installSpinner.succeed('Phase-2: Dependencies are ready');
  } catch (error) {
    installSpinner.warn(`Phase-2: npm install had warnings (${error.message})`);
  }

  let port = detectPort(backendPath);
  const healthPaths = ['/api/health', '/health'];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    report.attempts = attempt;
    const spin = ora(`Phase-2: Verifying backend startup (attempt ${attempt}/${maxAttempts})...`).start();

    const proc = spawn('npm', ['run', 'start'], {
      cwd: backendPath,
      shell: true,
      env: {
        ...process.env,
        PORT: String(port)
      }
    });

    const logs = [];
    proc.stdout.on('data', (chunk) => logs.push(chunk.toString()));
    proc.stderr.on('data', (chunk) => logs.push(chunk.toString()));

    let exitedEarly = false;
    proc.on('exit', () => {
      exitedEarly = true;
    });

    const ready = await waitForHealth(port, healthPaths, timeoutMs);

    if (ready.ok) {
      report.ok = true;
      report.port = port;
      report.healthEndpoint = ready.path;
      spin.succeed(`Phase-2: Backend healthy at http://localhost:${port}${ready.path}`);
      await stopProcess(proc);
      break;
    }

    await stopProcess(proc);

    const combined = logs.join('\n');
    const knownFix = await tryKnownFixes(backendPath, combined, { port });

    if (knownFix.applied) {
      report.fixesApplied.push(knownFix.message);
      if (knownFix.nextPort) {
        port = knownFix.nextPort;
      }
      spin.warn(`Phase-2: ${knownFix.message}. Retrying...`);
      continue;
    }

    const reason = inferIssue(combined, exitedEarly);
    report.issue = reason;
    spin.fail(`Phase-2: Verification failed - ${reason}`);
    break;
  }

  report.port = report.port || port;
  if (!report.ok && !report.issue) {
    report.issue = 'Backend health endpoint did not become ready in time.';
  }

  return report;
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

async function waitForHealth(port, healthPaths, timeoutMs) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    for (const healthPath of healthPaths) {
      try {
        const response = await fetch(`http://127.0.0.1:${port}${healthPath}`);
        if (response.ok) {
          return { ok: true, path: healthPath };
        }
      } catch {
        // Keep polling until timeout.
      }
    }

    await delay(1000);
  }

  return { ok: false, path: null };
}

async function tryKnownFixes(backendPath, logs, context = {}) {
  const missingPkgs = extractMissingPackages(logs);
  if (missingPkgs.length > 0) {
    const pkg = missingPkgs[0];
    try {
      await execAsync(`npm install ${pkg} --no-audit --no-fund`, {
        cwd: backendPath,
        timeout: 120000,
        maxBuffer: 1024 * 1024 * 5
      });
      return { applied: true, message: `Installed missing package ${pkg}` };
    } catch {
      return { applied: false, message: `Could not install missing package ${pkg}` };
    }
  }

  if (/EADDRINUSE/i.test(logs)) {
    const nextPort = (context.port || 5000) + 1;
    return {
      applied: true,
      message: `Port ${context.port || 5000} was busy, switched verifier to port ${nextPort}`,
      nextPort
    };
  }

  return { applied: false, message: '' };
}

function extractMissingPackages(logs) {
  const packages = new Set();
  const patterns = [
    /Cannot find package '([^']+)'/g,
    /Cannot find module '([^']+)'/g,
    /ERR_MODULE_NOT_FOUND[\s\S]*?'([^']+)'/g
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(logs)) !== null) {
      const name = (match[1] || '').trim();
      if (!name || name.startsWith('.') || path.isAbsolute(name)) {
        continue;
      }

      if (name.includes('/') && !name.startsWith('@')) {
        continue;
      }

      packages.add(name);
    }
  }

  return Array.from(packages);
}

function inferIssue(logs, exitedEarly) {
  if (/ECONNREFUSED|MongoNetworkError|SequelizeConnectionError|ConnectionRefusedError|connection error/i.test(logs)) {
    return 'Database is not reachable. Start your DB service or update .env credentials.';
  }

  if (/ERR_MODULE_NOT_FOUND|Cannot find module|Cannot find package/i.test(logs)) {
    return 'Module resolution error remains after retry.';
  }

  if (/SyntaxError/i.test(logs)) {
    return 'Syntax error found in generated backend code.';
  }

  if (exitedEarly) {
    return 'Backend process exited before health-check passed.';
  }

  return 'Health endpoint timeout.';
}

async function stopProcess(proc) {
  if (!proc || proc.killed) {
    return;
  }

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
        // Ignore taskkill errors.
      }
    } else {
      try {
        proc.kill('SIGKILL');
      } catch {
        // Ignore kill errors.
      }
    }
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default { verifyGeneratedBackend };
