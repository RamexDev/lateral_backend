/**
 * Bank repository — CRUD over `banks` reference data.
 * See backend.md §3.2 and §6.9 (admin bank endpoints).
 *
 * Uses Sequelize models. All queries use `raw: true` to return plain JS objects
 * with the underlying DB column names (snake_case), matching the rest of the
 * service layer.
 */
const { Bank, User } = require('../db/models');
const sequelize = require('../db/sequelize');
const { QueryTypes } = require('sequelize');
const TABLE = 'banks';

/**
 * Build the SELECT attribute list — resolves the localized name column.
 * Returns an array of Sequelize attribute selectors.
 */
function bankAttributes(lang) {
  if (lang === 'am') {
    return ['id', 'nickname', 'swift_code', 'year_established', 'is_active', ['name_am', 'name']];
  }
  return ['id', 'nickname', 'swift_code', 'year_established', 'is_active', 'name'];
}

module.exports = {
  TABLE,

  async findById(id, lang = 'en') {
    return Bank.findOne({
      attributes: bankAttributes(lang),
      where: { id },
      raw: true,
    });
  },

  async findByIdRaw(id) {
    return Bank.findByPk(id, { raw: true });
  },

  async list({ page = 1, pageSize = 50, isActive } = {}) {
    const where = {};
    if (isActive !== undefined) where.is_active = isActive;

    const { rows, count } = await Bank.findAndCountAll({
      attributes: [
        'id',
        'name',
        'name_am',
        'nickname',
        'swift_code',
        'year_established',
        'is_active',
      ],
      where,
      order: [['name', 'ASC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
      raw: true,
    });
    return { rows, total: count };
  },

  async listActive(lang = 'en') {
    return Bank.findAll({
      attributes: bankAttributes(lang),
      where: { is_active: true },
      order: [['name', 'ASC']],
      raw: true,
    });
  },

  async create(data) {
    const row = await Bank.create(data);
    return row.id;
  },

  async update(id, patch) {
    const [affected] = await Bank.update(patch, { where: { id } });
    return affected > 0;
  },

  async findByNickname(nickname) {
    return Bank.findOne({ where: { nickname }, raw: true });
  },

  async countActiveUsers(bankId) {
    return User.count({ where: { bank_id: bankId, is_active: true } });
  },
};
