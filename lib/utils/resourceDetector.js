/**
 * Resource Detector - Detects data resources from frontend code patterns.
 * Detects from state, map/list rendering, forms, and existing API calls.
 */

import fs from 'fs';
import path from 'path';
import { globSync } from 'glob';

export function detectResourcesFromFrontend(projectPath) {
  const resources = new Map();
  const files = getFrontendFiles(projectPath);

  console.log(`   Scanning ${files.length} files...`);

  for (const file of files) {
    try {
      const fullPath = path.join(projectPath, file);
      const content = fs.readFileSync(fullPath, 'utf8');
      const detected = detectFromCode(content, file);

      for (const resource of detected) {
        const normalizedName = normalizeResourceName(resource.name);
        if (!normalizedName) continue;

        if (!resources.has(normalizedName)) {
          resources.set(normalizedName, {
            name: normalizedName,
            singular: singularize(normalizedName),
            fields: new Set(),
            sources: []
          });
        }

        const existing = resources.get(normalizedName);
        existing.sources.push({ file, type: resource.type });

        for (const field of resource.fields || []) {
          if (!isIgnoredField(field)) {
            existing.fields.add(field);
          }
        }
      }
    } catch {
      // Ignore unreadable files.
    }
  }

  return Array.from(resources.values()).map((resource) => ({
    ...resource,
    fields: Array.from(resource.fields)
  }));
}

function getFrontendFiles(projectPath) {
  const patterns = [
    'src/**/*.{js,jsx,ts,tsx}',
    'app/**/*.{js,jsx,ts,tsx}',
    'pages/**/*.{js,jsx,ts,tsx}',
    'components/**/*.{js,jsx,ts,tsx}',
    '*.{js,jsx,ts,tsx}'
  ];

  const ignored = ['node_modules', 'backend', 'dist', 'build', '.next', 'out', 'coverage'];
  const files = new Set();

  for (const pattern of patterns) {
    const found = globSync(pattern, {
      cwd: projectPath,
      nodir: true,
      ignore: ignored.map((dir) => `${dir}/**`)
    });

    for (const file of found) {
      files.add(file);
    }
  }

  return Array.from(files);
}

function detectFromCode(content, fileName) {
  const resources = [];
  const statePattern = /const\s*\[\s*(\w+)\s*,\s*set\w+\s*\]\s*=\s*useState(?:<[^>]+>)?\s*\(/g;
  const arrayPattern = /const\s+(\w+)\s*=\s*\[([\s\S]*?)\]\s*;?/g;
  const mapPattern = /(\w+)\.map\s*\(\s*(?:\()?([a-zA-Z_$][\w$]*)(?:\))?\s*=>/g;
  const inputPattern = /name=["']([a-zA-Z_$][\w$]*)["']/g;

  let match;

  while ((match = statePattern.exec(content)) !== null) {
    const varName = match[1];
    if (isResourceVariable(varName)) {
      resources.push({
        name: varName,
        singular: singularize(varName),
        type: 'useState',
        fields: extractFieldsFromListVariable(content, varName)
      });
    }
  }

  while ((match = arrayPattern.exec(content)) !== null) {
    const varName = match[1];
    const arrayLiteral = match[2] || '';
    if (isResourceVariable(varName)) {
      resources.push({
        name: varName,
        singular: singularize(varName),
        type: 'array',
        fields: [
          ...extractFieldsFromListVariable(content, varName),
          ...extractFieldsFromArrayLiteral(arrayLiteral)
        ]
      });
    }
  }

  while ((match = mapPattern.exec(content)) !== null) {
    const listName = match[1];
    const itemName = match[2];
    if (isResourceVariable(listName)) {
      resources.push({
        name: listName,
        singular: singularize(listName),
        type: 'map',
        fields: extractFieldsFromItemVariable(content, itemName)
      });
    }
  }

  const formFields = [];
  while ((match = inputPattern.exec(content)) !== null) {
    formFields.push(match[1]);
  }

  if (formFields.length > 0) {
    const inferred = inferResourceFromFields(formFields, fileName);
    if (inferred) {
      resources.push({
        name: inferred,
        singular: singularize(inferred),
        type: 'form',
        fields: formFields
      });
    }
  }

  resources.push(...extractResourcesFromApiCalls(content));

  return resources;
}

function extractResourcesFromApiCalls(content) {
  const results = [];

  const fetchPattern = /fetch\s*\(\s*([`"'])([\s\S]*?)\1/g;
  const axiosPattern = /axios\.(get|post|put|patch|delete)\s*\(\s*([`"'])([\s\S]*?)\2/g;

  let match;
  while ((match = fetchPattern.exec(content)) !== null) {
    const resource = getResourceFromUrlString(match[2]);
    if (resource) {
      results.push({ name: resource, singular: singularize(resource), type: 'fetch', fields: [] });
    }
  }

  while ((match = axiosPattern.exec(content)) !== null) {
    const resource = getResourceFromUrlString(match[3]);
    if (resource) {
      results.push({ name: resource, singular: singularize(resource), type: 'axios', fields: [] });
    }
  }

  return results;
}

function getResourceFromUrlString(rawUrl) {
  if (!rawUrl) return null;

  let url = rawUrl
    .replace(/\$\{[^}]+\}/g, '')
    .replace(/https?:\/\/[^/]+/g, '')
    .trim();

  if (!url) return null;

  const apiIndex = url.indexOf('/api/');
  if (apiIndex !== -1) {
    url = url.slice(apiIndex + 5);
  }

  if (url.startsWith('/')) {
    url = url.slice(1);
  }

  url = url.split('?')[0].split('#')[0];
  if (!url) return null;

  const firstSegment = url.split('/')[0];
  if (!firstSegment) return null;

  if (firstSegment.startsWith(':') || firstSegment === 'health') return null;

  return normalizeResourceName(firstSegment);
}

function normalizeResourceName(name) {
  if (!name) return null;

  let normalized = name
    .replace(/[^a-zA-Z0-9_]/g, '')
    .replace(/^(get|fetch|load)/i, '')
    .replace(/(List|Data)$/i, '')
    .trim();

  if (!normalized) return null;

  const lowered = normalized.toLowerCase();
  if (lowered.length < 3) return null;
  if (!isResourceVariable(lowered)) return null;

  if (!lowered.endsWith('s')) {
    return `${lowered}s`;
  }

  return lowered;
}

function extractFieldsFromListVariable(content, varName) {
  const fields = new Set();
  const nestedAccessPattern = new RegExp(`${varName}\\.\\w+\\.([a-zA-Z_$][\\w$]*)`, 'g');

  let match;
  while ((match = nestedAccessPattern.exec(content)) !== null) {
    if (!isIgnoredField(match[1])) {
      fields.add(match[1]);
    }
  }

  return Array.from(fields);
}

function extractFieldsFromItemVariable(content, itemName) {
  const fields = new Set();
  const fieldPattern = new RegExp(`${itemName}\\.([a-zA-Z_$][a-zA-Z0-9_$]*)`, 'g');

  let match;
  while ((match = fieldPattern.exec(content)) !== null) {
    const field = match[1];
    if (!['map', 'filter', 'reduce', 'forEach', 'length'].includes(field) && !isIgnoredField(field)) {
      fields.add(field);
    }
  }

  return Array.from(fields);
}

function extractFieldsFromArrayLiteral(arrayLiteral) {
  if (!arrayLiteral) return [];

  const fields = new Set();
  const keyPattern = /([A-Za-z_$][A-Za-z0-9_$]*)\s*:/g;
  let match;

  while ((match = keyPattern.exec(arrayLiteral)) !== null) {
    const field = match[1];
    if (!isIgnoredField(field)) {
      fields.add(field);
    }
  }

  return Array.from(fields);
}

function inferResourceFromFields(fields, fileName = '') {
  const byPrefix = {};

  for (const field of fields) {
    const clean = field.trim();
    const camelPrefix = clean.match(/^([a-z][a-z0-9]+)[A-Z]/);
    if (camelPrefix) {
      const key = camelPrefix[1].toLowerCase();
      byPrefix[key] = (byPrefix[key] || 0) + 1;
    }
  }

  const candidate = Object.entries(byPrefix)
    .sort((a, b) => b[1] - a[1])[0]?.[0];

  if (candidate && candidate.length > 2) {
    return normalizeResourceName(candidate.endsWith('s') ? candidate : `${candidate}s`);
  }

  const fileBase = path.basename(fileName, path.extname(fileName)).toLowerCase();
  if (isResourceVariable(fileBase)) {
    return normalizeResourceName(fileBase.endsWith('s') ? fileBase : `${fileBase}s`);
  }

  return null;
}

function isResourceVariable(name) {
  const lower = String(name || '').toLowerCase();

  const excluded = new Set([
    'data', 'loading', 'error', 'fetching', 'isloading', 'iserror', 'response', 'result',
    'value', 'state', 'props', 'params', 'filter', 'filtered', 'sorted', 'paginated',
    'searched', 'config', 'item', 'items', 'list', 'payload'
  ]);

  const derivedPrefixes = ['filtered', 'sorted', 'paginated', 'searched', 'visible', 'active', 'selected', 'new'];
  if (excluded.has(lower)) return false;
  if (derivedPrefixes.some((prefix) => lower.startsWith(prefix))) return false;

  return lower.length > 2 && (
    lower.endsWith('s') ||
    lower.endsWith('list') ||
    lower.endsWith('data') ||
    isCommonResource(lower)
  );
}

function isCommonResource(name) {
  const common = [
    'user', 'product', 'order', 'cart', 'item', 'post', 'comment', 'review',
    'category', 'tag', 'customer', 'invoice', 'payment', 'task', 'project',
    'message', 'notification', 'ticket', 'booking'
  ];

  return common.some((base) => name === base || name === `${base}s`);
}

function singularize(word) {
  if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (word.endsWith('ses')) return word.slice(0, -2);
  if (word.endsWith('s')) return word.slice(0, -1);
  return word;
}

function isIgnoredField(field) {
  const lower = String(field || '').toLowerCase();
  return lower === '_id' || lower === 'id';
}

export default { detectResourcesFromFrontend };
