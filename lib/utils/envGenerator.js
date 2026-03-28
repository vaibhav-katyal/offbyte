import crypto from 'crypto';

/**
 * Generate secure JWT secret
 */
export function generateJWTSecret() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate environment file for auth
 */
export function generateAuthEnv() {
  const jwtSecret = generateJWTSecret();
  
  return `# ========== SERVER ==========
NODE_ENV=development
PORT=5000

# ========== DATABASE ==========
MONGODB_URI=mongodb://localhost:27017/offbyte-app
DB_NAME=offbyte-app

# ========== SECURITY ==========
JWT_SECRET=${jwtSecret}
JWT_EXPIRES_IN=7d
BCRYPT_ROUNDS=10

# ========== CORS ==========
CORS_ORIGIN=*

# ========== API ==========
API_URL=http://localhost:5000
`;
}

