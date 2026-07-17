/**
 * Payment repository.
 * See backend.md §3.2 (payments) and §6.7 (payments webhooks).
 */
const { Payment } = require('../db/models');
const sequelize = require('../db/sequelize');
const { QueryTypes, literal } = require('sequelize');
const TABLE = 'payments';

module.exports = {
  TABLE,

  async findById(id) {
    return Payment.findByPk(id, { raw: true });
  },

  async findByChargeId(chargeId) {
    return Payment.findOne({
      where: { telegram_charge_id: chargeId },
      raw: true,
    });
  },

  async create(data) {
    const row = await Payment.create(data);
    return row.id;
  },

  async update(id, patch) {
    return Payment.update(patch, { where: { id } });
  },

  async totalCompletedRevenue({ from, to, bankId } = {}) {
    const replacements = {};
    const where = ['payments.status = :status'];
    replacements.status = 'completed';

    if (from) {
      where.push('payments.created_at >= :from');
      replacements.from = from;
    }
    if (to) {
      where.push('payments.created_at <= :to');
      replacements.to = to;
    }
    if (bankId) {
      where.push('users.bank_id = :bankId');
      replacements.bankId = bankId;
    }

    const rows = await sequelize.query(
      `SELECT
         COALESCE(SUM(payments.amount), 0) AS revenue,
         COUNT(payments.id) AS purchaseCount
       FROM payments
       JOIN purchases ON purchases.id = payments.purchase_id
       JOIN users ON users.id = purchases.buyer_id
       WHERE ${where.join(' AND ')}`,
      { replacements, type: QueryTypes.SELECT },
    );
    return {
      revenueEtb: Number(rows[0]?.revenue || 0),
      purchaseCount: Number(rows[0]?.purchaseCount || 0),
    };
  },

  async revenueByBank({ from, to } = {}) {
    const replacements = {};
    const where = ['payments.status = :status'];
    replacements.status = 'completed';

    if (from) {
      where.push('payments.created_at >= :from');
      replacements.from = from;
    }
    if (to) {
      where.push('payments.created_at <= :to');
      replacements.to = to;
    }

    return sequelize.query(
      `SELECT
         users.bank_id AS bankId,
         COALESCE(SUM(payments.amount), 0) AS revenueEtb,
         COUNT(payments.id) AS purchaseCount
       FROM payments
       JOIN purchases ON purchases.id = payments.purchase_id
       JOIN users ON users.id = purchases.buyer_id
       WHERE ${where.join(' AND ')}
       GROUP BY users.bank_id`,
      { replacements, type: QueryTypes.SELECT },
    );
  },
};
