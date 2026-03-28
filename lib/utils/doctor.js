import { exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';
import ora from 'ora';

const execAsync = promisify(exec);

const MIN_NODE_MAJOR = 18;
const MIN_NPM_MAJOR = 9;

const DOCTOR_EXIT_CODES = {
  healthy: 0,
  issuesFound: 1,
  internalError: 2
};

const ALLOWED_STATUS = new Set(['pass', 'warn', 'fail']);

export async function runDoctor(options = {}) {
  const config = normalizeOptions(options);
  const checks = [
    { name: 'Node.js', test: () => checkNode(config) },
    { name: 'npm', test: () => checkNpm(config) },
    { name: 'MongoDB', test: () => checkMongoDB(config) },
    { name: 'Git CLI', test: () => checkGit(config) },
    { name: `Port ${config.port}`, test: () => checkPort(config) }
  ];

  const diagnostics = [];

  try {
    if (!config.json) {
      console.log(chalk.cyan('\noffbyt Doctor - System Health Check\n'));
      console.log(chalk.gray(`   Mode: ${config.strict ? 'strict' : 'non-strict'} | Port: ${config.port}\n`));
    }

    for (const check of checks) {
      const spinner = config.json ? null : ora(`Checking ${check.name}...`).start();
      try {
        const rawResult = await check.test();
        const result = normalizeCheckResult(check.name, rawResult);
        diagnostics.push(result);
        renderCheckResult(spinner, result);
      } catch (error) {
        const result = {
          name: check.name,
          status: 'fail',
          message: `- Unexpected error: ${error.message}`,
          recommendation: 'Rerun command with --json and inspect error details.'
        };
        diagnostics.push(result);
        renderCheckResult(spinner, result);
      }
    }

    const summary = summarize(diagnostics);
    const blockingIssues = config.strict ? summary.warn + summary.fail : summary.fail;
    const report = {
      ok: blockingIssues === 0,
      strict: config.strict,
      port: config.port,
      exitCode: blockingIssues === 0 ? DOCTOR_EXIT_CODES.healthy : DOCTOR_EXIT_CODES.issuesFound,
      timestamp: new Date().toISOString(),
      summary,
      diagnostics
    };

    if (config.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      printHumanSummary(report);
    }

    return report;
  } catch (error) {
    const report = {
      ok: false,
      strict: config.strict,
      port: config.port,
      exitCode: DOCTOR_EXIT_CODES.internalError,
      timestamp: new Date().toISOString(),
      summary: { pass: 0, warn: 0, fail: 1, total: 1 },
      diagnostics: [
        {
          name: 'Doctor Runner',
          status: 'fail',
          message: `- Internal error: ${error.message}`,
          recommendation: 'Try again or open an issue with the command output.'
        }
      ]
    };

    if (config.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.error(chalk.red(`\nDoctor failed to run: ${error.message}\n`));
    }

    return report;
  }
}

function normalizeOptions(options) {
  return {
    strict: options.strict !== false,
    json: Boolean(options.json),
    port: Number.isInteger(options.port) ? options.port : 5000
  };
}

function normalizeCheckResult(name, result) {
  if (!result || typeof result !== 'object') {
    return {
      name,
      status: 'fail',
      message: '- Check returned invalid result format.',
      recommendation: 'Update the check implementation to return a valid object.'
    };
  }

  const status = ALLOWED_STATUS.has(result.status) ? result.status : (result.success ? 'pass' : 'warn');

  return {
    name,
    status,
    message: result.message || '',
    recommendation: result.recommendation || null
  };
}

function summarize(diagnostics) {
  const summary = { pass: 0, warn: 0, fail: 0, total: diagnostics.length };

  for (const diagnostic of diagnostics) {
    if (diagnostic.status === 'pass') summary.pass += 1;
    if (diagnostic.status === 'warn') summary.warn += 1;
    if (diagnostic.status === 'fail') summary.fail += 1;
  }

  return summary;
}

function renderCheckResult(spinner, result) {
  if (!spinner) return;

  if (result.status === 'pass') {
    spinner.succeed(`[OK] ${result.name} ${result.message}`.trim());
    return;
  }

  if (result.status === 'warn') {
    spinner.warn(`[WARN] ${result.name} ${result.message}`.trim());
    return;
  }

  spinner.fail(`[FAIL] ${result.name} ${result.message}`.trim());
}

function printHumanSummary(report) {
  const { summary, diagnostics, strict, exitCode } = report;

  console.log(chalk.cyan('\nSummary:\n'));
  console.log(`   ${chalk.green('Passed:')} ${summary.pass}`);
  console.log(`   ${chalk.yellow('Warnings:')} ${summary.warn}`);
  console.log(`   ${chalk.red('Failed:')} ${summary.fail}`);
  console.log(`   ${chalk.gray('Strict Mode:')} ${strict ? 'ON' : 'OFF'}`);
  console.log(`   ${chalk.gray('Exit Code:')} ${exitCode}\n`);

  const actionable = diagnostics.filter(diagnostic => diagnostic.status !== 'pass' && diagnostic.recommendation);

  if (actionable.length > 0) {
    console.log(chalk.cyan('Recommendations:'));
    for (const diagnostic of actionable) {
      console.log(`   - ${diagnostic.name}: ${diagnostic.recommendation}`);
    }
    console.log('');
  }

  if (report.ok) {
    console.log(chalk.green('All systems ready! You are good to go.\n'));
  } else {
    console.log(chalk.yellow('Fix issues above before using offbyt.\n'));
  }
}

function parseMajorVersion(versionString) {
  const match = /v?(\d+)(?:\.\d+)?(?:\.\d+)?/.exec(versionString.trim());
  if (!match) return null;

  const major = Number.parseInt(match[1], 10);
  return Number.isNaN(major) ? null : major;
}

function statusFromStrictMode(strict) {
  return strict ? 'fail' : 'warn';
}

function isCommandMissing(error) {
  const stderr = error?.stderr || '';
  const message = error?.message || '';
  const combined = `${message} ${stderr}`.toLowerCase();

  return combined.includes('not recognized') || combined.includes('not found') || combined.includes('enoent');
}

async function checkNode(config) {
  try {
    const { stdout } = await execAsync('node --version');
    const version = stdout.trim();
    const major = parseMajorVersion(version);

    if (major === null) {
      return {
        status: statusFromStrictMode(config.strict),
        message: `(Could not parse detected version: ${version})`,
        recommendation: 'Reinstall Node.js from https://nodejs.org.'
      };
    }

    if (major < MIN_NODE_MAJOR) {
      return {
        status: statusFromStrictMode(config.strict),
        message: `(Detected ${version}, requires >= v${MIN_NODE_MAJOR})`,
        recommendation: `Upgrade Node.js to v${MIN_NODE_MAJOR}+.`
      };
    }

    return {
      status: 'pass',
      message: `(${version})`
    };
  } catch {
    return {
      status: 'fail',
      message: '- Node.js not found',
      recommendation: 'Install Node.js from https://nodejs.org.'
    };
  }
}

async function checkNpm(config) {
  try {
    const { stdout } = await execAsync('npm --version');
    const version = stdout.trim();
    const major = parseMajorVersion(version);

    if (major === null) {
      return {
        status: statusFromStrictMode(config.strict),
        message: `(Could not parse detected version: ${version})`,
        recommendation: 'Reinstall npm (or reinstall Node.js).'
      };
    }

    if (major < MIN_NPM_MAJOR) {
      return {
        status: statusFromStrictMode(config.strict),
        message: `(Detected ${version}, requires >= ${MIN_NPM_MAJOR})`,
        recommendation: `Upgrade npm to ${MIN_NPM_MAJOR}+.`
      };
    }

    return {
      status: 'pass',
      message: `(${version})`
    };
  } catch {
    return {
      status: 'fail',
      message: '- npm not found',
      recommendation: 'Install Node.js which includes npm.'
    };
  }
}

async function checkMongoDB(config) {
  try {
    await execAsync('mongosh --version', { timeout: 5000 });
  } catch {
    return {
      status: statusFromStrictMode(config.strict),
      message: '- mongosh not found',
      recommendation: 'Install MongoDB Shell (mongosh) or use MongoDB Atlas.'
    };
  }

  try {
    await execAsync('mongosh --eval "db.adminCommand({ ping: 1 })" --quiet', { timeout: 7000 });
    return {
      status: 'pass',
      message: '(Reachable on localhost)'
    };
  } catch (error) {
    if (isCommandMissing(error)) {
      return {
        status: statusFromStrictMode(config.strict),
        message: '- mongosh command unavailable',
        recommendation: 'Install MongoDB Shell (mongosh).'
      };
    }

    return {
      status: statusFromStrictMode(config.strict),
      message: '- MongoDB not reachable on localhost',
      recommendation: 'Start local MongoDB (`mongod`) or update your connection to MongoDB Atlas.'
    };
  }
}

async function checkGit(config) {
  try {
    const { stdout } = await execAsync('git --version', { timeout: 5000 });
    return {
      status: 'pass',
      message: `(${stdout.trim()})`
    };
  } catch {
    return {
      status: statusFromStrictMode(config.strict),
      message: '- Git CLI not found',
      recommendation: 'Install Git from https://git-scm.com/downloads.'
    };
  }
}

async function checkPort(config) {
  const port = config.port;

  try {
    const net = await import('net');

    return new Promise(resolve => {
      const server = net.createServer();
      let settled = false;

      const done = result => {
        if (settled) return;
        settled = true;

        if (server.listening) {
          server.close(() => resolve(result));
        } else {
          resolve(result);
        }
      };

      server.once('error', error => {
        if (error?.code === 'EADDRINUSE') {
          done({
            status: 'fail',
            message: `- Port ${port} is already in use`,
            recommendation: `Free port ${port} or run your backend on a different port.`
          });
          return;
        }

        done({
          status: 'fail',
          message: `- Port ${port} check failed (${error.message})`,
          recommendation: `Verify local permissions and port availability for ${port}.`
        });
      });

      server.once('listening', () => {
        done({
          status: 'pass',
          message: `(Port ${port} available)`
        });
      });

      server.listen(port, '127.0.0.1');
    });
  } catch {
    return {
      status: 'fail',
      message: `- Port ${port} check could not be completed`,
      recommendation: 'Retry the command and verify your network stack permissions.'
    };
  }
}

