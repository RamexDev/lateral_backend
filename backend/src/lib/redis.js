// Import ioredis client.
import Redis from 'ioredis';

// Import environment variables.
import { env } from '../config/env.js';

// Import logger.
import { logger } from './logger.js';

// Export a lazy Redis client for application use.
export const redis = new Redis(env.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 3
});

// Log Redis errors.
redis.on('error', (err) => {
  logger.error({ err }, 'Redis error');
});

// Export a factory for BullMQ-compatible connections.
export function createRedisConnection() {
  return new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null
  });
}

// Export Redis connection config for BullMQ queues.
export const redisConnection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT) || 6379,
  maxRetriesPerRequest: null
};
