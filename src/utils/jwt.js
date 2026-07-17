const jwt = require('jsonwebtoken');
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
 * Sign a staff JWT — scope='staff' so router-scope enforcement blocks these
 * from /api/v1/* (Mini App endpoints).
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

function verify(token) {
  return jwt.verify(token, config.jwt.secret);
}

module.exports = { signUserToken, signStaffToken, verify };
