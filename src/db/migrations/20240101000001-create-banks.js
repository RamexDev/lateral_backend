/**
 * Migration: banks
 * Reference data — bank directory shared across the platform.
 * See backend.md §3.2 (banks table).
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('banks', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      name: { type: Sequelize.STRING(150), allowNull: false },
      name_am: { type: Sequelize.STRING(150), allowNull: false },
      nickname: { type: Sequelize.STRING(30), allowNull: false, unique: true },
      swift_code: { type: Sequelize.STRING(11), allowNull: true },
      year_established: { type: Sequelize.SMALLINT.UNSIGNED, allowNull: true },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
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
  },

  async down(queryInterface) {
    await queryInterface.dropTable('banks');
  },
};
