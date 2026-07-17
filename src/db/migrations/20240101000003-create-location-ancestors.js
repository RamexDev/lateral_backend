/**
 * Migration: location_ancestors (closure table).
 * Precomputed transitive closure over `locations` for fast hierarchy matching.
 * See backend.md §3.2 (location_ancestors) and §4.2 (closure maintenance).
 *
 * depth = 0 rows are self-references; depth > 0 are true ancestors.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('location_ancestors', {
      ancestor_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: { model: 'locations', key: 'id' },
        onDelete: 'CASCADE',
      },
      descendant_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: { model: 'locations', key: 'id' },
        onDelete: 'CASCADE',
      },
      depth: { type: Sequelize.INTEGER, allowNull: false },
    });

    await queryInterface.addConstraint('location_ancestors', {
      fields: ['ancestor_id', 'descendant_id'],
      type: 'primary key',
      name: 'pk_location_ancestors',
    });

    await queryInterface.addIndex('location_ancestors', ['descendant_id'], {
      name: 'idx_la_descendant',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('location_ancestors');
  },
};
