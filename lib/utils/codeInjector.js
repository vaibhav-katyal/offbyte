/**
 * Frontend Code Injector
 * Injects API calls into frontend code where resources are used
 */

import fs from 'fs';
import path from 'path';
import { globSync } from 'glob';

/**
 * Inject API calls into frontend files
 */
export function injectApiCalls(projectPath, resources, options = {}) {
  const injectedFiles = [];
  const files = getFrontendFiles(projectPath);
  const idField = options.idField || '_id';

  for (const file of files) {
    try {
      const fullPath = path.join(projectPath, file);
      let content = fs.readFileSync(fullPath, 'utf8');
      let modified = false;

      for (const resource of resources) {
        // Check if this file uses this resource
        if (usesResource(content, resource)) {
          const result = injectForResource(content, resource, { idField });
          if (result.modified) {
            content = result.content;
            modified = true;
          }
        }
      }

      if (modified) {
        fs.writeFileSync(fullPath, content, 'utf8');
        injectedFiles.push(file);
      }
    } catch (error) {
      // Ignore errors
    }
  }

  return injectedFiles;
}

function getFrontendFiles(projectPath) {
  const patterns = [
    'src/**/*.{js,jsx,ts,tsx}',
    'src/pages/**/*.{js,jsx,ts,tsx}',
    'src/components/**/*.{js,jsx,ts,tsx}',
  ];

  const files = new Set();
  for (const pattern of patterns) {
    const found = globSync(pattern, { nodir: true, cwd: projectPath });
    for (const file of found) {
      files.add(file);
    }
  }

  return [...files];
}

/**
 * Check if file uses a resource
 */
function usesResource(content, resource) {
  const varName = resource.name;
  const setterName = `set${capitalize(varName)}`;
  const statePattern = new RegExp(`\\[\\s*${varName}\\s*,\\s*${setterName}\\s*\\]\\s*=\\s*useState\\(`, 'g');
  if (statePattern.test(content)) return true;

  const staticArrayPattern = new RegExp(`const\\s+${varName}\\s*=\\s*\\[[\\s\\S]*?\\]\\s*;?`, 'g');
  if (staticArrayPattern.test(content)) return true;

  const mapPattern = new RegExp(`${varName}\\.map\\s*\\(`, 'g');
  if (mapPattern.test(content)) return true;

  return false;
}

/**
 * Inject API calls for a specific resource
 */
function injectForResource(content, resource, options = {}) {
  let modified = false;
  let nextContent = content;

  const resourceName = resource.name;
  const singular = resource.singular || resourceName.slice(0, -1);
  const capitalSingular = capitalize(singular);
  const capitalResource = capitalize(resourceName);

  const hasStaticArray = new RegExp(`const\\s+${resourceName}\\s*=\\s*\\[[\\s\\S]*?\\]\\s*;?`).test(nextContent);
  const hasApiImplementation = hasResourceApiCalls(nextContent, resourceName);
  if (hasApiImplementation && !hasStaticArray && options.force !== true) {
    return { content: nextContent, modified: false };
  }

  const importResult = ensureReactHooksImport(nextContent, ['useEffect', 'useState']);
  nextContent = importResult.content;
  modified = modified || importResult.changed;

  const staticToStateResult = convertStaticArrayToState(nextContent, resourceName, capitalResource);
  nextContent = staticToStateResult.content;
  modified = modified || staticToStateResult.changed;

  const apiUrlResult = ensureApiUrlConstant(nextContent);
  nextContent = apiUrlResult.content;
  modified = modified || apiUrlResult.changed;

  const stateInitResult = normalizeStateArray(nextContent, resourceName, capitalResource);
  nextContent = stateInitResult.content;
  modified = modified || stateInitResult.changed;

  const fetchFunctionName = `fetch${capitalResource}`;

  const fetchFnResult = ensureFetchFunction(nextContent, resourceName, capitalResource, fetchFunctionName);
  nextContent = fetchFnResult.content;
  modified = modified || fetchFnResult.changed;

  const effectResult = ensureFetchEffect(nextContent, fetchFunctionName, resourceName, capitalResource);
  nextContent = effectResult.content;
  modified = modified || effectResult.changed;

  const createResult = replaceCreateHandler(nextContent, {
    resourceName,
    singular,
    capitalSingular,
    fetchFunctionName,
  });
  nextContent = createResult.content;
  modified = modified || createResult.changed;

  const deleteResult = replaceDeleteHandler(nextContent, {
    resourceName,
    singular,
    capitalSingular,
    fetchFunctionName,
  });
  nextContent = deleteResult.content;
  modified = modified || deleteResult.changed;

  const jsxResult = ensureIdsInJsx(nextContent, capitalSingular, options.idField || '_id');
  nextContent = jsxResult.content;
  modified = modified || jsxResult.changed;

  return { content: nextContent, modified };
}

function ensureReactHooksImport(content, requiredHooks = []) {
  if (!requiredHooks.length) {
    return { content, changed: false };
  }

  const missing = requiredHooks.filter((hook) => !new RegExp(`\\b${hook}\\b`).test(content));
  if (missing.length === 0) {
    return { content, changed: false };
  }

  const reactNamedImport = /import\s+\{([^}]*)\}\s+from\s+['"]react['"];?/;
  if (reactNamedImport.test(content)) {
    const next = content.replace(reactNamedImport, (_, names) => {
      const cleaned = names
        .split(',')
        .map(name => name.trim())
        .filter(Boolean);

      for (const hook of requiredHooks) {
        if (!cleaned.includes(hook)) {
          cleaned.push(hook);
        }
      }

      return `import { ${cleaned.join(', ')} } from 'react';`;
    });
    return { content: next, changed: next !== content };
  }

  const reactDefaultImport = /import\s+([A-Za-z_$][\w$]*)\s+from\s+['"]react['"];?/;
  if (reactDefaultImport.test(content)) {
    const next = content.replace(reactDefaultImport, (_, defaultName) => {
      return `import ${defaultName}, { ${requiredHooks.join(', ')} } from 'react';`;
    });
    return { content: next, changed: next !== content };
  }

  return { content, changed: false };
}

function convertStaticArrayToState(content, resourceName, capitalResource) {
  const stateRegex = new RegExp(`const\\s+\\[\\s*${resourceName}\\s*,\\s*set${capitalResource}\\s*\\]\\s*=\\s*useState\\(`);
  if (stateRegex.test(content)) {
    return { content, changed: false };
  }

  const staticRegex = new RegExp(`const\\s+${resourceName}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*;?`);
  const staticMatch = content.match(staticRegex);
  if (!staticMatch) {
    return { content, changed: false };
  }

  const replacement = `const [${resourceName}, set${capitalResource}] = useState([]);`;
  const matchIndex = staticMatch.index ?? -1;

  const componentStart = findPrimaryComponentStart(content);
  if (componentStart !== -1 && matchIndex !== -1 && matchIndex < componentStart) {
    // Remove top-level static data and declare hook state inside component scope.
    const withoutStatic = content.replace(staticRegex, '');
    const componentStartAfterRemoval = findPrimaryComponentStart(withoutStatic);
    const insertPos = findFirstLineBreakAfterBrace(withoutStatic, componentStartAfterRemoval);
    if (insertPos !== -1) {
      const indentedReplacement = `\n  ${replacement}`;
      const next = `${withoutStatic.slice(0, insertPos)}${indentedReplacement}${withoutStatic.slice(insertPos)}`;
      return { content: next, changed: next !== content };
    }
  }

  // If static array is already inside a component/function scope, replace in-place.
  const next = content.replace(staticRegex, replacement);
  return { content: next, changed: next !== content };
}

function ensureApiUrlConstant(content) {
  if (/\b(API_URL|API_BASE_URL|BACKEND_URL)\b/.test(content)) {
    return { content, changed: false };
  }

  const importMatches = [...content.matchAll(/^import.*$/gm)];
  if (importMatches.length === 0) {
    return { content, changed: false };
  }

  const lastImport = importMatches[importMatches.length - 1];
  const insertPos = lastImport.index + lastImport[0].length;
  const next = `${content.slice(0, insertPos)}\n\nconst API_BASE_URL =\n+  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) ||\n+  (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_URL) ||\n+  'http://localhost:5000';\n+const API_URL = \`${'${API_BASE_URL}'}/api\`;${content.slice(insertPos)}`;
  return { content: next, changed: true };
}

function normalizeStateArray(content, resourceName, capitalResource) {
  const stateRegex = new RegExp(`(const\\s+\\[\\s*${resourceName}\\s*,\\s*set${capitalResource}\\s*\\]\\s*=\\s*useState\\()([\\s\\S]*?)(\\)\\s*;?)`);
  const match = content.match(stateRegex);
  if (!match) return { content, changed: false };

  const currentValue = match[2].trim();
  if (currentValue === '[]') return { content, changed: false };

  const next = content.replace(stateRegex, `$1[]$3`);
  return { content: next, changed: next !== content };
}

function ensureFetchFunction(content, resourceName, capitalResource, fetchFunctionName) {
  if (new RegExp(`const\\s+${fetchFunctionName}\\s*=\\s*async`).test(content)) {
    return { content, changed: false };
  }

  const stateRegex = new RegExp(`const\\s+\\[\\s*${resourceName}\\s*,\\s*set${capitalResource}\\s*\\]\\s*=\\s*useState\\([^)]*\\)\\s*;?`);
  const stateMatch = content.match(stateRegex);
  if (!stateMatch) {
    return { content, changed: false };
  }

  const insertPos = content.indexOf(stateMatch[0]) + stateMatch[0].length;
  const snippet = `\n\n  const ${fetchFunctionName} = async () => {\n    try {\n      const res = await fetch(\`\${API_URL}/${resourceName}\`);\n      if (!res.ok) {\n        throw new Error(\`Failed to fetch ${resourceName}: \${res.status}\`);\n      }\n      const payload = await res.json();\n      const list = Array.isArray(payload)\n        ? payload\n        : payload.data || payload.items || payload.results || [];\n      set${capitalResource}(Array.isArray(list) ? list : []);\n    } catch (error) {\n      console.error('Error fetching ${resourceName}:', error);\n    }\n  };`;

  const next = `${content.slice(0, insertPos)}${snippet}${content.slice(insertPos)}`;
  return { content: next, changed: true };
}

function ensureFetchEffect(content, fetchFunctionName, resourceName, capitalResource) {
  const effectRegex = new RegExp(`useEffect\\(\\(\\)\\s*=>\\s*\\{\\s*${fetchFunctionName}\\(\\);?\\s*\\},\\s*\\[\\s*\\]\\s*\\);?`, 'm');
  if (effectRegex.test(content)) {
    return { content, changed: false };
  }

  const fetchFnRegex = new RegExp(`const\\s+${fetchFunctionName}\\s*=\\s*async[\\s\\S]*?\\n\\s*};`);
  const fetchMatch = content.match(fetchFnRegex);

  const effectSnippet = `\n\n  useEffect(() => {\n    ${fetchFunctionName}();\n  }, []);`;

  if (fetchMatch) {
    const insertPos = content.indexOf(fetchMatch[0]) + fetchMatch[0].length;
    const next = `${content.slice(0, insertPos)}${effectSnippet}${content.slice(insertPos)}`;
    return { content: next, changed: true };
  }

  const stateRegex = new RegExp(`const\\s+\\[\\s*${resourceName}\\s*,\\s*set${capitalResource}\\s*\\]\\s*=\\s*useState\\([^)]*\\)\\s*;?`);
  const stateMatch = content.match(stateRegex);
  if (!stateMatch) {
    return { content, changed: false };
  }

  const insertPos = content.indexOf(stateMatch[0]) + stateMatch[0].length;
  const next = `${content.slice(0, insertPos)}${effectSnippet}${content.slice(insertPos)}`;
  return { content: next, changed: true };
}

function replaceCreateHandler(content, ctx) {
  const { resourceName, singular, capitalSingular, fetchFunctionName } = ctx;
  const functionName = `handle${capitalSingular}Submit`;
  const block = findConstArrowFunction(content, functionName);
  if (!block) {
    return { content, changed: false };
  }

  const currentBlock = content.slice(block.start, block.end);
  if (/method:\s*['"]POST['"]/.test(currentBlock)) {
    return { content, changed: false };
  }

  const newStateName = `new${capitalSingular}`;
  const setNewStateName = `setNew${capitalSingular}`;
  const initialStateLiteral = extractInitialStateLiteral(content, newStateName, setNewStateName) || '{}';
  const nonEmptyGuard = buildNonEmptyGuard(newStateName, initialStateLiteral);

  const replacement = `const ${functionName} = async (e) => {\n    e.preventDefault();\n    ${nonEmptyGuard}\n\n    try {\n      const res = await fetch(\`\${API_URL}/${resourceName}\`, {\n        method: 'POST',\n        headers: { 'Content-Type': 'application/json' },\n        body: JSON.stringify(${newStateName}),\n      });\n\n      if (res.ok) {\n        await ${fetchFunctionName}();\n        ${setNewStateName}(${initialStateLiteral});\n      } else {\n        console.error('Failed to add ${singular}:', res.status);\n      }\n    } catch (error) {\n      console.error('Error adding ${singular}:', error);\n    }\n  };\n\n`;

  const next = `${content.slice(0, block.start)}${replacement}${content.slice(block.end)}`;
  return { content: next, changed: true };
}

function replaceDeleteHandler(content, ctx) {
  const { resourceName, singular, capitalSingular, fetchFunctionName } = ctx;
  const functionName = `delete${capitalSingular}`;
  const block = findConstArrowFunction(content, functionName);
  if (!block) {
    return { content, changed: false };
  }

  const currentBlock = content.slice(block.start, block.end);
  if (/method:\s*['"]DELETE['"]/.test(currentBlock)) {
    return { content, changed: false };
  }

  const replacement = `const ${functionName} = async (id) => {\n    try {\n      const res = await fetch(\`\${API_URL}/${resourceName}/\${id}\`, {\n        method: 'DELETE',\n      });\n\n      if (res.ok) {\n        await ${fetchFunctionName}();\n      } else {\n        console.error('Failed to delete ${singular}:', res.status);\n      }\n    } catch (error) {\n      console.error('Error deleting ${singular}:', error);\n    }\n  };\n\n`;

  const next = `${content.slice(0, block.start)}${replacement}${content.slice(block.end)}`;
  return { content: next, changed: true };
}

function ensureIdsInJsx(content, capitalSingular, idField = '_id') {
  let next = content;
  let changed = false;

  if (idField === '_id') {
    const keyReplaced = next.replace(/key=\{(\w+)\.id\}/g, 'key={$1._id}');
    if (keyReplaced !== next) {
      next = keyReplaced;
      changed = true;
    }

    const deleteCallPattern = new RegExp(`onClick=\\{\\(\\)\\s*=>\\s*delete${capitalSingular}\\((\\w+)\\.id\\)\\}`, 'g');
    const clickReplaced = next.replace(deleteCallPattern, `onClick={() => delete${capitalSingular}($1._id)}`);
    if (clickReplaced !== next) {
      next = clickReplaced;
      changed = true;
    }
  } else {
    const keyReplaced = next.replace(/key=\{(\w+)\._id\}/g, 'key={$1.id}');
    if (keyReplaced !== next) {
      next = keyReplaced;
      changed = true;
    }

    const deleteCallPattern = new RegExp(`onClick=\\{\\(\\)\\s*=>\\s*delete${capitalSingular}\\((\\w+)\\._id\\)\\}`, 'g');
    const clickReplaced = next.replace(deleteCallPattern, `onClick={() => delete${capitalSingular}($1.id)}`);
    if (clickReplaced !== next) {
      next = clickReplaced;
      changed = true;
    }
  }

  return { content: next, changed };
}

function extractInitialStateLiteral(content, stateName, setterName) {
  const regex = new RegExp(`const\\s+\\[\\s*${stateName}\\s*,\\s*${setterName}\\s*\\]\\s*=\\s*(?:React\\.)?useState\\((\\{[\\s\\S]*?\\})\\)`);
  const match = content.match(regex);
  return match ? match[1] : null;
}

function buildNonEmptyGuard(stateName, objectLiteral) {
  const keys = [...objectLiteral.matchAll(/([A-Za-z_][A-Za-z0-9_]*)\s*:/g)].map(m => m[1]);
  if (keys.length === 0) {
    return `if (!${stateName}) return;`;
  }

  const checks = keys.map(key => `!${stateName}.${key}`).join(' || ');
  return `if (${checks}) return;`;
}

function findConstArrowFunction(content, functionName) {
  const startRegex = new RegExp(`const\\s+${functionName}\\s*=\\s*(?:async\\s*)?\\([^)]*\\)\\s*=>\\s*\\{`);
  const startMatch = startRegex.exec(content);
  if (!startMatch) return null;

  const braceStart = content.indexOf('{', startMatch.index);
  if (braceStart === -1) return null;

  let depth = 0;
  let end = -1;
  for (let i = braceStart; i < content.length; i++) {
    const char = content[i];
    if (char === '{') depth++;
    if (char === '}') {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }

  if (end === -1) return null;

  while (end < content.length && /[;\s]/.test(content[end])) {
    end++;
  }

  return { start: startMatch.index, end };
}

function findPrimaryComponentStart(content) {
  const functionComponentMatch = /function\s+[A-Z][A-Za-z0-9_$]*\s*\([^)]*\)\s*\{/.exec(content);
  if (functionComponentMatch) {
    return functionComponentMatch.index;
  }

  const arrowComponentMatch = /const\s+[A-Z][A-Za-z0-9_$]*\s*=\s*(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>\s*\{/.exec(content);
  if (arrowComponentMatch) {
    return arrowComponentMatch.index;
  }

  return -1;
}

function findFirstLineBreakAfterBrace(content, startIndex) {
  const braceIndex = content.indexOf('{', startIndex);
  if (braceIndex === -1) return -1;

  const lineBreakIndex = content.indexOf('\n', braceIndex);
  if (lineBreakIndex === -1) return -1;

  return lineBreakIndex + 1;
}

function hasResourceApiCalls(content, resourceName) {
  const escaped = escapeRegExp(resourceName);
  const quotedOrTemplatePath = '(["\'])[^\\n]*?\\/api\\/' + escaped + '[^\\n]*?\\1|`[^`]*?\\/api\\/' + escaped + '[^`]*?`';
  const fetchPattern = new RegExp('fetch\\s*\\(\\s*(?:' + quotedOrTemplatePath + ')', 'i');
  const axiosPattern = new RegExp('axios\\.(get|post|put|patch|delete)\\s*\\(\\s*(?:' + quotedOrTemplatePath + ')', 'i');
  return fetchPattern.test(content) || axiosPattern.test(content);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Capitalize string
 */
function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export default { injectApiCalls };
