// Reference data routes — public read access.
// No authentication required: this is seed/reference data the mini app needs
// before the user has a profile (e.g. during onboarding-like profile completion).

import { Router } from 'express';
import * as referenceController from './reference.controller.js';

const router = Router();

// GET /api/v1/regions — list all active regions.
router.get('/regions', referenceController.listRegions);

// GET /api/v1/zones?region_id= — list active zones, optionally filtered by region.
router.get('/zones', referenceController.listZones);

export default router;
