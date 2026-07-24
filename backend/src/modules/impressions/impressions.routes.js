// Impressions routes.

import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { authenticateUser } from '../../middleware/userAuth.js';
import * as impressionsController from './impressions.controller.js';
import { impressionsSchema } from './impressions.schema.js';

const router = Router();

// All impressions routes require user authentication.
router.use(authenticateUser);

// POST /api/v1/marketplace/impressions — record a batch of card impressions.
router.post('/impressions', validate(impressionsSchema), impressionsController.recordImpressions);

export default router;
