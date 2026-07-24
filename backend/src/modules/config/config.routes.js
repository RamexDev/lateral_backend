// Public config routes — no auth required.

import { Router } from 'express';
import * as configController from './config.controller.js';

const router = Router();

// GET /api/v1/config — public runtime configuration.
router.get('/config', configController.getConfig);

export default router;
