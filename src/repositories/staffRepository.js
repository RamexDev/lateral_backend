/**
 * Staff repository — admin users with RBAC roles.
 * See backend.md §3.2 (staff, roles) and §6.9 (admin staff management).
 */
const db = require('../db/knex');
const STAFF_TABLE = 'staff';
const ROLES_TABLE = 'roles';

module.exports = {
  STAFF_TABLE,
  ROLES_TABLE,

  async findRoleByName(name) {
    return db(ROLES_TABLE).select('*').where({ name }).first();
  },

  async listRoles() {
    return db(ROLES_TABLE).select('*').orderBy('id', 'asc');
  },

  async findById(id) {
    return db(STAFF_TABLE).select('*').where({ id }).first();
  },

  async findByEmail(email) {
    return db(STAFF_TABLE).select('*').where({ email: email.toLowerCase() }).first();
  },

  async findByIdWithRole(id) {
    return db(STAFF_TABLE)
      .select('staff.*', 'roles.name as role_name')
      .join('roles', 'roles.id', '=', 'staff.role_id')
      .where('staff.id', id)
      .first();
  },

  async create(data) {
    const [id] = await db(STAFF_TABLE).insert(data);
    return id;
  },

  async update(id, patch) {
    const affected = await db(STAFF_TABLE).where({ id }).update(patch);
    return affected > 0;
  },

  async touchLastLogin(id) {
    return db(STAFF_TABLE).where({ id }).update({ last_login_at: new Date() });
  },

  async list({ page = 1, pageSize = 50, isActive } = {}) {
    const query = db(STAFF_TABLE)
      .select(
        'staff.id',
        'staff.full_name as fullName',
        'staff.email',
        'staff.role_id as roleId',
        'roles.name as roleName',
        'staff.preferred_language as preferredLanguage',
        'staff.is_active as isActive',
        'staff.last_login_at as lastLoginAt',
        'staff.created_at as createdAt',
      )
      .join('roles', 'roles.id', '=', 'staff.role_id');

    if (isActive !== undefined) query.where('staff.is_active', isActive);

    const total = await query.clone().count('* as count').first();
    const rows = await query
      .clone()
      .orderBy('staff.created_at', 'desc')
      .limit(pageSize)
      .offset((page - 1) * pageSize);
    return { rows, total: Number(total?.count || 0) };
  },

  async countActive() {
    const row = await db(STAFF_TABLE).where({ is_active: true }).count('* as count').first();
    return Number(row?.count || 0);
  },
};
