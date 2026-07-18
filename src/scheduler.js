/**
 * Scheduler process — registers the daily repeatable digest job on the
 * digest-notifications queue (§7, answers.md §B). Run as
 * `node src/scheduler.js` (logically separate from the worker so a worker
 * redeploy doesn't skip a scheduled tick).
 *
 * The cron schedule comes from DIGEST_SCHEDULE_CRON (default: '0 6 * * *' —
 * 6:00 AM every day, server timezone).
 *
 * If REDIS_URL is unset, prints a warning and exits — BullMQ repeatable jobs
 * require Redis.
 */
const config = require('./config');
const queues = require('./queues');
const { QUEUE_NAMES } = queues;
const logger = require('./utils/logger');

async function main() {
  if (!queues.isQueueAvailable()) {
    logger.error(
      'REDIS_URL is not set — scheduler requires Redis. Set REDIS_URL in your .env.',
    );
    process.exit(1);
  }

  // The processor must be registered even on the scheduler process — when
  // using the inline-fallback path (test env), enqueue() looks up the
  // processor in the same registry. In production the scheduler only enqueues;
  // a separate worker.js process consumes.
  const { runDigest } = require('./queues/processors/digest');
  queues.registerProcessor(QUEUE_NAMES.DIGEST, 'run', runDigest);

  const queuesMap = await queues.getQueues();
  const digestQueue = queuesMap[QUEUE_NAMES.DIGEST];
  const cron = config.business.digestScheduleCron;

  // BullMQ repeatable jobs are idempotent on the repeat key — re-registering
  // with the same key + same cron just updates the next-tick.
  await digestQueue.add(
    'run',
    {},
    {
      repeat: { pattern: cron },
      jobId: 'digest-daily', // stable id so re-registration updates, not duplicates
    },
  );

  logger.info(
    `[scheduler] registered daily digest job on '${QUEUE_NAMES.DIGEST}' (cron: ${cron})`,
  );

  // The scheduler process stays alive — BullMQ manages the timing. We just
  // need to keep the process running and handle graceful shutdown.
  const shutdown = async (signal) => {
    logger.info(`[scheduler] received ${signal}, shutting down...`);
    await queues.close();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error('[scheduler] fatal:', err);
  process.exit(1);
});
