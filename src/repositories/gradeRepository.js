/**
 * Grade repository — CRUD over shared grade matrix.
 * See backend.md §3.2 (grades), §4.3 (seeding), §6.9 (admin grade endpoints).
 */
const { Grade, User } = require('../db/models');
const sequelize = require('../db/sequelize');
const { QueryTypes, literal, fn, col } = require('sequelize');
const TABLE = 'grades';

function gradeAttributes(lang) {
  if (lang === 'am') {
    return [
      'id',
      'grade_number',
      'rank_order',
      ['band_label_am', 'band_label'],
      ['tier_classification_am', 'tier_classification'],
      ['typical_roles_am', 'typical_roles'],
    ];
  }
  return ['id', 'grade_number', 'rank_order', 'band_label', 'tier_classification', 'typical_roles'];
}

module.exports = {
  TABLE,

  async findById(id) {
    return Grade.findByPk(id, { raw: true });
  },

  async findByGradeNumber(gradeNumber) {
    return Grade.findOne({
      attributes: ['id'],
      where: { grade_number: gradeNumber },
      raw: true,
    });
  },

  async listActive(lang = 'en') {
    return Grade.findAll({
      attributes: gradeAttributes(lang),
      where: { is_active: true },
      order: [['grade_number', 'ASC']],
      raw: true,
    });
  },

  async listDistinctBands(lang = 'en') {
    // Distinct (band_label, tier_classification) with MIN(grade_number) for ordering.
    // Use a raw query because Sequelize's group+orderRaw combo is awkward here.
    const bandCol = lang === 'am' ? 'band_label_am' : 'band_label';
    const tierCol = lang === 'am' ? 'tier_classification_am' : 'tier_classification';
    const rows = await sequelize.query(
      `SELECT ${bandCol} AS band_label, ${tierCol} AS tier_classification
       FROM grades
       WHERE is_active = 1
       GROUP BY band_label, tier_classification
       ORDER BY MIN(grade_number) ASC`,
      { type: QueryTypes.SELECT },
    );
    return rows;
  },

  async listByBand(bandLabel, lang = 'en') {
    const rolesCol = lang === 'am' ? 'typical_roles_am' : 'typical_roles';
    return Grade.findAll({
      attributes: ['id', 'grade_number', [col(rolesCol), 'typical_roles']],
      where: { band_label: bandLabel, is_active: true },
      order: [['grade_number', 'ASC']],
      raw: true,
    });
  },

  async create(data) {
    const row = await Grade.create(data);
    return row.id;
  },

  async update(id, patch) {
    const [affected] = await Grade.update(patch, { where: { id } });
    return affected > 0;
  },

  async countActiveUsers(gradeId) {
    return User.count({ where: { grade_id: gradeId, is_active: true } });
  },
};
