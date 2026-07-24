// Shortlist routes — save-for-later functionality.

import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { authenticateUser } from '../../middleware/userAuth.js';
import * as shortlistController from './shortlist.controller.js';
import { addShortlistSchema, listShortlistSchema, targetUserParamSchema } from './shortlist.schema.js';

const router = Router();

// All shortlist routes require user authentication.
router.use(authenticateUser);

// GET /api/v1/shortlist — list the viewer's shortlisted candidates.
router.get('/', validate(listShortlistSchema, 'query'), shortlistController.listShortlist);

// POST /api/v1/shortlist — add a candidate to shortlist.
router.post('/', validate(addShortlistSchema), shortlistController.addShortlist);

// DELETE /api/v1/shortlist/:target_user_id — remove a candidate from shortlist.
router.delete('/:target_user_id', validate(targetUserParamSchema, 'params'), shortlistController.removeShortlist);

export default router;
