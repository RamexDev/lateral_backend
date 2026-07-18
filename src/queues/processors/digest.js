/**
 * Digest-notifications queue processor (§7, §9, answers.md §B).
 *
 * The full per-user match predicate is implemented in
 * `notificationService.runDailyDigest()` — this processor is just a thin
 * wrapper so the worker can register it as a BullMQ job handler.
 */
const notificationService = require('../../services/notificationService');

async function runDigest(_data) {
  return notificationService.runDailyDigest();
}

module.exports = { runDigest };
