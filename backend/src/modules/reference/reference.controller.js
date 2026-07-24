// Reference data controller.

import * as referenceService from './reference.service.js';
import { ok } from '../../lib/http.js';

// Handle GET /api/v1/regions
export async function listRegions(req, res, next) {
  try {
    const data = await referenceService.listRegions();
    ok(res, data);
  } catch (err) {
    next(err);
  }
}

// Handle GET /api/v1/zones?region_id=
export async function listZones(req, res, next) {
  try {
    const regionId = req.query.region_id ? Number(req.query.region_id) : null;
    const data = await referenceService.listZones(regionId);
    ok(res, data);
  } catch (err) {
    next(err);
  }
}
