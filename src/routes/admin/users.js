const express = require('express');
const router = express.Router();

const adminService = require('../../services/adminService');
const reportingService = require('../../services/reportingService');
const { validate } = require('../../middlewares/validate');
const { success } = require('../../utils/response');
const { adminUserStatusSchema, adminUserListQuerySchema } = require('../../schemas/admin');
const { requireRole, Capabilities } = require('../../middlewares/rbac');

/**
 * GET /admin/api/v1/users — search/list users for monitoring.
 * Phone is masked (SEC-006); full phone only on the detail view, and only for
 * Support Officer or higher.
 */
router.get(
  '/',
  requireRole(...Capabilities.viewUserReports),
  validate(adminUserListQuerySchema, 'query'),
  async (req, res, next) => {
    try {
      const data = await reportingService.listUsers({
        q: req.query.q,
        bankId: req.query.bankId,
        regionId: req.query.regionId,
        zoneId: req.query.zoneId,
        gradeId: req.query.gradeId,
        isActive: req.query.isActive,
        page: req.query.page,
        pageSize: req.query.pageSize,
      });
      return success(res, data);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /admin/api/v1/users/:id — per-user monitor view.
 * Returns full phone (SEC-006 — staff callers permitted).
 */
router.get('/:id', requireRole(...Capabilities.viewUserReports), async (req, res, next) => {
  try {
    const data = await reportingService.getUserDetail(Number(req.params.id), req.authPayload);
    if (!data) {
      const { ApiError } = require('../../utils/ApiError');
      const i18n = require('../../services/localizationService');
      return next(ApiError.notFound('NOT_FOUND', i18n.t('NOT_FOUND', 'en')));
    }
    return success(res, data);
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /admin/api/v1/users/:id/status — activate/deactivate a user.
 * Super admin, platform admin, or support officer.
 */
router.patch(
  '/:id/status',
  requireRole(...Capabilities.manageUserStatus),
  validate(adminUserStatusSchema),
  async (req, res, next) => {
    try {
      const data = await adminService.setUserStatus(Number(req.params.id), req.body, {
        type: 'staff',
        id: req.staff.id,
        ipAddress: req.ip,
      });
      return success(res, data);
    } catch (err) {
      next(err);
    }
  },
);

module.exports = router;
