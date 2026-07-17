const express = require('express');
const router = express.Router();

const adminService = require('../../services/adminService');
const gradeRepo = require('../../repositories/gradeRepository');
const { validate } = require('../../middlewares/validate');
const { success } = require('../../utils/response');
const { adminGradeCreateSchema, adminGradeUpdateSchema } = require('../../schemas/admin');
const { requireRole, Capabilities } = require('../../middlewares/rbac');

/**
 * GET /admin/api/v1/grades — list all grades (admin view).
 */
router.get('/', requireRole(...Capabilities.manageReferenceData), async (req, res, next) => {
  try {
    const grades = await gradeRepo.listActive('en');
    return success(res, { grades });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /admin/api/v1/grades — add a new grade.
 */
router.post(
  '/',
  requireRole(...Capabilities.manageReferenceData),
  validate(adminGradeCreateSchema),
  async (req, res, next) => {
    try {
      const data = await adminService.createGrade(req.body, {
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
 * PATCH /admin/api/v1/grades/:id — edit a grade.
 */
router.patch(
  '/:id',
  requireRole(...Capabilities.manageReferenceData),
  validate(adminGradeUpdateSchema),
  async (req, res, next) => {
    try {
      const data = await adminService.updateGrade(Number(req.params.id), req.body, {
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
