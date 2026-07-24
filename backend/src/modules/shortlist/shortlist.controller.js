// Shortlist controller.

import * as shortlistService from './shortlist.service.js';
import { ok } from '../../lib/http.js';

// Handle POST /api/v1/shortlist
export async function addShortlist(req, res, next) {
  try {
    const body = req.validated ? req.validated.body : req.body;
    const data = await shortlistService.addShortlist(req.user.id, body.target_user_id, { ip: req.ip });
    ok(res, data, 'Shortlisted.', 201);
  } catch (err) {
    next(err);
  }
}

// Handle DELETE /api/v1/shortlist/:target_user_id
export async function removeShortlist(req, res, next) {
  try {
    const targetUserId = Number(req.params.target_user_id);
    const data = await shortlistService.removeShortlist(req.user.id, targetUserId, { ip: req.ip });
    ok(res, data);
  } catch (err) {
    next(err);
  }
}

// Handle GET /api/v1/shortlist
export async function listShortlist(req, res, next) {
  try {
    const query = req.validated ? req.validated.query : req.query;
    const page = Number(query.page) || 1;
    const pageSize = Number(query.page_size) || 20;
    const data = await shortlistService.listShortlist(req.user.id, { page, pageSize });
    ok(res, data);
  } catch (err) {
    next(err);
  }
}
