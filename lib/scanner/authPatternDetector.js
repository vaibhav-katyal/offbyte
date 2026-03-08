/**
 * Auth Pattern Detection
 * Analyzes frontend code to detect authentication patterns
 */

export function detectAuthPatterns(content, apiCalls = []) {
  const authPatterns = {
    hasSignup: false,
    hasLogin: false,
    hasLogout: false,
    hasProfile: false,
    hasTokenStorage: false,
    hasPasswordField: false,
    authEndpoints: []
  };

  // Detect signup
  if (/signup|register|createAccount/i.test(content)) {
    authPatterns.hasSignup = true;
    const signupCall = apiCalls.find(c => /signup|register|createAccount/i.test(c.route));
    if (signupCall) authPatterns.authEndpoints.push({ type: 'signup', ...signupCall });
  }

  // Detect login
  if (/login|authenticate|signIn/i.test(content)) {
    authPatterns.hasLogin = true;
    const loginCall = apiCalls.find(c => /login|authenticate|signIn/i.test(c.route));
    if (loginCall) authPatterns.authEndpoints.push({ type: 'login', ...loginCall });
  }

  // Detect logout
  if (/logout|signOut/i.test(content)) {
    authPatterns.hasLogout = true;
  }

  // Detect profile/user endpoints
  if (/profile|user|account|me(?!thod)/i.test(content)) {
    authPatterns.hasProfile = true;
    const profileCall = apiCalls.find(c => /profile|user|account|\/me/i.test(c.route) && c.method === 'GET');
    if (profileCall) authPatterns.authEndpoints.push({ type: 'profile', ...profileCall });
  }

  // Detect token/storage
  if (/localStorage|sessionStorage|jwt|token|Bearer/i.test(content)) {
    authPatterns.hasTokenStorage = true;
  }

  // Detect password field
  if (/password|pwd|passcode/i.test(content)) {
    authPatterns.hasPasswordField = true;
  }

  return authPatterns;
}
