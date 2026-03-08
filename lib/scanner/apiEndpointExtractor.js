/**
 * API Endpoint Extractor - Enhanced Version
 * Properly handles complex routes, nested actions, and query parameters
 * Groups endpoints by actual resources (not nested actions)
 */

export function extractAllApiEndpoints(content, detectedApiCalls = []) {
  const resources = {};

  for (const call of detectedApiCalls) {
    let endpoint, method, hasAuth = false, queryParams = [];
    
    if (typeof call === 'object' && call.route) {
      endpoint = call.route.startsWith('/') ? call.route : '/' + call.route;
      method = call.method || 'GET';
      hasAuth = true; // Assume protected by default
      queryParams = call.queryParams || [];
    } else if (typeof call === 'string') {
      endpoint = extractEndpoint(call);
      method = extractMethod(call);
      hasAuth = requiresAuth(call);
    } else {
      continue;
    }

    if (!endpoint) continue;
    if (isSystemEndpoint(endpoint)) continue;

    // Smart resource extraction (ignores nested actions)
    const resource = extractResourceSmart(endpoint);
    const action = extractActionFromEndpoint(endpoint);
    const hasParam = hasParameter(endpoint);

    if (!resources[resource]) {
      resources[resource] = {
        name: resource,
        endpoints: [],
        methods: new Set(),
        hasAuth: false,
        fields: new Set(),
        actions: new Set(),
        queryParams: new Set()
      };
    }

    // Add action if it's a nested action
    if (action) {
      resources[resource].actions.add(action);
    }

    resources[resource].endpoints.push({
      path: endpoint,
      method: method,
      requiresAuth: hasAuth,
      hasParam: hasParam,
      action: action,
      queryParams: queryParams
    });

    resources[resource].methods.add(method);
    if (hasAuth) resources[resource].hasAuth = true;

    // Add query params to resource
    queryParams.forEach(p => resources[resource].queryParams.add(p));

    // Extract field names
    let fields = [];
    const callContent = (typeof call === 'object' && call.content) ? call.content : '';
    
    if (typeof call === 'object' && call.fields) {
      fields = Array.isArray(call.fields) ? call.fields : Object.keys(call.fields || {});
    } else if (typeof call === 'string') {
      fields = extractFieldNames(endpoint, call, content);
    } else if (typeof call === 'object') {
      // Extract from the full file content
      fields = extractFieldNames(endpoint, JSON.stringify(call), callContent || content);
    }
    fields.forEach(f => resources[resource].fields.add(f));
  }

  // Convert Sets to Arrays and enrich with defaults
  const result = {};
  for (const [key, resource] of Object.entries(resources)) {
    const methods = Array.from(resource.methods);
    const fields = Array.from(resource.fields);
    
    // Add default fields if none detected
    const allFields = fields.length > 0 
      ? fields 
      : getDefaultFieldsForResource(resource.name);

    result[key] = {
      name: resource.name,
      endpoints: resource.endpoints,
      methods: methods,
      hasAuth: resource.hasAuth,
      fields: allFields,
      actions: Array.from(resource.actions),
      queryParams: Array.from(resource.queryParams),
      isCrudResource: detectCrudOperations(methods),
      isComplexResource: resource.actions.size > 0 || resource.queryParams.size > 0
    };
  }

  return result;
}

function isSystemEndpoint(endpoint) {
  const normalized = endpoint
    .split('?')[0]
    .trim()
    .replace(/\/+$/, '')
    .toLowerCase();

  return normalized === '/health' ||
    normalized === `/api/health` ||
    normalized === `/api/status` ||
    normalized === `/api`;
}

/**
 * Smart resource extraction - ignores nested actions
 * Examples:
 * - /api/products → products
 * - /api/products/:id → products
 * - /api/products/:id/reviews → products (NOT a separate resource!)
 * - /api/reviews/:id/approve → reviews (approve is an action)
 * - /api/orders/:id/cancel → orders (cancel is an action)
 * - /api/cart/clear → cart (clear is an action)
 */
function extractResourceSmart(endpoint) {
  // Remove /api prefix
  let path = endpoint.replace(/^\/api\//, '');
  
  // Split into segments
  const segments = path.split('/').filter(s => s && s !== ':id');
  
  if (segments.length === 0) return 'api';
  
  // First segment is always the resource
  const resource = segments[0];
  
  // Common action keywords that should NOT be resources
  const actionKeywords = [
    'approve', 'reject', 'cancel', 'confirm', 'verify',
    'activate', 'deactivate', 'enable', 'disable',
    'clear', 'reset', 'refresh', 'sync',
    'search', 'filter', 'sort', 'export', 'import',
    'list', 'stats', 'analytics', 'dashboard'
  ];
  
  // If second segment is an action keyword, return first segment
  if (segments.length > 1 && actionKeywords.includes(segments[1].toLowerCase())) {
    return resource;
  }
  
  // If resource is an action keyword, it's likely being used as a resource name
  // (e.g., /api/approve) - check context
  if (actionKeywords.includes(resource.toLowerCase())) {
    // If there's a preceding resource, it's an action
    // Otherwise, treat as resource (might be miscategorized)
    return resource;
  }
  
  return resource;
}

/**
 * Extract action from endpoint
 * Examples:
 * - /api/reviews/:id/approve → approve
 * - /api/orders/:id/cancel → cancel
 * - /api/cart/clear → clear
 * - /api/products/search → search
 */
function extractActionFromEndpoint(endpoint) {
  const path = endpoint.replace(/^\/api\//, '');
  const segments = path.split('/').filter(s => s && s !== ':id');
  
  if (segments.length <= 1) return null;
  
  // Last segment is likely the action (if not :id)
  const lastSegment = segments[segments.length - 1];
  
  const actionKeywords = [
    'approve', 'reject', 'cancel', 'confirm', 'verify',
    'activate', 'deactivate', 'enable', 'disable',
    'clear', 'reset', 'refresh', 'sync',
    'search', 'filter', 'sort', 'export', 'import',
    'stats', 'analytics', 'dashboard', 'count'
  ];
  
  if (actionKeywords.includes(lastSegment.toLowerCase())) {
    return lastSegment;
  }
  
  return null;
}

/**
 * Extract HTTP method from API call
 */
function extractMethod(call) {
  if (typeof call !== 'string') return 'GET';
  
  if (call.includes("method: 'POST'") || call.includes('method: "POST"') || call.includes('.post(')) {
    return 'POST';
  }
  if (call.includes("method: 'PUT'") || call.includes('method: "PUT"') || call.includes('.put(')) {
    return 'PUT';
  }
  if (call.includes("method: 'DELETE'") || call.includes('method: "DELETE"') || call.includes('.delete(')) {
    return 'DELETE';
  }
  if (call.includes("method: 'GET'") || call.includes('method: "GET"') || call.includes('.get(')) {
    return 'GET';
  }
  if (call.includes('body:')) {
    return 'POST'; // Default POST if body present
  }
  return 'GET'; // Default GET
}

/**
 * Check if route requires authentication
 */
function requiresAuth(call) {
  if (typeof call !== 'string') return false;
  
  const authIndicators = [
    'Authorization',
    'Bearer',
    'token',
    'jwt',
    'headers:'
  ];
  return authIndicators.some(indicator => call.toLowerCase().includes(indicator.toLowerCase()));
}

/**
 * Check if endpoint has parameters
 */
function hasParameter(endpoint) {
  return endpoint.includes(':id') || endpoint.includes('${') || /\/\d+$/.test(endpoint);
}

/**
 * Extract potential field names from endpoint and context
 */
function extractFieldNames(endpoint, call, fullContent) {
  const fields = new Set();
  
  // Extract from JSON.stringify patterns
  if (typeof call === 'string') {
    const jsonPattern = /JSON\.stringify\(\s*\{([^}]+)\}/g;
    let match;
    while ((match = jsonPattern.exec(call)) !== null) {
      const jsonContent = match[1];
      const fields_in_json = jsonContent.match(/(\w+)\s*[,:]/g);
      if (fields_in_json) {
        fields_in_json.forEach(f => {
          fields.add(f.replace(/[,:]/g, '').trim());
        });
      }
    }
  }

  // Look for form input names in full content
  if (fullContent && typeof fullContent === 'string') {
    // Pattern 1: <input name="fieldName"
    const inputPattern = /<input[^>]*name=['"`](\w+)['"`]/g;
    let match;
    while ((match = inputPattern.exec(fullContent)) !== null) {
      fields.add(match[1]);
    }
    
    // Pattern 2: formData.append('fieldName'
    const formDataPattern = /formData\.append\s*\(\s*['"`](\w+)['"`]/g;
    while ((match = formDataPattern.exec(fullContent)) !== null) {
      fields.add(match[1]);
    }
    
    // Pattern 3: useState for field names
    const statePattern = /const\s*\[(\w+),\s*set\w+\]\s*=\s*useState/g;
    while ((match = statePattern.exec(fullContent)) !== null) {
      const stateName = match[1];
      // Only add if looks like a field (not loading, error, etc.)
      if (!['loading', 'error', 'data', 'response', 'success'].includes(stateName)) {
        fields.add(stateName);
      }
    }
    
    // Pattern 4: Object shorthand in body ({ name, email, price })
    const bodyPattern = /body\s*:\s*JSON\.stringify\s*\(\s*\{([^}]+)\}\s*\)/g;
    while ((match = bodyPattern.exec(fullContent)) !== null) {
      const bodyContent = match[1];
      const fieldMatches = bodyContent.match(/(\w+)\s*[,:}]/g);
      if (fieldMatches) {
        fieldMatches.forEach(f => {
          const fieldName = f.replace(/[,:}]/g, '').trim();
          if (fieldName && fieldName !== 'headers') {
            fields.add(fieldName);
          }
        });
      }
    }
  }

  return Array.from(fields);
}

/**
 * Detect if resource has CRUD operations based on methods
 */
function detectCrudOperations(methods) {
  // Convert Set to Array if needed
  const methodsArray = Array.isArray(methods) ? methods : Array.from(methods);
  
  const has_get = methodsArray.includes('GET');
  const has_post = methodsArray.includes('POST');
  const has_put = methodsArray.includes('PUT');
  const has_delete = methodsArray.includes('DELETE');

  return {
    create: has_post,
    read: has_get,
    update: has_put,
    delete: has_delete
  };
}

/**
 * Get default fields for a resource based on name
 */
export function getDefaultFieldsForResource(resourceName) {
  const fieldsMap = {
    products: ['name', 'description', 'price', 'category', 'stock'],
    posts: ['title', 'content', 'author', 'views', 'likes'],
    comments: ['text', 'author', 'postId', 'likes'],
    users: ['name', 'email', 'phone', 'avatar'],
    orders: ['orderNumber', 'items', 'total', 'status', 'shippingAddress'],
    categories: ['name', 'description', 'icon'],
    tags: ['name', 'description'],
    reviews: ['rating', 'text', 'author', 'productId'],
    articles: ['title', 'content', 'author', 'tags', 'published'],
    todos: ['title', 'completed', 'priority', 'dueDate'],
  };

  return fieldsMap[resourceName.toLowerCase()] || ['name', 'description'];
}

/**
 * Group endpoints by operation type
 */
export function groupEndpointsByOperation(resources) {
  const grouped = {
    create: [],
    read: [],
    update: [],
    delete: [],
    list: [],
    other: []
  };

  for (const [resourceName, resource] of Object.entries(resources)) {
    for (const endpoint of resource.endpoints) {
      const path = endpoint.path.toLowerCase();
      const method = endpoint.method;

      if (method === 'POST' && (path.includes('create') || path.includes('add'))) {
        grouped.create.push({ resource: resourceName, ...endpoint });
      } else if (method === 'GET' && (path.includes('list') || path.endsWith(`/api/${resourceName}`))) {
        grouped.list.push({ resource: resourceName, ...endpoint });
      } else if (method === 'GET' && path.includes(':id')) {
        grouped.read.push({ resource: resourceName, ...endpoint });
      } else if (method === 'PUT' || method === 'PATCH') {
        grouped.update.push({ resource: resourceName, ...endpoint });
      } else if (method === 'DELETE') {
        grouped.delete.push({ resource: resourceName, ...endpoint });
      } else {
        grouped.other.push({ resource: resourceName, ...endpoint });
      }
    }
  }

  return grouped;
}
