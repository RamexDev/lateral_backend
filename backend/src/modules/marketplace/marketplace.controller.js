// Import marketplace service.
import * as marketplaceService from './marketplace.service.js';
// Import HTTP response helper.
import { ok } from '../../lib/http.js';

// Handle GET /api/v1/marketplace/feed
export async function getFeed(req, res, next) {
  try {
    // Extract validated query parameters.
    const query = req.validated ? req.validated.query : req.query;
    const page = Number(query.page) || 1;
    const pageSize = Number(query.page_size) || 10;
    const fresh = query.fresh === true || query.fresh === 'true';

    // Call feed service.
    const data = await marketplaceService.getFeed(req.user.id, { page, pageSize, fresh });

    // Return feed response.
    ok(res, data);
  } catch (err) {
    next(err);
  }
}

// Handle GET /api/v1/marketplace/people
export async function getPeople(req, res, next) {
  try {
    // Extract validated query parameters.
    const query = req.validated ? req.validated.query : req.query;
    const page = Number(query.page) || 1;
    const pageSize = Number(query.page_size) || 10;

    // Call people service.
    const data = await marketplaceService.getPeople(req.user.id, { page, pageSize });

    // Return people response with optional message.
    if (data.requires_interests) {
      ok(res, data, 'Add transfer interests to see people in your desired areas.');
    } else {
      ok(res, data);
    }
  } catch (err) {
    next(err);
  }
}
