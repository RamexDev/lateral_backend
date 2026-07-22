// Import Express router.
import { Router } from 'express';
// Import validation middleware.
import { validate } from '../../middleware/validate.js';
// Import user authentication middleware.
import { authenticateUser } from '../../middleware/userAuth.js';
// Import notifications controller.
import * as notificationsController from './notifications.controller.js';
// Import notifications schemas.
import { listNotificationsSchema } from './notifications.schema.js';

// Create notifications router.
const router = Router();

// All notification routes require user authentication.
router.use(authenticateUser);

// GET /api/v1/notifications/me
router.get('/me', validate(listNotificationsSchema, 'query'), notificationsController.listNotifications);

// Export notifications router.
export default router;
