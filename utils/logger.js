export function logInfo(message) {
  console.log(`[offbyte] ${message}`);
}

export function logWarn(message) {
  console.warn(`[offbyte][warn] ${message}`);
}

export function logError(message) {
  console.error(`[offbyte][error] ${message}`);
}

export default {
  logInfo,
  logWarn,
  logError
};

