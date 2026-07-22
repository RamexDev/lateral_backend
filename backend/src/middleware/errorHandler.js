// Import the structured API error class.
import { ApiError } from '../lib/errors.js';

// Import the shared logger.
import { logger } from '../lib/logger.js';

// Import environment variables.
import { env } from '../config/env.js';

// Export a handler for unknown routes.
export function notFoundHandler(req, res, next) {
  // Forward a structured 404 error.
  next(new ApiError(404, 'NOT_FOUND', 'Route not found'));
}

// Export the centralized error handler.
export function errorHandler(err, req, res, next) {
  // Read the request ID added by pino-http.
  const requestId = req.id;

  // Handle known API errors.
  if (err instanceof ApiError) {
    // Log server errors as errors.
    if (err.statusCode >= 500) {
      logger.error(
        {
          err,
          requestId,
          code: err.code,
          statusCode: err.statusCode
        },
        err.message
      );
    } else {
      // Log client/business errors at debug level to reduce noise.
      logger.debug(
        {
          requestId,
          code: err.code,
          statusCode: err.statusCode
        },
        err.message
      );
    }

    // Return the structured API error response.
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details
      }
    });
  }

  // Log unexpected errors with full details.
  logger.error(
    {
      err,
      requestId
    },
    'Unhandled error'
  );

  // Return a safe 500 response.
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: env.NODE_ENV === 'production'
        ? 'Something went wrong'
        : err.message
    }
  });
}