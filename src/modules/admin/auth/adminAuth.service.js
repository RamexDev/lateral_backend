// Import bcrypt implementation.
import { hash, verify } from '@node-rs/bcrypt';

// Import MySQL pool.
import { pool } from '../../../db/pool.js';

// Import API error class.
import { ApiError } from '../../../lib/errors.js';

// Import token utilities.
import {
  generateRefreshToken,
  sha256,
  signStaffAccessToken,
  getRefreshTokenExpiresAt
} from '../../../lib/adminTokens.js';

// Import audit helper.
import { writeAudit } from '../../../lib/audit.js';

// Return only safe staff fields to the client.
function toPublicStaff(staff) {
  return {
    id: staff.id,
    full_name: staff.full_name,
    email: staff.email,
    role: staff.role,
    preferred_language: staff.preferred_language
  };
}

// Insert a new refresh token row and return the raw token once.
async function insertRefreshToken(staffId) {
  // Generate opaque refresh token.
  const token = generateRefreshToken();

  // Store only SHA-256 hash.
  const tokenHash = sha256(token);

  // Compute expiry timestamp.
  const expiresAt = getRefreshTokenExpiresAt();

  // Persist hashed refresh token.
  await pool.query(
    'INSERT INTO staff_refresh_tokens (staff_id, token_hash, expires_at) VALUES (?, ?, ?)',
    [staffId, tokenHash, expiresAt]
  );

  // Return raw token and expiry.
  return { token, expiresAt };
}

// Revoke all active refresh tokens for a staff account.
async function revokeAllStaffTokens(staffId) {
  await pool.query(
    'UPDATE staff_refresh_tokens SET revoked_at = NOW() WHERE staff_id = ? AND revoked_at IS NULL',
    [staffId]
  );
}

// Revoke one refresh token row by ID.
async function revokeRefreshTokenById(tokenId) {
  await pool.query(
    'UPDATE staff_refresh_tokens SET revoked_at = NOW() WHERE id = ? AND revoked_at IS NULL',
    [tokenId]
  );
}

// Admin login service.
export async function login({ email, password }, context = {}) {
  // Normalize email.
  const normalizedEmail = email.toLowerCase();

  // Fetch staff by email.
  const [rows] = await pool.query(
    'SELECT id, full_name, email, password_hash, role, preferred_language, is_active ' +
    'FROM staff WHERE email = ?',
    [normalizedEmail]
  );

  // Get first matching staff row.
  const staff = rows[0];

  // If staff does not exist, burn time and reject.
  if (!staff) {
    // Reduce timing-based user enumeration.
    await hash(password, 10);

    // Audit failed login.
    await writeAudit({
      actorType: 'system',
      actorId: null,
      action: 'admin_login_failed',
      entityType: 'staff',
      entityId: null,
      metadata: Object.assign({ email: normalizedEmail, reason: 'not_found' }, context)
    });

    // Return generic invalid credentials error.
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  }

  // Compare submitted password with stored bcrypt hash.
  let passwordIsValid = false;
  try {
    passwordIsValid = await verify(password, staff.password_hash);
  } catch {
    passwordIsValid = false;
  }

  // Reject invalid password.
  if (!passwordIsValid) {
    // Audit failed login.
    await writeAudit({
      actorType: 'staff',
      actorId: staff.id,
      action: 'admin_login_failed',
      entityType: 'staff',
      entityId: staff.id,
      metadata: Object.assign({ reason: 'invalid_password' }, context)
    });

    // Return generic invalid credentials error.
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  }

  // Reject disabled staff accounts.
  if (!staff.is_active) {
    // Audit disabled account login attempt.
    await writeAudit({
      actorType: 'staff',
      actorId: staff.id,
      action: 'admin_login_failed',
      entityType: 'staff',
      entityId: staff.id,
      metadata: Object.assign({ reason: 'account_disabled' }, context)
    });

    // Return disabled account error.
    throw new ApiError(403, 'ACCOUNT_DISABLED', 'Staff account is disabled.');
  }

  // Update last login timestamp.
  await pool.query('UPDATE staff SET last_login_at = NOW() WHERE id = ?', [staff.id]);

  // Sign short-lived staff access token.
  const token = signStaffAccessToken(staff);

  // Create rotating refresh token.
  const refresh = await insertRefreshToken(staff.id);

  // Audit successful login.
  await writeAudit({
    actorType: 'staff',
    actorId: staff.id,
    action: 'admin_login_success',
    entityType: 'staff',
    entityId: staff.id,
    metadata: context
  });

  // Return auth payload.
  return {
    token,
    refresh_token: refresh.token,
    refresh_expires_at: refresh.expiresAt,
    staff: toPublicStaff(staff)
  };
}

// Refresh access token service.
export async function refresh({ refresh_token: refreshToken }, context = {}) {
  // Hash presented refresh token.
  const tokenHash = sha256(refreshToken);

  // Fetch refresh token row with related staff.
  const [rows] = await pool.query(
    'SELECT ' +
    'srt.id AS token_id, ' +
    'srt.staff_id, ' +
    'srt.revoked_at, ' +
    'srt.expires_at, ' +
    's.id, ' +
    's.full_name, ' +
    's.email, ' +
    's.role, ' +
    's.preferred_language, ' +
    's.is_active ' +
    'FROM staff_refresh_tokens srt ' +
    'JOIN staff s ON s.id = srt.staff_id ' +
    'WHERE srt.token_hash = ?',
    [tokenHash]
  );

  // Get first matching token row.
  const row = rows[0];

  // Reject unknown refresh token.
  if (!row) {
    throw new ApiError(401, 'INVALID_TOKEN', 'Invalid refresh token.');
  }

  // Detect reuse of a revoked refresh token.
  if (row.revoked_at) {
    // Revoke all active tokens for this staff account.
    await revokeAllStaffTokens(row.staff_id);

    // Audit possible token theft/reuse.
    await writeAudit({
      actorType: 'staff',
      actorId: row.staff_id,
      action: 'admin_refresh_token_reuse_detected',
      entityType: 'staff_refresh_token',
      entityId: row.token_id,
      metadata: context
    });

    // Return invalid token error.
    throw new ApiError(401, 'INVALID_TOKEN', 'Invalid refresh token.');
  }

  // Reject expired refresh token.
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    // Revoke expired token if not already revoked.
    await revokeRefreshTokenById(row.token_id);

    // Audit expired refresh attempt.
    await writeAudit({
      actorType: 'staff',
      actorId: row.staff_id,
      action: 'admin_refresh_token_expired',
      entityType: 'staff_refresh_token',
      entityId: row.token_id,
      metadata: context
    });

    // Return invalid token error.
    throw new ApiError(401, 'INVALID_TOKEN', 'Refresh token expired.');
  }

  // Reject disabled staff accounts.
  if (!row.is_active) {
    // Revoke presented token.
    await revokeRefreshTokenById(row.token_id);

    // Audit disabled refresh attempt.
    await writeAudit({
      actorType: 'staff',
      actorId: row.staff_id,
      action: 'admin_refresh_token_disabled_staff',
      entityType: 'staff_refresh_token',
      entityId: row.token_id,
      metadata: context
    });

    // Return disabled account error.
    throw new ApiError(403, 'ACCOUNT_DISABLED', 'Staff account is disabled.');
  }

  // Rotate: revoke used refresh token.
  await revokeRefreshTokenById(row.token_id);

  // Issue new refresh token.
  const newRefresh = await insertRefreshToken(row.staff_id);

  // Issue new access token.
  const token = signStaffAccessToken(row);

  // Audit successful refresh.
  await writeAudit({
    actorType: 'staff',
    actorId: row.staff_id,
    action: 'admin_token_refresh_success',
    entityType: 'staff_refresh_token',
    entityId: row.token_id,
    metadata: context
  });

  // Return rotated tokens.
  return {
    token,
    refresh_token: newRefresh.token,
    refresh_expires_at: newRefresh.expiresAt
  };
}

// Logout service.
export async function logout({ refresh_token: refreshToken }, context = {}) {
  // Hash presented refresh token.
  const tokenHash = sha256(refreshToken);

  // Find refresh token row.
  const [rows] = await pool.query(
    'SELECT id, staff_id, revoked_at FROM staff_refresh_tokens WHERE token_hash = ?',
    [tokenHash]
  );

  // Get first matching row.
  const row = rows[0];

  // Revoke only if it exists and is not already revoked.
  if (row && !row.revoked_at) {
    // Mark token revoked.
    await revokeRefreshTokenById(row.id);

    // Audit logout.
    await writeAudit({
      actorType: 'staff',
      actorId: row.staff_id,
      action: 'admin_logout',
      entityType: 'staff_refresh_token',
      entityId: row.id,
      metadata: context
    });
  }

  // Always return success to avoid leaking token state.
  return { logged_out: true };
}

// Get current staff profile.
export async function getMe(staffId) {
  // Fetch staff by ID.
  const [rows] = await pool.query(
    'SELECT id, full_name, email, role, preferred_language, is_active, created_at, last_login_at ' +
    'FROM staff WHERE id = ?',
    [staffId]
  );

  // Get first matching staff row.
  const staff = rows[0];

  // Reject missing staff.
  if (!staff) {
    throw new ApiError(401, 'INVALID_TOKEN', 'Staff account not found.');
  }

  // Reject disabled staff.
  if (!staff.is_active) {
    throw new ApiError(403, 'ACCOUNT_DISABLED', 'Staff account is disabled.');
  }

  // Return safe staff payload.
  return Object.assign(toPublicStaff(staff), {
    is_active: Boolean(staff.is_active),
    created_at: staff.created_at,
    last_login_at: staff.last_login_at
  });
}
