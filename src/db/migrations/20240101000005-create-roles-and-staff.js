/**
 * Migration: roles + staff
 * RBAC tables for admin access. See backend.md §3.2 (roles, staff) and §11 (RBAC matrix).
 *
 * Roles: super_admin | platform_admin | finance_officer | support_officer
 * Seeded at migration time so the super-admin seeder can attach to 'super_admin' on first run.
 */
const ROLE_NAMES = ['super_admin', 'platform_admin', 'finance_officer', 'support_officer'];

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('roles', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      name: { type: Sequelize.STRING(50), allowNull: false, unique: true },
    });

    // Seed the 4 roles inline so downstream migrations (staff FK) work immediately.
    const now = new Date();
    await queryInterface.bulkInsert(
      'roles',
      ROLE_NAMES.map((name) => ({ name })),
      { createdAt: now, updatedAt: now },
    );

    await queryInterface.createTable('staff', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      full_name: { type: Sequelize.STRING(150), allowNull: false },
      email: { type: Sequelize.STRING(150), allowNull: false, unique: true },
      password_hash: { type: Sequelize.STRING(255), allowNull: false },
      role_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: 'roles', key: 'id' },
        onDelete: 'RESTRICT',
      },
      preferred_language: {
        type: Sequelize.ENUM('en', 'am'),
        allowNull: false,
        defaultValue: 'en',
      },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      last_login_at: { type: Sequelize.DATE, allowNull: true },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('staff');
    await queryInterface.dropTable('roles');
  },
};
