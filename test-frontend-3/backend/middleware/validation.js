import { validationResult } from 'express-validator';

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

export const validateRequest = (schema) => {
  return (req, res, next) => {
    // If no schema is provided, just continue.
    if (!schema || typeof schema.validate !== 'function') {
      return next();
    }

    const { error, value } = schema.validate(req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation Error',
        details: error.details.map(d => d.message)
      });
    }

    req.validatedBody = value;
    next();
  };
};