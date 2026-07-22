// Import Express router.
import { Router } from 'express';
// Import staff authentication middleware.
import { authenticateStaff } from '../../../middleware/auth.js';
// Import validation middleware.
import { validate } from '../../../middleware/validate.js';
// Import notifications controller.
import { sendBroadcast } from '../../notifications/notifications.controller.js';
// Import broadcast schema.
import { broadcastSchema } from '../../notifications/notifications.schema.js';

// Create broadcast router.
const router = Router();

// All broadcast routes require staff authentication.
router.use(authenticateStaff);

// POST /admin/api/v1/notifications/broadcast
router.post('/', validate(broadcastSchema), sendBroadcast);

// Export broadcast router.
export default router;
