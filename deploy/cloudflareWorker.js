import fs from 'fs';
import path from 'path';
import { deployWithCommand, runCommandCapture } from './utils.js';

function sanitizeProjectName(rawValue, fallback = 'offbyt-api') {
  const normalized = String(rawValue || '')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');

  const base = normalized || fallback;
  return base.slice(0, 58);
}

async function checkWranglerLogin() {
  try {
    const result = await runCommandCapture({
      command: 'wrangler',
      args: ['whoami'],
      cwd: process.cwd(),
      streamOutput: false
    });

    const output = `${result.stdout}\n${result.stderr}`.toLowerCase();
    return !output.includes('not logged in') && !output.includes('authentication') && !output.includes('login');
  } catch {
    return false;
  }
}

function ensurePagesBackendScaffold(backendPath, projectName) {
  const deployDir = path.join(backendPath, '.offbyt-cloudflare-pages');
  const workerFile = path.join(deployDir, '_worker.js');
  const indexFile = path.join(deployDir, 'index.html');
  const wranglerConfig = path.join(deployDir, 'wrangler.toml');

  fs.mkdirSync(deployDir, { recursive: true });

  if (!fs.existsSync(workerFile)) {
    const workerTemplate = `const json = (status, body) => new Response(JSON.stringify(body), {\n  status,\n  headers: { 'content-type': 'application/json; charset=utf-8' }\n});\n\nexport default {\n  async fetch(request) {\n    const url = new URL(request.url);\n\n    if (request.method === 'GET' && url.pathname === '/') {\n      return json(200, {\n        success: true,\n        message: 'offbyt Cloudflare Pages backend is running'\n      });\n    }\n\n    if (request.method === 'GET' && url.pathname === '/health') {\n      return json(200, {\n        status: 'ok',\n        platform: 'cloudflare-pages',\n        timestamp: new Date().toISOString()\n      });\n    }\n\n    if (request.method === 'GET' && url.pathname === '/api/ping') {\n      return json(200, { success: true, data: 'pong' });\n    }\n\n    return json(404, { success: false, message: 'Route not found' });\n  }\n};\n`;

    fs.writeFileSync(workerFile, workerTemplate, 'utf8');
  }

  if (!fs.existsSync(indexFile)) {
    const html = '<!doctype html><html><head><meta charset="utf-8"><title>offbyt API</title></head><body><h1>offbyt API</h1><p>Project: ' + projectName + '</p></body></html>\n';
    fs.writeFileSync(indexFile, html, 'utf8');
  }

  const wranglerToml = [
    `name = "${projectName}"`,
    'pages_build_output_dir = "."',
    'compatibility_date = "2026-03-06"'
  ].join('\n');

  fs.writeFileSync(wranglerConfig, `${wranglerToml}\n`, 'utf8');

  return { deployDir };
}

async function ensurePagesProject(projectName, cwd) {
  try {
    const listResult = await runCommandCapture({
      command: 'wrangler',
      args: ['pages', 'project', 'list'],
      cwd,
      streamOutput: false
    });

    const listOutput = `${listResult.stdout}\n${listResult.stderr}`.toLowerCase();
    if (listOutput.includes(projectName.toLowerCase())) {
      return;
    }
  } catch {
    // Fall through and try project creation directly.
  }

  try {
    await runCommandCapture({
      command: 'wrangler',
      args: ['pages', 'project', 'create', projectName, '--production-branch', 'main'],
      cwd,
      streamOutput: true
    });
  } catch (error) {
    const message = String(error.message || '').toLowerCase();
    const alreadyExists = message.includes('already exists') || message.includes('already in use');

    if (!alreadyExists) {
      throw error;
    }
  }
}

export async function deployToCloudflareWorker(backendPath, options = {}) {
  let projectName = '';
  let deployDir = path.join(backendPath, '.offbyt-cloudflare-pages');

  const preflight = async () => {
    projectName = sanitizeProjectName(options.projectName || path.basename(backendPath), 'offbyt-api');
    const setup = ensurePagesBackendScaffold(backendPath, projectName);
    deployDir = setup.deployDir;
    await ensurePagesProject(projectName, deployDir);
  };

  return deployWithCommand({
    providerName: 'Cloudflare Pages',
    command: 'wrangler',
    packageName: 'wrangler',
    args: () => ['pages', 'deploy', '.', '--project-name', projectName, '--commit-dirty=true'],
    cwd: deployDir || backendPath,
    urlHints: ['pages.dev'],
    loginCheck: checkWranglerLogin,
    loginCommand: { command: 'wrangler', args: ['login'] },
    commandNeedsTty: true,
    preflight,
    postDeploy: async () => `https://${projectName}.pages.dev`,
    successLabel: 'Backend deployed on Cloudflare Pages'
  });
}

