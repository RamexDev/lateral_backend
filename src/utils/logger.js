/**
 * Minimal structured logger.
 * In production, integrate with pino/winston — here we keep it minimal
 * to avoid heavy deps and keep tests quiet.
 */
const config = require('../config');

function fmt(level, msg, meta) {
  const ts = new Date().toISOString();
  const base = `[${ts}] ${level.toUpperCase()} ${msg}`;
  return meta ? `${base} ${JSON.stringify(meta)}` : base;
}

module.exports = {
  info: (msg, meta) => {
    if (!config.isTest) console.log(fmt('info', msg, meta));
  },
  warn: (msg, meta) => console.warn(fmt('warn', msg, meta)),
  error: (msg, meta) => console.error(fmt('error', msg, meta)),
  debug: (msg, meta) => {
    if (!config.isProd && !config.isTest) console.log(fmt('debug', msg, meta));
  },
};
