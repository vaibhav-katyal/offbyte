import fs from 'fs';
import os from 'os';
import path from 'path';
import { deployWithCommand, isCommandAvailable, runCommandCapture } from './utils.js';

function resolveRenderAssetSuffix() {
  const platform = process.platform;
  const arch = process.arch;

  if (platform === 'win32') {
    if (arch === 'arm64') return 'windows_arm64.zip';
    if (arch === 'ia32') return 'windows_386.zip';
    return 'windows_amd64.zip';
  }

  if (platform === 'linux') {
    if (arch === 'arm64') return 'linux_arm64.zip';
    if (arch === 'arm') return 'linux_arm.zip';
    if (arch === 'ia32') return 'linux_386.zip';
    return 'linux_amd64.zip';
  }

  if (platform === 'darwin') {
    return arch === 'arm64' ? 'darwin_arm64.zip' : 'darwin_amd64.zip';
  }

  return null;
}

async function fetchLatestRenderRelease() {
  const response = await fetch('https://api.github.com/repos/render-oss/cli/releases/latest', {
    headers: {
      'User-Agent': 'offbyt-cli'
    }
  });

  if (!response.ok) {
    throw new Error(`Could not fetch Render CLI release metadata (HTTP ${response.status})`);
  }

  return response.json();
}

function getRenderInstallPaths() {
  const binDir = path.join(os.homedir(), '.offbyt', 'bin');
  const executableName = process.platform === 'win32' ? 'render.exe' : 'render';

  return {
    binDir,
    executablePath: path.join(binDir, executableName)
  };
}

function prependBinToPath(binDir) {
  const currentPath = process.env.PATH || '';
  const pathParts = currentPath.split(path.delimiter);

  if (!pathParts.includes(binDir)) {
    process.env.PATH = `${binDir}${path.delimiter}${currentPath}`;
  }
}

async function installRenderCliFromGithub() {
  const assetSuffix = resolveRenderAssetSuffix();
  if (!assetSuffix) {
    throw new Error(`Render CLI auto-install is not supported on this platform: ${process.platform}/${process.arch}`);
  }

  const release = await fetchLatestRenderRelease();
  const assets = release.assets || [];
  const targetAsset = assets.find((asset) =>
    String(asset.name || '').toLowerCase().endsWith(assetSuffix)
  );

  if (!targetAsset || !targetAsset.browser_download_url) {
    throw new Error(`No Render CLI release asset found for ${assetSuffix}`);
  }

  const { binDir, executablePath } = getRenderInstallPaths();
  const tempRoot = path.join(os.tmpdir(), 'offbyt-render-cli');
  const zipPath = path.join(tempRoot, targetAsset.name);
  const extractDir = path.join(tempRoot, `extract-${Date.now()}`);

  fs.mkdirSync(tempRoot, { recursive: true });
  fs.mkdirSync(extractDir, { recursive: true });
  fs.mkdirSync(binDir, { recursive: true });

  const archiveResponse = await fetch(targetAsset.browser_download_url, {
    headers: {
      'User-Agent': 'offbyt-cli'
    }
  });

  if (!archiveResponse.ok) {
    throw new Error(`Failed to download Render CLI archive (HTTP ${archiveResponse.status})`);
  }

  const archiveBuffer = Buffer.from(await archiveResponse.arrayBuffer());
  fs.writeFileSync(zipPath, archiveBuffer);

  if (process.platform === 'win32') {
    await runCommandCapture({
      command: 'powershell',
      args: ['-NoProfile', '-Command', `Expand-Archive -Path \"${zipPath}\" -DestinationPath \"${extractDir}\" -Force`],
      cwd: process.cwd(),
      streamOutput: false
    });
  } else {
    await runCommandCapture({
      command: 'unzip',
      args: ['-o', zipPath, '-d', extractDir],
      cwd: process.cwd(),
      streamOutput: false
    });
  }

  const extractedFiles = fs.readdirSync(extractDir);
  const binaryFile = extractedFiles.find((fileName) => {
    const lower = fileName.toLowerCase();
    if (process.platform === 'win32') {
      return lower.startsWith('cli_v') && lower.endsWith('.exe');
    }
    return lower.startsWith('cli_v');
  });

  if (!binaryFile) {
    throw new Error('Downloaded Render CLI archive did not contain expected binary');
  }

  const sourceBinary = path.join(extractDir, binaryFile);
  fs.copyFileSync(sourceBinary, executablePath);

  if (process.platform !== 'win32') {
    fs.chmodSync(executablePath, 0o755);
  }

  prependBinToPath(binDir);
}

async function ensureRenderCommandAvailable() {
  const { binDir, executablePath } = getRenderInstallPaths();
  prependBinToPath(binDir);

  if (fs.existsSync(executablePath)) {
    return;
  }

  if (await isCommandAvailable('render')) {
    return;
  }

  await installRenderCliFromGithub();

  if (!(await isCommandAvailable('render'))) {
    throw new Error('Render CLI installation completed but command is still unavailable in PATH');
  }
}

async function checkRenderLogin() {
  try {
    const result = await runCommandCapture({
      command: 'render',
      args: ['workspaces', '--output', 'text', '--confirm'],
      cwd: process.cwd(),
      streamOutput: false
    });
    const output = `${result.stdout}\n${result.stderr}`.toLowerCase();
    return !output.includes('authentication') && !output.includes('login') && !output.includes('unauthorized');
  } catch {
    return false;
  }
}

export async function deployToRender(backendPath, options = {}) {
  await ensureRenderCommandAvailable();

  const serviceId = String(options.serviceId || process.env.RENDER_SERVICE_ID || '').trim();
  if (!serviceId) {
    throw new Error('Render service ID is required. Pass --backend-service-id <SERVICE_ID> or set RENDER_SERVICE_ID.');
  }

  return deployWithCommand({
    providerName: 'Render',
    command: 'render',
    packageName: null,
    installHint: 'Render CLI auto-install failed. Download from https://github.com/render-oss/cli/releases and ensure `render` is in PATH.',
    args: ['deploys', 'create', serviceId],
    cwd: backendPath,
    urlHints: ['onrender.com', 'dashboard.render.com'],
    loginCheck: checkRenderLogin,
    loginCommand: { command: 'render', args: ['login'] },
    successLabel: 'Backend deployed on Render'
  });
}

