/**
 * Notification repository.
 * See backend.md §3.2 (notifications) and §9 (notification system).
 */
const { Notification } = require('../db/models');
const TABLE = 'notifications';

module.exports = {
  TABLE,

  async create(data) {
    const row = await Notification.create(data);
    return row.id;
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
      await Notification.bulkCreate(chunk, { validate: false });
      inserted += chunk.length;
    }
    return inserted;
  },

  async listByUser(userId, { limit = 50 } = {}) {
    return Notification.findAll({
      attributes: [
        'id',
        'type',
        'channel',
        'payload',
        'status',
        ['sent_at', 'sentAt'],
        ['created_at', 'createdAt'],
      ],
      where: { user_id: userId },
      order: [['created_at', 'DESC']],
      limit,
      raw: true,
    });
  },

  async markSent(id) {
    return Notification.update(
      { status: 'sent', sent_at: new Date() },
      { where: { id } },
    );
  },

  async countByStatus(status) {
    return Notification.count({ where: { status } });
  },
};
