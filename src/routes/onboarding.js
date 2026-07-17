const express = require('express');
const router = express.Router();

const onboardingService = require('../services/onboardingService');
const interestService = require('../services/interestService');
const { validate } = require('../middlewares/validate');
const { requireInitData } = require('../middlewares/initData');
const schemas = require('../schemas/onboarding');
const interestSchemas = require('../schemas/interests');
const { success } = require('../utils/response');
const { ApiError } = require('../utils/ApiError');
const i18n = require('../services/localizationService');

// SEC-003: validate X-Telegram-Init-Data on Mini App requests.
// If the header is absent (bot-gateway internal call), the request is allowed through.
router.use(requireInitData());

/**
 * POST /onboarding/start — begin or resume the registration wizard.
 * Body: { telegramId, telegramUsername? }
 */
router.post('/onboarding/start', validate(schemas.startSchema), async (req, res, next) => {
  try {
    const data = await onboardingService.start(req.body);
    const message = data._message;
    delete data._message;
    delete data._lang;
    return success(res, data, message, 200);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /onboarding/language — set the user's preferred language for the rest of the flow.
 */
router.post('/onboarding/language', validate(schemas.languageSchema), async (req, res, next) => {
  try {
    const data = await onboardingService.setLanguage(req.body);
    return success(res, data);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /onboarding/contact — verify contact-share and proceed to bank selection.
 */
router.post('/onboarding/contact', validate(schemas.contactSchema), async (req, res, next) => {
  try {
    const { data, message, _lang } = await onboardingService.submitContact(req.body);
    return success(res, data, message, 200);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /onboarding/bank — pick the bank the user works for.
 */
router.post('/onboarding/bank', validate(schemas.bankSchema), async (req, res, next) => {
  try {
    const data = await onboardingService.selectBank(req.body);
    return success(res, data);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /onboarding/region — pick a region.
 */
router.post('/onboarding/region', validate(schemas.regionSchema), async (req, res, next) => {
  try {
    const data = await onboardingService.selectRegion(req.body);
    return success(res, data);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /onboarding/zone — pick a zone/subcity.
 */
router.post('/onboarding/zone', validate(schemas.zoneSchema), async (req, res, next) => {
  try {
    const data = await onboardingService.selectZone(req.body);
    return success(res, data);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /onboarding/branch-details — free-text branch name + optional neighborhood.
 */
router.post(
  '/onboarding/branch-details',
  validate(schemas.branchDetailsSchema),
  async (req, res, next) => {
    try {
      const { data, message, _lang } = await onboardingService.submitBranchDetails(req.body);
      return success(res, data, message, 200);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /onboarding/grade-band — pick a grade band (tier 1 of 2-tier grade selection).
 */
router.post('/onboarding/grade-band', validate(schemas.gradeBandSchema), async (req, res, next) => {
  try {
    const data = await onboardingService.selectGradeBand(req.body);
    return success(res, data);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /onboarding/grade — finalize the profile.
 * Returns userId; the bot gateway then issues a user JWT (see /auth/issue-token).
 */
router.post('/onboarding/grade', validate(schemas.gradeSchema), async (req, res, next) => {
  try {
    const data = await onboardingService.selectGrade(req.body);
    const message = i18n.t('onboarding.profile_created', data._lang || 'en');
    delete data._lang;
    return success(res, data, message, 200);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /onboarding/otp/request — OTP fallback (FR-AUTH-002).
 * Stub: in production this would actually send an OTP via SMS.
 */
router.post(
  '/onboarding/otp/request',
  validate(schemas.otpRequestSchema),
  async (req, res, next) => {
    try {
      const session = require('../services/botSessionStore');
      await session.update(req.body.telegramId, {
        step: 'otp_verify',
        phoneNumber: req.body.phoneNumber,
      });
      return success(res, { step: 'otp_verify', otpExpiresInSeconds: 300 });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /onboarding/otp/verify — OTP fallback verification.
 * Stub: in production this would verify the code against Redis-stored OTP.
 * For tests, any 6-digit code is accepted.
 */
router.post('/onboarding/otp/verify', validate(schemas.otpVerifySchema), async (req, res, next) => {
  try {
    if (!/^\d{4,10}$/.test(req.body.code)) {
      throw ApiError.business('OTP_INVALID', 'Incorrect or expired code.');
    }
    const session = require('../services/botSessionStore');
    const sess = await session.get(req.body.telegramId);
    const lang = sess?.languageChoice || 'en';
    const banks = require('../repositories/bankRepository').listActive(lang);
    const list = await banks;
    await session.update(req.body.telegramId, {
      step: 'select_bank',
      phoneNumber: sess?.phoneNumber,
    });
    return success(res, {
      step: 'select_bank',
      banks: list,
      page: 1,
      pageSize: 10,
      totalBanks: list.length,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /auth/issue-token — exchange a freshly-onboarded telegramId for a user JWT.
 * Called by the bot gateway right after profile_created. For security, this only
 * succeeds if the user exists in the DB.
 */
router.post('/auth/issue-token', async (req, res, next) => {
  try {
    const { telegramId } = req.body || {};
    if (!telegramId) {
      throw ApiError.business('VALIDATION_FAILED', 'telegramId is required.');
    }
    const userRepo = require('../repositories/userRepository');
    const user = await userRepo.findByTelegramId(telegramId);
    if (!user) {
      throw ApiError.notFound('NOT_FOUND', 'User not found. Please complete onboarding first.');
    }
    const authService = require('../services/authService');
    const token = authService.issueUserToken(user);
    return success(res, { token, userId: user.id });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /interests/zone-options?telegramId=...&regionId=...
 *
 * In the bot flow, this is invoked server-side by the BotGatewayService after
 * profile_created. For the Mini App / tests, the user is identified by JWT instead
 * (the authUserRouter variant below provides that path).
 */
router.get(
  '/interests/zone-options',
  validate(interestSchemas.zoneOptionsQuerySchema, 'query'),
  async (req, res, next) => {
    try {
      const userRepo = require('../repositories/userRepository');
      const user = await userRepo.findByTelegramId(Number(req.query.telegramId));
      if (!user) {
        throw ApiError.business('PROFILE_INCOMPLETE', i18n.t('PROFILE_INCOMPLETE', 'en'));
      }
      const data = await interestService.getZoneOptions(
        user,
        req.query.regionId ? Number(req.query.regionId) : undefined,
      );
      return success(res, data);
    } catch (err) {
      next(err);
    }
  },
);

module.exports = router;
