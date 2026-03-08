/**
 * Caching Middleware
 * Implements HTTP caching for GET requests
 */

export const cacheMiddleware = (duration = 60) => {
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Set cache headers
    res.set('Cache-Control', `public, max-age=${duration}`);
    
    // Skip if no-cache header is set
    if (req.headers['cache-control'] === 'no-cache') {
      res.set('Cache-Control', 'no-cache');
      return next();
    }

    next();
  };
};

// No-cache for sensitive endpoints
export const noCacheMiddleware = (req, res, next) => {
  res.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
};

export default cacheMiddleware;
