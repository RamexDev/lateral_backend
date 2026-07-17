const express = require('express');
const router = express.Router();

const adminService = require('../../services/adminService');
const bankRepo = require('../../repositories/bankRepository');
const { validate } = require('../../middlewares/validate');
const { success } = require('../../utils/response');
const { adminBankCreateSchema, adminBankUpdateSchema } = require('../../schemas/admin');
const { requireRole, Capabilities } = require('../../middlewares/rbac');

/**
 * GET /admin/api/v1/banks — list all banks (admin view, includes inactive).
 */
router.get('/', requireRole(...Capabilities.manageReferenceData), async (req, res, next) => {
  try {
    const page = Number(req.query.page || 1);
    const pageSize = Number(req.query.pageSize || 50);
    const isActive = req.query.isActive === undefined ? undefined : req.query.isActive === 'true';
    const { rows, total } = await bankRepo.list({ page, pageSize, isActive });
    return success(res, { banks: rows, page, pageSize, totalResults: total });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /admin/api/v1/banks — add a new bank (banks table only; never touches locations/grades).
 */
router.post(
  '/',
  requireRole(...Capabilities.manageReferenceData),
  validate(adminBankCreateSchema),
  async (req, res, next) => {
    try {
      const data = await adminService.createBank(req.body, {
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

/**
 * PATCH /admin/api/v1/banks/:id — edit a bank (any subset).
 */
router.patch(
  '/:id',
  requireRole(...Capabilities.manageReferenceData),
  validate(adminBankUpdateSchema),
  async (req, res, next) => {
    try {
      const data = await adminService.updateBank(Number(req.params.id), req.body, {
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
