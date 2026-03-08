import { deployWithCommand, runCommandCapture } from './utils.js';

async function checkNetlifyLogin() {
  try {
    const result = await runCommandCapture({
      command: 'netlify',
      args: ['status'],
      cwd: process.cwd(),
      streamOutput: false
    });
    return result.stdout.toLowerCase().includes('logged in');
  } catch {
    return false;
  }
}

export async function deployToNetlify(frontendPath) {
  return deployWithCommand({
    providerName: 'Netlify',
    command: 'netlify',
    packageName: 'netlify-cli',
    args: ['deploy', '--prod'],
    cwd: frontendPath,
    urlHints: ['netlify.app'],
    loginCheck: checkNetlifyLogin,
    loginCommand: { command: 'netlify', args: ['login'] },
    successLabel: 'Frontend deployed on Netlify'
  });
}
