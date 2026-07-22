// Lazy-initialized BullMQ queues.
// Queues are created on first use, not at import time.
// If Redis is unavailable, queue operations fail gracefully.

// Import logger.
import { logger } from '../lib/logger.js';

// Cached queue instances.
let _telegramSendQueue = null;
let _notificationQueue = null;

// Get Redis connection config for BullMQ.
function getConnection() {
  return {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT) || 6379,
    maxRetriesPerRequest: null
  };
}

// Get or create the telegram-send queue.
export async function getTelegramSendQueue() {
  if (_telegramSendQueue) {
    return _telegramSendQueue;
  }
  try {
    const { Queue } = await import('bullmq');
    _telegramSendQueue = new Queue('telegram-send', {
      connection: getConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 50
      }
    });
    return _telegramSendQueue;
  } catch (err) {
    logger.warn({ err }, 'Failed to initialize telegram-send queue');
    return null;
  }
}

// Get or create the notification-fanout queue.
export async function getNotificationQueue() {
  if (_notificationQueue) {
    return _notificationQueue;
  }
  try {
    const { Queue } = await import('bullmq');
    _notificationQueue = new Queue('notification-fanout', {
      connection: getConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 50,
        removeOnFail: 20
      }
    });
    return _notificationQueue;
  } catch (err) {
    logger.warn({ err }, 'Failed to initialize notification-fanout queue');
    return null;
  }
}
