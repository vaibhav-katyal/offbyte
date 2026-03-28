import { createField, createIR, createResource } from './IRTypes.js';

function singularize(name) {
  return name.toLowerCase().replace(/ies$/, 'y').replace(/s$/, '');
}

function extractResourceFromRoute(route) {
  if (!route) return null;
  const cleaned = route.split('?')[0];
  const match = cleaned.match(/\/api\/(?:v\d+\/)?([^/]+)/i);
  if (match?.[1]) return singularize(match[1]);

  const fallback = cleaned.replace(/^\/+/, '').split('/')[0];
  return fallback ? singularize(fallback) : null;
}

function normalizeRoute(route = '') {
  return route.split('?')[0].trim().replace(/\/+$/, '').toLowerCase();
}

function isHealthProbeCall(call, resourceName) {
  if (resourceName !== 'health') return false;

  const method = (call.method || 'GET').toUpperCase();
  if (method !== 'GET') return false;

  const route = normalizeRoute(call.route || '');
  return route === '/health' || route === `/api/health`;
}

export function buildIRFromDetections(apiCalls = [], forms = []) {
  const resourcesMap = new Map();

  for (const call of apiCalls) {
    const resourceName = extractResourceFromRoute(call.route);
    if (!resourceName || resourceName === 'api') continue;
    if (isHealthProbeCall(call, resourceName)) continue;

    if (!resourcesMap.has(resourceName)) {
      resourcesMap.set(resourceName, {
        name: resourceName,
        path: `/${resourceName}s`,
        methodSet: new Set(),
        fieldSet: new Set()
      });
    }

    const resource = resourcesMap.get(resourceName);
    resource.methodSet.add((call.method || 'GET').toUpperCase());

    for (const field of call.fields || []) {
      if (field) resource.fieldSet.add(field);
    }
  }

  for (const form of forms) {
    for (const field of form.fields || []) {
      if (!field) continue;
      for (const resource of resourcesMap.values()) {
        resource.fieldSet.add(field);
      }
    }
  }

  const resources = Array.from(resourcesMap.values()).map((resource) => {
    const fields = Array.from(resource.fieldSet).map((fieldName) => createField(fieldName));
    return createResource({
      name: resource.name,
      path: resource.path,
      fields,
      methods: Array.from(resource.methodSet)
    });
  });

  return createIR({
    resources,
    relations: [],
    auth: { enabled: false },
    database: 'mongodb'
  });
}

export default buildIRFromDetections;
