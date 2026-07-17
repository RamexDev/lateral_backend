/**
 * Transfer interest repository.
 * See backend.md §3.2 (transfer_interests) and §6.4 (interest API).
 */
const { TransferInterest, Location } = require('../db/models');
const sequelize = require('../db/sequelize');
const { QueryTypes, literal } = require('sequelize');
const TABLE = 'transfer_interests';

module.exports = {
  TABLE,

  async create(data) {
    // Idempotent — uq_user_location guards duplicates. SQLite + MySQL portable upsert.
    // Use a raw INSERT OR IGNORE-equivalent via Sequelize's upsert (ON CONFLICT DO NOTHING
    // on Postgres / INSERT IGNORE on MySQL / INSERT OR IGNORE on SQLite).
    try {
      const row = await TransferInterest.create(data);
      return row.id;
    } catch (err) {
      // Unique constraint — fetch the existing row.
      if (err.name === 'SequelizeUniqueConstraintError') {
        const existing = await TransferInterest.findOne({
          where: { user_id: data.user_id, location_id: data.location_id },
          raw: true,
        });
        return existing?.id;
      }
      throw err;
    }
  },

  async listByUser(userId, lang = 'en') {
    const nameCol = lang === 'am' ? 'locations.name_am' : 'locations.name';
    const rows = await sequelize.query(
      `SELECT
         transfer_interests.id,
         transfer_interests.location_id AS locationId,
         transfer_interests.created_at AS createdAt,
         ${nameCol} AS locationName,
         locations.level_type AS levelType
       FROM transfer_interests
       JOIN locations ON locations.id = transfer_interests.location_id
       WHERE transfer_interests.user_id = :userId
       ORDER BY transfer_interests.created_at DESC`,
      { replacements: { userId }, type: QueryTypes.SELECT },
    );
    return rows;
  },

  async findById(id) {
    return TransferInterest.findByPk(id, { raw: true });
  },

  async deleteById(id) {
    const affected = await TransferInterest.destroy({ where: { id } });
    return affected > 0;
  },

  async listByUserLocationIds(userId) {
    const rows = await TransferInterest.findAll({
      attributes: ['location_id'],
      where: { user_id: userId },
      raw: true,
    });
    return new Set(rows.map((r) => r.location_id));
  },

  async countByUser(userId) {
    return TransferInterest.count({ where: { user_id: userId } });
  },
};
