const express = require('express');
const router = express.Router();

const authService = require('../../services/authService');
const { validate } = require('../../middlewares/validate');
const { adminLoginSchema } = require('../../schemas/admin');
const { success } = require('../../utils/response');

/**
 * POST /admin/api/v1/auth/login — staff login (§6.9 implicit; SEC-005 rate-limited).
 * Returns a staff-scoped JWT.
 *
 * Mounted at /auth, so the full path is /admin/api/v1/auth/login.
 */
router.post('/login', validate(adminLoginSchema), async (req, res, next) => {
  try {
    const { staff, token } = await authService.loginStaff(
      req.body.email,
      req.body.password,
      req.ip,
    );
    return success(
      res,
      {
        token,
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

module.exports = router;
