/**
 * Enhanced Offline Mode
 * Exports the production-ready generator
 */

import { enhancedOfflineMode } from './offline.enhanced.js';

// Main export - uses enhanced production-ready version
export async function offlineMode(projectPath) {
  return enhancedOfflineMode(projectPath);
}

export default offlineMode;
