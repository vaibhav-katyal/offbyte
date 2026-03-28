import { deployWithCommand, runCommandCapture } from './utils.js';

async function checkVercelLogin() {
  try {
    const result = await runCommandCapture({
      command: 'vercel',
      args: ['whoami'],
      cwd: process.cwd(),
      streamOutput: false
    });
    return !result.stderr.toLowerCase().includes('not');
  } catch {
    return false;
  }
}

export async function deployToVercel(frontendPath) {
  return deployWithCommand({
    providerName: 'Vercel',
    command: 'vercel',
    packageName: 'vercel',
    args: ['--prod', '--yes'],
    cwd: frontendPath,
    urlHints: ['vercel.app'],
    loginCheck: checkVercelLogin,
    loginCommand: { command: 'vercel', args: ['login'] },
    successLabel: 'Frontend deployed on Vercel'
  });
}
