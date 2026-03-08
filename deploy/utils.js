import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';

const URL_REGEX = /https?:\/\/[^\s"'`<>]+/gi;

export function normalizeProviderKey(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/\./g, '')
    .replace(/-/g, '')
    .replace(/\/+/g, '');
}

export async function isCommandAvailable(command) {
  const checks = [
    ['--version'],
    ['version'],
    ['-v']
  ];

  for (const args of checks) {
    try {
      await runCommandCapture({
        command,
        args,
        cwd: process.cwd(),
        streamOutput: false
      });
      return true;
    } catch {
      // Try next version flag
    }
  }

  return false;
}

export async function autoInstallCLI(packageName, command) {
  console.log(chalk.cyan(`\n📦 Installing ${command} CLI...\n`));
  
  const spinner = ora(`Installing ${packageName}...`).start();
  
  try {
    await runCommandCapture({
      command: 'npm',
      args: ['install', '-g', packageName],
      cwd: process.cwd(),
      streamOutput: true
    });
    
    spinner.succeed(`${command} CLI installed successfully`);
    return true;
  } catch (error) {
    spinner.fail(`Failed to install ${command} CLI`);
    throw new Error(`Could not install ${packageName}. Please install manually: npm install -g ${packageName}`);
  }
}

export async function ensureCommandAvailable(command, packageName, installHint) {
  const isAvailable = await isCommandAvailable(command);
  
  if (!isAvailable) {
    console.log(chalk.yellow(`⚠️  ${command} CLI not found`));

    if (!packageName) {
      const hint = installHint
        ? ` ${installHint}`
        : ` Please install "${command}" and ensure it is available in PATH.`;
      throw new Error(`${command} CLI not found.${hint}`);
    }

    // Auto-install
    await autoInstallCLI(packageName, command);
    
    // Verify installation
    const stillNotAvailable = !(await isCommandAvailable(command));
    if (stillNotAvailable) {
      throw new Error(`${command} CLI installation failed. Please install manually.`);
    }
  }
}

export async function deployWithCommand({
  providerName,
  command,
  args,
  cwd,
  urlHints = [],
  packageName,
  installHint,
  loginCheck,
  loginCommand,
  preflight,
  postDeploy,
  successLabel,
  commandNeedsTty = false
}) {
  // Step 1: Ensure CLI is installed (auto-install if needed)
  await ensureCommandAvailable(command, packageName, installHint);

  // Step 2: Check login status and prompt if needed
  if (typeof loginCheck === 'function') {
    const isLoggedIn = await loginCheck();
    if (!isLoggedIn && loginCommand) {
      console.log(chalk.yellow(`\n⚠️  Not logged in to ${providerName}`));
      console.log(chalk.cyan(`🔐 Please login to continue...\n`));
      
      try {
        await runCommandCapture({
          command: loginCommand.command,
          args: loginCommand.args || [],
          cwd: process.cwd(),
          streamOutput: true,
          interactive: true
        });
        console.log(chalk.green(`\n✅ Successfully logged in to ${providerName}\n`));
      } catch (error) {
        throw new Error(`Login to ${providerName} failed. Please try again.`);
      }
    }
  }

  // Step 3: Run preflight checks
  if (typeof preflight === 'function') {
    await preflight();
  }

  const spinner = ora(`Deploying to ${providerName}...`).start();

  try {
    const resolvedArgs = typeof args === 'function' ? await args() : args;
    spinner.stop();
    const result = await runCommandCapture({
      command,
      args: resolvedArgs,
      cwd,
      streamOutput: true,
      interactive: commandNeedsTty
    });

    const output = `${result.stdout}\n${result.stderr}`;
    let deployedUrl = null;

    if (typeof postDeploy === 'function') {
      try {
        deployedUrl = await postDeploy({ cwd, output, command, args: resolvedArgs, providerName });
      } catch {
        // Fall back to parsing command output when post-deploy URL lookup fails.
      }
    }

    if (!deployedUrl) {
      deployedUrl = extractUrl(output, urlHints);
    }

    if (!deployedUrl) {
      throw new Error(
        `Deployment completed but no URL was detected in ${providerName} output.`
      );
    }

    spinner.succeed(successLabel || `${providerName} deployment complete`);

    return {
      provider: providerName,
      url: deployedUrl,
      output
    };
  } catch (error) {
    spinner.fail(`${providerName} deployment failed`);
    throw error;
  }
}

export async function runCommandCapture({ command, args = [], cwd, streamOutput = true, interactive = false }) {
  return new Promise((resolve, reject) => {
    const stdio = interactive ? 'inherit' : ['inherit', 'pipe', 'pipe'];

    // When using shell: true, properly quote arguments that contain spaces
    const quotedArgs = args.map((arg) => {
      if (typeof arg !== 'string') return String(arg);
      if (arg.includes(' ')) {
        return `"${arg.replace(/"/g, '\\"')}"`;
      }
      return arg;
    });

    const child = spawn(command, quotedArgs, {
      cwd,
      shell: true,
      env: process.env,
      windowsHide: false,
      stdio
    });

    let stdout = '';
    let stderr = '';

    if (child.stdout) {
      child.stdout.on('data', (chunk) => {
        const text = chunk.toString();
        stdout += text;
        if (streamOutput) {
          process.stdout.write(chalk.gray(text));
        }
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (chunk) => {
        const text = chunk.toString();
        stderr += text;
        if (streamOutput) {
          process.stderr.write(chalk.gray(text));
        }
      });
    }

    child.on('error', (error) => {
      reject(new Error(`Failed to run command "${command}": ${error.message}`));
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr, code });
        return;
      }

      const combined = `${stdout}\n${stderr}`.trim();
      const preview = combined
        ? combined.split('\n').slice(-12).join('\n')
        : 'No captured output (interactive command mode).';

      reject(
        new Error(
          `Command failed (${command} ${args.join(' ')}). Exit code: ${code}.\n${preview}`
        )
      );
    });
  });
}

export function extractUrl(output = '', urlHints = []) {
  const matches = [...new Set(String(output).match(URL_REGEX) || [])]
    .map(cleanDetectedUrl)
    .filter(Boolean);

  if (matches.length === 0) {
    return null;
  }

  const normalizedHints = urlHints
    .map((hint) => String(hint).trim().toLowerCase())
    .filter(Boolean);

  const hintedMatches = normalizedHints.length
    ? matches.filter((url) => normalizedHints.some((hint) => url.toLowerCase().includes(hint)))
    : matches;

  const candidates = hintedMatches.length > 0 ? hintedMatches : matches;

  const httpsCandidates = candidates.filter((url) => url.startsWith('https://'));
  const rankingPool = httpsCandidates.length > 0 ? httpsCandidates : candidates;

  return rankingPool[rankingPool.length - 1] || null;
}

function cleanDetectedUrl(value) {
  return String(value)
    .trim()
    .replace(/[),.;]+$/g, '');
}

export function detectBuildOutputDirectory(frontendPath) {
  const candidates = ['dist', 'build', 'out', '.next'];

  for (const candidate of candidates) {
    const fullPath = path.join(frontendPath, candidate);
    if (fs.existsSync(fullPath)) {
      return candidate;
    }
  }

  return null;
}

export function detectFrontendPath(projectPath) {
  const candidates = [
    projectPath,
    path.join(projectPath, 'frontend'),
    path.join(projectPath, 'client'),
    path.join(projectPath, 'web')
  ];

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;

    const hasPackage = fs.existsSync(path.join(candidate, 'package.json'));
    const hasSource = ['src', 'app', 'pages'].some((folder) =>
      fs.existsSync(path.join(candidate, folder))
    );

    if (hasPackage || hasSource) {
      return candidate;
    }
  }

  return projectPath;
}

export function detectBackendPath(projectPath) {
  const candidates = [
    path.join(projectPath, 'backend'),
    path.join(projectPath, 'api'),
    projectPath
  ];

  for (const candidate of candidates) {
    const hasPackage = fs.existsSync(path.join(candidate, 'package.json'));
    const hasServer = ['server.js', 'index.js', 'app.js', 'main.ts'].some((file) =>
      fs.existsSync(path.join(candidate, file))
    );

    if (hasPackage || hasServer) {
      return candidate;
    }
  }

  return projectPath;
}

export function detectLocalBackendUrl(projectPath) {
  const backendPath = detectBackendPath(projectPath);
  const candidateFiles = [
    path.join(backendPath, 'server.js'),
    path.join(backendPath, 'index.js'),
    path.join(backendPath, 'app.js'),
    path.join(backendPath, 'main.ts')
  ];

  let port = 5000;

  for (const filePath of candidateFiles) {
    if (!fs.existsSync(filePath)) continue;

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const envPortMatch = content.match(/process\.env\.PORT\s*\|\|\s*(\d+)/);
      if (envPortMatch) {
        port = Number(envPortMatch[1]);
        break;
      }

      const directMatch = content.match(/PORT\s*=\s*['"]?(\d+)['"]?/);
      if (directMatch) {
        port = Number(directMatch[1]);
        break;
      }
    } catch {
      // Ignore unreadable files and continue scanning.
    }
  }

  return `http://localhost:${port}`;
}

export function readPackageJsonSafe(targetPath) {
  const packagePath = path.join(targetPath, 'package.json');
  if (!fs.existsSync(packagePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  } catch {
    return null;
  }
}
