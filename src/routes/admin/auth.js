const express = require('express');
const router = express.Router();

const authService = require('../../services/authService');
const { validate } = require('../../middlewares/validate');
const { adminLoginSchema, adminRefreshSchema } = require('../../schemas/admin');
const { success } = require('../../utils/response');

/**
 * POST /admin/api/v1/auth/login — staff login (§6.9 implicit; SEC-005 rate-limited).
 *
 * Returns a 30-minute staff-scoped access JWT + a 7-day refresh token
 * (answers.md §D). The refresh token is stored hashed in staff_refresh_tokens
 * so it can be revoked on logout, password change, or staff deactivation.
 *
 * Mounted at /auth, so the full path is /admin/api/v1/auth/login.
 */
router.post('/login', validate(adminLoginSchema), async (req, res, next) => {
  try {
    const { staff, token, refreshToken, refreshExpiresAt } = await authService.loginStaff(
      req.body.email,
      req.body.password,
      req.ip,
    );
    return success(
      res,
      {
        token,
        refreshToken,
        refreshExpiresAt,
        staff: {
          id: staff.id,
          fullName: staff.full_name,
          email: staff.email,
          roleId: staff.role_id,
          preferredLanguage: staff.preferred_language,
        },
      },
      undefined,
      200,
    );
  } catch (err) {
    next(err);
  }
});

/**
 * POST /admin/api/v1/auth/refresh — exchange a valid refresh token for a new
 * access token + rotated refresh token (answers.md §D).
 *
 * The old refresh token is revoked on use (rotation). Reuse of a revoked
 * token triggers defensive revocation of ALL tokens for that staff member
 * (possible theft — see refreshTokenService.consume).
 */
router.post('/refresh', validate(adminRefreshSchema), async (req, res, next) => {
  try {
    const { staff, token, refreshToken, refreshExpiresAt } =
      await authService.refreshStaffToken(req.body.refreshToken);
    return success(
      res,
      {
        token,
        refreshToken,
        refreshExpiresAt,
        staff: {
          id: staff.id,
          fullName: staff.full_name,
          email: staff.email,
          roleId: staff.role_id,
          preferredLanguage: staff.preferred_language,
        },
      },
      undefined,
      200,
    );
  } catch (err) {
    next(err);
  }
});

/**
 * POST /admin/api/v1/auth/logout — revoke the supplied refresh token (answers.md §D).
 *
 * Optionally authenticated (if the access token is still valid, we use the
 * staff id from it for the audit log; otherwise we just revoke the refresh
 * token and return 200).
 *
 * Idempotent — calling logout with an unknown or already-revoked refresh token
 * returns 200 with no error.
 */
router.post('/logout', async (req, res, next) => {
  try {
    const refreshToken = req.body?.refreshToken;
    // Best-effort staff identification for the audit log — don't fail logout
    // if the access token is expired/missing.
    let staff = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const { staff: s } = await authService.getStaffFromToken(
          authHeader.slice('Bearer '.length),
        );
        staff = s;
      } catch {
        /* token expired or invalid — proceed with logout anyway */
      }
    }
    await authService.logoutStaff(refreshToken, staff, req.ip);
    return success(res, { loggedOut: true }, undefined, 200);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
