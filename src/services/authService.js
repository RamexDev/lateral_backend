/**
 * AuthService — JWT issuance & verification for both user and staff.
 *
 * User auth flow (§6.3): onboarding creates the users row, then AuthService
 * issues a user-scoped JWT. Subsequent /api/v1/* requests verify the JWT.
 *
 * Staff auth flow (§6.9, SEC-002, SEC-005, SEC-009, answers.md §D):
 *   - Login: email + bcrypt-hashed password, rate-limited per IP.
 *   - On success: issue a 30-minute access JWT + a 7-day refresh token (stored
 *     as a hash in staff_refresh_tokens).
 *   - Refresh: POST /auth/refresh with the refresh token → new access token +
 *     rotated refresh token (old one revoked).
 *   - Logout: POST /auth/logout revokes the refresh token.
 *   - Password change / staff deactivation (FR-ADM-003): revoke ALL refresh
 *     tokens for the staff member.
 */
const bcrypt = require('../utils/password');
const jwtUtil = require('../utils/jwt');
const staffRepo = require('../repositories/staffRepository');
const userRepo = require('../repositories/userRepository');
const refreshTokenService = require('./refreshTokenService');
const { ApiError } = require('../utils/ApiError');
const i18n = require('./localizationService');
const auditService = require('./auditService');
const { getBackend } = require('../utils/cache');

/**
 * Issue a JWT for a freshly registered / logged-in user.
 * @param {object} user  users row
 */
function issueUserToken(user) {
  return jwtUtil.signUserToken({
    userId: user.id,
    telegramId: user.telegram_id,
    bankId: user.bank_id,
    lang: user.preferred_language,
  });
}

/**
 * Staff login — email + password. Rate-limited per IP (SEC-005).
 * Returns the staff record + 30-minute access JWT + 7-day refresh token.
 */
async function loginStaff(email, password, ipAddress) {
  // SEC-005: simple per-IP rate limiter on admin login.
  await enforceLoginRateLimit(ipAddress);

  const staff = await staffRepo.findByEmail(email.toLowerCase().trim());
  if (!staff) {
    await registerLoginFailure(ipAddress);
    throw ApiError.unauthorized('INVALID_CREDENTIALS', i18n.t('INVALID_CREDENTIALS', 'en'));
  }
  if (!staff.is_active) {
    throw ApiError.forbidden('ACCOUNT_DISABLED', i18n.t('ACCOUNT_DISABLED', 'en'));
  }

  const ok = await bcrypt.compare(password, staff.password_hash);
  if (!ok) {
    await registerLoginFailure(ipAddress);
    throw ApiError.unauthorized('INVALID_CREDENTIALS', i18n.t('INVALID_CREDENTIALS', 'en'));
  }

  // Clear failure counter on success.
  await clearLoginFailures(ipAddress);
  await staffRepo.touchLastLogin(staff.id);

  const roleRow = await staffRepo.findRoleByName(
    (await staffRepo.findByIdWithRole(staff.id)).role_name,
  );

  const token = jwtUtil.signStaffToken({
    staffId: staff.id,
    roleId: staff.role_id,
    roleName: roleRow?.name,
    lang: staff.preferred_language,
  });

  // Issue a 7-day refresh token alongside the access token.
  const { rawToken: refreshToken, expiresAt: refreshExpiresAt } =
    await refreshTokenService.issue(staff.id);

  await auditService.log({
    actorType: 'staff',
    actorId: staff.id,
    action: 'staff.login',
    entityType: 'staff',
    entityId: staff.id,
    ipAddress,
  });

  return { staff, token, refreshToken, refreshExpiresAt };
}

/**
 * Refresh a staff access token using a valid refresh token. Rotates the
 * refresh token (old one revoked, new one issued).
 */
async function refreshStaffToken(rawRefreshToken) {
  const { staff, rawToken: newRefreshToken, expiresAt } =
    await refreshTokenService.consume(rawRefreshToken);

  const roleRow = await staffRepo.findRoleByName(
    (await staffRepo.findByIdWithRole(staff.id)).role_name,
  );

  const accessToken = jwtUtil.signStaffToken({
    staffId: staff.id,
    roleId: staff.role_id,
    roleName: roleRow?.name,
    lang: staff.preferred_language,
  });

  return {
    staff,
    token: accessToken,
    refreshToken: newRefreshToken,
    refreshExpiresAt: expiresAt,
  };
}

/**
 * Logout — revoke the supplied refresh token. Idempotent (no-op if unknown).
 */
async function logoutStaff(rawRefreshToken, staff, ipAddress) {
  await refreshTokenService.revoke(rawRefreshToken);
  if (staff) {
    await auditService.log({
      actorType: 'staff',
      actorId: staff.id,
      action: 'staff.logout',
      entityType: 'staff',
      entityId: staff.id,
      ipAddress,
    });
  }
}

async function getStaffFromToken(token) {
  let payload;
  try {
    payload = jwtUtil.verify(token);
  } catch {
    throw ApiError.unauthorized('INVALID_TOKEN', i18n.t('INVALID_TOKEN', 'en'));
  }
  if (payload.scope !== 'staff') {
    throw ApiError.unauthorized(
      'INVALID_TOKEN_FOR_ROUTER',
      i18n.t('INVALID_TOKEN_FOR_ROUTER', 'en'),
    );
  }
  const staff = await staffRepo.findById(payload.staffId);
  if (!staff || !staff.is_active) {
    throw ApiError.unauthorized('INVALID_TOKEN', i18n.t('INVALID_TOKEN', 'en'));
  }
  return { staff, payload };
}

async function getUserFromToken(token) {
  let payload;
  try {
    payload = jwtUtil.verify(token);
  } catch {
    throw ApiError.unauthorized('INVALID_TOKEN', i18n.t('INVALID_TOKEN', 'en'));
  }
  if (payload.scope !== 'user') {
    throw ApiError.unauthorized(
      'INVALID_TOKEN_FOR_ROUTER',
      i18n.t('INVALID_TOKEN_FOR_ROUTER', 'en'),
    );
  }
  const user = await userRepo.findById(payload.userId);
  if (!user || !user.is_active) {
    throw ApiError.unauthorized('INVALID_TOKEN', i18n.t('INVALID_TOKEN', 'en'));
  }
  return { user, payload };
}

// ─── SEC-005: login rate limiting (per IP) ────────────────────────────────────

const MAX_FAILURES = 5;
const LOCKOUT_SECONDS = 900; // 15 min after the 5th failure.

async function enforceLoginRateLimit(ipAddress) {
  if (!ipAddress) return;
  const cache = await getBackend();
  const key = `rl:admin-login:${ipAddress}`;
  const raw = await cache.get(key);
  const failures = Number(raw || 0);
  if (failures >= MAX_FAILURES) {
    throw ApiError.forbidden('RATE_LIMITED', i18n.t('RATE_LIMITED', 'en'));
  }
}

async function registerLoginFailure(ipAddress) {
  if (!ipAddress) return;
  const cache = await getBackend();
  const key = `rl:admin-login:${ipAddress}`;
  const next = await cache.incr(key);
  if (next === 1) {
    // First failure in the window — set the TTL.
    await cache.expire(key, LOCKOUT_SECONDS);
  }
}

async function clearLoginFailures(ipAddress) {
  if (!ipAddress) return;
  const cache = await getBackend();
  await cache.del(`rl:admin-login:${ipAddress}`);
}

module.exports = {
  issueUserToken,
  loginStaff,
  refreshStaffToken,
  logoutStaff,
  getStaffFromToken,
  getUserFromToken,
};
