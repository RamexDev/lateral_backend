/**
 * Server entry point.
 *
 * Boots the Express app on the configured PORT.
 * In production, run via PM2 / container orchestrator (§14).
 */
const { createApp } = require('./app');
const config = require('./config');
const logger = require('./utils/logger');

const app = createApp();

if (require.main === module) {
  const server = app.listen(config.port, () => {
    logger.info(`Server listening on port ${config.port} (${config.env})`);
  });

  // Graceful shutdown.
  for (const sig of ['SIGTERM', 'SIGINT']) {
    process.on(sig, () => {
      logger.info(`${sig} received, shutting down...`);
      server.close(() => process.exit(0));
    });
  }
  // Return the server so callers (tests) can close it explicitly.
  return server;
}

module.exports = app;
