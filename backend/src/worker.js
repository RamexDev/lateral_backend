// Worker process: consumes BullMQ queues.
// Run separately from the API: node src/worker.js

// Import environment config (must be first).
import './config/env.js';
// Import logger.
import { logger } from './lib/logger.js';
// Import Redis connection.
import { redis } from './lib/redis.js';
// Import MySQL pool.
import { pool } from './db/pool.js';
// Import Telegram helper.
import { sendTelegramMessage } from './lib/telegram.js';

// Lazy-import BullMQ Worker.
let Worker;
try {
  const bullmq = await import('bullmq');
  Worker = bullmq.Worker;
} catch {
  logger.error('BullMQ not installed. Worker cannot start.');
  process.exit(1);
}

// Redis connection config for BullMQ.
const connection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT) || 6379,
  maxRetriesPerRequest: null
};

// -----------------------------------------------------------------------------
// telegram-send processor
// -----------------------------------------------------------------------------
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
  const result = await sendTelegramMessage(user.telegram_id, text);

  // Mark notification as sent.
  if (!result.skipped) {
    await pool.query(
      'UPDATE notifications SET sent_at = NOW() WHERE id = ?',
      [notificationId]
    );
  }

  return { sent: true, notificationId, skipped: result.skipped || false };
}

// -----------------------------------------------------------------------------
// digest-notifications processor
// -----------------------------------------------------------------------------
async function processDigest(job) {
  const { userId } = job.data;

  // Fetch user context.
  const [userRows] = await pool.query(
    'SELECT u.id, u.telegram_id, u.bank_id, u.zone_id, u.region_id, u.grade_id, u.preferred_language, u.last_digest_at, g.band_number ' +
    'FROM users u LEFT JOIN grades g ON g.id = u.grade_id ' +
    'WHERE u.id = ? AND u.is_active = TRUE AND u.profile_completed_at IS NOT NULL',
    [userId]
  );

  if (!userRows[0]) {
    return { skipped: true, reason: 'user_not_eligible' };
  }

  const user = userRows[0];
  const lastDigest = user.last_digest_at || '2000-01-01';

  // Count new qualifying interests since last digest.
  const [countRows] = await pool.query(
    'SELECT COUNT(DISTINCT ti.user_id) AS new_matches ' +
    'FROM transfer_interests ti ' +
    'JOIN users u2 ON u2.id = ti.user_id ' +
    'JOIN grades g2 ON g2.id = u2.grade_id ' +
    'WHERE ((ti.zone_id = ?) OR (ti.zone_id IS NULL AND ti.region_id = ?)) ' +
    'AND ti.created_at > ? ' +
    'AND u2.bank_id = ? ' +
    'AND u2.id != ? ' +
    'AND u2.is_active = TRUE ' +
    'AND u2.profile_completed_at IS NOT NULL ' +
    'AND ABS(CAST(g2.band_number AS SIGNED) - ?) <= 1',
    [user.zone_id, user.region_id, lastDigest, user.bank_id, user.id, user.band_number || 0]
  );

  const newMatches = Number(countRows[0].new_matches);

  // Skip if no new matches.
  if (newMatches === 0) {
    await pool.query('UPDATE users SET last_digest_at = NOW() WHERE id = ?', [userId]);
    return { skipped: true, reason: 'no_new_matches' };
  }

  // Build bilingual digest message.
  const language = user.preferred_language === 'am' ? 'am' : 'en';
  const messages = {
    en: newMatches + ' new potential transfer match' + (newMatches > 1 ? 'es' : '') + ' in your area. Open Zwuwur to view your feed.',
    am: newMatches + ' አዲስ የዝውውር ተዛማጅ' + (newMatches > 1 ? 'ዎች' : '') + ' በአካባቢዎ ተገኝተዋል። ፊድዎን ለማየት Zwuwur ይክፈቱ።'
  };

  // Create notification record.
  const [notifResult] = await pool.query(
    'INSERT INTO notifications (user_id, type, payload, sent_at) VALUES (?, ?, ?, NULL)',
    [userId, 'digest', JSON.stringify({ summary_en: messages.en, summary_am: messages.am, new_matches: newMatches })]
  );

  // Send Telegram message.
  await sendTelegramMessage(user.telegram_id, messages[language]);

  // Mark sent and update last_digest_at.
  await pool.query('UPDATE notifications SET sent_at = NOW() WHERE id = ?', [notifResult.insertId]);
  await pool.query('UPDATE users SET last_digest_at = NOW() WHERE id = ?', [userId]);

  return { sent: true, newMatches };
}

// -----------------------------------------------------------------------------
// Start workers
// -----------------------------------------------------------------------------
const telegramWorker = new Worker('telegram-send', processTelegramSend, {
  connection,
  concurrency: 5
});

const digestWorker = new Worker('digest-notifications', processDigest, {
  connection,
  concurrency: 3
});

telegramWorker.on('completed', (job) => {
  logger.info({ jobId: job.id, queue: 'telegram-send' }, 'Job completed.');
});

telegramWorker.on('failed', (job, err) => {
  logger.error({ jobId: job.id, err, queue: 'telegram-send' }, 'Job failed.');
});

digestWorker.on('completed', (job) => {
  logger.info({ jobId: job.id, queue: 'digest-notifications' }, 'Job completed.');
});

digestWorker.on('failed', (job, err) => {
  logger.error({ jobId: job.id, err, queue: 'digest-notifications' }, 'Job failed.');
});

logger.info('Zwuwur worker started (telegram-send, digest-notifications).');

// Graceful shutdown.
async function shutdown() {
  logger.info('Worker shutting down...');
  await telegramWorker.close();
  await digestWorker.close();
  await pool.end();
  redis.disconnect();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
