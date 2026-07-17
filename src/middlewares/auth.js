/**
 * Auth middleware — verifies Bearer JWT and attaches the user/staff record to req.
 *
 * Two modes (use the factory):
 *   requireUser() — only accepts scope='user' tokens (for /api/v1/* user routes).
 *   requireStaff() — only accepts scope='staff' tokens (for /admin/api/v1/* routes).
 */
const authService = require('../services/authService');
const { ApiError } = require('../utils/ApiError');
const i18n = require('../services/localizationService');

function extractToken(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim();
}

/**
 * User JWT required. Attaches `req.user` (the users row) and `req.authPayload`.
 */
function requireUser() {
  return async (req, res, next) => {
    const token = extractToken(req);
    if (!token) {
      return next(ApiError.unauthorized('INVALID_TOKEN', i18n.t('INVALID_TOKEN', 'en')));
    }
    try {
      const { user, payload } = await authService.getUserFromToken(token);
      req.user = user;
      req.authPayload = payload;
      req.lang = user.preferred_language;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Staff JWT required. Attaches `req.staff` (the staff row) and `req.authPayload`.
 */
function requireStaff() {
  return async (req, res, next) => {
    const token = extractToken(req);
    if (!token) {
      return next(ApiError.unauthorized('INVALID_TOKEN', i18n.t('INVALID_TOKEN', 'en')));
    }
    try {
      const { staff, payload } = await authService.getStaffFromToken(token);
      req.staff = staff;
      req.authPayload = payload;
      req.lang = staff.preferred_language;
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { requireUser, requireStaff };
