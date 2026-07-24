// Config controller.

import * as configService from './config.service.js';
import { ok } from '../../lib/http.js';

// Handle GET /api/v1/config
export async function getConfig(req, res, next) {
  try {
    const data = await configService.getPublicConfig();
    ok(res, data);
  } catch (err) {
    next(err);
  }
}
