/**
 * Router-scope enforcement — SEC-011.
 *
 * Mounted on BOTH routers as the FIRST middleware (before any handler):
 *   - /api/v1/*        → rejects staff tokens
 *   - /admin/api/v1/*  → rejects user tokens
 *
 * This is server-side and independent of CORS (CORS only constrains browsers).
 * Prevents a stolen staff token from being replayed against Mini App endpoints
 * (or vice versa) via a non-browser client.
 *
 * The check is a single claim comparison — no DB lookup needed because the scope
 * is baked into the JWT at signing time.
 */
const { ApiError } = require('../utils/ApiError');
const i18n = require('../services/localizationService');
const jwtUtil = require('../utils/jwt');

function rejectMismatchedScope(expectedScope) {
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) {
      // No token at all — let the downstream requireUser/requireStaff handle the 401.
      return next();
    }
    const token = header.slice('Bearer '.length).trim();
    let payload;
    try {
      payload = jwtUtil.verify(token);
    } catch {
      // Invalid token — let downstream return INVALID_TOKEN.
      return next();
    }
    if (payload.scope && payload.scope !== expectedScope) {
      return next(
        ApiError.unauthorized('INVALID_TOKEN_FOR_ROUTER', i18n.t('INVALID_TOKEN_FOR_ROUTER', 'en')),
      );
    }
    next();
  };
}

module.exports = { rejectMismatchedScope };
