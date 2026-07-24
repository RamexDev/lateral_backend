// Import purchases service.
import * as purchasesService from './purchases.service.js';
// Import HTTP response helper.
import { ok } from '../../lib/http.js';

// Handle POST /api/v1/purchases
export async function createPurchase(req, res, next) {
  try {
    // Extract validated body.
    const body = req.validated ? req.validated.body : req.body;
    const targetUserId = Number(body.target_user_id);

    // Call service.
    const data = await purchasesService.createPurchase(req.user.id, targetUserId);

    // Return appropriate status code.
    if (data.already_exists) {
      ok(res, data, 'Purchase already exists.', 200);
    } else {
      ok(res, data, 'Purchase initiated.', 201);
    }
  } catch (err) {
    next(err);
  }
}

// Handle GET /api/v1/purchases/me
export async function listPurchases(req, res, next) {
  try {
    // Extract validated query parameters.
    const query = req.validated ? req.validated.query : req.query;
    const page = Number(query.page) || 1;
    const pageSize = Number(query.page_size) || 20;
    // status is optional — default to 'completed' for backward compatibility.
    const status = query.status || 'completed';

    // Call service.
    const data = await purchasesService.listPurchases(req.user.id, { page, pageSize, status });

    // Return purchase history.
    ok(res, data);
  } catch (err) {
    next(err);
  }
}

// Handle GET /api/v1/purchases/me/stats (F.12)
export async function getPurchaseStats(req, res, next) {
  try {
    const data = await purchasesService.getPurchaseStats(req.user.id);
    ok(res, data);
  } catch (err) {
    next(err);
  }
}
