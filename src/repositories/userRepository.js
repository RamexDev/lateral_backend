/**
 * User repository — CRUD over `users`.
 * See backend.md §3.2 (users), §6.5 (profile), §6.9 (admin user management).
 */
const db = require('../db/knex');
const TABLE = 'users';

module.exports = {
  TABLE,

  async findById(id) {
    return db(TABLE).select('*').where({ id }).first();
  },

  async findByTelegramId(telegramId) {
    return db(TABLE).select('*').where({ telegram_id: telegramId }).first();
  },

  async findByPhoneAndBank(phone, bankId) {
    return db(TABLE).select('*').where({ phone_number: phone, bank_id: bankId }).first();
  },

  async create(data) {
    const [id] = await db(TABLE).insert(data);
    return id;
  },

  async update(id, patch) {
    const affected = await db(TABLE).where({ id }).update(patch);
    return affected > 0;
  },

  async touchActivity(id) {
    // Best-effort; not awaited in request paths per spec ("best-effort, throttled").
    return db(TABLE).where({ id }).update({ last_activity_at: new Date() });
  },

  /**
   * Admin user search — §6.10. `q` matches phone, telegram_username, branch_name.
   */
  async search({ q, bankId, regionId, zoneId, gradeId, isActive, page = 1, pageSize = 25 }) {
    const query = db(TABLE)
      .select(
        'users.id',
        'users.phone_number as phone',
        'users.telegram_username as telegramUsername',
        'users.bank_id as bankId',
        'banks.name as bankName',
        'users.current_location_id as zoneId',
        'zones.name as zoneName',
        'regions.id as regionId',
        'regions.name as regionName',
        'users.branch_name as branchName',
        'users.grade_id as gradeId',
        'users.is_active as isActive',
        'users.created_at as createdAt',
        'users.last_activity_at as lastActivityAt',
      )
      .join('banks', 'banks.id', '=', 'users.bank_id')
      .join('locations as zones', 'zones.id', '=', 'users.current_location_id')
      .join('locations as regions', 'regions.id', '=', 'zones.parent_id');

    if (q) {
      query.andWhere((b) => {
        b.where('users.phone_number', 'like', `%${q}%`)
          .orWhere('users.telegram_username', 'like', `%${q}%`)
          .orWhere('users.branch_name', 'like', `%${q}%`);
      });
    }
    if (bankId) query.andWhere('users.bank_id', bankId);
    if (zoneId) query.andWhere('users.current_location_id', zoneId);
    if (regionId) query.andWhere('regions.id', regionId);
    if (gradeId) query.andWhere('users.grade_id', gradeId);
    if (isActive !== undefined) query.andWhere('users.is_active', isActive);

    const totalRow = await query.clone().count('* as count').first();
    const total = Number(totalRow?.count || 0);

    const rows = await query
      .clone()
      .orderBy('users.created_at', 'desc')
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    // Attach counts per user (interestsCount, purchasesCount) in one batched query.
    if (rows.length) {
      const ids = rows.map((r) => r.id);
      const interestCounts = await db('transfer_interests')
        .select('user_id')
        .count('* as count')
        .whereIn('user_id', ids)
        .groupBy('user_id');
      const purchaseCounts = await db('purchases')
        .select('buyer_id')
        .count('* as count')
        .whereIn('buyer_id', ids)
        .groupBy('buyer_id');
      const intMap = new Map(interestCounts.map((r) => [r.user_id, Number(r.count)]));
      const purMap = new Map(purchaseCounts.map((r) => [r.buyer_id, Number(r.count)]));

      for (const r of rows) {
        r.interestsCount = intMap.get(r.id) || 0;
        r.purchasesCount = purMap.get(r.id) || 0;
      }
    }

    return { rows, total };
  },
};
