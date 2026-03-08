import fs from 'fs';
import path from 'path';
import { globSync } from 'glob';
import ora from 'ora';
import { scanProject } from '../../core/scanner/scanProject.js';
import { parseJS } from '../../core/parser/parseJS.js';
import { parseTS } from '../../core/parser/parseTS.js';
import { detectFetch } from '../../core/detector/detectFetch.js';
import { detectAxios } from '../../core/detector/detectAxios.js';
import { detectForms } from '../../core/detector/detectForms.js';
import { detectSocket } from '../../core/detector/detectSocket.js';
import { buildIRFromDetections } from '../../core/ir/buildIR.js';
import { applyRuleEngine } from '../../core/rules/resourceRules.js';

/**
 * Frontend Code Scanner - Enhanced Version
 * Detects ALL API calls including:
 * - Direct fetch/axios calls
 * - Variable-based URLs
 * - Template literals
 * - Query parameters
 * - Nested routing
 */

export function scanFrontendCode(projectPath) {
  const spinner = ora('🔍 Scanning frontend code...').start();

  try {
    const astResult = runAstDetection(projectPath);

    // Regex fallback scan (legacy compatibility)
    const patterns = [
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

    const files = [];
    for (const pattern of patterns) {
      files.push(...globSync(pattern, { nodir: true, cwd: projectPath }));
    }

    const apiCalls = [...astResult.apiCalls];
    const urlVariables = new Map();

    for (const file of files) {
      try {
        const fullPath = path.join(projectPath, file);
        const content = fs.readFileSync(fullPath, 'utf8');

        extractUrlVariables(content, urlVariables);
        apiCalls.push(...extractDirectApiCalls(content, file, content));
        apiCalls.push(...extractVariableBasedCalls(content, file, urlVariables, content));
        apiCalls.push(...extractQueryParamCalls(content, file, content));
      } catch {
        // Skip files that can't be read
      }
    }

    const uniqueCalls = deduplicateApiCalls(apiCalls);

    spinner.succeed(`✅ Found ${uniqueCalls.length} API calls`);
    return uniqueCalls;
  } catch (error) {
    spinner.fail('Failed to scan code');
    throw error;
  }
}

function extractInlineScripts(htmlContent) {
  const scripts = [];
  const scriptPattern = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = scriptPattern.exec(htmlContent)) !== null) {
    const scriptCode = match[1]?.trim();
    if (scriptCode) scripts.push(scriptCode);
  }

  return scripts;
}

function runAstDetection(projectPath) {
  const apiCalls = [];
  const forms = [];
  const socketDetections = [];

  let files = [];
  try {
    files = scanProject(projectPath);
  } catch {
    return { apiCalls, forms, socketDetections };
  }

  for (const file of files) {
    const parsedTargets = [];

    if (file.language === 'html') {
      const scripts = extractInlineScripts(file.content);
      for (const script of scripts) {
        const ast = parseJS(script, file.relativePath);
        if (ast) parsedTargets.push({ ast, content: script });
      }
    } else if (file.language === 'js') {
      const ast = parseJS(file.content, file.relativePath);
      if (ast) parsedTargets.push({ ast, content: file.content });
    } else if (file.language === 'ts') {
      const ast = parseTS(file.content, file.relativePath);
      if (ast) parsedTargets.push({ ast, content: file.content });
    }

    for (const { ast, content } of parsedTargets) {
      apiCalls.push(...detectFetch(ast, file.relativePath));
      apiCalls.push(...detectAxios(ast, file.relativePath));
      forms.push(...detectForms(ast, file.relativePath));
      
      // Detect Socket.io / WebSocket patterns
      const socketDetection = detectSocket(ast, content);
      if (socketDetection.hasSocket || socketDetection.hasChat) {
        socketDetections.push({
          file: file.relativePath,
          ...socketDetection
        });
      }
    }
  }
  
  return { apiCalls, forms, socketDetections };
}

export async function buildHybridIR(projectPath) {
  const { apiCalls, forms, socketDetections } = runAstDetection(projectPath);
  const regexCalls = scanFrontendCode(projectPath);
  const merged = deduplicateApiCalls([...apiCalls, ...regexCalls]);

  const rawIR = buildIRFromDetections(merged, forms);
  const ir = applyRuleEngine(rawIR);
  
  // Add socket detection to IR
  ir.socketDetection = mergeSocketDetections(socketDetections);
  
  return ir;
}

/**
 * Merge multiple socket detections into one
 */
function mergeSocketDetections(detections) {
  if (!detections || detections.length === 0) {
    return {
      hasSocket: false,
      hasChat: false,
      socketType: null,
      events: [],
      rooms: false,
      presence: false
    };
  }

  const merged = {
    hasSocket: false,
    hasChat: false,
    socketType: null,
    events: [],
    rooms: false,
    presence: false,
    endpoints: [],
    files: []
  };

  for (const detection of detections) {
    if (detection.hasSocket) merged.hasSocket = true;
    if (detection.hasChat) merged.hasChat = true;
    if (detection.socketType) merged.socketType = detection.socketType;
    if (detection.rooms) merged.rooms = true;
    if (detection.presence) merged.presence = true;
    
    if (detection.events) {
      merged.events.push(...detection.events);
    }
    
    if (detection.endpoints) {
      merged.endpoints.push(...detection.endpoints);
    }
    
    if (detection.file) {
      merged.files.push(detection.file);
    }
  }

  // Deduplicate events
  merged.events = Array.from(
    new Map(merged.events.map(e => [e.name, e])).values()
  );

  return merged;
}

/**
 * Extract URL variables: const url = `/api/products`;
 */
function extractUrlVariables(content, urlVariables) {
  // Pattern: const/let/var variableName = `/api/...`;
  const patterns = [
    /(const|let|var)\s+(\w+)\s*=\s*['"`]([^'"`]+)['"`]/g,
    /(\w+)\s*=\s*['"`](\/api[^'"`]+)['"`]/g,
    /(\w+)\s*=\s*`([^`]*\/api[^`]*)`/g
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const varName = match[2] || match[1];
      const url = match[3] || match[2];
      
      if (url && url.includes(`/api`)) {
        urlVariables.set(varName, url);
      }
    }
  }
}

/**
 * Extract direct API calls: fetch(`/api/products`)
 */
function extractDirectApiCalls(content, file, fileContent) {
  const calls = [];
  
  // Pattern 1: fetch with direct string
  const fetchPattern = /fetch\s*\(\s*['"`]([^'"`\n]+)['"`]\s*,?\s*(\{[^}]*\})?/g;
  let match;
  
  while ((match = fetchPattern.exec(content)) !== null) {
    const route = match[1];
    const config = match[2] || '';
    
    // Skip non-API calls
    if (!route.includes(`/api`) && !route.startsWith('/')) continue;
    
    // Extract method and fields
    const method = extractMethod(config, content, match.index) || 'GET';
    const fields = extractFields(config, content, match.index);
    
    calls.push({
      file,
      type: 'fetch',
      method,
      route: cleanRoute(route),
      fields,
      hasQueryParams: route.includes('?'),
      line: content.substring(0, match.index).split('\n').length,
      content: fileContent
    });
  }
  
  // Pattern 2: fetch with template literal
  const fetchTemplatePattern = /fetch\s*\(\s*`([^`]+)`\s*,?\s*(\{[^}]*\})?/g;
  
  while ((match = fetchTemplatePattern.exec(content)) !== null) {
    const route = match[1];
    const config = match[2] || '';
    
    // Skip if no API path found
    if (!route.includes(`/api`)) continue;
    
    const method = extractMethod(config, content, match.index) || 'GET';
    const fields = extractFields(config, content, match.index);
    
    calls.push({
      file,
      type: 'fetch',
      method,
      route: cleanRoute(route),
      fields,
      hasQueryParams: route.includes('?'),
      line: content.substring(0, match.index).split('\n').length,
      content: fileContent
    });
  }
  
  // Pattern 3: axios and custom instances (e.g. api, client, request)
  const axiosPattern = /\b(?:axios|api|client|http|request)\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`\n]+)['"`]\s*,?\s*(\{[^}]*\})?/g;
  
  while ((match = axiosPattern.exec(content)) !== null) {
    const method = match[1].toUpperCase();
    const route = match[2];
    const config = match[3] || '';
    
    if (!route.includes(`/api`) && !route.startsWith('/')) continue;
    
    const fields = extractFields(config, content, match.index);
    
    calls.push({
      file,
      type: 'axios',
      method,
      route: cleanRoute(route),
      fields,
      hasQueryParams: route.includes('?'),
      line: content.substring(0, match.index).split('\n').length,
      content: fileContent
    });
  }
  
  return calls;
}

/**
 * Extract variable-based calls: fetch(url)
 */
function extractVariableBasedCalls(content, file, urlVariables, fileContent) {
  const calls = [];
  
  // Pattern: fetch(variableName)
  const fetchVarPattern = /fetch\s*\(\s*(\w+)\s*,?\s*(\{[^}]*\})?/g;
  let match;
  
  while ((match = fetchVarPattern.exec(content)) !== null) {
    const varName = match[1];
    const config = match[2] || '';
    
    // Check if this variable maps to a URL
    let route = null;
    
    // Try to find URL from variable map
    if (urlVariables.has(varName)) {
      route = urlVariables.get(varName);
    } else {
      // Try to find in local scope (look backward in content)
      const beforeContext = content.substring(Math.max(0, match.index - 500), match.index);
      const assignPattern = new RegExp(`${varName}\\s*=\\s*['"\`]([^'"\`]+)['"\`]`);
      const assignMatch = beforeContext.match(assignPattern);
      
      if (assignMatch) {
        route = assignMatch[1];
      }
    }
    
    if (route && (route.includes(`/api`) || route.startsWith('/'))) {
      const method = extractMethod(config, content, match.index) || 'GET';
      const fields = extractFields(config, content, match.index);
      
      calls.push({
        file,
        type: 'fetch',
        method,
        route: cleanRoute(route),
        fields,
        hasQueryParams: route.includes('?'),
        line: content.substring(0, match.index).split('\n').length,
        content: fileContent
      });
    }
  }
  
  return calls;
}

/**
 * Extract calls with query parameters
 */
function extractQueryParamCalls(content, file, fileContent) {
  const calls = [];
  
  // Pattern: URLSearchParams usage
  const searchParamsPattern = /new URLSearchParams\(\)([^;]*params\.append[^;]*)+/g;
  let match;
  
  while ((match = searchParamsPattern.exec(content)) !== null) {
    const paramsBlock = match[0];
    
    // Extract param names
    const paramNames = [];
    const appendPattern = /params\.append\s*\(\s*['"`](\w+)['"`]/g;
    let paramMatch;
    
    while ((paramMatch = appendPattern.exec(paramsBlock)) !== null) {
      paramNames.push(paramMatch[1]);
    }
    
    // Try to find associated fetch call nearby
    const afterContext = content.substring(match.index, match.index + 300);
    const fetchMatch = afterContext.match(/fetch\s*\(\s*['"`]([^'"`]+)['"`]/);
    
    if (fetchMatch) {
      const route = fetchMatch[1];
      
      calls.push({
        file,
        type: 'fetch',
        method: 'GET',
        route: cleanRoute(route),
        fields: [],
        hasQueryParams: true,
        queryParams: paramNames,
        line: content.substring(0, match.index).split('\n').length,
        content: fileContent
      });
    }
  }
  
  return calls;
}

/**
 * Extract HTTP method from fetch config
 */
function extractMethod(config, fullContent, startIndex) {
  // Look in config object
  const methodMatch = config.match(/method\s*:\s*['"`]([A-Z]+)['"`]/i);
  if (methodMatch) return methodMatch[1].toUpperCase();
  
  // Look ahead in content
  const snippet = fullContent.substring(startIndex, startIndex + 300);
  const snippetMatch = snippet.match(/method\s*:\s*['"`]([A-Z]+)['"`]/i);
  if (snippetMatch) return snippetMatch[1].toUpperCase();
  
  // Check for body presence (implies POST)
  if (config.includes('body:') || snippet.includes('body:')) {
    return 'POST';
  }
  
  return 'GET';
}

/**
 * Extract fields from request body
 */
function extractFields(config, fullContent, startIndex) {
  const fields = [];
  
  // Pattern 1: body: JSON.stringify({ field1, field2 })
  const jsonStringifyPattern = /body\s*:\s*JSON\.stringify\s*\(\s*\{([^}]+)\}/;
  const jsonMatch = config.match(jsonStringifyPattern);
  
  if (jsonMatch) {
    const fieldsStr = jsonMatch[1];
    const fieldMatches = fieldsStr.match(/(\w+)\s*[,:]/g);
    if (fieldMatches) {
      fieldMatches.forEach(f => {
        fields.push(f.replace(/[,:]/g, '').trim());
      });
    }
  }
  
  // Pattern 2: Look ahead in content
  const snippet = fullContent.substring(startIndex, startIndex + 500);
  const snippetMatch = snippet.match(/body\s*:\s*JSON\.stringify\s*\(\s*\{([^}]+)\}/);
  
  if (snippetMatch) {
    const fieldsStr = snippetMatch[1];
    const fieldMatches = fieldsStr.match(/(\w+)\s*[,:]/g);
    if (fieldMatches) {
      fieldMatches.forEach(f => {
        const fieldName = f.replace(/[,:]/g, '').trim();
        if (!fields.includes(fieldName)) {
          fields.push(fieldName);
        }
      });
    }
  }
  
  // Pattern 3: body: JSON.stringify(variableName) - trace the variable
  const varPattern = /body\s*:\s*JSON\.stringify\s*\(\s*(\w+)\s*\)/;
  const varMatch = config.match(varPattern) || snippet.match(varPattern);
  
  if (varMatch) {
    const varName = varMatch[1];
    
    // Look backward in fullContent to find useState initialization
    const beforeContext = fullContent.substring(0, startIndex);
    
    // Pattern: const [formData, setFormData] = useState({ field1: '', field2: '' })
    const statePattern = new RegExp(`const\\s*\\[${varName},\\s*set\\w+\\]\\s*=\\s*useState\\s*\\(\\s*\\{([^}]+)\\}`, 'g');
    const stateMatch = statePattern.exec(beforeContext);
    
    if (stateMatch) {
      const stateFields = stateMatch[1];
      const stateFieldMatches = stateFields.match(/(\w+)\s*:/g);
      if (stateFieldMatches) {
        stateFieldMatches.forEach(f => {
          const fieldName = f.replace(':', '').trim();
          if (!fields.includes(fieldName)) {
            fields.push(fieldName);
          }
        });
      }
    }
  }
  
  return fields;
}

/**
 * Extract API path from a route that may contain URL variables
 * Examples: "${API_URL}/api/products" -> `/api/products`
 * "${BASE_URL}/api/users/${id}" -> `/api/users/:id`
 */
function extractApiPath(route) {
  // Try to extract /api/... path (stop at query params or template literal end)
  const apiMatch = route.match(/\/api\/[^\s?`'"()]*/);  
  if (apiMatch) {
    let apiPath = apiMatch[0];
    // Replace remaining ${...} with :id for parameterized routes
    apiPath = apiPath.replace(/\$\{[^}]+\}/g, ':id');
    return apiPath;
  }
  // If no /api/ found, return as-is (might be relative path)
  return route;
}

/**
 * Clean and normalize route paths
 */
function cleanRoute(route) {
  // First extract API path to remove URL prefixes like ${API_URL}
  let cleaned = extractApiPath(route);
  
  // Remove query parameters for base route
  cleaned = cleaned.split('?')[0];
  
  // Ensure leading slash
  if (!cleaned.startsWith('/')) {
    cleaned = '/' + cleaned;
  }
  
  return cleaned;
}

/**
 * Deduplicate API calls
 */
function deduplicateApiCalls(calls) {
  const seen = new Set();
  const unique = [];
  
  for (const call of calls) {
    const key = `${call.method}:${call.route}`;
    
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(call);
    } else {
      // Merge fields if same endpoint
      const existing = unique.find(c => c.method === call.method && c.route === call.route);
      if (existing && call.fields) {
        call.fields.forEach(f => {
          if (!existing.fields.includes(f)) {
            existing.fields.push(f);
          }
        });
      }
      
      // Merge query params
      if (call.queryParams && existing) {
        if (!existing.queryParams) existing.queryParams = [];
        call.queryParams.forEach(p => {
          if (!existing.queryParams.includes(p)) {
            existing.queryParams.push(p);
          }
        });
      }
    }
  }
  
  return unique;
}

/**
 * Smart Route Mapping
 * Maps detected API calls to CRUD operations
 */

export function generateRoutesFromAPICalls(apiCalls) {
  const routeMap = new Map();

  for (const call of apiCalls) {
    // Extract base resource from route (e.g., /auth/signup -> auth)
    const baseResource = getBaseResource(call.route);
    const key = baseResource;
    
    if (!routeMap.has(key)) {
      routeMap.set(key, {
        route: `/${baseResource}`,
        model: generateModelName(baseResource),
        operations: [],
        subRoutes: new Set()
      });
    }

    const routeInfo = routeMap.get(key);
    
    // Track sub-routes (e.g., /auth/signup, /auth/login)
    routeInfo.subRoutes.add(call.route);
    
    routeInfo.operations.push({
      method: call.method,
      route: call.route,
      fields: call.fields,
      description: getOperationDescription(call.method)
    });
  }

  return Array.from(routeMap.values());
}

function getBaseResource(route) {
  // /auth/signup -> auth
  // /users -> users
  // /api/products/:id -> products
  return route
    .replace(/^\/+/, '') // Remove leading slashes
    .split('/')[0] // Get first segment
    .replace(/[^\w]/g, ''); // Remove special chars
}

function generateModelName(route) {
  // auth -> Auth, users -> User, products -> Product
  const clean = route
    .replace(/^\//, '')
    .split('/')[0]
    .replace(/s$/, ''); // Remove trailing s
  
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function getOperationDescription(method) {
  const descriptions = {
    'GET': 'Fetch data',
    'POST': 'Create new',
    'PUT': 'Update data',
    'PATCH': 'Partial update',
    'DELETE': 'Remove data'
  };
  return descriptions[method] || method;
}
