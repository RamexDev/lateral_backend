// Import Express router.
import { Router } from 'express';
// Import validation middleware.
import { validate } from '../../middleware/validate.js';
// Import user authentication middleware.
import { authenticateUser } from '../../middleware/userAuth.js';
// Import notifications controller.
import * as notificationsController from './notifications.controller.js';
// Import notifications schemas.
import { listNotificationsSchema, notificationIdParamSchema } from './notifications.schema.js';

// Create notifications router.
const router = Router();

// All notification routes require user authentication.
router.use(authenticateUser);

// GET /api/v1/notifications/me — list notifications (F.4: supports ?unread_only=).
router.get('/me', validate(listNotificationsSchema, 'query'), notificationsController.listNotifications);

// POST /api/v1/notifications/me/mark-read — mark all as read (F.4).
router.post('/me/mark-read', notificationsController.markAllRead);

// POST /api/v1/notifications/:id/read — mark one as read (F.4).
router.post('/:id/read', validate(notificationIdParamSchema, 'params'), notificationsController.markRead);

// Export notifications router.
export default router;
