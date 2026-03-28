import { parse } from '@babel/parser';

export function parseTS(code, sourceFilename = 'unknown.ts') {
  try {
    return parse(code, {
      sourceType: 'unambiguous',
      sourceFilename,
      errorRecovery: true,
      plugins: [
        'typescript',
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

export default parseTS;
