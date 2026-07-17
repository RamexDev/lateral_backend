/**
 * Migration: locations
 * Shared administrative geography (region + zone_subcity).
 * See backend.md §3.2 (locations) and §3.1 (design note).
 *
 * The locations tree is bank-agnostic: every bank shares the same geography.
 * A user's exact branch identity is captured as free text on the users row.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('locations', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      parent_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
        references: { model: 'locations', key: 'id' },
        onDelete: 'RESTRICT',
      },
      name: { type: Sequelize.STRING(150), allowNull: false },
      name_am: { type: Sequelize.STRING(150), allowNull: false },
      level_type: {
        type: Sequelize.ENUM('region', 'zone_subcity'),
        allowNull: false,
      },
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

    await queryInterface.addIndex('locations', ['parent_id'], { name: 'idx_loc_parent' });
    await queryInterface.addIndex('locations', ['level_type'], { name: 'idx_loc_level' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('locations');
  },
};
