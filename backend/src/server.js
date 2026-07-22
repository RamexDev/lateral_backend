// Import the Express application.
import app from './app.js';

// Import validated environment variables.
import { env } from './config/env.js';

// Import the shared logger.
import { logger } from './lib/logger.js';

// Import the MySQL pool for graceful shutdown.
import { pool } from './db/pool.js';

// Import the Redis client for graceful shutdown.
import { redis } from './lib/redis.js';

// Track whether shutdown has already started.
let isShuttingDown = false;

// Start the HTTP server.
const server = app.listen(env.PORT, () => {
  // Log successful startup.
  logger.info('API listening on port ' + env.PORT);
});

// Define graceful shutdown behavior.
async function shutdown(signal) {
  // Ignore duplicate signals from npm, node --watch, or Windows terminals.
  if (isShuttingDown) {
    return;
  }

  // Mark shutdown as started.
  isShuttingDown = true;

  // Log the received signal.
  logger.info(signal + ' received, shutting down');

  // Create a safety timer to force exit if graceful shutdown hangs.
  const forceExitTimer = setTimeout(() => {
    // Log shutdown timeout.
    logger.error('Graceful shutdown timed out, forcing exit');

    // Force exit with failure code.
    process.exit(1);
  }, 5000);

  // Do not let this timer keep the process alive.
  forceExitTimer.unref();

  try {
    // Close idle keep-alive connections immediately.
    if (typeof server.closeIdleConnections === 'function') {
      server.closeIdleConnections();
    }

    // Close all remaining connections shortly after.
    const closeAllConnectionsTimer = setTimeout(() => {
      // Force-close active connections if they still exist.
      if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections();
      }
    }, 1000);

    // Do not let this timer keep the process alive.
    closeAllConnectionsTimer.unref();

    // Wait for the HTTP server to close.
    await new Promise((resolve) => {
      // Resolve when the server has finished closing.
      server.close(() => resolve());
    });

    // Close the MySQL connection pool.
    await pool.end();

    // Disconnect Redis if it is not already fully closed.
    if (redis.status !== 'end') {
      redis.disconnect();
    }

    // Exit successfully.
    process.exit(0);
  } catch (err) {
    // Log shutdown errors.
    logger.error({ err }, 'Shutdown failed');

    // Exit with failure code.
    process.exit(1);
  }
}

// Handle Ctrl+C once.
process.once('SIGINT', () => shutdown('SIGINT'));

// Handle termination signal once.
process.once('SIGTERM', () => shutdown('SIGTERM'));