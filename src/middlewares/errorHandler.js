/**
 * Centralized error handler — converts thrown errors to the standard envelope.
 *
 * ApiError → use its `code`, `message`, `status`, optional `details`.
 * ZodError → VALIDATION_FAILED, 400.
 * Anything else → INTERNAL_ERROR, 500.
 */
const { ApiError } = require('../utils/ApiError');
const i18n = require('../services/localizationService');
const logger = require('../utils/logger');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    const body = {
      success: false,
      error: { code: err.code, message: err.message },
    };
    if (err.details) body.error.details = err.details;
    return res.status(err.status).json(body);
  }

  // Zod errors thrown directly (rare since we use validate middleware).
  if (err?.name === 'ZodError') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_FAILED',
        message: i18n.t('VALIDATION_FAILED', 'en'),
        details: err.issues,
      },
    });
  }

  // MySQL/SQLite unique-constraint violation → 409 conflict.
  if (err?.code === 'ER_DUP_ENTRY' || err?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return res.status(409).json({
      success: false,
      error: { code: 'CONFLICT', message: 'A uniqueness constraint was violated.' },
    });
  }

  logger.error('Unhandled error', { message: err?.message, stack: err?.stack });
  return res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: i18n.t('INTERNAL_ERROR', 'en') },
  });
}

function notFoundHandler(req, res) {
  return res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: i18n.t('NOT_FOUND', 'en') },
  });
}

module.exports = { errorHandler, notFoundHandler };
