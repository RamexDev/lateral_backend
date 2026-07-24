// Import Express router.
import { Router } from 'express';
// Import validation middleware.
import { validate } from '../../middleware/validate.js';
// Import user authentication middleware.
import { authenticateUser } from '../../middleware/userAuth.js';
// Import marketplace controller.
import * as marketplaceController from './marketplace.controller.js';
// Import impressions controller.
import * as impressionsController from '../impressions/impressions.controller.js';
// Import impressions schema.
import { impressionsSchema } from '../impressions/impressions.schema.js';
// Import marketplace schemas.
import { feedQuerySchema, peopleQuerySchema } from './marketplace.schema.js';
// Import rate limit middleware.
import { userFeedRateLimit, userPeopleRateLimit } from '../../middleware/marketplaceRateLimit.js';

// Create marketplace router.
const router = Router();

// All marketplace routes require user authentication.
router.use(authenticateUser);

// GET /api/v1/marketplace/feed
router.get('/feed', userFeedRateLimit, validate(feedQuerySchema, 'query'), marketplaceController.getFeed);

// GET /api/v1/marketplace/people
router.get('/people', userPeopleRateLimit, validate(peopleQuerySchema, 'query'), marketplaceController.getPeople);

// POST /api/v1/marketplace/impressions — record card impressions (F.6).
router.post('/impressions', validate(impressionsSchema), impressionsController.recordImpressions);

// Export marketplace router.
export default router;
