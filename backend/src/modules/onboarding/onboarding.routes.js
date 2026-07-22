// Import Express router.
import { Router } from 'express';

// Import validation middleware.
import { validate } from '../../middleware/validate.js';

// Import onboarding controller.
import * as onboardingController from './onboarding.controller.js';

// Import onboarding schemas.
import {
  startSchema,
  languageSchema,
  contactSchema,
  bankSchema,
  regionSchema,
  zoneSchema,
  otpRequestSchema,
  otpVerifySchema
} from './onboarding.schema.js';

// Create onboarding router.
const router = Router();

// POST /api/v1/onboarding/start
router.post('/start', validate(startSchema), onboardingController.start);

// POST /api/v1/onboarding/language
router.post('/language', validate(languageSchema), onboardingController.selectLanguage);

// POST /api/v1/onboarding/contact
router.post('/contact', validate(contactSchema), onboardingController.shareContact);

// POST /api/v1/onboarding/bank
router.post('/bank', validate(bankSchema), onboardingController.selectBank);

// POST /api/v1/onboarding/region
router.post('/region', validate(regionSchema), onboardingController.selectRegion);

// POST /api/v1/onboarding/zone
router.post('/zone', validate(zoneSchema), onboardingController.selectZone);

// POST /api/v1/onboarding/otp/request
router.post('/otp/request', validate(otpRequestSchema), onboardingController.requestOtp);

// POST /api/v1/onboarding/otp/verify
router.post('/otp/verify', validate(otpVerifySchema), onboardingController.verifyOtp);

// Export onboarding router.
export default router;
