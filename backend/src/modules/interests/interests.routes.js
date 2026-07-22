// Import Express router.
import { Router } from 'express';

// Import validation middleware.
import { validate } from '../../middleware/validate.js';

// Import user authentication middleware.
import { authenticateUser } from '../../middleware/userAuth.js';

// Import interests controller.
import * as interestsController from './interests.controller.js';

// Import interests schemas.
import {
  saveInterestsSchema,
  optionsQuerySchema,
  interestIdParamSchema
} from './interests.schema.js';

// Create interests router.
const router = Router();

// All interest routes require user authentication.
router.use(authenticateUser);

// GET /api/v1/interests/me
router.get('/me', interestsController.getMyInterests);

// GET /api/v1/interests/options
router.get('/options', validate(optionsQuerySchema, 'query'), interestsController.getOptions);

// PUT /api/v1/interests/me
router.put('/me', validate(saveInterestsSchema), interestsController.saveInterests);

// DELETE /api/v1/interests/:id
router.delete('/:id', validate(interestIdParamSchema, 'params'), interestsController.deleteInterest);

// Export interests router.
export default router;
