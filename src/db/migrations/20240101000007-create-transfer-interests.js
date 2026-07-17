/**
 * Migration: transfer_interests
 * A user's set of desired transfer locations (zone_subcity today; region supported by schema).
 * See backend.md §3.2 (transfer_interests) and §6.4 (interest API).
 *
 * uq_user_location guarantees idempotent re-confirm: re-selecting an already-saved zone is a no-op.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('transfer_interests', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      user_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      location_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: { model: 'locations', key: 'id' },
        onDelete: 'RESTRICT',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addConstraint('transfer_interests', {
      fields: ['user_id', 'location_id'],
      type: 'unique',
      name: 'uq_user_location',
    });
    await queryInterface.addIndex('transfer_interests', ['location_id'], {
      name: 'idx_ti_location',
    });
    await queryInterface.addIndex('transfer_interests', ['user_id'], { name: 'idx_ti_user' });
    await queryInterface.addIndex('transfer_interests', ['created_at'], {
      name: 'idx_ti_created',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('transfer_interests');
  },
};
