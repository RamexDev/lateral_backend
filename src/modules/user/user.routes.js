// Import Express router.
import { Router } from 'express';

// Import validation middleware.
import { validate } from '../../middleware/validate.js';

// Import user authentication middleware.
import { authenticateUser } from '../../middleware/userAuth.js';

// Import user controller.
import * as userController from './user.controller.js';

// Import user schemas.
import {
  telegramAuthSchema,
  issueTokenSchema,
  updateProfileSchema
} from './user.schema.js';

// Create user router.
const router = Router();

// POST /api/v1/auth/telegram
router.post('/auth/telegram', validate(telegramAuthSchema), userController.authTelegram);

// POST /api/v1/auth/issue-token
// Non-production helper for bot/gateway flows and local testing.
router.post('/auth/issue-token', validate(issueTokenSchema), userController.issueToken);

// GET /api/v1/me
router.get('/me', authenticateUser, userController.getMe);

// PUT /api/v1/me
router.put('/me', authenticateUser, validate(updateProfileSchema), userController.updateProfile);

// GET /api/v1/me/completeness
router.get('/me/completeness', authenticateUser, userController.getCompleteness);

// Export user router.
export default router;
