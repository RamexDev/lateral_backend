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
    // unread_only comes from transform — undefined becomes false.
    const unreadOnly = query.unread_only === true;

    const data = await notificationsService.listNotifications(req.user.id, { page, pageSize, unreadOnly });
    ok(res, data);
  } catch (err) {
    next(err);
  }
}

// Handle POST /api/v1/notifications/me/mark-read (F.4)
export async function markAllRead(req, res, next) {
  try {
    const data = await notificationsService.markAllRead(req.user.id);
    ok(res, data);
  } catch (err) {
    next(err);
  }
}

// Handle POST /api/v1/notifications/:id/read (F.4)
export async function markRead(req, res, next) {
  try {
    const notificationId = Number(req.params.id);
    const data = await notificationsService.markRead(req.user.id, notificationId);
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
