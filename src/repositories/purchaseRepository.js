/**
 * Purchase repository.
 * See backend.md §3.2 (purchases) and §6.7 (purchase API).
 */
const db = require('../db/knex');
const TABLE = 'purchases';

module.exports = {
  TABLE,

  async findById(id) {
    return db(TABLE).select('*').where({ id }).first();
  },

  async findByBuyerAndTarget(buyerId, targetUserId) {
    return db(TABLE).select('*').where({ buyer_id: buyerId, target_user_id: targetUserId }).first();
  },

  async listByBuyer(buyerId) {
    return db(TABLE).select('*').where({ buyer_id: buyerId }).orderBy('created_at', 'desc');
  },

  async listByTarget(targetUserId) {
    return db(TABLE)
      .select('*')
      .where({ target_user_id: targetUserId })
      .orderBy('created_at', 'desc');
  },

  async create(data) {
    const [id] = await db(TABLE).insert(data);
    return id;
  },

  async updatePaymentLink(id, paymentId) {
    return db(TABLE).where({ id }).update({ payment_id: paymentId });
  },

  async countOfTarget(targetUserId) {
    const row = await db(TABLE).where({ target_user_id: targetUserId }).count('* as count').first();
    return Number(row?.count || 0);
  },

  async sumRevenueOfTarget(targetUserId, pricePerPurchase) {
    const count = await this.countOfTarget(targetUserId);
    return count * pricePerPurchase;
  },

  async totalSpentByBuyer(buyerId, pricePerPurchase) {
    const row = await db(TABLE).where({ buyer_id: buyerId }).count('* as count').first();
    return Number(row?.count || 0) * pricePerPurchase;
  },
};
