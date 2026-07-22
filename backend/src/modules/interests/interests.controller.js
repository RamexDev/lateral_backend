// Import interests service.
import * as interestsService from './interests.service.js';

// Import HTTP response helper.
import { ok } from '../../lib/http.js';

// Handle GET /api/v1/interests/me
export async function getMyInterests(req, res, next) {
  try {
    const data = await interestsService.getMyInterests(req.user.id);
    ok(res, data);
  } catch (err) {
    next(err);
  }
}

// Handle GET /api/v1/interests/options
export async function getOptions(req, res, next) {
  try {
    const query = req.validated ? req.validated.query : req.query;
    const regionId = query && query.region_id ? Number(query.region_id) : undefined;
    const data = await interestsService.getOptions(req.user.id, regionId);
    ok(res, data);
  } catch (err) {
    next(err);
  }
}

// Handle PUT /api/v1/interests/me
export async function saveInterests(req, res, next) {
  try {
    const data = await interestsService.saveInterests(
      req.user.id,
      req.validated.body.interests,
      { ip: req.ip }
    );
    ok(res, data);
  } catch (err) {
    next(err);
  }
}

// Handle DELETE /api/v1/interests/:id
export async function deleteInterest(req, res, next) {
  try {
    const params = req.validated ? req.validated.params : req.params;
    const data = await interestsService.deleteInterest(
      req.user.id,
      Number(params.id),
      { ip: req.ip }
    );
    ok(res, data);
  } catch (err) {
    next(err);
  }
}
