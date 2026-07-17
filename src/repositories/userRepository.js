/**
 * User repository — CRUD over `users`.
 * See backend.md §3.2 (users), §6.5 (profile), §6.9 (admin user management).
 */
const { User, Bank, Location, TransferInterest, Purchase } = require('../db/models');
const sequelize = require('../db/sequelize');
const { Op, QueryTypes, literal } = require('sequelize');
const TABLE = 'users';

module.exports = {
  TABLE,

  async findById(id) {
    return User.findByPk(id, { raw: true });
  },

  async findByTelegramId(telegramId) {
    return User.findOne({ where: { telegram_id: telegramId }, raw: true });
  },

  async findByPhoneAndBank(phone, bankId) {
    return User.findOne({
      where: { phone_number: phone, bank_id: bankId },
      raw: true,
    });
  },

  async create(data) {
    const row = await User.create(data);
    return row.id;
  },

  async update(id, patch) {
    const [affected] = await User.update(patch, { where: { id } });
    return affected > 0;
  },

  async touchActivity(id) {
    // Best-effort; not awaited in request paths per spec ("best-effort, throttled").
    return User.update({ last_activity_at: new Date() }, { where: { id } });
  },

  /**
   * Admin user search — §6.10. `q` matches phone, telegram_username, branch_name.
   *
   * Returns rows with the join shape expected by reportingService.listUsers.
   */
  async search({ q, bankId, regionId, zoneId, gradeId, isActive, page = 1, pageSize = 25 }) {
    const where = [];
    const replacements = {};

    if (q) {
      where.push(
        '(users.phone_number LIKE :q OR users.telegram_username LIKE :q OR users.branch_name LIKE :q)',
      );
      replacements.q = `%${q}%`;
    }
    if (bankId) {
      where.push('users.bank_id = :bankId');
      replacements.bankId = bankId;
    }
    if (zoneId) {
      where.push('users.current_location_id = :zoneId');
      replacements.zoneId = zoneId;
    }
    if (regionId) {
      where.push('regions.id = :regionId');
      replacements.regionId = regionId;
    }
    if (gradeId) {
      where.push('users.grade_id = :gradeId');
      replacements.gradeId = gradeId;
    }
    if (isActive !== undefined) {
      where.push('users.is_active = :isActive');
      replacements.isActive = isActive ? 1 : 0;
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    // Count query (without the join for performance — joins are only needed for the rows).
    const countWhere = where.filter((c) => !c.startsWith('regions.')).join(' AND ');
    const countClause = countWhere
      ? `WHERE ${countWhere.replace(/users\./g, '')}`
      : '';
    const countRows = await sequelize.query(
      `SELECT COUNT(*) AS count FROM users ${countClause}`,
      {
        replacements,
        type: QueryTypes.SELECT,
      },
    );
    const total = Number(countRows[0]?.count || 0);

    const offset = (page - 1) * pageSize;
    const rows = await sequelize.query(
      `SELECT
         users.id,
         users.phone_number AS phone,
         users.telegram_username AS telegramUsername,
         users.bank_id AS bankId,
         banks.name AS bankName,
         users.current_location_id AS zoneId,
         zones.name AS zoneName,
         regions.id AS regionId,
         regions.name AS regionName,
         users.branch_name AS branchName,
         users.grade_id AS gradeId,
         users.is_active AS isActive,
         users.created_at AS createdAt,
         users.last_activity_at AS lastActivityAt
       FROM users
       JOIN banks ON banks.id = users.bank_id
       JOIN locations AS zones ON zones.id = users.current_location_id
       JOIN locations AS regions ON regions.id = zones.parent_id
       ${whereClause}
       ORDER BY users.created_at DESC
       LIMIT :limit OFFSET :offset`,
      {
        replacements: { ...replacements, limit: pageSize, offset },
        type: QueryTypes.SELECT,
      },
    );

    // Attach counts per user (interestsCount, purchasesCount) in batched queries.
    if (rows.length) {
      const ids = rows.map((r) => r.id);
      const interestCounts = await TransferInterest.findAll({
        attributes: [
          'user_id',
          [literal('COUNT(*)'), 'count'],
        ],
        where: { user_id: { [Op.in]: ids } },
        group: ['user_id'],
        raw: true,
      });
      const purchaseCounts = await Purchase.findAll({
        attributes: ['buyer_id', [literal('COUNT(*)'), 'count']],
        where: { buyer_id: { [Op.in]: ids } },
        group: ['buyer_id'],
        raw: true,
      });
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
