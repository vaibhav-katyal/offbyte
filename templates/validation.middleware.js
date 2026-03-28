import { validationResult } from 'express-validator';

/**
 * Validation Error Middleware
 * Checks for validation errors and returns them if found
 */
export const validateErrors = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.param || err.path,
        message: err.msg,
        value: err.value
      }))
    });
  }

  next();
};

/**
 * Custom Validation Helpers
 */
export const ValidationHelpers = {
  /**
   * Validate email format
   */
  isValidEmail: (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  /**
   * Validate phone format
   */
  isValidPhone: (phone) => {
    const phoneRegex = /^[\d\s\-\+\(\)]{10,}$/;
    return phoneRegex.test(phone);
  },

  /**
   * Validate URL format
   */
  isValidUrl: (url) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Check if string length is within range
   */
  isLengthBetween: (str, min, max) => {
    return str && str.length >= min && str.length <= max;
  }
};
