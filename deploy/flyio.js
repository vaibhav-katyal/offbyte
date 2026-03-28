import { deployWithCommand, isCommandAvailable, runCommandCapture } from './utils.js';

async function checkFlyLogin(command) {
  try {
    const result = await runCommandCapture({
      command,
      args: ['auth', 'whoami'],
      cwd: process.cwd(),
      streamOutput: false
    });
    return !result.stdout.toLowerCase().includes('not logged in');
  } catch {
    return false;
  }
}

async function resolveFlyCommand() {
  if (await isCommandAvailable('flyctl')) {
    return 'flyctl';
  }

  if (await isCommandAvailable('fly')) {
    return 'fly';
  }

  return 'flyctl';
}

const FLY_INSTALL_HINT = [
  'Install Fly CLI manually, then re-run deploy.',
  'Windows options:',
  '  winget install --id Fly-io.flyctl -e',
  '  or choco install flyctl',
  '  or scoop install flyctl'
].join('\n');

export async function deployToFlyIO(backendPath) {
  const flyCommand = await resolveFlyCommand();

  return deployWithCommand({
    providerName: 'Fly.io',
    command: flyCommand,
    installHint: FLY_INSTALL_HINT,
    args: ['deploy', '--remote-only'],
    cwd: backendPath,
    urlHints: ['fly.dev'],
    loginCheck: () => checkFlyLogin(flyCommand),
    loginCommand: { command: flyCommand, args: ['auth', 'login'] },
    successLabel: 'Backend deployed on Fly.io'
  });
}
