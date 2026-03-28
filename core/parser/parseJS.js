import { parse } from '@babel/parser';

export function parseJS(code, sourceFilename = 'unknown.js') {
  try {
    return parse(code, {
      sourceType: 'unambiguous',
      sourceFilename,
      errorRecovery: true,
      plugins: [
        'jsx',
        'classProperties',
        'classPrivateProperties',
        'classPrivateMethods',
        'objectRestSpread',
        'optionalChaining',
        'nullishCoalescingOperator',
        'dynamicImport',
        'topLevelAwait'
      ]
    });
  } catch {
    return null;
  }
}

export default parseJS;
