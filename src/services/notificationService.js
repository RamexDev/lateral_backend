/**
 * NotificationService — digest, broadcast, transactional notifications (§9).
 *
 * In v1 we don't ship BullMQ workers — broadcasts and transactional notifications
 * are written directly to the `notifications` table. The `digest-notifications`
 * repeatable job is exposed as a callable function `runDailyDigest()` that the
 * scheduler would invoke (or tests can call directly).
 */
const db = require('../db/knex');
const notificationRepo = require('../repositories/notificationRepository');
const { ApiError } = require('../utils/ApiError');
const i18n = require('./localizationService');
const locationRepo = require('../repositories/locationRepository');

async function listForUser(user, { limit = 50 } = {}) {
  const rows = await notificationRepo.listByUser(user.id, { limit });
  return rows.map((r) => ({
    type: r.type,
    sentAt: r.sentAt || r.createdAt,
    summary: r.payload?.summary ?? null,
    payload: r.payload,
  }));
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

  // Resolve the user IDs by scope.
  let userIds = [];
  if (scope === 'all') {
    const rows = await db('users').select('id').where({ is_active: true });
    userIds = rows.map((r) => r.id);
  } else if (scope === 'bank') {
    const rows = await db('users')
      .select('id')
      .where({ is_active: true, bank_id: segmentFilter.bankId });
    userIds = rows.map((r) => r.id);
  } else if (scope === 'region') {
    const rows = await db('users as u')
      .join('location_ancestors as la', 'la.descendant_id', '=', 'u.current_location_id')
      .where('u.is_active', true)
      .andWhere('la.ancestor_id', segmentFilter.regionId)
      .modify((qb) => {
        if (segmentFilter.bankId) qb.andWhere('u.bank_id', segmentFilter.bankId);
      })
      .select('u.id');
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
    const rows = await db('users')
      .select('id')
      .where({ is_active: true, current_location_id: segmentFilter.zoneId })
      .modify((qb) => {
        if (segmentFilter.bankId) qb.andWhere('bank_id', segmentFilter.bankId);
      });
    userIds = rows.map((r) => r.id);
  } else {
    throw ApiError.business('VALIDATION_FAILED', `Unsupported scope: ${scope}`);
  }

  if (!userIds.length) {
    throw ApiError.business('EMPTY_SEGMENT', i18n.t('EMPTY_SEGMENT', lang));
  }

  // Build notification rows — one per user.
  const payload = JSON.stringify({ message, scope });
  const rows = userIds.map((uid) => ({
    user_id: uid,
    type: 'broadcast',
    channel: 'telegram',
    payload,
    status: 'queued',
  }));
  const inserted = await notificationRepo.createMany(rows);

  await auditService.log({
    actorType: actor?.type || 'staff',
    actorId: actor?.id,
    action: 'admin.notification.broadcast',
    entityType: 'notification',
    metadata: { scope, recipientCount: inserted, segmentFilter },
    ipAddress: actor?.ipAddress,
  });

  return { queuedRecipients: inserted };
}

/**
 * Daily digest job — for each active user, find transfer_interests created since
 * the user's last_digest_at whose location closure-matches the user's current_location_id
 * (same predicate as the live feed query, scoped by created_at > last_digest_at).
 * If any qualifying rows exist, enqueue a digest notification and update last_digest_at.
 */
async function runDailyDigest() {
  const users = await db('users')
    .select('id', 'last_digest_at', 'preferred_language')
    .where({ is_active: true });

  let sentCount = 0;
  for (const user of users) {
    const since = user.last_digest_at || new Date(0);
    const matches = await db('transfer_interests as ti')
      .join('users as u', 'u.id', '=', 'ti.user_id')
      .join('location_ancestors as la', 'la.descendant_id', '=', 'u.current_location_id')
      .where('la.ancestor_id', 'ti.location_id')
      .where('ti.user_id', '!=', user.id)
      .where('ti.created_at', '>', since)
      .count('* as count')
      .first();

    const count = Number(matches?.count || 0);
    if (count > 0) {
      await notificationRepo.create({
        user_id: user.id,
        type: 'digest',
        channel: 'telegram',
        payload: JSON.stringify({ summary: `${count} new matches near your location` }),
        status: 'queued',
      });
      await db('users').where({ id: user.id }).update({ last_digest_at: new Date() });
      sentCount += 1;
    }
  }
  return { processedUsers: users.length, sentDigests: sentCount };
}

const auditService = require('./auditService');

module.exports = { listForUser, broadcast, runDailyDigest };
