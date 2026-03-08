// Request Logger Middleware
const requestLogger = (req, res, next) => {
  const start = Date.now();

  // Log request
  console.log(`📨 ${req.method} ${req.path}`);

  // Override res.json to log response
  const originalJson = res.json.bind(res);
  res.json = function(data) {
    const duration = Date.now() - start;
    console.log(`✅ ${res.statusCode} ${req.method} ${req.path} [${duration}ms]`);
    return originalJson(data);
  };

  next();
};

export default requestLogger;
