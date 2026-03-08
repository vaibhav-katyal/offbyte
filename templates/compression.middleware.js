/**
 * Compression Middleware
 * Compresses response bodies for all requests that match the filter function
 */

import compression from 'compression';

export const compressionMiddleware = compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: process.env.NODE_ENV === 'production' ? 6 : 3,
  threshold: 1024 // Only compress responses larger than 1KB
});

export default compressionMiddleware;
