/**
 * Security Middleware
 * Implements security best practices
 */

import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import { body, validationResult } from 'express-validator';

// Helmet security headers
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:']
    }
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  frameguard: {
    action: 'deny'
  },
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin'
  }
});

// MongoDB injection prevention
export const sanitizeData = (req, res, next) => {
  // Sanitize req.body
  if (req.body) {
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = mongoSanitize.sanitize(req.body[key]);
      }
    }
  }

  // Sanitize req.query
  if (req.query) {
    for (const key in req.query) {
      if (typeof req.query[key] === 'string') {
        req.query[key] = mongoSanitize.sanitize(req.query[key]);
      }
    }
  }

  next();
};

// Validation error handler
export const validateErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }
  next();
};

// Common validation chains
export const validators = {
  email: body('email').isEmail().normalizeEmail(),
  password: body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  url: body('url').isURL(),
  id: body('id').isMongoId().withMessage('Invalid ID'),
  phone: body('phone').isMobilePhone().optional(),
  date: body('date').isISO8601().optional()
};

export default { securityHeaders, sanitizeData, validateErrors, validators };
