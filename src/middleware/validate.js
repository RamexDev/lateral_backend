// Import API error class.
import { ApiError } from '../lib/errors.js';

// Validate a request source against a Zod schema.
export function validate(schema, source = 'body') {
  // Return Express middleware.
  return (req, res, next) => {
    // Parse selected request source.
    const parsed = schema.safeParse(req[source]);

    // Reject invalid payloads.
    if (!parsed.success) {
      // Build readable validation details.
      const details = parsed.error.issues.map((issue) => ({
        path: issue.path.join('.') || source,
        message: issue.message
      }));

      // Forward standardized validation error.
      return next(new ApiError(400, 'VALIDATION_FAILED', 'Validation failed', details));
    }

    // Store validated data in a safe location.
    if (!req.validated) {
      req.validated = {};
    }
    req.validated[source] = parsed.data;

    // Also assign directly when the request property is writable.
    try {
      req[source] = parsed.data;
    } catch {
      // Some Express request properties may be read-only.
    }

    // Continue.
    next();
  };
}
