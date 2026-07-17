/**
 * Grade repository — CRUD over shared grade matrix.
 * See backend.md §3.2 (grades), §4.3 (seeding), §6.9 (admin grade endpoints).
 */
const db = require('../db/knex');
const TABLE = 'grades';

module.exports = {
  TABLE,

  async findById(id) {
    return db(TABLE).select('*').where({ id }).first();
  },

  async findByGradeNumber(gradeNumber) {
    return db(TABLE).select('id').where({ grade_number: gradeNumber }).first();
  },

  async listActive(lang = 'en') {
    const nameCol = lang === 'am' ? 'band_label_am as band_label' : 'band_label';
    const tierCol =
      lang === 'am' ? 'tier_classification_am as tier_classification' : 'tier_classification';
    const rolesCol = lang === 'am' ? 'typical_roles_am as typical_roles' : 'typical_roles';
    return db(TABLE)
      .select(
        'id',
        'grade_number',
        'rank_order',
        db.raw(nameCol),
        db.raw(tierCol),
        db.raw(rolesCol),
      )
      .where({ is_active: true })
      .orderBy('grade_number', 'asc');
  },

  async listDistinctBands(lang = 'en') {
    const bandCol = lang === 'am' ? 'band_label_am as band_label' : 'band_label';
    const tierCol =
      lang === 'am' ? 'tier_classification_am as tier_classification' : 'tier_classification';
    const rows = await db(TABLE)
      .select(db.raw(bandCol), db.raw(tierCol))
      .where({ is_active: true })
      .groupBy('band_label', 'tier_classification')
      .orderByRaw('MIN(grade_number) ASC');
    return rows;
  },

  async listByBand(bandLabel, lang = 'en') {
    const rolesCol = lang === 'am' ? 'typical_roles_am as typical_roles' : 'typical_roles';
    return db(TABLE)
      .select('id', 'grade_number', db.raw(rolesCol))
      .where({ band_label: bandLabel, is_active: true })
      .orderBy('grade_number', 'asc');
  },

  async create(data) {
    const [id] = await db(TABLE).insert(data);
    return id;
  },

  async update(id, patch) {
    const affected = await db(TABLE).where({ id }).update(patch);
    return affected > 0;
  },

  async countActiveUsers(gradeId) {
    const res = await db('users')
      .where({ grade_id: gradeId, is_active: true })
      .count('* as count')
      .first();
    return Number(res?.count || 0);
  },
};
