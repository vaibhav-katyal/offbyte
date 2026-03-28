import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { detectLocalBackendUrl, readPackageJsonSafe } from './utils.js';

const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.html']);
const IGNORE_FOLDERS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.turbo', 'coverage', 'backend']);

export function autoConnectDeployment({ projectPath, frontendPath, backendUrl }) {
  const packageJson = readPackageJsonSafe(frontendPath) || {};
  const isVite = detectVite(frontendPath, packageJson);
  const apiVar = isVite ? 'VITE_API_URL' : 'REACT_APP_API_URL';
  const envReference = isVite ? 'import.meta.env.VITE_API_URL' : 'process.env.REACT_APP_API_URL';
  const localBackendUrl = detectLocalBackendUrl(projectPath);

  const envFilesUpdated = [];
  envFilesUpdated.push(...upsertEnvFile(path.join(frontendPath, '.env.development'), [
    [apiVar, localBackendUrl],
    ['BACKEND_URL_LOCAL', localBackendUrl]
  ]));

  envFilesUpdated.push(...upsertEnvFile(path.join(frontendPath, '.env.production'), [
    [apiVar, backendUrl],
    ['BACKEND_URL', backendUrl]
  ]));

  envFilesUpdated.push(...upsertEnvFile(path.join(frontendPath, '.env'), [
    [apiVar, localBackendUrl]
  ]));

  const sourceFiles = collectFrontendSourceFiles(frontendPath);

  let updatedFileCount = 0;

  for (const filePath of sourceFiles) {
    const original = fs.readFileSync(filePath, 'utf8');
    const rewritten = rewriteApiReferences(original, envReference, backendUrl);

    if (rewritten !== original) {
      fs.writeFileSync(filePath, rewritten, 'utf8');
      updatedFileCount += 1;
    }
  }

  console.log(chalk.cyan('\nConnecting frontend with backend...\n'));
  console.log(chalk.white('  Local API URL:'), chalk.gray(localBackendUrl));
  console.log(chalk.white('  Production API URL:'), chalk.gray(backendUrl));
  console.log(chalk.white('  Env strategy:'), chalk.gray(`${apiVar} in .env.development + .env.production`));

  return {
    isVite,
    apiVar,
    localBackendUrl,
    updatedFileCount,
    envFilesUpdated: [...new Set(envFilesUpdated)]
  };
}

function rewriteApiReferences(content, envReference, backendUrl) {
  const envTemplatePrefix = `\${${envReference}}`;
  const backendOrigin = safeOrigin(backendUrl);

  let updated = content;

  // Replace relative /api URLs with environment-based base URL.
  updated = updated.replace(/(["'`])(\/api(?:\/[^"'`\n]*)?)\1/g, (_match, _quote, apiPath) => {
    return `\`${envTemplatePrefix}${apiPath}\``;
  });

  // Replace localhost absolute API URLs.
  updated = updated.replace(
    /(["'`])https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):\d+(\/api(?:\/[^"'`\n]*)?)\1/g,
    (_match, _quote, apiPath) => {
      return `\`${envTemplatePrefix}${apiPath}\``;
    }
  );

  // Replace previously deployed absolute API URLs when redeploying to a new host.
  if (backendOrigin) {
    const escapedOrigin = escapeRegex(backendOrigin);
    const absoluteApiRegex = new RegExp(
      "([\"'`])" + escapedOrigin + "(\\/api(?:\\/[^\"'`\\n]*)?)\\1",
      'g'
    );
    updated = updated.replace(absoluteApiRegex, (_match, _quote, apiPath) => {
      return `\`${envTemplatePrefix}${apiPath}\``;
    });
  }

  // Replace hardcoded API base URL constants (without /api suffix).
  updated = updated.replace(
    /(["'`])https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):\d+\1/g,
    envReference
  );

  return updated;
}

function detectVite(frontendPath, packageJson) {
  const deps = packageJson.dependencies || {};
  const devDeps = packageJson.devDependencies || {};

  if (deps.vite || devDeps.vite) {
    return true;
  }

  const viteConfigFiles = ['vite.config.js', 'vite.config.ts', 'vite.config.mjs', 'vite.config.cjs'];
  return viteConfigFiles.some((file) => fs.existsSync(path.join(frontendPath, file)));
}

function collectFrontendSourceFiles(frontendPath) {
  const candidates = [
    path.join(frontendPath, 'src'),
    path.join(frontendPath, 'app'),
    path.join(frontendPath, 'pages'),
    path.join(frontendPath, 'components')
  ];

  if (candidates.every((candidate) => !fs.existsSync(candidate))) {
    candidates.push(frontendPath);
  }

  const files = [];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      walk(candidate, files);
    }
  }

  return [...new Set(files)];
}

function walk(currentPath, files) {
  const stat = fs.statSync(currentPath);

  if (stat.isFile()) {
    const extension = path.extname(currentPath).toLowerCase();
    if (SOURCE_EXTENSIONS.has(extension)) {
      files.push(currentPath);
    }
    return;
  }

  const folderName = path.basename(currentPath).toLowerCase();
  if (IGNORE_FOLDERS.has(folderName)) {
    return;
  }

  const entries = fs.readdirSync(currentPath, { withFileTypes: true });
  for (const entry of entries) {
    walk(path.join(currentPath, entry.name), files);
  }
}

function upsertEnvFile(filePath, entries) {
  const updated = [];

  let content = '';
  if (fs.existsSync(filePath)) {
    content = fs.readFileSync(filePath, 'utf8');
  }

  const lines = content === '' ? [] : content.split(/\r?\n/);

  for (const [key, value] of entries) {
    const serialized = `${key}=${value}`;
    const index = lines.findIndex((line) => line.startsWith(`${key}=`));

    if (index >= 0) {
      lines[index] = serialized;
    } else {
      lines.push(serialized);
    }

    updated.push(filePath);
  }

  const nextContent = `${lines.filter((line, idx, arr) => {
    if (line.trim() !== '') return true;
    return idx !== arr.length - 1;
  }).join('\n')}\n`;

  fs.writeFileSync(filePath, nextContent, 'utf8');
  return updated;
}

function safeOrigin(url) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
