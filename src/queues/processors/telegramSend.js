// Import BullMQ Worker.
import { Worker } from 'bullmq';
// Import Redis connection config.
import { redisConnection } from '../../lib/redis.js';
// Import MySQL pool.
import { pool } from '../../db/pool.js';
// Import Telegram helper.
import { sendTelegramMessage } from '../../lib/telegram.js';
// Import logger.
import { logger } from '../../lib/logger.js';

// Process telegram-send jobs.
async function processTelegramSend(job) {
  const { notificationId, userId, type, payload } = job.data;

  // Fetch user's Telegram ID and language preference.
  const [rows] = await pool.query(
    'SELECT telegram_id, preferred_language FROM users WHERE id = ?',
    [userId]
  );

  if (!rows[0]) {
    logger.warn({ userId, notificationId }, 'User not found for Telegram notification.');
    return { skipped: true, reason: 'user_not_found' };
  }

  const user = rows[0];
  const language = user.preferred_language === 'am' ? 'am' : 'en';

  // Resolve message text based on type and language.
  let text = '';
  if (payload && payload['summary_' + language]) {
    text = payload['summary_' + language];
  } else if (payload && payload['message_' + language]) {
    text = payload['message_' + language];
  } else if (payload && payload.summary_en) {
    text = payload.summary_en;
  } else {
    text = 'You have a new notification from Zwuwur.';
  }

  // Send Telegram message.
  await sendTelegramMessage(user.telegram_id, text);

  // Mark notification as sent.
  await pool.query(
    'UPDATE notifications SET sent_at = NOW() WHERE id = ?',
    [notificationId]
  );

  return { sent: true, notificationId };
}

// Create the worker (only starts when this module is imported by the worker process).
export function startTelegramSendWorker() {
  const worker = new Worker('telegram-send', processTelegramSend, {
    connection: redisConnection,
    concurrency: 5
  });

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Telegram notification sent.');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job.id, err }, 'Telegram notification failed.');
  });

  return worker;
}
