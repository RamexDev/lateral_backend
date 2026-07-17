/**
 * Bank repository — CRUD over `banks` reference data.
 * See backend.md §3.2 and §6.9 (admin bank endpoints).
 */
const db = require('../db/knex');
const TABLE = 'banks';

const pickColumn = (lang) => (lang === 'am' ? 'name_am as name' : 'name');

module.exports = {
  TABLE,

  async findById(id, lang = 'en') {
    return db(TABLE)
      .select(
        'id',
        'nickname',
        'swift_code',
        'year_established',
        'is_active',
        db.raw(pickColumn(lang)),
      )
      .where({ id })
      .first();
  },

  async findByIdRaw(id) {
    return db(TABLE).select('*').where({ id }).first();
  },

  async list({ page = 1, pageSize = 50, isActive } = {}) {
    const query = db(TABLE).select(
      'id',
      'name',
      'name_am',
      'nickname',
      'swift_code',
      'year_established',
      'is_active',
    );
    if (isActive !== undefined) query.where({ is_active: isActive });
    const total = await query.clone().count('* as count').first();
    const rows = await query
      .clone()
      .orderBy('name', 'asc')
      .limit(pageSize)
      .offset((page - 1) * pageSize);
    return { rows, total: total?.count || 0 };
  },

  async listActive(lang = 'en') {
    return db(TABLE)
      .select('id', 'nickname', 'swift_code', db.raw(pickColumn(lang)))
      .where({ is_active: true })
      .orderBy('name', 'asc');
  },

  async create(data) {
    const [row] = await db(TABLE).insert(data);
    return row;
  },

  async update(id, patch) {
    const affected = await db(TABLE).where({ id }).update(patch);
    return affected > 0;
  },

  async findByNickname(nickname) {
    return db(TABLE).select('*').where({ nickname }).first();
  },

  async countActiveUsers(bankId) {
    const res = await db('users')
      .where({ bank_id: bankId, is_active: true })
      .count('* as count')
      .first();
    return Number(res?.count || 0);
  },
};
