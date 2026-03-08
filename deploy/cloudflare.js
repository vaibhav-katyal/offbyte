import fs from 'fs';
import path from 'path';
import { deployWithCommand, runCommandCapture, detectBuildOutputDirectory } from './utils.js';

async function checkWranglerLogin() {
  try {
    const result = await runCommandCapture({
      command: 'wrangler',
      args: ['whoami'],
      cwd: process.cwd(),
      streamOutput: false
    });
    return !result.stdout.toLowerCase().includes('not logged in');
  } catch {
    return false;
  }
}

export async function deployToCloudflare(frontendPath, options = {}) {
  const buildDir = options.buildDir || detectBuildOutputDirectory(frontendPath) || 'dist';
  const buildPath = path.join(frontendPath, buildDir);

  return deployWithCommand({
    providerName: 'Cloudflare Pages',
    command: 'wrangler',
    packageName: 'wrangler',
    args: ['pages', 'deploy', buildDir],
    cwd: frontendPath,
    urlHints: ['pages.dev'],
    loginCheck: checkWranglerLogin,
    loginCommand: { command: 'wrangler', args: ['login'] },
    successLabel: 'Frontend deployed on Cloudflare Pages',
    preflight: async () => {
      if (!fs.existsSync(buildPath)) {
        throw new Error(
          `Build output folder "${buildDir}" was not found in ${frontendPath}. Run your frontend build first.`
        );
      }
    }
  });
}
