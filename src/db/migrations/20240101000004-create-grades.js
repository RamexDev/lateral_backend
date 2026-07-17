/**
 * Migration: grades
 * Shared, industry-standard grade matrix (Ethiopian Banking Grade Matrix).
 * See backend.md §3.2 (grades) and §4.3 (seeding).
 *
 * Shared across all banks — same 1–18 rank scale makes grade-adjacency matching
 * (BR-003) consistent across banks rather than comparing incompatible per-bank scales.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('grades', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      grade_number: {
        type: Sequelize.TINYINT.UNSIGNED,
        allowNull: false,
        unique: true,
      },
      band_label: { type: Sequelize.STRING(40), allowNull: false },
      band_label_am: { type: Sequelize.STRING(60), allowNull: false },
      tier_classification: { type: Sequelize.STRING(60), allowNull: false },
      tier_classification_am: { type: Sequelize.STRING(80), allowNull: false },
      typical_roles: { type: Sequelize.STRING(255), allowNull: false },
      typical_roles_am: { type: Sequelize.STRING(255), allowNull: false },
      rank_order: { type: Sequelize.INTEGER, allowNull: false },
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
    await queryInterface.dropTable('grades');
  },
};
