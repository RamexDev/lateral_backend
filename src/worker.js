/**
 * Worker process — boots BullMQ consumers for the three queues in §7
 * (answers.md §B). Run as `node src/worker.js` (separate process from the
 * API server per §1, sharing the same MySQL/Redis instances).
 *
 * Queue processors:
 *   - digest-notifications         → runDailyDigest (cron-triggered)
 *   - broadcast-notifications      → fanOutBroadcast (admin-triggered)
 *   - payment-webhook-processing   → confirmPayment (Chapa webhook-triggered)
 *
 * If REDIS_URL is unset, prints a warning and exits — there's nothing for a
 * real BullMQ worker to do without Redis. (In test/dev, the queue layer falls
 * back to inline synchronous execution, so no worker process is needed.)
 */
const queues = require('./queues');
const { QUEUE_NAMES } = queues;
const { confirmPayment } = require('./queues/processors/paymentWebhook');
const { fanOutBroadcast } = require('./queues/processors/broadcast');
const { runDigest } = require('./queues/processors/digest');
const logger = require('./utils/logger');

// Load Sequelize so DB connections are pooled.
require('./db/sequelize');

async function main() {
  if (!queues.isQueueAvailable()) {
    logger.error(
      'REDIS_URL is not set — worker process requires Redis. Set REDIS_URL in your .env.',
    );
    process.exit(1);
  }

  // Register all processors (these run inline in test env via the queue
  // layer's fallback, and as real BullMQ consumers in production).
  queues.registerProcessor(QUEUE_NAMES.PAYMENT_WEBHOOK, 'confirm', confirmPayment);
  queues.registerProcessor(QUEUE_NAMES.BROADCAST, 'fanOut', fanOutBroadcast);
  queues.registerProcessor(QUEUE_NAMES.DIGEST, 'run', runDigest);

  await queues.bootWorkers();
  logger.info(
    `[worker] booted consumers for: ${Object.values(QUEUE_NAMES).join(', ')}`,
  );

  // Graceful shutdown.
  const shutdown = async (signal) => {
    logger.info(`[worker] received ${signal}, shutting down...`);
    await queues.close();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error('[worker] fatal:', err);
  process.exit(1);
});
