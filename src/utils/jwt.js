const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config');

/**
 * Sign a user JWT — scope='user' so router-scope enforcement (SEC-011) can block
 * these from /admin/api/v1/* without a DB lookup.
 */
function signUserToken(payload) {
  return jwt.sign(
    {
      scope: 'user',
      userId: payload.userId,
      telegramId: payload.telegramId,
      bankId: payload.bankId,
      lang: payload.lang,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn },
  );
}

/**
 * Sign a staff access JWT — scope='staff' so router-scope enforcement blocks
 * these from /api/v1/* (Mini App endpoints). Short-lived (30 min by default per
 * answers.md §D) so a stolen/leaked token dies fast even without server-side
 * revocation.
 */
function signStaffToken(payload) {
  return jwt.sign(
    {
      scope: 'staff',
      staffId: payload.staffId,
      roleId: payload.roleId,
      roleName: payload.roleName,
      lang: payload.lang,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.adminExpiresIn },
  );
}

/**
 * Generate a random 7-day refresh token (NOT a JWT — opaque high-entropy string).
 * The token is stored in `staff_refresh_tokens` as a SHA-256 hash; the raw token
 * is only ever returned to the client at issue time.
 *
 * Why not a JWT? Refresh tokens need to be revocable (logout, password change,
 * staff deactivation per FR-ADM-003). An opaque token + DB lookup is the
 * simplest revocable design — a stateless JWT would require a denylist, which
 * defeats the statelessness.
 */
function generateRefreshTokenString() {
  return crypto.randomBytes(48).toString('base64url');
}

function hashRefreshToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

function verify(token) {
  return jwt.verify(token, config.jwt.secret);
}

module.exports = {
  signUserToken,
  signStaffToken,
  generateRefreshTokenString,
  hashRefreshToken,
  verify,
};
