/**
 * Resource Detector - Detects data resources from frontend code patterns
 * Detects from: useState, useEffect, data arrays, forms, etc.
 */

import fs from 'fs';
import path from 'path';
import { globSync } from 'glob';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';

/**
 * Scan frontend and detect resources from state variables and data patterns
 */
export function detectResourcesFromFrontend(projectPath) {
  const resources = new Map();
  
  // Find all frontend files
  const patterns = [
    'src/**/*.{js,jsx,ts,tsx}',
    'app/**/*.{js,jsx,ts,tsx}',
    'pages/**/*.{js,jsx,ts,tsx}',
    'components/**/*.{js,jsx,ts,tsx}',
    '*.{js,jsx,ts,tsx}'
  ];

  const files = [];
  for (const pattern of patterns) {
    files.push(...globSync(pattern, { nodir: true, cwd: projectPath }));
  }

  console.log(`   📁 Scanning ${files.length} files...`);

  for (const file of files) {
    try {
      const fullPath = path.join(projectPath, file);
      const content = fs.readFileSync(fullPath, 'utf8');
      
      // Detect resources from code patterns
      const detected = detectFromCode(content, file);
      
      for (const resource of detected) {
        if (!resources.has(resource.name)) {
          resources.set(resource.name, {
            name: resource.name,
            singular: resource.singular,
            fields: new Set(resource.fields || []),
            sources: []
          });
        }
        
        resources.get(resource.name).sources.push({
          file,
          type: resource.type
        });
        
        // Merge fields
        if (resource.fields) {
          for (const field of resource.fields) {
            resources.get(resource.name).fields.add(field);
          }
        }
      }
    } catch (error) {
      // Ignore parse errors
    }
  }

  // Convert to array
  return Array.from(resources.values()).map(r => ({
    ...r,
    fields: Array.from(r.fields).filter(field => 
      field !== '_id' && field !== 'id' && field.toLowerCase() !== 'id'
    )
  }));
}

/**
 * Detect resources from code content using AST and patterns
 */
function detectFromCode(content, fileName) {
  const resources = [];

  // Pattern 1: useState hooks
  // Example: const [products, setProducts] = useState([])
  const statePattern = /const\s+\[(\w+),\s*set\w+\]\s*=\s*useState/g;
  let match;
  while ((match = statePattern.exec(content)) !== null) {
    const varName = match[1];
    if (isResourceVariable(varName)) {
      resources.push({
        name: varName,
        singular: singularize(varName),
        type: 'useState',
        fields: extractFieldsFromVariable(content, varName)
      });
    }
  }

  // Pattern 2: Data arrays
  // Example: const products = []
  const arrayPattern = /const\s+(\w+)\s*=\s*\[\]/g;
  while ((match = arrayPattern.exec(content)) !== null) {
    const varName = match[1];
    if (isResourceVariable(varName)) {
      resources.push({
        name: varName,
        singular: singularize(varName),
        type: 'array',
        fields: extractFieldsFromVariable(content, varName)
      });
    }
  }

  // Pattern 3: map operations (indicates list rendering)
  // Example: products.map(product => ...)
  const mapPattern = /(\w+)\.map\s*\(\s*(?:\()?(\w+)(?:\))?\s*=>/g;
  while ((match = mapPattern.exec(content)) !== null) {
    const listName = match[1];
    const itemName = match[2];
    
    if (isResourceVariable(listName)) {
      const fields = extractFieldsFromItemVariable(content, itemName);
      resources.push({
        name: listName,
        singular: itemName,
        type: 'map',
        fields
      });
    }
  }

  // Pattern 4: Form fields (input names)
  // Example: <input name="productName" />
  const inputPattern = /name=["'](\w+)["']/g;
  const formFields = [];
  while ((match = inputPattern.exec(content)) !== null) {
    formFields.push(match[1]);
  }

  if (formFields.length > 0) {
    // Try to infer resource from form fields
    const resourceName = inferResourceFromFields(formFields);
    if (resourceName) {
      resources.push({
        name: resourceName,
        singular: singularize(resourceName),
        type: 'form',
        fields: formFields
      });
    }
  }

  // Pattern 5: useEffect with fetch/axios placeholder
  // Example: useEffect(() => { /* TODO: fetch products */ }, [])
  const effectPattern = /useEffect\s*\([^)]*?(?:fetch|load|get)\s*(\w+)/gi;
  while ((match = effectPattern.exec(content)) !== null) {
    const varName = match[1];
    if (isResourceVariable(varName)) {
      resources.push({
        name: varName,
        singular: singularize(varName),
        type: 'useEffect'
      });
    }
  }

  return resources;
}

/**
 * Check if variable name looks like a resource
 */
function isResourceVariable(name) {
  // Skip common non-resource variables
  const excluded = ['data', 'loading', 'error', 'fetching', 'isLoading', 'isError', 
                      'response', 'result', 'value', 'state', 'props', 'params', 'filter', 
                      'filtered', 'sorted', 'paginated', 'searched'];
  
    // Skip derived/transformed variables (filteredTodos, sortedProducts, etc.)
    const derivedPrefixes = ['filtered', 'sorted', 'paginated', 'searched', 'visible', 'active', 'selected', 'new'];
    if (derivedPrefixes.some(prefix => name.toLowerCase().startsWith(prefix))) {
      return false;
    }
  
  if (excluded.includes(name.toLowerCase())) return false;
  
  // Should be plural or common resource name
  return name.length > 2 && (
    name.endsWith('s') || 
    name.endsWith('List') ||
    name.endsWith('Data') ||
    isCommonResource(name)
  );
}

/**
 * Check if it's a common resource name
 */
function isCommonResource(name) {
  const common = ['user', 'product', 'order', 'cart', 'item', 'post', 'comment', 
                  'review', 'category', 'tag', 'customer', 'invoice', 'payment'];
  const lowerName = name.toLowerCase();
  // Check if name equals or ends with (singular or plural) a common resource
  return common.some(r => {
    const plural = r + 's';
    return lowerName === r || lowerName === plural || 
           lowerName.endsWith(r) && (lowerName[lowerName.length - r.length - 1] === 's' || lowerName.length === r.length);
  });
}

/**
 * Convert plural to singular (simple version)
 */
function singularize(word) {
  if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (word.endsWith('ses')) return word.slice(0, -2);
  if (word.endsWith('s')) return word.slice(0, -1);
  return word;
}

/**
 * Extract fields from variable usage in code
 */
function extractFieldsFromVariable(content, varName) {
  const fields = new Set();
  
  // Pattern: varName.field
  const dotPattern = new RegExp(`${varName}\\.\\w+\\.(\\w+)`, 'g');
  let match;
  while ((match = dotPattern.exec(content)) !== null) {
    fields.add(match[1]);
  }
  
  return Array.from(fields).filter(field => 
    field !== '_id' && field !== 'id' && field.toLowerCase() !== 'id'
  );
}

/**
 * Extract fields from item variable in map operations
 */
function extractFieldsFromItemVariable(content, itemName) {
  const fields = new Set();
  
  // Pattern: item.fieldName
  const fieldPattern = new RegExp(`${itemName}\\.([a-zA-Z_][a-zA-Z0-9_]*)`, 'g');
  let match;
  while ((match = fieldPattern.exec(content)) !== null) {
    const field = match[1];
    // Skip common methods and MongoDB _id
    if (!['map', 'filter', 'reduce', 'forEach', 'length'].includes(field) &&
        field !== '_id' && field !== 'id' && field.toLowerCase() !== 'id') {
      fields.add(field);
    }
  }
  
  return Array.from(fields);
}

/**
 * Infer resource name from form fields
 */
function inferResourceFromFields(fields) {
  // Look for common patterns in field names
  const patterns = {
    product: ['productName', 'productPrice', 'productDescription'],
    user: ['userName', 'userEmail', 'userPassword'],
    order: ['orderDate', 'orderTotal', 'orderStatus']
  };
  
  for (const [resource, keywords] of Object.entries(patterns)) {
    if (keywords.some(kw => fields.some(f => f.toLowerCase().includes(kw.toLowerCase())))) {
      return resource + 's';
    }
  }
  
  return null;
}

export default { detectResourcesFromFrontend };
