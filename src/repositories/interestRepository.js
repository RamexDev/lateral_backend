/**
 * Transfer interest repository.
 * See backend.md §3.2 (transfer_interests) and §6.4 (interest API).
 */
const db = require('../db/knex');
const TABLE = 'transfer_interests';

module.exports = {
  TABLE,

  async create(data) {
    // Idempotent — uq_user_location guards duplicates.
    const [id] = await db(TABLE)
      .insert(data)
      .onConflict(['user_id', 'location_id'])
      .merge()
      .returning('id');
    // better-sqlite3 returns the row directly when using returning; normalize:
    return typeof id === 'object' && id !== null ? id.id : id;
  },

  async listByUser(userId, lang = 'en') {
    const nameCol =
      lang === 'am' ? 'locations.name_am as locationName' : 'locations.name as locationName';
    return db(TABLE)
      .select(
        'transfer_interests.id',
        'transfer_interests.location_id as locationId',
        'transfer_interests.created_at as createdAt',
        db.raw(nameCol),
        'locations.level_type as levelType',
      )
      .join('locations', 'locations.id', '=', 'transfer_interests.location_id')
      .where('transfer_interests.user_id', userId)
      .orderBy('transfer_interests.created_at', 'desc');
  },

  async findById(id) {
    return db(TABLE).select('*').where({ id }).first();
  },

  async deleteById(id) {
    const affected = await db(TABLE).where({ id }).del();
    return affected > 0;
  },

  async listByUserLocationIds(userId) {
    const rows = await db(TABLE).select('location_id').where({ user_id: userId });
    return new Set(rows.map((r) => r.location_id));
  },

  async countByUser(userId) {
    const row = await db(TABLE).where({ user_id: userId }).count('* as count').first();
    return Number(row?.count || 0);
  },
};
