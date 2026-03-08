import babelTraverse from '@babel/traverse';

const traverse = babelTraverse.default || babelTraverse;

export function detectForms(ast, file) {
  if (!ast) return [];

  const forms = [];

  traverse(ast, {
    VariableDeclarator(path) {
      const { node } = path;

      if (node.init?.type !== 'CallExpression') return;
      if (node.init.callee.type !== 'Identifier' || node.init.callee.name !== 'useState') return;
      if (!node.init.arguments[0] || node.init.arguments[0].type !== 'ObjectExpression') return;

      const fields = node.init.arguments[0].properties
        .filter((p) => p.type === 'ObjectProperty')
        .map((p) => (p.key.type === 'Identifier' ? p.key.name : p.key.value))
        .filter(Boolean);

      if (fields.length === 0) return;

      forms.push({
        file,
        type: 'form',
        fields,
        line: node.loc?.start?.line || 0,
        source: 'ast'
      });
    },
    CallExpression(path) {
      const { node } = path;

      if (node.callee.type !== 'MemberExpression') return;
      if (node.callee.property.type !== 'Identifier' || node.callee.property.name !== 'append') return;

      const keyArg = node.arguments[0];
      if (!keyArg || keyArg.type !== 'StringLiteral') return;

      forms.push({
        file,
        type: 'form-data',
        fields: [keyArg.value],
        line: node.loc?.start?.line || 0,
        source: 'ast'
      });
    }
  });

  return forms;
}

export default detectForms;
