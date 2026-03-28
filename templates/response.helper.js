/**
 * Response Helper Utility
 * Standardizes API responses across the application
 */
export class ResponseHelper {
  /**
   * Success response with data
   */
  static success(res, data, message = 'Success', statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      data
    });
  }

  /**
   * Paginated response
   */
  static paginated(res, data, pagination, message = 'Data retrieved successfully', statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
      pagination
    });
  }

  /**
   * Error response
   */
  static error(res, message = 'Internal server error', statusCode = 500, errors = null) {
    const response = {
      success: false,
      message
    };

    if (errors) {
      response.errors = errors;
    }

    return res.status(statusCode).json(response);
  }

  /**
   * Validation error response
   */
  static validationError(res, errors, message = 'Validation failed') {
    return res.status(400).json({
      success: false,
      message,
      errors
    });
  }

  /**
   * Not found response
   */
  static notFound(res, message = 'Resource not found') {
    return res.status(404).json({
      success: false,
      message
    });
  }

  /**
   * Unauthorized response
   */
  static unauthorized(res, message = 'Unauthorized access') {
    return res.status(401).json({
      success: false,
      message
    });
  }

  /**
   * Forbidden response
   */
  static forbidden(res, message = 'Access forbidden') {
    return res.status(403).json({
      success: false,
      message
    });
  }

  /**
   * Created response (201)
   */
  static created(res, data, message = 'Resource created successfully') {
    return res.status(201).json({
      success: true,
      message,
      data
    });
  }

  /**
   * Updated response
   */
  static updated(res, data, message = 'Resource updated successfully') {
    return res.status(200).json({
      success: true,
      message,
      data
    });
  }

  /**
   * Deleted response
   */
  static deleted(res, message = 'Resource deleted successfully') {
    return res.status(200).json({
      success: true,
      message
    });
  }

  /**
   * Bad request response
   */
  static badRequest(res, message = 'Bad request', errors = null) {
    const response = {
      success: false,
      message
    };

    if (errors) {
      response.errors = errors;
    }

    return res.status(400).json(response);
  }

  /**
   * Server error response
   */
  static serverError(res, error = null, message = 'Internal server error') {
    const response = {
      success: false,
      message
    };

    // Only include error details in development
    if (process.env.NODE_ENV === 'development' && error) {
      response.error = {
        message: error.message,
        stack: error.stack
      };
    }

    return res.status(500).json(response);
  }

  /**
   * Format error details for response
   */
  static formatErrors(errorArray) {
    return errorArray.map(err => ({
      field: err.field || err.param,
      message: err.message,
      value: err.value
    }));
  }

  /**
   * Bulk success response
   */
  static bulkSuccess(res, successCount, failureCount, message = 'Bulk operation completed') {
    return res.status(200).json({
      success: true,
      message,
      data: {
        total: successCount + failureCount,
        successful: successCount,
        failed: failureCount
      }
    });
  }
}
