/**
 * Purchase repository.
 * See backend.md §3.2 (purchases) and §6.7 (purchase API).
 */
const { Purchase } = require('../db/models');
const { literal } = require('sequelize');
const TABLE = 'purchases';

module.exports = {
  TABLE,

  async findById(id) {
    return Purchase.findByPk(id, { raw: true });
  },

  async findByBuyerAndTarget(buyerId, targetUserId) {
    return Purchase.findOne({
      where: { buyer_id: buyerId, target_user_id: targetUserId },
      raw: true,
    });
  },

  async listByBuyer(buyerId) {
    return Purchase.findAll({
      where: { buyer_id: buyerId },
      order: [['created_at', 'DESC']],
      raw: true,
    });
  },

  async listByTarget(targetUserId) {
    return Purchase.findAll({
      where: { target_user_id: targetUserId },
      order: [['created_at', 'DESC']],
      raw: true,
    });
  },

  async create(data) {
    const row = await Purchase.create(data);
    return row.id;
  },

  async updatePaymentLink(id, paymentId) {
    return Purchase.update({ payment_id: paymentId }, { where: { id } });
  },

  async countOfTarget(targetUserId) {
    return Purchase.count({ where: { target_user_id: targetUserId } });
  },

  async sumRevenueOfTarget(targetUserId, pricePerPurchase) {
    const count = await this.countOfTarget(targetUserId);
    return count * pricePerPurchase;
  },

  async totalSpentByBuyer(buyerId, pricePerPurchase) {
    const count = await Purchase.count({ where: { buyer_id: buyerId } });
    return count * pricePerPurchase;
  },
};
