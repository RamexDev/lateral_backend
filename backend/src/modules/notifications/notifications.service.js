// Import MySQL pool.
import { pool } from '../../db/pool.js';
// Import Redis client.
import { redis } from '../../lib/redis.js';
// Import API error class.
import { ApiError } from '../../lib/errors.js';
// Import logger.
import { logger } from '../../lib/logger.js';
// Import env config.
import { env } from '../../config/env.js';

// Notification rate limit: max 5 per hour per user.
const NOTIFICATION_MAX_PER_HOUR = 5;
const NOTIFICATION_WINDOW_SECONDS = 3600;

// Check notification rate limit for a user.
async function checkNotificationRateLimit(userId) {
  try {
    const key = 'rl:notification:' + userId;
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, NOTIFICATION_WINDOW_SECONDS);
    }
    return current <= NOTIFICATION_MAX_PER_HOUR;
  } catch {
    // Fail open if Redis is unavailable.
    return true;
  }
}

// Queue a Telegram send job (best-effort, never throws).
async function queueTelegramSend(notificationId, userId, type, payload) {
  try {
    const { getTelegramSendQueue } = await import('../../queues/index.js');
    const queue = await getTelegramSendQueue();
    if (queue) {
      await queue.add('send', { notificationId, userId, type, payload });
    }
  } catch (err) {
    // Queue failure should not fail the notification creation.
    logger.warn({ err, notificationId }, 'Failed to queue Telegram notification.');
  }
}

// Create a notification record and queue Telegram delivery.
export async function createNotification({ userId, type, payload, sendTelegram = true }) {
  // Check rate limit.
  const withinLimit = await checkNotificationRateLimit(userId);
  if (!withinLimit) {
    logger.warn({ userId, type }, 'Notification rate limit exceeded, skipping.');
    return { created: false, rate_limited: true };
  }

  // Insert notification record.
  const [result] = await pool.query(
    'INSERT INTO notifications (user_id, type, payload, sent_at) VALUES (?, ?, ?, NULL)',
    [userId, type, payload ? JSON.stringify(payload) : null]
  );
  const notificationId = result.insertId;

  // Queue Telegram delivery if requested.
  if (sendTelegram) {
    await queueTelegramSend(notificationId, userId, type, payload);
  }

  return { created: true, notification_id: notificationId, rate_limited: false };
}

// Send a payment confirmation notification to the buyer.
export async function sendPaymentConfirmation(buyerId, purchaseId, targetUserId, amount) {
  // Build bilingual payload.
  const amountNum = Number(amount) || 0;
  const payload = {
    purchase_id: purchaseId,
    target_user_id: targetUserId,
    amount_etb: amountNum,
    summary_en: 'Payment confirmed. Contact details unlocked for ' + amountNum + ' ETB.',
    summary_am: 'ክፍያ ተረጋግጧል። የእውቂያ ዝርዝር ለ ' + amountNum + ' ብር ተከፍቷል።'
  };

  // Create notification.
  await createNotification({
    userId: buyerId,
    type: 'payment_confirmation',
    payload,
    sendTelegram: true
  });
}

// Send a profile nudge notification.
export async function sendProfileNudge(userId) {
  // Check if user already received a nudge recently.
  const [rows] = await pool.query(
    'SELECT id FROM notifications WHERE user_id = ? AND type = ? AND created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)',
    [userId, 'profile_nudge']
  );
  if (rows.length > 0) {
    return { skipped: true, reason: 'recent_nudge_exists' };
  }

  const payload = {
    summary_en: 'Complete your profile to unlock the marketplace.',
    summary_am: 'ገበያውን ለመክፈት መገለጫዎን ያሟሉ።'
  };

  await createNotification({
    userId,
    type: 'profile_nudge',
    payload,
    sendTelegram: true
  });

  return { skipped: false };
}

// List notifications for a user.
// F.4: now supports unread_only filter and returns read_at field.
export async function listNotifications(userId, { page, pageSize, unreadOnly = false }) {
  const offset = (page - 1) * pageSize;

  let whereClause = 'WHERE user_id = ?';
  const params = [userId];

  if (unreadOnly) {
    whereClause += ' AND read_at IS NULL';
  }

  const [rows] = await pool.query(
    'SELECT id, type, payload, sent_at, read_at, created_at FROM notifications ' +
    whereClause + ' ORDER BY created_at DESC LIMIT ? OFFSET ?',
    [...params, pageSize, offset]
  );

  const [countRows] = await pool.query(
    'SELECT COUNT(*) AS total FROM notifications ' + whereClause,
    params
  );

  // Count unread for the bell badge.
  const [unreadRows] = await pool.query(
    'SELECT COUNT(*) AS unread FROM notifications WHERE user_id = ? AND read_at IS NULL',
    [userId]
  );

  const notifications = rows.map((row) => ({
    id: row.id,
    type: row.type,
    payload: row.payload ? (typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload) : null,
    sent_at: row.sent_at,
    read_at: row.read_at,
    created_at: row.created_at
  }));

  return {
    notifications,
    page,
    page_size: pageSize,
    total_results: Number(countRows[0].total),
    unread_count: Number(unreadRows[0].unread)
  };
}

// Mark all notifications as read for a user (F.4).
export async function markAllRead(userId) {
  const [result] = await pool.query(
    'UPDATE notifications SET read_at = NOW() WHERE user_id = ? AND read_at IS NULL',
    [userId]
  );
  return { marked_read: result.affectedRows };
}

// Mark a single notification as read (F.4).
export async function markRead(userId, notificationId) {
  const [result] = await pool.query(
    'UPDATE notifications SET read_at = NOW() WHERE id = ? AND user_id = ? AND read_at IS NULL',
    [notificationId, userId]
  );

  if (result.affectedRows === 0) {
    // Either notification doesn't exist, doesn't belong to user, or was already read.
    // We treat all as idempotent success to avoid leaking existence.
    return { marked_read: 0 };
  }

  return { marked_read: 1, notification_id: notificationId };
}

// Send a broadcast to a segment of users.
export async function sendBroadcast({ segment_filter, message }, staffId) {
  // Build the recipient query based on segment scope.
  let whereClause = 'WHERE u.is_active = TRUE AND u.profile_completed_at IS NOT NULL';
  const params = [];

  const scope = segment_filter.scope;

  if (scope === 'bank') {
    if (!segment_filter.bank_id) {
      throw new ApiError(400, 'VALIDATION_FAILED', 'bank_id is required for bank scope.');
    }
    whereClause += ' AND u.bank_id = ?';
    params.push(segment_filter.bank_id);
  } else if (scope === 'region') {
    if (!segment_filter.region_id) {
      throw new ApiError(400, 'VALIDATION_FAILED', 'region_id is required for region scope.');
    }
    whereClause += ' AND u.region_id = ?';
    params.push(segment_filter.region_id);
  } else if (scope === 'zone') {
    if (!segment_filter.zone_id) {
      throw new ApiError(400, 'VALIDATION_FAILED', 'zone_id is required for zone scope.');
    }
    whereClause += ' AND u.zone_id = ?';
    params.push(segment_filter.zone_id);
  } else if (scope !== 'all') {
    throw new ApiError(400, 'VALIDATION_FAILED', 'Invalid scope. Must be all, bank, region, or zone.');
  }

  // Count recipients.
  const [countRows] = await pool.query(
    'SELECT COUNT(*) AS count FROM users u ' + whereClause,
    params
  );
  const recipientCount = Number(countRows[0].count);

  // Reject empty segments.
  if (recipientCount === 0) {
    throw new ApiError(422, 'EMPTY_SEGMENT', 'No recipients matched the segment.');
  }

  // Fetch recipient IDs.
  const [recipientRows] = await pool.query(
    'SELECT u.id FROM users u ' + whereClause + ' LIMIT 5000',
    params
  );

  // Create notification records and queue delivery for each recipient.
  let queuedCount = 0;
  for (const recipient of recipientRows) {
    try {
      const result = await createNotification({
        userId: recipient.id,
        type: 'broadcast',
        payload: {
          summary_en: message.en,
          summary_am: message.am
        },
        sendTelegram: true
      });
      if (result.created) {
        queuedCount++;
      }
    } catch (err) {
      logger.warn({ err, userId: recipient.id }, 'Failed to create broadcast notification.');
    }
  }

  return {
    queued_recipients: queuedCount,
    total_recipients: recipientCount
  };
}
