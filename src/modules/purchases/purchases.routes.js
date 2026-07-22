// Import Express router.
import { Router } from 'express';
// Import validation middleware.
import { validate } from '../../middleware/validate.js';
// Import user authentication middleware.
import { authenticateUser } from '../../middleware/userAuth.js';
// Import purchases controller.
import * as purchasesController from './purchases.controller.js';
// Import purchases schemas.
import { createPurchaseSchema, listPurchasesSchema } from './purchases.schema.js';
// Import rate limit middleware.
import { purchaseRateLimit } from '../../middleware/purchaseRateLimit.js';

// Create purchases router.
const router = Router();

// All purchase routes require user authentication.
router.use(authenticateUser);

// POST /api/v1/purchases — initiate a paid reveal.
router.post('/', purchaseRateLimit, validate(createPurchaseSchema, 'body'), purchasesController.createPurchase);

// GET /api/v1/purchases/me — list completed purchases.
router.get('/me', validate(listPurchasesSchema, 'query'), purchasesController.listPurchases);

// Export purchases router.
export default router;
