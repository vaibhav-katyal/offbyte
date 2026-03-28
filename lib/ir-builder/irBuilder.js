/**
 * IR Builder - Converts Scanner Output to Intermediate Representation
 * Creates structured, language-agnostic description of backend
 */

import { buildFieldConfig, detectRelationship } from './rulesEngine.js';

/**
 * Build IR from scanner detected APIs
 * @param {Array} detectedApis - Output from scanner
 * @param {Object} options - Configuration options
 * @returns {Object} - Complete IR
 */
export function buildIR(detectedApis = [], options = {}) {
  const resources = [];
  const relationships = [];
  const globalSettings = {
    hasAuth: options.hasAuth || false,
    dbType: options.dbType || 'mongodb',
    apiVersion: options.apiVersion || 'v1',
    ...options
  };

  // Group APIs by resource
  const resourceMap = groupApisByResource(detectedApis);

  // PASS 1: Build basic resource info (names only)
  const resourceNames = [];
  for (const resourceName of Object.keys(resourceMap)) {
    const normalized = normalizeResourceName(resourceName);
    resourceNames.push({
      name: normalized,
      singular: singularize(resourceName),
      plural: pluralize(resourceName)
    });
  }

  // PASS 2: Build complete resource definitions with smart relationship detection
  for (const [resourceName, apis] of Object.entries(resourceMap)) {
    const resource = buildResourceIR(resourceName, apis, options, resourceNames);
    resources.push(resource);

    // Track relationships
    resource.fields.forEach(field => {
      if (field.relationship) {
        relationships.push({
          from: resource.name,
          to: field.relationship.ref,
          field: field.name,
          type: 'reference'
        });
      }
    });
  }

  return {
    version: '1.0',
    metadata: {
      createdAt: new Date().toISOString(),
      generator: 'offbyt-ir-builder'
    },
    settings: globalSettings,
    resources,
    relationships,
    hooks: generateHooks(resources)
  };
}

/**
 * Build single resource IR
 */
function buildResourceIR(resourceName, apis, options, resourceNames = []) {
  const methods = new Set(apis.map(api => api.method));
  
  // Infer fields from API documentation or use defaults
  // Pass resourceNames so relationship detection can work
  const fields = inferFieldsFromApis(apis, options, resourceNames);

  // Add audit fields if auth enabled
  if (options.hasAuth) {
    if (!fields.find(f => f.name === 'userId')) {
      fields.push({
        name: 'userId',
        type: 'ObjectId',
        ref: 'User',
        isRequired: true,
        relationship: { ref: 'User' }
      });
    }
  }

  return {
    name: normalizeResourceName(resourceName),
    singular: singularize(resourceName),
    plural: pluralize(resourceName),
    description: `${capitalizeFirst(resourceName)} resource`,
    fields,
    routes: Array.from(methods),
    endpoints: apis.map(api => ({
      method: api.method,
      path: api.path,
      action: inferAction(api)
    })),
    validations: generateValidations(fields),
    middleware: generateMiddleware(fields, options),
    timestamps: true
  };
}

/**
 * Group APIs by resource name
 */
function groupApisByResource(apis) {
  const grouped = {};

  for (const api of apis) {
    let resource = null;

    // First check if api object has resource property explicitly
    if (api.resource) {
      resource = api.resource;
    } else {
      // Extract resource from path
      // Handle both /api/users and /api/v1/users patterns
      let match = api.path.match(/\/api\/(?:v\d+\/)?(\w+)/);
      if (match) {
        resource = match[1];
      }
    }

    if (resource) {
      if (!grouped[resource]) grouped[resource] = [];
      grouped[resource].push(api);
    }
  }

  return grouped;
}

/**
 * Infer fields from APIs (or use smart defaults)
 */
function inferFieldsFromApis(apis, options, resourceNames = []) {
  const fields = [];
  const fieldSet = new Set();

  // Get common field names for this resource
  const commonFields = getCommonFieldsForResource(apis[0]?.path);

  for (const fieldName of commonFields) {
    if (!fieldSet.has(fieldName)) {
      const config = buildFieldConfig(fieldName, '', resourceNames);
      fields.push(config);
      fieldSet.add(fieldName);
    }
  }

  return fields;
}

/**
 * Get smart default fields for resource based on type
 * Enhanced with automatic relationship fields
 */
function getCommonFieldsForResource(apiPath) {
  // Smart defaults based on resource type with relationship fields
  const defaults = {
    users: ['username', 'firstName', 'lastName', 'email', 'password', 'phone', 'avatar', 'bio', 'role', 'active'],
    products: ['name', 'description', 'price', 'category', 'stock', 'image', 'rating', 'seller'],
    posts: ['title', 'content', 'author', 'tags', 'published', 'views', 'likes'],
    comments: ['text', 'author', 'post', 'likes', 'approved'],
    categories: ['name', 'description', 'parent', 'active'],
    events: ['title', 'description', 'club', 'date', 'location', 'capacity', 'organizer', 'image'],
    clubs: ['name', 'description', 'admin', 'members', 'image'],
    registrations: ['event', 'user', 'status'],
    orders: ['items', 'total', 'status', 'user', 'deliveryAddress', 'paymentStatus'],
    reviews: ['rating', 'text', 'author', 'product', 'verified']
  };

  // Try to match resource type from API path
  for (const [type, fields] of Object.entries(defaults)) {
    if (apiPath?.includes(`/${type}`)) {
      return fields;
    }
  }

  // Default fields for any resource
  return ['name', 'description', 'active'];
}

/**
 * Infer action from API endpoint
 */
function inferAction(api) {
  const methodToAction = {
    'GET': 'read',
    'POST': 'create',
    'PUT': 'update',
    'PATCH': 'update',
    'DELETE': 'delete'
  };

  return methodToAction[api.method] || 'custom';
}

/**
 * Generate validation rules from fields
 */
function generateValidations(fields) {
  const validations = {};

  for (const field of fields) {
    const fieldValidations = [];

    if (field.isRequired) fieldValidations.push('required');
    if (field.validators) fieldValidations.push(...field.validators);

    if (fieldValidations.length > 0) {
      validations[field.name] = fieldValidations;
    }
  }

  return validations;
}

/**
 * Generate required middleware based on fields
 */
function generateMiddleware(fields, options) {
  const middleware = [];

  // Add auth middleware if needed
  if (options.hasAuth) {
    middleware.push('authenticate');
  }

  // Add validation middleware
  middleware.push('validateInput');

  // Add error handling
  middleware.push('errorHandler');

  return middleware;
}

/**
 * Generate hooks needed for fields
 */
function generateHooks(resources) {
  const hooks = {};

  for (const resource of resources) {
    hooks[resource.name] = [];

    for (const field of resource.fields) {
      if (field.hooks) {
        hooks[resource.name].push(...field.hooks);
      }
    }

    // Remove duplicates
    hooks[resource.name] = [...new Set(hooks[resource.name])];
  }

  return hooks;
}

/**
 * Helper: Normalize resource name
 */
function normalizeResourceName(name) {
  return name.toLowerCase().replace(/s$/, '').replace(/ies$/, 'y');
}

/**
 * Helper: Singularize
 */
function singularize(word) {
  if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (word.endsWith('s')) return word.slice(0, -1);
  return word;
}

/**
 * Helper: Pluralize
 */
function pluralize(word) {
  if (word.endsWith('y')) return word.slice(0, -1) + 'ies';
  return word + 's';
}

/**
 * Helper: Capitalize first letter
 */
function capitalizeFirst(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * Validate IR structure
 */
export function validateIR(ir) {
  const errors = [];

  if (!ir.version) errors.push('Missing IR version');
  if (!ir.resources || !Array.isArray(ir.resources)) {
    errors.push('Missing or invalid resources array');
  }
  if (!ir.settings) errors.push('Missing settings');

  ir.resources?.forEach((resource, idx) => {
    if (!resource.name) errors.push(`Resource ${idx} missing name`);
    if (!resource.fields || !Array.isArray(resource.fields)) {
      errors.push(`Resource ${resource.name} missing fields`);
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Pretty print IR (for debugging)
 */
export function printIR(ir) {
  return JSON.stringify(ir, null, 2);
}

