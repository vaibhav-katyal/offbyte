import babelTraverse from '@babel/traverse';

const traverse = babelTraverse.default || babelTraverse;

function getMethodFromFetchConfig(configNode) {
  if (!configNode || configNode.type !== 'ObjectExpression') return 'GET';

  for (const prop of configNode.properties) {
    if (prop.type !== 'ObjectProperty') continue;

    const keyName = prop.key.type === 'Identifier'
      ? prop.key.name
      : prop.key.type === 'StringLiteral'
        ? prop.key.value
        : null;

    if (keyName !== 'method') continue;

    if (prop.value.type === 'StringLiteral') return prop.value.value.toUpperCase();
  }

  const hasBody = configNode.properties.some((prop) => {
    if (prop.type !== 'ObjectProperty') return false;
    const keyName = prop.key.type === 'Identifier'
      ? prop.key.name
      : prop.key.type === 'StringLiteral'
        ? prop.key.value
        : null;
    return keyName === 'body';
  });

  return hasBody ? 'POST' : 'GET';
}

function getRoute(node) {
  if (!node) return null;

  if (node.type === 'StringLiteral') {
    return node.value;
  }

  if (node.type === 'TemplateLiteral') {
    const text = node.quasis.map((q) => q.value.cooked || '').join(':id');
    return text;
  }

  return null;
}

function extractBodyFields(configNode) {
  if (!configNode || configNode.type !== 'ObjectExpression') return [];

  const bodyProp = configNode.properties.find((prop) => {
    if (prop.type !== 'ObjectProperty') return false;
    const keyName = prop.key.type === 'Identifier'
      ? prop.key.name
      : prop.key.type === 'StringLiteral'
        ? prop.key.value
        : null;
    return keyName === 'body';
  });

  if (!bodyProp) return [];

  const value = bodyProp.value;

  if (value.type === 'ObjectExpression') {
    return value.properties
      .filter((p) => p.type === 'ObjectProperty')
      .map((p) => (p.key.type === 'Identifier' ? p.key.name : p.key.value))
      .filter(Boolean);
  }

  if (
    value.type === 'CallExpression' &&
    value.callee.type === 'MemberExpression' &&
    value.callee.object.type === 'Identifier' &&
    value.callee.object.name === 'JSON' &&
    value.callee.property.type === 'Identifier' &&
    value.callee.property.name === 'stringify' &&
    value.arguments[0] &&
    value.arguments[0].type === 'ObjectExpression'
  ) {
    return value.arguments[0].properties
      .filter((p) => p.type === 'ObjectProperty')
      .map((p) => (p.key.type === 'Identifier' ? p.key.name : p.key.value))
      .filter(Boolean);
  }

  return [];
}

function normalizeRoute(route) {
  if (!route) return null;
  const cleaned = route.split('?')[0];
  if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
    const index = cleaned.indexOf(`/api/`);
    if (index >= 0) return cleaned.substring(index);
  }
  return cleaned.startsWith('/') ? cleaned : `/${cleaned}`;
}

export function detectFetch(ast, file) {
  if (!ast) return [];

  const detections = [];

  traverse(ast, {
    CallExpression(path) {
      const { node } = path;
      const callee = node.callee;

      const isDirectFetch = callee.type === 'Identifier' && callee.name === 'fetch';
      const isWindowFetch =
        callee.type === 'MemberExpression' &&
        callee.object.type === 'Identifier' &&
        callee.object.name === 'window' &&
        callee.property.type === 'Identifier' &&
        callee.property.name === 'fetch';

      if (!isDirectFetch && !isWindowFetch) return;

      const rawRoute = getRoute(node.arguments[0]);
      const route = normalizeRoute(rawRoute);
      if (!route) return;
      if (!route.includes(`/api`) && !route.startsWith('/')) return;

      const configNode = node.arguments[1];
      const method = getMethodFromFetchConfig(configNode);
      const fields = extractBodyFields(configNode);

      detections.push({
        file,
        type: 'fetch',
        method,
        route,
        fields,
        hasQueryParams: route.includes('?'),
        line: node.loc?.start?.line || 0,
        source: 'ast'
      });
    }
  });

  return detections;
}

export default detectFetch;
