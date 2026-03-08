export const rateLimiter = (limit = 100) => {
  const requests = new Map();
  
  return (req, res, next) => {
    const ip = req.ip;
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 minutes
    
    if (!requests.has(ip)) {
      requests.set(ip, []);
    }
    
    const userRequests = requests.get(ip).filter(time => now - time < windowMs);
    
    if (userRequests.length >= limit) {
      return res.status(429).json({ message: 'Too many requests' });
    }
    
    userRequests.push(now);
    requests.set(ip, userRequests);
    next();
  };
};