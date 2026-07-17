/**
 * Validation middleware — wraps a Zod schema and rejects bad requests with
 * VALIDATION_FAILED (§6.0 error envelope).
 *
 * Validates req.body by default; pass `{ query: true }` or `{ params: true }` to
 * validate those instead.
 */
const { ApiError } = require('../utils/ApiError');
const i18n = require('../services/localizationService');

function validate(schema, source = 'body') {
  return (req, res, next) => {
    const target = source === 'query' ? req.query : source === 'params' ? req.params : req.body;
    const result = schema.safeParse(target);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      }));
      const err = ApiError.business('VALIDATION_FAILED', i18n.t('VALIDATION_FAILED', 'en'), 400);
      err.details = details;
      return next(err);
    }
    // Replace with the parsed + coerced value (Zod applies defaults/transforms).
    if (source === 'query') req.query = result.data;
    else if (source === 'params') req.params = result.data;
    else req.body = result.data;
    next();
  };
}

module.exports = { validate };
