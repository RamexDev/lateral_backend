/**
 * Notification repository.
 * See backend.md §3.2 (notifications) and §9 (notification system).
 */
const db = require('../db/knex');
const TABLE = 'notifications';

module.exports = {
  TABLE,

  async create(data) {
    const [id] = await db(TABLE).insert(data);
    return id;
  },

  /**
   * Batch insert — used by broadcast fan-out. Splits into chunks for SQLite's variable limit.
   */
  async createMany(rows) {
    if (!rows.length) return 0;
    const CHUNK = 500;
    let inserted = 0;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      await db(TABLE).insert(chunk);
      inserted += chunk.length;
    }
    return inserted;
  },

  async listByUser(userId, { limit = 50 } = {}) {
    return db(TABLE)
      .select(
        'id',
        'type',
        'channel',
        'payload',
        'status',
        'sent_at as sentAt',
        'created_at as createdAt',
      )
      .where({ user_id: userId })
      .orderBy('created_at', 'desc')
      .limit(limit);
  },

  async markSent(id) {
    return db(TABLE).where({ id }).update({ status: 'sent', sent_at: new Date() });
  },

  async countByStatus(status) {
    const row = await db(TABLE).where({ status }).count('* as count').first();
    return Number(row?.count || 0);
  },
};
