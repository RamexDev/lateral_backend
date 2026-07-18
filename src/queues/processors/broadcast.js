/**
 * Broadcast-notifications queue processor (§7, §9, answers.md §B).
 *
 * Fan-out: inserts one notification row per resolved recipient user id.
 * The user-id resolution is done synchronously in notificationService.broadcast
 * (a fast read) so the queue job only carries the resolved user-id list + the
 * message — keeping the processor body pure and idempotent.
 */
const notificationRepo = require('../../repositories/notificationRepository');

async function fanOutBroadcast({ userIds, message, scope, actorId }) {
  if (!userIds || !userIds.length) {
    return { inserted: 0 };
  }
  const payload = { message, scope };
  const rows = userIds.map((uid) => ({
    user_id: uid,
    type: 'broadcast',
    channel: 'telegram',
    payload,
    status: 'queued',
  }));
  const inserted = await notificationRepo.createMany(rows);
  return { inserted, actorId };
}

module.exports = { fanOutBroadcast };
