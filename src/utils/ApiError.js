/**
 * ApiError — typed application error carrying a stable machine code + HTTP status.
 * Centralized error handler (middlewares/errorHandler.js) inspects these fields
 * to render the standard error envelope documented in §6.0.
 */
class ApiError extends Error {
  /**
   * @param {object} params
   * @param {string} params.code    Stable machine-readable error code (e.g. "DUPLICATE_PHONE").
   * @param {string} params.message Human-readable message.
   * @param {number} [params.status=400] HTTP status code.
   * @param {object} [params.details]    Optional extra context for the error envelope.
   */
  constructor({ code, message, status = 400, details }) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }

  static notFound(code, message) {
    return new ApiError({ code, message, status: 404 });
  }

  static forbidden(code, message) {
    return new ApiError({ code, message, status: 403 });
  }

  static unauthorized(code, message) {
    return new ApiError({ code, message, status: 401 });
  }

  static conflict(code, message) {
    return new ApiError({ code, message, status: 409 });
  }

  static business(code, message, status = 422) {
    return new ApiError({ code, message, status });
  }
}

module.exports = { ApiError };
