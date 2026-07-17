const express = require('express');
const router = express.Router();

const adminService = require('../../services/adminService');
const { validate } = require('../../middlewares/validate');
const { success } = require('../../utils/response');
const { adminStaffCreateSchema } = require('../../schemas/admin');
const { requireRole, Capabilities } = require('../../middlewares/rbac');

/**
 * GET /admin/api/v1/staff — list staff accounts.
 * Super admin only (§11).
 */
router.get('/', requireRole(...Capabilities.manageStaff), async (req, res, next) => {
  try {
    const page = Number(req.query.page || 1);
    const pageSize = Number(req.query.pageSize || 50);
    const isActive = req.query.isActive === undefined ? undefined : req.query.isActive === 'true';
    const { rows, total } = await adminService.listStaff({ page, pageSize, isActive });
    return success(res, { staff: rows, page, pageSize, totalResults: total });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /admin/api/v1/staff/roles — list available roles (for the staff creation form).
 */
router.get('/roles', requireRole(...Capabilities.manageStaff), async (req, res, next) => {
  try {
    const roles = await adminService.listRoles();
    return success(res, { roles });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /admin/api/v1/staff — create a new staff account.
 * Super admin only (§11).
 */
router.post(
  '/',
  requireRole(...Capabilities.manageStaff),
  validate(adminStaffCreateSchema),
  async (req, res, next) => {
    try {
      const data = await adminService.createStaff(req.body, {
        type: 'staff',
        id: req.staff.id,
        ipAddress: req.ip,
      });
      return success(res, data, undefined, 201);
    } catch (err) {
      next(err);
    }
  },
);

module.exports = router;
