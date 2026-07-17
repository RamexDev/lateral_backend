/**
 * Payment repository.
 * See backend.md §3.2 (payments) and §6.7 (payments webhooks).
 */
const db = require('../db/knex');
const TABLE = 'payments';

module.exports = {
  TABLE,

  async findById(id) {
    return db(TABLE).select('*').where({ id }).first();
  },

  async findByChargeId(chargeId) {
    return db(TABLE).select('*').where({ telegram_charge_id: chargeId }).first();
  },

  async create(data) {
    const [id] = await db(TABLE).insert(data);
    return id;
  },

  async update(id, patch) {
    return db(TABLE).where({ id }).update(patch);
  },

  async totalCompletedRevenue({ from, to, bankId } = {}) {
    const query = db(TABLE)
      .join('purchases', 'purchases.id', '=', 'payments.purchase_id')
      .join('users', 'users.id', '=', 'purchases.buyer_id')
      .where('payments.status', 'completed')
      .sum('payments.amount as revenue')
      .count('payments.id as purchaseCount')
      .first();

    if (from) query.andWhere('payments.created_at', '>=', from);
    if (to) query.andWhere('payments.created_at', '<=', to);
    if (bankId) query.andWhere('users.bank_id', bankId);

    const row = await query;
    return {
      revenueEtb: Number(row?.revenue || 0),
      purchaseCount: Number(row?.purchaseCount || 0),
    };
  },

  async revenueByBank({ from, to } = {}) {
    const query = db(TABLE)
      .join('purchases', 'purchases.id', '=', 'payments.purchase_id')
      .join('users', 'users.id', '=', 'purchases.buyer_id')
      .where('payments.status', 'completed')
      .select('users.bank_id as bankId')
      .sum('payments.amount as revenueEtb')
      .count('payments.id as purchaseCount')
      .groupBy('users.bank_id');

    if (from) query.andWhere('payments.created_at', '>=', from);
    if (to) query.andWhere('payments.created_at', '<=', to);

    return query;
  },
};
