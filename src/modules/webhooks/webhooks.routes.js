// Import Express router.
import { Router } from 'express';
// Import Chapa signature verification middleware.
import { verifyChapaSignature } from '../../middleware/verifyChapaSignature.js';
// Import Chapa webhook controller.
import * as chapaController from './chapa.controller.js';

// Create webhooks router.
const router = Router();

// POST /api/v1/webhooks/chapa — Chapa payment confirmation.
// No user auth required (called by Chapa servers).
// Signature verification replaces user auth.
router.post('/chapa', verifyChapaSignature, chapaController.chapaWebhook);

// Export webhooks router.
export default router;
