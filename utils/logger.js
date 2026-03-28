export function logInfo(message) {
  console.log(`[offbyt] ${message}`);
}

export function logWarn(message) {
  console.warn(`[offbyt][warn] ${message}`);
}

export function logError(message) {
  console.error(`[offbyt][error] ${message}`);
}

export default {
  logInfo,
  logWarn,
  logError
};

