/**
 * RefreshTokenService — issue, consume (rotate), and revoke staff refresh tokens
 * (SEC-009, answers.md §D).
 *
 * Refresh tokens are opaque high-entropy strings (not JWTs) stored as SHA-256
 * hashes in `staff_refresh_tokens`. Rotation: when a refresh token is used to
 * mint a new access token, the old refresh token is revoked and a new one is
 * issued. This bounds the blast radius of a leaked refresh token — an attacker
 * who replays it after the legitimate client refreshes gets a 401.
 */
const { StaffRefreshToken, Staff } = require('../db/models');
const { Op } = require('sequelize');
const jwtUtil = require('../utils/jwt');
const config = require('../config');
const { ApiError } = require('../utils/ApiError');
const i18n = require('./localizationService');

/**
 * Issue a new refresh token for a staff member. Does NOT revoke existing tokens
 * for the staff member — that's the caller's responsibility (e.g. on logout).
 *
 * @param {number} staffId
 * @returns {Promise<{rawToken: string, expiresAt: Date}>}
 */
async function issue(staffId) {
  const rawToken = jwtUtil.generateRefreshTokenString();
  const tokenHash = jwtUtil.hashRefreshToken(rawToken);
  const ttlMs = parseDurationToMs(config.jwt.adminRefreshExpiresIn);
  const expiresAt = new Date(Date.now() + ttlMs);

  await StaffRefreshToken.create({
    staff_id: staffId,
    token_hash: tokenHash,
    expires_at: expiresAt,
    revoked_at: null,
  });

  return { rawToken, expiresAt };
}

/**
 * Consume a refresh token: verify it's valid + active + not expired, revoke
 * it, and issue a fresh one (rotation). Returns the staff member + the new
 * refresh token so the caller can issue a new access token too.
 *
 * Throws INVALID_TOKEN if the token is unknown, expired, or already revoked.
 */
async function consume(rawToken) {
  if (!rawToken || typeof rawToken !== 'string') {
    throw ApiError.unauthorized('INVALID_TOKEN', i18n.t('INVALID_TOKEN', 'en'));
  }
  const tokenHash = jwtUtil.hashRefreshToken(rawToken);
  const record = await StaffRefreshToken.findOne({
    where: { token_hash: tokenHash },
    raw: true,
  });
  if (!record) {
    throw ApiError.unauthorized('INVALID_TOKEN', i18n.t('INVALID_TOKEN', 'en'));
  }
  if (record.revoked_at) {
    // Reuse of a revoked token — possible token theft. Revoke ALL tokens for
    // this staff member as a defensive measure (the "reuse detection" pattern
    // from RFC 6749 §10.4).
    await revokeAllForStaff(record.staff_id);
    throw ApiError.unauthorized('INVALID_TOKEN', i18n.t('INVALID_TOKEN', 'en'));
  }
  if (new Date(record.expires_at).getTime() < Date.now()) {
    // Expired — mark revoked so it can't be reused.
    await StaffRefreshToken.update(
      { revoked_at: new Date() },
      { where: { id: record.id } },
    );
    throw ApiError.unauthorized('INVALID_TOKEN', i18n.t('INVALID_TOKEN', 'en'));
  }

  // Revoke the consumed token + issue a fresh one (rotation).
  await StaffRefreshToken.update(
    { revoked_at: new Date() },
    { where: { id: record.id } },
  );
  const staff = await Staff.findByPk(record.staff_id, { raw: true });
  if (!staff || !staff.is_active) {
    throw ApiError.unauthorized('INVALID_TOKEN', i18n.t('INVALID_TOKEN', 'en'));
  }
  const fresh = await issue(staff.id);
  return { staff, rawToken: fresh.rawToken, expiresAt: fresh.expiresAt };
}

/**
 * Revoke a single refresh token (by raw value). Used by POST /auth/logout.
 * No-op if the token is unknown — logout should always succeed for the client.
 */
async function revoke(rawToken) {
  if (!rawToken) return;
  const tokenHash = jwtUtil.hashRefreshToken(rawToken);
  await StaffRefreshToken.update(
    { revoked_at: new Date() },
    { where: { token_hash: tokenHash, revoked_at: null } },
  );
}

/**
 * Revoke ALL refresh tokens for a staff member. Used on:
 *   - password change
 *   - staff deactivation (FR-ADM-003)
 *   - refresh-token reuse detection (defensive)
 */
async function revokeAllForStaff(staffId) {
  await StaffRefreshToken.update(
    { revoked_at: new Date() },
    { where: { staff_id: staffId, revoked_at: null } },
  );
}

/**
 * Periodic cleanup helper — delete rows whose tokens have expired AND been
 * revoked (or just expired past a grace period). Intended to be called by the
 * scheduler, not on the hot path.
 */
async function purgeExpired() {
  const cutoff = new Date();
  const deleted = await StaffRefreshToken.destroy({
    where: {
      [Op.or]: [
        { expires_at: { [Op.lt]: cutoff } },
        { revoked_at: { [Op.ne]: null } },
      ],
    },
  });
  return deleted;
}

function parseDurationToMs(duration) {
  if (typeof duration === 'number') return duration;
  const match = String(duration).match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000; // default 7d
  const num = Number(match[1]);
  const unit = match[2];
  const multipliers = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return num * multipliers[unit];
}

module.exports = { issue, consume, revoke, revokeAllForStaff, purgeExpired };
