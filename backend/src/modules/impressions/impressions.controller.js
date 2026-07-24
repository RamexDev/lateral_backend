// Impressions controller.

import * as impressionsService from './impressions.service.js';
import { ok } from '../../lib/http.js';

// Handle POST /api/v1/marketplace/impressions
// Body: { candidate_ids: number[] }
export async function recordImpressions(req, res, next) {
  try {
    const body = req.validated ? req.validated.body : req.body;
    const candidateIds = Array.isArray(body.candidate_ids) ? body.candidate_ids : [];
    const data = await impressionsService.recordImpressions(req.user.id, candidateIds);
    ok(res, data);
  } catch (err) {
    next(err);
  }
}
