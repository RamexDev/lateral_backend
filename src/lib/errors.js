// Export a structured API error class.
export class ApiError extends Error {
  constructor(statusCode, code, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  static badRequest(message, details) {
    return new ApiError(400, 'VALIDATION_FAILED', message, details);
  }

  static unauthorized(message) {
    return new ApiError(401, 'INVALID_TOKEN', message);
  }

  static forbidden(message) {
    return new ApiError(403, 'FORBIDDEN', message);
  }

  static notFound(message) {
    return new ApiError(404, 'NOT_FOUND', message);
  }

  static conflict(message) {
    return new ApiError(409, 'CONFLICT', message);
  }

  static businessRule(message) {
    return new ApiError(422, 'BUSINESS_RULE_VIOLATION', message);
  }
}
