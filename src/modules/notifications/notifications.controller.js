// Import notifications service.
import * as notificationsService from './notifications.service.js';
// Import HTTP response helper.
import { ok } from '../../lib/http.js';

// Handle GET /api/v1/notifications/me
export async function listNotifications(req, res, next) {
  try {
    const query = req.validated ? req.validated.query : req.query;
    const page = Number(query.page) || 1;
    const pageSize = Number(query.page_size) || 20;

    const data = await notificationsService.listNotifications(req.user.id, { page, pageSize });
    ok(res, data);
  } catch (err) {
    next(err);
  }
}

// Handle POST /admin/api/v1/notifications/broadcast
export async function sendBroadcast(req, res, next) {
  try {
    const body = req.validated ? req.validated.body : req.body;
    const data = await notificationsService.sendBroadcast(body, req.staff.id);
    ok(res, data, 'Broadcast queued for ' + data.queued_recipients + ' recipients.');
  } catch (err) {
    next(err);
  }
}
