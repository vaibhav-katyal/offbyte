import fs from 'fs';
import path from 'path';
import fg from 'fast-glob';

const DEFAULT_PATTERNS = [
  'src/**/*.{html,js,jsx,ts,tsx}',
  'app/**/*.{html,js,jsx,ts,tsx}',
  'pages/**/*.{html,js,jsx,ts,tsx}',
  'components/**/*.{html,js,jsx,ts,tsx}',
  'services/**/*.{html,js,jsx,ts,tsx}',
  'frontend/**/*.{html,js,jsx,ts,tsx}',
  'client/**/*.{html,js,jsx,ts,tsx}',
  'public/**/*.{html,js,jsx,ts,tsx}',
  '*.{html,js,jsx,ts,tsx}'
];

const DEFAULT_IGNORE = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
  '**/coverage/**'
];

function detectLanguage(ext) {
  if (ext === '.ts' || ext === '.tsx') return 'ts';
  if (ext === '.js' || ext === '.jsx') return 'js';
  if (ext === '.html') return 'html';
  return 'unknown';
}

export function scanProject(projectPath, options = {}) {
  const patterns = options.patterns || DEFAULT_PATTERNS;
  const ignore = options.ignore || DEFAULT_IGNORE;

  const fullPaths = fg.sync(patterns, {
    cwd: projectPath,
    absolute: true,
    onlyFiles: true,
    unique: true,
    ignore
  });

  return fullPaths.map((fullPath) => {
    const ext = path.extname(fullPath).toLowerCase();
    const content = fs.readFileSync(fullPath, 'utf8');
    return {
      fullPath,
      relativePath: path.relative(projectPath, fullPath).replace(/\\/g, '/'),
      extension: ext,
      language: detectLanguage(ext),
      content
    };
  });
}

export default scanProject;
