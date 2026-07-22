// Import Express router.
import { Router } from 'express';

// Import validation middleware.
import { validate } from '../../../middleware/validate.js';

// Import auth schemas.
import {
  loginSchema,
  refreshTokenSchema,
  logoutSchema
} from './adminAuth.schema.js';

// Import admin auth controller.
import * as adminAuthController from './adminAuth.controller.js';

// Import admin login rate limiter.
import { adminLoginRateLimit } from '../../../middleware/rateLimit.js';

// Import staff authentication middleware.
import { authenticateStaff } from '../../../middleware/auth.js';

// Create admin auth router.
const router = Router();

// POST /admin/api/v1/auth/login
router.post(
  '/login',
  adminLoginRateLimit,
  validate(loginSchema),
  adminAuthController.login
);

// POST /admin/api/v1/auth/refresh
router.post(
  '/refresh',
  validate(refreshTokenSchema),
  adminAuthController.refresh
);

// POST /admin/api/v1/auth/logout
router.post(
  '/logout',
  validate(logoutSchema),
  adminAuthController.logout
);

// GET /admin/api/v1/auth/me
router.get(
  '/me',
  authenticateStaff,
  adminAuthController.me
);

// Export admin auth router.
export default router;
