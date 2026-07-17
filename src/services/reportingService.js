/**
 * ReportingService — dashboard summaries, revenue reports, user monitoring (§6.10).
 *
 * Phone masking (SEC-006): list view masks phone; detail view returns full phone
 * only when caller is support_officer or higher (i.e. any staff role in v1).
 */
const db = require('../db/knex');
const userRepo = require('../repositories/userRepository');
const purchaseRepo = require('../repositories/purchaseRepository');
const paymentRepo = require('../repositories/paymentRepository');
const interestRepo = require('../repositories/interestRepository');
const bankRepo = require('../repositories/bankRepository');
const locationRepo = require('../repositories/locationRepository');
const gradeRepo = require('../repositories/gradeRepository');
const { maskPhone } = require('../utils/phone');
const config = require('../config');

async function dashboardSummary() {
  const [activeUsers, totalInterests, totalPurchases, revenueRow] = await Promise.all([
    db('users').where({ is_active: true }).count('* as count').first(),
    interestRepo.TABLE
      ? db(interestRepo.TABLE).count('* as count').first()
      : Promise.resolve({ count: 0 }),
    db(purchaseRepo.TABLE).count('* as count').first(),
    db('payments').where({ status: 'completed' }).sum('amount as revenue').first(),
  ]);

  return {
    activeUsers: Number(activeUsers?.count || 0),
    totalInterests: Number(totalInterests?.count || 0),
    totalPurchases: Number(totalPurchases?.count || 0),
    revenueEtb: Number(revenueRow?.revenue || 0),
  };
}

async function revenueReport({ from, to, bankId } = {}) {
  const overall = await paymentRepo.totalCompletedRevenue({ from, to, bankId });
  const byBankRows = await paymentRepo.revenueByBank({ from, to });
  const byBank = byBankRows
    .filter((r) => !bankId || r.bankId === bankId)
    .map((r) => ({ bankId: r.bankId, revenueEtb: Number(r.revenueEtb || 0) }));

  return {
    revenueEtb: overall.revenueEtb,
    purchaseCount: overall.purchaseCount,
    byBank,
  };
}

async function listUsers({
  q,
  bankId,
  regionId,
  zoneId,
  gradeId,
  isActive,
  page = 1,
  pageSize = 25,
} = {}) {
  const { rows, total } = await userRepo.search({
    q,
    bankId,
    regionId,
    zoneId,
    gradeId,
    isActive,
    page,
    pageSize,
  });
  // Mask phone in list view (SEC-006).
  const maskedRows = rows.map((r) => ({
    ...r,
    phone: maskPhone(r.phone),
  }));
  return { users: maskedRows, page, pageSize, totalResults: total };
}

async function getUserDetail(id, caller) {
  const user = await userRepo.findById(id);
  if (!user) return null;

  const [bank, zone, grade, interests, purchasesMade, purchasesOfMe] = await Promise.all([
    bankRepo.findById(user.bank_id),
    locationRepo.findById(user.current_location_id, user.preferred_language),
    gradeRepo.findById(user.grade_id),
    interestRepo.listByUser(id),
    purchaseRepo.listByBuyer(id),
    purchaseRepo.listByTarget(id),
  ]);
  const region = zone?.parent_id
    ? await locationRepo.findById(zone.parent_id, user.preferred_language)
    : null;

  const totalSpentEtb = purchasesMade.length * config.payments.amountEtb;
  const totalRevealedByOthersEtb = purchasesOfMe.length * config.payments.amountEtb;

  const activity = [
    { at: user.created_at, type: 'registration_complete' },
    ...purchasesMade.map((p) => ({
      at: p.created_at,
      type: 'purchase',
      targetUserId: p.target_user_id,
      amountEtb: config.payments.amountEtb,
    })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at));

  const gradeLabel = `Grade ${grade?.grade_number} — ${grade?.tier_classification}`;

  // SEC-006: full phone only for staff callers (Support Officer or higher = any staff in v1).
  const canSeeFullPhone = caller?.scope === 'staff';
  const profile = {
    bankName: bank?.name,
    regionName: region?.name,
    zoneName: zone?.name,
    branchName: user.branch_name,
    gradeLabel,
    preferredLanguage: user.preferred_language,
    isActive: user.is_active,
    createdAt: user.created_at,
    phone: canSeeFullPhone ? user.phone_number : maskPhone(user.phone_number),
  };

  return {
    id,
    profile,
    stats: {
      interestsCount: interests.length,
      purchasesMadeCount: purchasesMade.length,
      purchasesOfMeCount: purchasesOfMe.length,
      totalSpentEtb,
      totalRevealedByOthersEtb,
    },
    activity,
  };
}

async function systemHealth() {
  let dbOk = false;
  let redisOk = false;
  try {
    await db.raw('SELECT 1');
    dbOk = true;
  } catch {
    /* ignore */
  }
  try {
    const { getBackend } = require('../utils/cache');
    const cache = await getBackend();
    await cache.set('healthz', '1', 5);
    redisOk = true;
  } catch {
    /* ignore */
  }
  const [activeSessions, queuedNotifications] = await Promise.all([
    db('staff').where({ is_active: true }).count('* as count').first(),
    db('notifications').where({ status: 'queued' }).count('* as count').first(),
  ]);
  return {
    mysql: dbOk ? 'ok' : 'down',
    redis: redisOk ? 'ok' : 'down',
    activeStaffSessions: Number(activeSessions?.count || 0),
    queuedNotifications: Number(queuedNotifications?.count || 0),
  };
}

module.exports = { dashboardSummary, revenueReport, listUsers, getUserDetail, systemHealth };
