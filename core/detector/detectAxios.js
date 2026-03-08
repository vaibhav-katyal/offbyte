import babelTraverse from '@babel/traverse';

const traverse = babelTraverse.default || babelTraverse;

const AXIOS_NAMES = new Set(['axios', 'api', 'client', 'http', 'request']);
const METHOD_NAMES = new Set(['get', 'post', 'put', 'patch', 'delete']);

function getStringValue(node) {
  if (!node) return null;
  if (node.type === 'StringLiteral') return node.value;
  if (node.type === 'TemplateLiteral') {
    return node.quasis.map((q) => q.value.cooked || '').join(':id');
  }
  return null;
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

function extractFieldsFromNode(node) {
  if (!node) return [];
  if (node.type !== 'ObjectExpression') return [];

  return node.properties
    .filter((p) => p.type === 'ObjectProperty')
    .map((p) => (p.key.type === 'Identifier' ? p.key.name : p.key.value))
    .filter(Boolean);
}

export function detectAxios(ast, file) {
  if (!ast) return [];

  const detections = [];

  traverse(ast, {
    CallExpression(path) {
      const { node } = path;

      if (node.callee.type === 'MemberExpression') {
        const object = node.callee.object;
        const property = node.callee.property;

        const objectName = object.type === 'Identifier' ? object.name : null;
        const methodName = property.type === 'Identifier' ? property.name : null;

        if (!objectName || !methodName) return;
        if (!AXIOS_NAMES.has(objectName) || !METHOD_NAMES.has(methodName)) return;

        const route = normalizeRoute(getStringValue(node.arguments[0]));
        if (!route) return;
        if (!route.includes(`/api`) && !route.startsWith('/')) return;

        const method = methodName.toUpperCase();
        const dataArgIndex = methodName === 'get' ? -1 : 1;
        const fields = dataArgIndex >= 0 ? extractFieldsFromNode(node.arguments[dataArgIndex]) : [];

        detections.push({
          file,
          type: 'axios',
          method,
          route,
          fields,
          hasQueryParams: route.includes('?'),
          line: node.loc?.start?.line || 0,
          source: 'ast'
        });
      }

      if (node.callee.type === 'Identifier' && node.callee.name === 'axios' && node.arguments[0]?.type === 'ObjectExpression') {
        const config = node.arguments[0];

        const methodProp = config.properties.find((p) => p.type === 'ObjectProperty' && ((p.key.type === 'Identifier' && p.key.name === 'method') || (p.key.type === 'StringLiteral' && p.key.value === 'method')));
        const urlProp = config.properties.find((p) => p.type === 'ObjectProperty' && ((p.key.type === 'Identifier' && p.key.name === 'url') || (p.key.type === 'StringLiteral' && p.key.value === 'url')));
        const dataProp = config.properties.find((p) => p.type === 'ObjectProperty' && ((p.key.type === 'Identifier' && p.key.name === 'data') || (p.key.type === 'StringLiteral' && p.key.value === 'data')));

        const route = normalizeRoute(getStringValue(urlProp?.value));
        if (!route) return;
        if (!route.includes(`/api`) && !route.startsWith('/')) return;

        const method = (getStringValue(methodProp?.value) || 'GET').toUpperCase();
        const fields = extractFieldsFromNode(dataProp?.value);

        detections.push({
          file,
          type: 'axios',
          method,
          route,
          fields,
          hasQueryParams: route.includes('?'),
          line: node.loc?.start?.line || 0,
          source: 'ast'
        });
      }
    }
  });

  return detections;
}

export default detectAxios;
