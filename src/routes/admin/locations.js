const express = require('express');
const router = express.Router();

const adminService = require('../../services/adminService');
const locationService = require('../../services/locationService');
const { validate } = require('../../middlewares/validate');
const { success } = require('../../utils/response');
const { adminLocationCreateSchema, adminLocationUpdateSchema } = require('../../schemas/admin');
const { requireRole, Capabilities } = require('../../middlewares/rbac');

/**
 * GET /admin/api/v1/locations — list regions + zones tree (admin view).
 */
router.get('/', requireRole(...Capabilities.manageReferenceData), async (req, res, next) => {
  try {
    const regions = await locationService.listRegions('en');
    const out = [];
    for (const r of regions) {
      const zones = await locationService.listZonesByRegion(r.id, 'en');
      out.push({ ...r, zones });
    }
    return success(res, { locations: out });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /admin/api/v1/locations — add a region or zone.
 */
router.post(
  '/',
  requireRole(...Capabilities.manageReferenceData),
  validate(adminLocationCreateSchema),
  async (req, res, next) => {
    try {
      const data = await adminService.createLocation(req.body, {
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
 * PATCH /admin/api/v1/locations/:id — rename / move / activate / deactivate.
 */
router.patch(
  '/:id',
  requireRole(...Capabilities.manageReferenceData),
  validate(adminLocationUpdateSchema),
  async (req, res, next) => {
    try {
      const data = await adminService.updateLocation(Number(req.params.id), req.body, {
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
