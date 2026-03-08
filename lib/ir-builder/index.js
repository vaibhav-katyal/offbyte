/**
 * IR Builder - Main Export
 * Complete IR generation pipeline
 */

export { buildIR, validateIR, printIR } from './irBuilder.js';
export {
  detectFieldType,
  buildFieldConfig,
  shouldIndex,
  detectRelationship,
  getAllRules,
  addCustomRule,
  getRule
} from './rulesEngine.js';
export { renderTemplate, renderAllTemplates, validateTemplate } from './templateEngine.js';
