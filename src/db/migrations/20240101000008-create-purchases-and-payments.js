/**
 * Migration: purchases + payments
 * Reveal purchase + payment record. See backend.md §3.2 and §6.7.
 *
 * - purchases.revealed_fields JSON: which contact fields were unlocked
 * - purchases.uq_buyer_target enforces BR-006: never charge the same buyer twice for the same target
 * - payments.telegram_charge_id UNIQUE: idempotency key for FR-PAY-002
 *
 * Two-step: create purchases first, then payments, then add the purchases.payment_id FK
 * (chicken-and-egg otherwise).
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('purchases', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      buyer_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'RESTRICT',
      },
      target_user_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'RESTRICT',
      },
      matched_interest_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
      },
      revealed_fields: { type: Sequelize.JSON, allowNull: false },
      payment_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addConstraint('purchases', {
      fields: ['buyer_id', 'target_user_id'],
      type: 'unique',
      name: 'uq_buyer_target',
    });

    await queryInterface.createTable('payments', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      purchase_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
        references: { model: 'purchases', key: 'id' },
        onDelete: 'SET NULL',
      },
      telegram_charge_id: { type: Sequelize.STRING(100), allowNull: true, unique: true },
      provider: {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: 'telegram_stars',
      },
      amount: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
      currency: { type: Sequelize.STRING(10), allowNull: false },
      status: {
        type: Sequelize.ENUM('pending', 'completed', 'failed', 'refunded'),
        allowNull: false,
        defaultValue: 'pending',
      },
      raw_payload: { type: Sequelize.JSON, allowNull: true },
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

    // Back-fill the purchases.payment_id FK now that payments exists.
    await queryInterface.addConstraint('purchases', {
      fields: ['payment_id'],
      type: 'foreign key',
      name: 'fk_purchases_payment',
      references: { table: 'payments', field: 'id' },
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint('purchases', 'fk_purchases_payment');
    await queryInterface.dropTable('payments');
    await queryInterface.dropTable('purchases');
  },
};
