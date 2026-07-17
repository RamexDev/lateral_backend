/**
 * Staff repository — admin users with RBAC roles.
 * See backend.md §3.2 (staff, roles) and §6.9 (admin staff management).
 */
const { Staff, Role } = require('../db/models');
const { QueryTypes } = require('sequelize');
const sequelize = require('../db/sequelize');

const STAFF_TABLE = 'staff';
const ROLES_TABLE = 'roles';

module.exports = {
  STAFF_TABLE,
  ROLES_TABLE,

  async findRoleByName(name) {
    return Role.findOne({ where: { name }, raw: true });
  },

  async listRoles() {
    return Role.findAll({ order: [['id', 'ASC']], raw: true });
  },

  async findById(id) {
    return Staff.findByPk(id, { raw: true });
  },

  async findByEmail(email) {
    return Staff.findOne({ where: { email: email.toLowerCase() }, raw: true });
  },

  async findByIdWithRole(id) {
    const rows = await sequelize.query(
      `SELECT staff.*, roles.name AS role_name
       FROM staff
       JOIN roles ON roles.id = staff.role_id
       WHERE staff.id = :id
       LIMIT 1`,
      { replacements: { id }, type: QueryTypes.SELECT },
    );
    return rows[0] || null;
  },

  async create(data) {
    const row = await Staff.create(data);
    return row.id;
  },

  async update(id, patch) {
    const [affected] = await Staff.update(patch, { where: { id } });
    return affected > 0;
  },

  async touchLastLogin(id) {
    return Staff.update({ last_login_at: new Date() }, { where: { id } });
  },

  async list({ page = 1, pageSize = 50, isActive } = {}) {
    const where = {};
    if (isActive !== undefined) where.is_active = isActive;

    const { rows, count } = await Staff.findAndCountAll({
      attributes: [
        'id',
        'full_name',
        'email',
        'role_id',
        'preferred_language',
        'is_active',
        'last_login_at',
        'created_at',
      ],
      include: [{ model: Role, as: 'role', attributes: ['name'] }],
      where,
      order: [['created_at', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
      raw: true,
      nest: true,
    });

    // Flatten the nested role.name into roleName for backward compat with the old Knex shape.
    const flatRows = rows.map((r) => ({
      id: r.id,
      fullName: r.full_name,
      email: r.email,
      roleId: r.role_id,
      roleName: r.role?.name,
      preferredLanguage: r.preferred_language,
      isActive: r.is_active,
      lastLoginAt: r.last_login_at,
      createdAt: r.created_at,
    }));

    return { rows: flatRows, total: count };
  },

  async countActive() {
    return Staff.count({ where: { is_active: true } });
  },
};
