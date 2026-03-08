/**
 * API Scanner - Detects backend routes from route files
 */

import fs from 'fs';
import path from 'path';
import { globSync } from 'glob';

/**
 * Scan backend routes from route files
 */
export async function scanBackendRoutes(backendPath) {
  const routes = [];
  const seen = new Set();
  
  // Find all route files
  const routeFiles = globSync('routes/**/*.js', { 
    cwd: backendPath,
    absolute: true
  });

  for (const file of routeFiles) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      const detectedRoutes = extractRoutesFromFile(content, file);
      for (const route of detectedRoutes) {
        const key = `${route.method}:${route.path}`;
        if (!seen.has(key)) {
          seen.add(key);
          routes.push(route);
        }
      }
    } catch (error) {
      // Ignore file read errors
    }
  }

  return routes;
}

/**
 * Extract routes from a route file
 */
function extractRoutesFromFile(content, filePath) {
  const routes = [];
  const fileName = path.basename(filePath, '.js');
  
  // Detect base resource from filename (e.g., auth.routes.js -> auth)
  const resourceName = fileName.replace('.routes', '');
  
  // Regex patterns to detect Express routes
  const routePatterns = [
    /router\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/gi,
    /app\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/gi
  ];

  for (const pattern of routePatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const method = match[1].toUpperCase();
      const routePath = buildApiRoutePath(resourceName, match[2]);

      routes.push({
        method,
        path: routePath,
        file: path.basename(filePath)
      });
    }
  }

  return routes;
}

function buildApiRoutePath(resourceName, routePath) {
  const normalizedRoute = normalizePath(routePath);
  const basePath = normalizePath(`/api/${resourceName}`);

  if (normalizedRoute === '/') return basePath;
  return normalizePath(`${basePath}${normalizedRoute}`);
}

function normalizePath(routePath) {
  if (!routePath) return '/';

  let normalized = String(routePath)
    .trim()
    .replace(/\/+/g, '/');

  if (!normalized.startsWith('/')) normalized = `/${normalized}`;
  if (normalized.length > 1) normalized = normalized.replace(/\/+$/g, '');

  return normalized;
}

export default { scanBackendRoutes };
