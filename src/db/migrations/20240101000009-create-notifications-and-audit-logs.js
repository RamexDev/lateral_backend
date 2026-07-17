/**
 * Migration: notifications + audit_logs
 * See backend.md §3.2 (notifications, audit_logs) and §9 (notification system).
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('notifications', {
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
      type: {
        type: Sequelize.ENUM('registration', 'digest', 'payment_confirmation', 'broadcast'),
        allowNull: false,
      },
      channel: {
        type: Sequelize.ENUM('telegram', 'email', 'sms'),
        allowNull: false,
        defaultValue: 'telegram',
      },
      payload: { type: Sequelize.JSON, allowNull: false },
      status: {
        type: Sequelize.ENUM('queued', 'sent', 'failed'),
        allowNull: false,
        defaultValue: 'queued',
      },
      sent_at: { type: Sequelize.DATE, allowNull: true },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('notifications', ['user_id', 'created_at'], {
      name: 'idx_notif_user',
    });

    await queryInterface.createTable('audit_logs', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      actor_type: {
        type: Sequelize.ENUM('user', 'staff', 'system'),
        allowNull: false,
      },
      actor_id: { type: Sequelize.BIGINT.UNSIGNED, allowNull: true },
      action: { type: Sequelize.STRING(100), allowNull: false },
      entity_type: { type: Sequelize.STRING(50), allowNull: false },
      entity_id: { type: Sequelize.BIGINT.UNSIGNED, allowNull: true },
      metadata: { type: Sequelize.JSON, allowNull: true },
      ip_address: { type: Sequelize.STRING(45), allowNull: true },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('audit_logs', ['entity_type', 'entity_id'], {
      name: 'idx_audit_entity',
    });
    await queryInterface.addIndex('audit_logs', ['actor_type', 'actor_id'], {
      name: 'idx_audit_actor',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('audit_logs');
    await queryInterface.dropTable('notifications');
  },
};
