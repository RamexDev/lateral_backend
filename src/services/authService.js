/**
 * AuthService — JWT issuance & verification for both user and staff.
 *
 * User auth flow (§6.3): onboarding creates the users row, then AuthService
 * issues a user-scoped JWT. Subsequent /api/v1/* requests verify the JWT.
 *
 * Staff auth flow (§6.9, SEC-002, SEC-005): email + bcrypt-hashed password login,
 * rate-limited per IP, staff-scoped JWT issued on success.
 */
const bcrypt = require('../utils/password');
const jwtUtil = require('../utils/jwt');
const staffRepo = require('../repositories/staffRepository');
const userRepo = require('../repositories/userRepository');
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
 * Returns the staff record + signed JWT.
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

  await auditService.log({
    actorType: 'staff',
    actorId: staff.id,
    action: 'staff.login',
    entityType: 'staff',
    entityId: staff.id,
    ipAddress,
  });

  return { staff, token };
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
  getStaffFromToken,
  getUserFromToken,
};
