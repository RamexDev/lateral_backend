const express = require('express');
const router = express.Router();

const notificationService = require('../../services/notificationService');
const { validate } = require('../../middlewares/validate');
const { success } = require('../../utils/response');
const { adminBroadcastSchema } = require('../../schemas/admin');
const { requireRole, Capabilities } = require('../../middlewares/rbac');
const i18n = require('../../services/localizationService');

/**
 * POST /admin/api/v1/notifications/broadcast
 * Sends a promotion to a chosen audience (§6.8).
 */
router.post(
  '/broadcast',
  requireRole(...Capabilities.sendBroadcast),
  validate(adminBroadcastSchema),
  async (req, res, next) => {
    try {
      const data = await notificationService.broadcast(
        { segmentFilter: req.body.segmentFilter, message: req.body.message },
        { type: 'staff', id: req.staff.id, ipAddress: req.ip },
      );
      const message = i18n.t('BROADCAST_QUEUED', req.staff.preferred_language || 'en', {
        count: data.queuedRecipients,
      });
      return success(res, data, message, 200);
    } catch (err) {
      next(err);
    }
  },
);

module.exports = router;
