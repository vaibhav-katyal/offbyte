/**
 * All IR-based Templates Export
 */

export { MODEL_TEMPLATE } from './model.template.js';
export { ROUTES_TEMPLATE } from './routes.template.js';
export { VALIDATION_TEMPLATE } from './validation.template.js';

// Template map for easy access
export const TEMPLATES = {
  model: () => import('./model.template.js').then(m => m.MODEL_TEMPLATE),
  routes: () => import('./routes.template.js').then(m => m.ROUTES_TEMPLATE),
  validation: () => import('./validation.template.js').then(m => m.VALIDATION_TEMPLATE),
};
