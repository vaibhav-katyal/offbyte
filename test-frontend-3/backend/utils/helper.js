/**
 * Response Utilities
 * Standardized response formatting across the application
 */

export class ResponseHelper {
  static success(res, data, message = 'Success', statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
      timestamp: new Date().toISOString()
    });
  }

  static paginated(res, data, pagination, message = 'Success', statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
      pagination,
      timestamp: new Date().toISOString()
    });
  }

  static error(res, message = 'Error', errors = [], statusCode = 500) {
    return res.status(statusCode).json({
      success: false,
      message,
      errors: Array.isArray(errors) ? errors : [errors],
      timestamp: new Date().toISOString()
    });
  }

  static validationError(res, errors) {
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors,
      timestamp: new Date().toISOString()
    });
  }

  static notFound(res, resource = 'Resource') {
    return res.status(404).json({
      success: false,
      message: `${resource} not found`,
      timestamp: new Date().toISOString()
    });
  }

  static unauthorized(res) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized access',
      timestamp: new Date().toISOString()
    });
  }

  static forbidden(res) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Error Helper
 * Custom error classes for better error handling
 */
export class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation Error', errors = []) {
    super(message, 400);
    this.errors = errors;
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict') {
    super(message, 409);
  }
}

/**
 * Logger Utility
 * Structured logging with timestamps
 */
export class Logger {
  static info(message, data = {}) {
    console.log(JSON.stringify({
      level: 'INFO',
      message,
      data,
      timestamp: new Date().toISOString()
    }));
  }

  static error(message, error = {}) {
    console.error(JSON.stringify({
      level: 'ERROR',
      message,
      error: error.message || error,
      stack: error.stack,
      timestamp: new Date().toISOString()
    }));
  }

  static warn(message, data = {}) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message,
      data,
      timestamp: new Date().toISOString()
    }));
  }

  static debug(message, data = {}) {
    if (process.env.NODE_ENV === 'development') {
      console.debug(JSON.stringify({
        level: 'DEBUG',
        message,
        data,
        timestamp: new Date().toISOString()
      }));
    }
  }
}

export default { ResponseHelper, AppError, Logger };
