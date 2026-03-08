/**
 * Validation Schemas
 * Centralized validation for all endpoints
 */

import { body, query, param, validationResult } from 'express-validator';

// Error validation middleware
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

// Pagination validation
export const paginationValidators = [
  query('page').optional().isInt({ min: 1 }).default(1),
  query('limit').optional().isInt({ min: 1, max: 100 }).default(10),
  query('skip').optional().isInt({ min: 0 }).default(0)
];

// Search and filter validation
export const searchValidators = [
  query('search').optional().isString().trim(),
  query('sort').optional().isString(),
  query('fields').optional().isString()
];

// ID validation
export const idValidator = param('id').isMongoId().withMessage('Invalid ID');

// Common validators
export const validators = {
  // Email
  email: body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Invalid email address'),

  // Password
  password: body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),

  // Strong password
  strongPassword: body('password')
    .isLength({ min: 12 })
    .matches(/[A-Z]/)
    .withMessage('Password must contain uppercase letters')
    .matches(/[a-z]/)
    .withMessage('Password must contain lowercase letters')
    .matches(/[0-9]/)
    .withMessage('Password must contain numbers')
    .matches(/[!@#$%^&*]/)
    .withMessage('Password must contain special characters'),

  // Name
  name: body('name')
    .isString()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),

  // URL
  url: body('url').isURL().withMessage('Invalid URL'),

  // Phone
  phone: body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Invalid phone number'),

  // Number fields
  price: body('price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),

  // Status
  status: body('status')
    .isIn(['active', 'inactive', 'pending', 'archived'])
    .withMessage('Invalid status'),

  // Date
  date: body('date')
    .optional()
    .isISO8601()
    .withMessage('Invalid date format'),

  // Boolean
  boolean: body('active')
    .optional()
    .isBoolean()
    .toBoolean()
    .withMessage('Must be a boolean value'), 

  // JSON object
  metadata: body('metadata')
    .optional()
    .isObject()
    .withMessage('Metadata must be an object'),

  // Array
  tags: body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),

  // String array
  stringArray: body('items')
    .optional()
    .custom((value) => {
      if (!Array.isArray(value)) {
        throw new Error('Must be an array');
      }
      if (!value.every(item => typeof item === 'string')) {
        throw new Error('All items must be strings');
      }
      return true;
    })
};

export default validators;
