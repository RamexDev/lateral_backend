const express = require('express');
const router = express.Router();

const { requireUser } = require('../middlewares/auth');
const interestService = require('../services/interestService');
const profileService = require('../services/profileService');
const matchingService = require('../services/matchingService');
const purchaseService = require('../services/purchaseService');
const notificationService = require('../services/notificationService');
const { validate } = require('../middlewares/validate');
const { feedLimiter, purchaseLimiter } = require('../middlewares/rateLimit');
const interestSchemas = require('../schemas/interests');
const profileSchemas = require('../schemas/profile');
const marketplaceSchemas = require('../schemas/marketplace');
const { success } = require('../utils/response');
const i18n = require('../services/localizationService');

// All routes here require a user JWT.
router.use(requireUser());

// ─── Interests (authenticated) ───────────────────────────────────────────────

router.post('/interests/toggle', validate(interestSchemas.toggleSchema), async (req, res, next) => {
  try {
    const data = await interestService.toggleZone(req.user, req.body);
    return success(res, data);
  } catch (err) {
    next(err);
  }
});

router.post(
  '/interests/change-region',
  validate(interestSchemas.changeRegionSchema),
  async (req, res, next) => {
    try {
      // Authenticated variant — uses req.user, not telegramId.
      const data = await interestService.changeRegion(req.user, req.body.newRegionId);
      const customMessage =
        data.currentSelectionCount > 0
          ? `Your ${data.currentSelectionCount} selections in other regions are still kept. Confirm when done.`
          : undefined;
      return success(res, data, customMessage, 200);
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/interests/confirm',
  validate(interestSchemas.confirmSchema),
  async (req, res, next) => {
    try {
      // Confirm by user, not telegramId.
      const data = await interestService.confirmSelections(req.user);
      const message = i18n.t('INTEREST_CONFIRMED', req.user.preferred_language);
      return success(res, data, message, 200);
    } catch (err) {
      next(err);
    }
  },
);

router.get('/interests/me', async (req, res, next) => {
  try {
    const interests = await interestService.listMine(req.user);
    return success(res, { interests });
  } catch (err) {
    next(err);
  }
});

router.delete('/interests/:id', async (req, res, next) => {
  try {
    const data = await interestService.deleteMine(req.user, Number(req.params.id));
    return success(res, data);
  } catch (err) {
    next(err);
  }
});

// ─── Profile (§6.5) ──────────────────────────────────────────────────────────

router.get('/me', async (req, res, next) => {
  try {
    const data = await profileService.getMe(req.user);
    return success(res, data);
  } catch (err) {
    next(err);
  }
});

router.put('/me', validate(profileSchemas.updateMeSchema), async (req, res, next) => {
  try {
    const data = await profileService.updateMe(req.user, req.body, { ipAddress: req.ip });
    return success(res, data);
  } catch (err) {
    next(err);
  }
});

// ─── Marketplace feed (§6.6) ─────────────────────────────────────────────────

router.get(
  '/marketplace/feed',
  feedLimiter,
  validate(marketplaceSchemas.feedQuerySchema, 'query'),
  async (req, res, next) => {
    try {
      const data = await matchingService.getFeed(req.user, {
        page: req.query.page,
        pageSize: req.query.pageSize,
        fresh: req.query.fresh,
      });
      const message =
        data.results.length === 0 ? i18n.t('NO_MATCHES', req.user.preferred_language) : undefined;
      return success(res, data, message, 200);
    } catch (err) {
      next(err);
    }
  },
);

// ─── Purchases & payments (§6.7) ────────────────────────────────────────────

router.post(
  '/purchases',
  purchaseLimiter,
  validate(marketplaceSchemas.purchaseSchema),
  async (req, res, next) => {
    try {
      const data = await purchaseService.initiatePurchase(req.user, req.body.targetUserId);
      return success(res, data, undefined, 200);
    } catch (err) {
      next(err);
    }
  },
);

router.get('/me/purchases', async (req, res, next) => {
  try {
    const purchases = await purchaseService.listMine(req.user);
    return success(res, { purchases });
  } catch (err) {
    next(err);
  }
});

// ─── Notifications (§6.8) ────────────────────────────────────────────────────

router.get('/me/notifications', async (req, res, next) => {
  try {
    const notifications = await notificationService.listForUser(req.user);
    return success(res, { notifications });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
