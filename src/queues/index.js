/**
 * Queue layer — BullMQ wrappers for the three queues in §7 (answers.md §B).
 *
 * Queues:
 *   - digest-notifications         daily repeatable; per-user match digest
 *   - broadcast-notifications      admin-triggered ad-hoc fan-out
 *   - payment-webhook-processing   decouples Chapa webhook receipt from
 *                                  notification send + audit log work
 *
 * Test/dev fallback:
 *   When NODE_ENV === 'test' OR no REDIS_URL is configured, enqueue() runs
 *   the processor body inline (synchronously). This keeps the test suite
 *   self-contained (no Redis dependency) and the dev loop simple. Production
 *   deployments run `node src/worker.js` to boot real BullMQ consumers.
 */
const config = require('../config');

const QUEUE_NAMES = {
  DIGEST: 'digest-notifications',
  BROADCAST: 'broadcast-notifications',
  PAYMENT_WEBHOOK: 'payment-webhook-processing',
};

// Lazy-initialized singletons — only created on first enqueue().
let _redisClient = null;
let _queues = null;
let _workers = null;
const _processors = {}; // queueName -> { jobName -> fn(data) }

function isQueueAvailable() {
  return !!config.redis.url && !config.isTest;
}

/**
 * Lazy-init the Redis client + BullMQ queues. Returns null when queues are
 * unavailable (test env or no REDIS_URL) — callers should fall back to inline.
 */
async function getQueues() {
  if (!isQueueAvailable()) return null;
  if (_queues) return _queues;

  const IORedis = require('ioredis');
  const { Queue } = require('bullmq');

  if (!_redisClient) {
    _redisClient = new IORedis(config.redis.url, {
      maxRetriesPerRequest: null, // BullMQ requires this.
      enableReadyCheck: true,
    });
  }

  _queues = {
    [QUEUE_NAMES.DIGEST]: new Queue(QUEUE_NAMES.DIGEST, {
      connection: _redisClient,
      defaultJobOptions: { removeOnComplete: 100, removeOnFail: 50 },
    }),
    [QUEUE_NAMES.BROADCAST]: new Queue(QUEUE_NAMES.BROADCAST, {
      connection: _redisClient,
      defaultJobOptions: { removeOnComplete: 100, removeOnFail: 50 },
    }),
    [QUEUE_NAMES.PAYMENT_WEBHOOK]: new Queue(QUEUE_NAMES.PAYMENT_WEBHOOK, {
      connection: _redisClient,
      defaultJobOptions: { removeOnComplete: 200, removeOnFail: 100 },
    }),
  };

  return _queues;
}

/**
 * Register a processor for a (queueName, jobName) pair. Called by worker.js
 * at boot, AND by the inline-fallback path so the same processor body runs
 * regardless of mode.
 */
function registerProcessor(queueName, jobName, fn) {
  if (!_processors[queueName]) _processors[queueName] = {};
  _processors[queueName][jobName] = fn;
}

/**
 * Enqueue a job. In test/dev (no Redis) this runs the registered processor
 * inline — same code path as production, just synchronous. In production it
 * pushes the job onto the BullMQ queue.
 */
async function enqueue(queueName, jobName, data, options = {}) {
  // Resolve the processor (must have been registered first).
  const fn = _processors[queueName]?.[jobName];

  // Inline fallback for tests / no-Redis dev.
  if (!isQueueAvailable()) {
    if (!fn) {
      // No processor registered — silently drop. This happens if a service
      // enqueues before worker.js has booted (e.g. in unit tests that don't
      // load the worker module). Safe because the queue is a "best effort"
      // optimization on top of the synchronous state transition.
      // eslint-disable-next-line no-console
      console.warn(
        `[queues] no inline processor for ${queueName}/${jobName} — dropping (test mode)`,
      );
      return { inline: true, dropped: true };
    }
    try {
      await fn(data);
      return { inline: true };
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[queues] inline processor ${queueName}/${jobName} failed:`, err);
      // Don't rethrow — the spec (§7) says queue failures must not bubble up
      // to the API request path. In production BullMQ's retry/backoff handles
      // this; in test mode we just log.
      return { inline: true, failed: true, error: err.message };
    }
  }

  // Production: push onto BullMQ.
  const queues = await getQueues();
  if (!queues || !queues[queueName]) {
    throw new Error(`Unknown queue: ${queueName}`);
  }
  await queues[queueName].add(jobName, data, options);
  return { enqueued: true };
}

/**
 * Boot BullMQ Workers for all registered processors. Called by worker.js.
 * In test mode this is a no-op (processors run inline via enqueue).
 */
async function bootWorkers() {
  if (!isQueueAvailable()) {
    // eslint-disable-next-line no-console
    console.warn('[queues] REDIS_URL not set — workers not booted (inline mode)');
    return;
  }
  if (_workers) return _workers;

  const { Worker } = require('bullmq');
  _workers = Object.entries(_processors).map(([queueName, jobMap]) => {
    const worker = new Worker(
      queueName,
      async (job) => {
        const fn = jobMap[job.name];
        if (!fn) {
          throw new Error(`No processor for ${queueName}/${job.name}`);
        }
        return fn(job.data);
      },
      { connection: _redisClient, concurrency: 5 },
    );
    worker.on('failed', (job, err) => {
      // eslint-disable-next-line no-console
      console.error(`[queues] job ${queueName}/${job?.name} failed:`, err.message);
    });
    return worker;
  });

  return _workers;
}

async function close() {
  if (_workers) {
    await Promise.all(_workers.map((w) => w.close()));
    _workers = null;
  }
  if (_redisClient) {
    await _redisClient.quit().catch(() => {});
    _redisClient = null;
  }
  _queues = null;
}

module.exports = {
  QUEUE_NAMES,
  isQueueAvailable,
  enqueue,
  registerProcessor,
  bootWorkers,
  close,
  // Exposed for tests only.
  _processors,
};
