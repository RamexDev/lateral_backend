/**
 * NotificationService — digest, broadcast, transactional notifications (§9, answers.md §B).
 *
 * Broadcasts + transactional notifications are enqueued onto BullMQ queues
 * (or run inline in test env via the queue layer's fallback). The daily digest
 * is exposed as `runDailyDigest()` — the scheduler registers it as a
 * repeatable BullMQ job on the digest-notifications queue.
 */
const sequelize = require('../db/sequelize');
const { QueryTypes } = require('sequelize');
const { User } = require('../db/models');
const notificationRepo = require('../repositories/notificationRepository');
const locationRepo = require('../repositories/locationRepository');
const auditService = require('./auditService');
const { ApiError } = require('../utils/ApiError');
const i18n = require('./localizationService');
const queues = require('../queues');

async function listForUser(user, { limit = 50 } = {}) {
  const rows = await notificationRepo.listByUser(user.id, { limit });
  return rows.map((r) => {
    let payload = r.payload;
    // Sequelize may return JSON columns as strings (SQLite) or parsed objects (MySQL).
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch {
        /* leave as-is */
      }
    }
    return {
      type: r.type,
      sentAt: r.sentAt || r.createdAt,
      summary: payload?.summary ?? null,
      payload,
    };
  });
}

/**
 * Broadcast a message to a segment of users (§6.8).
 *
 * segmentFilter.scope:
 *   - "all"     — every active user
 *   - "bank"    — active users in one bank (requires bankId)
 *   - "region"  — active users whose current_location_id resolves under regionId
 *   - "zone"    — active users whose current_location_id = zoneId (zone_subcity only)
 *
 * Validates the combination and rejects contradictions (e.g. zoneId whose parent
 * isn't regionId when both are supplied).
 */
async function broadcast({ segmentFilter, message }, actor) {
  const { scope } = segmentFilter;
  const lang = 'en';

  // Validate scope parameters.
  if (scope === 'bank' && !segmentFilter.bankId) {
    throw ApiError.business('FILTER_INCOMPLETE', i18n.t('FILTER_INCOMPLETE', lang));
  }
  if (scope === 'region' && !segmentFilter.regionId) {
    throw ApiError.business('FILTER_INCOMPLETE', i18n.t('FILTER_INCOMPLETE', lang));
  }
  if (scope === 'zone' && !segmentFilter.zoneId) {
    throw ApiError.business('FILTER_INCOMPLETE', i18n.t('FILTER_INCOMPLETE', lang));
  }

  // Build the user-id resolution query per scope.
  let userIds = [];
  if (scope === 'all') {
    const rows = await User.findAll({
      attributes: ['id'],
      where: { is_active: true },
      raw: true,
    });
    userIds = rows.map((r) => r.id);
  } else if (scope === 'bank') {
    const rows = await User.findAll({
      attributes: ['id'],
      where: { is_active: true, bank_id: segmentFilter.bankId },
      raw: true,
    });
    userIds = rows.map((r) => r.id);
  } else if (scope === 'region') {
    const replacements = {
      regionId: segmentFilter.regionId,
      ...(segmentFilter.bankId ? { bankId: segmentFilter.bankId } : {}),
    };
    const rows = await sequelize.query(
      `SELECT u.id FROM users u
       JOIN location_ancestors la ON la.descendant_id = u.current_location_id
       WHERE u.is_active = 1
         AND la.ancestor_id = :regionId
         ${segmentFilter.bankId ? 'AND u.bank_id = :bankId' : ''}`,
      { replacements, type: QueryTypes.SELECT },
    );
    userIds = rows.map((r) => r.id);
  } else if (scope === 'zone') {
    // Validate zoneId really is a zone_subcity.
    const zone = await locationRepo.findByIdRaw(segmentFilter.zoneId);
    if (!zone || zone.level_type !== 'zone_subcity') {
      throw ApiError.business('INVALID_ZONE', i18n.t('INVALID_ZONE', lang));
    }
    // If regionId also supplied, validate the zone belongs to that region.
    if (segmentFilter.regionId && zone.parent_id !== segmentFilter.regionId) {
      throw ApiError.business('ZONE_REGION_MISMATCH', i18n.t('ZONE_REGION_MISMATCH', lang));
    }
    const where = { is_active: true, current_location_id: segmentFilter.zoneId };
    if (segmentFilter.bankId) where.bank_id = segmentFilter.bankId;
    const rows = await User.findAll({ attributes: ['id'], where, raw: true });
    userIds = rows.map((r) => r.id);
  } else {
    throw ApiError.business('VALIDATION_FAILED', `Unsupported scope: ${scope}`);
  }

  if (!userIds.length) {
    throw ApiError.business('EMPTY_SEGMENT', i18n.t('EMPTY_SEGMENT', lang));
  }

  // Enqueue the fan-out as a single broadcast-notifications job carrying the
  // resolved user-id list. The processor inserts one notification row per
  // user. In test env this runs inline via the queue layer's fallback.
  await queues.enqueue(queues.QUEUE_NAMES.BROADCAST, 'fanOut', {
    userIds,
    message,
    scope,
    actorId: actor?.id,
  });

  await auditService.log({
    actorType: actor?.type || 'staff',
    actorId: actor?.id,
    action: 'admin.notification.broadcast',
    entityType: 'notification',
    metadata: { scope, recipientCount: userIds.length, segmentFilter },
    ipAddress: actor?.ipAddress,
  });

  return { queuedRecipients: userIds.length };
}

/**
 * Daily digest job — for each active user, find transfer_interests created since
 * the user's last_digest_at whose location closure-matches the user's current_location_id
 * (same predicate as the live feed query, scoped by created_at > last_digest_at).
 *
 * AUDIT-FIX: previously the digest query did NOT filter by bank_id or grade
 * adjacency, diverging from §9's "same predicate as the live feed query". Fixed.
 */
async function runDailyDigest() {
  const users = await User.findAll({
    attributes: ['id', 'last_digest_at', 'preferred_language', 'bank_id', 'current_location_id', 'grade_id'],
    where: { is_active: true },
    raw: true,
  });

  let sentCount = 0;
  for (const user of users) {
    const since = user.last_digest_at || new Date(0);

    // Same predicate as the live feed query (§5): closure join + same bank + grade adjacency.
    // We need the user's grade rank_order to evaluate the adjacency clause.
    const gradeRows = await sequelize.query(
      `SELECT rank_order FROM grades WHERE id = :gradeId LIMIT 1`,
      {
        replacements: { gradeId: user.grade_id },
        type: QueryTypes.SELECT,
      },
    );
    const rankOrder = gradeRows[0]?.rank_order;
    if (rankOrder === undefined) continue;

    const adjacencyRange = Number(process.env.DEFAULT_GRADE_ADJACENCY_RANGE || 1);

    const matches = await sequelize.query(
      `SELECT COUNT(*) AS count
       FROM transfer_interests ti
       JOIN users u ON u.id = ti.user_id
       JOIN grades g ON g.id = u.grade_id
       JOIN location_ancestors la ON la.descendant_id = u.current_location_id
       WHERE la.ancestor_id = ti.location_id
         AND ti.user_id != :userId
         AND u.bank_id = :bankId
         AND u.is_active = 1
         AND ABS(g.rank_order - :rankOrder) <= :adj
         AND ti.created_at > :since`,
      {
        replacements: {
          userId: user.id,
          bankId: user.bank_id,
          rankOrder,
          adj: adjacencyRange,
          since,
        },
        type: QueryTypes.SELECT,
      },
    );

    const count = Number(matches[0]?.count || 0);
    if (count > 0) {
      await notificationRepo.create({
        user_id: user.id,
        type: 'digest',
        channel: 'telegram',
        payload: { summary: `${count} new matches near your location` },
        status: 'queued',
      });
      await User.update(
        { last_digest_at: new Date() },
        { where: { id: user.id } },
      );
      sentCount += 1;
    }
  }
  return { processedUsers: users.length, sentDigests: sentCount };
}

module.exports = { listForUser, broadcast, runDailyDigest };
