/**
 * Template Engine - IR + Templates → Generated Code
 * Uses simple but powerful template syntax
 */

/**
 * Render template with IR data
 * Supports: <%= %> for variables, <% %> for logic
 */
export function renderTemplate(template, ir, resourceName) {
  if (!template) return '';

  const resource = ir.resources.find(r => r.name === resourceName);
  if (!resource) throw new Error(`Resource ${resourceName} not found in IR`);

  // Create template context with helpers
  const context = {
    resource,
    ir,
    ...getTemplateHelpers()
  };

  // Simple template rendering
  return compileTemplate(template, context);
}

/**
 * Compile template with context
 * Supports: <%= expression %>, <% code %>, <%# comment %>
 */
function compileTemplate(template, context) {
  let result = template;

  // Remove comments <%# ... %>
  result = result.replace(/<%#[\s\S]*?%>/g, '');

  // Process output blocks <%= ... %> FIRST (before code blocks)
  result = result.replace(/<%=([\s\S]*?)%>/g, (match, expr) => {
    try {
      const trimmedExpr = expr.trim();
      const func = new Function(...Object.keys(context), `return ${trimmedExpr}`);
      const value = func(...Object.values(context));
      return value ?? '';
    } catch (e) {
      console.warn(`Template expression error at: ${expr.substring(0, 50)}... - ${e.message}`);
      return '';
    }
  });

  // Process code blocks <% ... %> AFTER output blocks
  result = result.replace(/<%(?!=)([\s\S]*?)%>/g, (match, code) => {
    try {
      // Create function with context access
      const func = new Function(...Object.keys(context), code);
      func(...Object.values(context));
      return '';
    } catch (e) {
      console.warn(`Template code block error: ${e.message}`);
      return '';
    }
  });

  return result;
}

/**
 * Template helper functions (available in templates)
 */
function getTemplateHelpers() {
  return {
    // String helpers
    capitalize: (str) => str.charAt(0).toUpperCase() + str.slice(1),
    camelCase: (str) => str.replace(/[-_](.)/g, (_, c) => c.toUpperCase()),
    snakeCase: (str) => str.replace(/([A-Z])/g, '_$1').toLowerCase(),
    kebabCase: (str) => str.replace(/([A-Z])/g, '-$1').toLowerCase(),

    // Field helpers
    fieldsByType: (fields, type) => fields.filter(f => f.type === type),
    requiredFields: (fields) => fields.filter(f => f.isRequired),
    indexedFields: (fields) => fields.filter(f => f.shouldIndex),
    fieldsWithValidators: (fields) => fields.filter(f => f.validators?.length > 0),

    // Array helpers
    forEach: (items, callback) => items.map(callback).join(''),
    join: (items, separator = ', ') => items.join(separator),

    // Conditional - use 'conditional' instead of 'if' to avoid reserved keyword
    conditional: (condition, trueValue, falseValue = '') => condition ? trueValue : falseValue,

    // Field schema generator for Mongoose models
    generateFieldSchema: (field) => {
      let type = field.type === 'ObjectId' ? 'mongoose.Types.ObjectId' 
        : field.type === 'Date' ? 'Date' 
        : field.type === 'Number' ? 'Number' 
        : field.type === 'Boolean' ? 'Boolean' 
        : 'String';
      let def = field.name + ': { type: ' + type;
      if (field.type === 'ObjectId' && field.relationship) {
        def += ", ref: '" + field.relationship.ref + "'";
      }
      if (field.isRequired) def += ', required: true';
      if (field.shouldIndex) def += ', index: true';
      def += ' }';
      return def;
    },

    // Validation generator for Joi
    generateJoiValidation: (field) => {
      let type = field.type === 'ObjectId' ? 'string()'
        : field.type === 'String' ? 'string()'
        : field.type === 'Number' ? 'number()'
        : field.type === 'Date' ? 'date()'
        : field.type === 'Boolean' ? 'boolean()'
        : 'string()';
      let def = field.name + ': Joi.' + type;
      if (field.isRequired) def += '.required()';
      else def += '.optional()';
      return def;
    }
  };
}

/**
 * Batch render multiple templates (model, routes, etc.)
 */
export function renderAllTemplates(ir, templates) {
  const generated = {};

  for (const [templateName, template] of Object.entries(templates)) {
    try {
      for (const resource of ir.resources) {
        const key = `${resource.name}.${templateName}`;
        generated[key] = renderTemplate(template, ir, resource.name);
      }
    } catch (error) {
      console.error(`Failed to render ${templateName}: ${error.message}`);
    }
  }

  return generated;
}

/**
 * Validate template syntax
 */
export function validateTemplate(template) {
  const errors = [];

  // Check for mismatched delimiters
  const openTags = (template.match(/<%/g) || []).length;
  const closeTags = (template.match(/%>/g) || []).length;
  
  if (openTags !== closeTags) {
    errors.push(`Mismatched template tags: ${openTags} opening, ${closeTags} closing`);
  }

  // Try simple parse
  try {
    new Function('resource, ir', template);
  } catch (e) {
    errors.push(`Template syntax error: ${e.message}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Advanced: Iterator helper for templates
 */
export class TemplateIterator {
  constructor(items) {
    this.items = items;
    this.index = 0;
  }

  each(callback) {
    return this.items.map((item, i) => {
      this.index = i;
      return callback(item, i, this.items);
    }).join('');
  }

  map(callback) {
    return this.items.map(callback);
  }

  filter(predicate) {
    return this.items.filter(predicate);
  }
}
