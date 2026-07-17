/**
 * Migration: users
 * Core domain — registered bank employees seeking lateral transfers.
 * See backend.md §3.2 (users table).
 *
 * Notes:
 * - current_location_id references locations.level_type='zone_subcity'
 * - branch_name + neighborhood are free text, only revealed on paid purchase (SEC-010)
 * - uq_phone_bank enforces FR-AUTH-003 (no duplicate phone under same bank across Telegram accounts)
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('users', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      telegram_id: { type: Sequelize.BIGINT.UNSIGNED, allowNull: false, unique: true },
      telegram_username: { type: Sequelize.STRING(64), allowNull: true },
      phone_number: { type: Sequelize.STRING(20), allowNull: false },
      phone_verified_at: { type: Sequelize.DATE, allowNull: true },
      bank_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: 'banks', key: 'id' },
        onDelete: 'RESTRICT',
      },
      current_location_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: { model: 'locations', key: 'id' },
        onDelete: 'RESTRICT',
      },
      branch_name: { type: Sequelize.STRING(150), allowNull: false },
      neighborhood: { type: Sequelize.STRING(150), allowNull: true },
      grade_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: 'grades', key: 'id' },
        onDelete: 'RESTRICT',
      },
      preferred_language: {
        type: Sequelize.ENUM('en', 'am'),
        allowNull: false,
        defaultValue: 'en',
      },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      last_digest_at: { type: Sequelize.DATE, allowNull: true },
      last_activity_at: { type: Sequelize.DATE, allowNull: true },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // FR-AUTH-003: phone is unique within a bank.
    await queryInterface.addConstraint('users', {
      fields: ['phone_number', 'bank_id'],
      type: 'unique',
      name: 'uq_phone_bank',
    });
    await queryInterface.addIndex('users', ['bank_id', 'current_location_id'], {
      name: 'idx_user_bank_location',
    });
    await queryInterface.addIndex('users', ['is_active', 'last_activity_at'], {
      name: 'idx_user_activity',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('users');
  },
};
