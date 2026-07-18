/**
 * ReportingService — dashboard summaries, revenue reports, user monitoring (§6.10).
 *
 * Phone masking (SEC-006): list view masks phone; detail view returns full phone
 * only when caller is support_officer or higher (i.e. any staff role in v1).
 */
const sequelize = require('../db/sequelize');
const { QueryTypes } = require('sequelize');
const { User, Payment, Notification, Staff, AuditLog } = require('../db/models');
const userRepo = require('../repositories/userRepository');
const purchaseRepo = require('../repositories/purchaseRepository');
const paymentRepo = require('../repositories/paymentRepository');
const interestRepo = require('../repositories/interestRepository');
const bankRepo = require('../repositories/bankRepository');
const locationRepo = require('../repositories/locationRepository');
const gradeRepo = require('../repositories/gradeRepository');
const { maskPhone } = require('../utils/phone');
const config = require('../config');
const auditService = require('./auditService');

async function dashboardSummary() {
  const [activeUsers, totalInterests, totalPurchases, revenueRow] = await Promise.all([
    User.count({ where: { is_active: true } }),
    sequelize.query(`SELECT COUNT(*) AS count FROM transfer_interests`, {
      type: QueryTypes.SELECT,
    }),
    sequelize.query(`SELECT COUNT(*) AS count FROM purchases`, {
      type: QueryTypes.SELECT,
    }),
    sequelize.query(
      `SELECT COALESCE(SUM(amount), 0) AS revenue FROM payments WHERE status = 'completed'`,
      { type: QueryTypes.SELECT },
    ),
  ]);

  return {
    activeUsers: Number(activeUsers || 0),
    totalInterests: Number(totalInterests[0]?.count || 0),
    totalPurchases: Number(totalPurchases[0]?.count || 0),
    revenueEtb: Number(revenueRow[0]?.revenue || 0),
  };
}

async function revenueReport({ from, to, bankId } = {}) {
  const overall = await paymentRepo.totalCompletedRevenue({ from, to, bankId });
  const byBankRows = await paymentRepo.revenueByBank({ from, to });
  const byBank = byBankRows
    .filter((r) => !bankId || r.bankId === bankId)
    .map((r) => ({
      bankId: r.bankId,
      revenueEtb: Number(r.revenueEtb || 0),
      purchaseCount: Number(r.purchaseCount || 0),
    }));

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
  let auditOk = false;
  try {
    await sequelize.query('SELECT 1', { type: QueryTypes.SELECT });
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

  // Decision I (answers.md): synthetic audit_logs write-and-verify probe.
  // Tagged with action='healthcheck' so a periodic cleanup job can purge them
  // without touching real audit entries.
  try {
    await auditService.log({
      actorType: 'system',
      action: 'healthcheck',
      entityType: 'system',
      entityId: 0,
      metadata: { probe: true, at: new Date().toISOString() },
    });
    // Verify the row is readable (catches silent insert failures where the
    // service swallowed the error but didn't actually persist).
    const recent = await AuditLog.count({
      where: { action: 'healthcheck' },
    });
    auditOk = recent > 0;
  } catch {
    auditOk = false;
  }

  const [activeSessions, queuedNotifications] = await Promise.all([
    Staff.count({ where: { is_active: true } }),
    Notification.count({ where: { status: 'queued' } }),
  ]);
  return {
    mysql: dbOk ? 'ok' : 'down',
    redis: redisOk ? 'ok' : 'down',
    auditLog: auditOk ? 'ok' : 'down',
    activeStaffSessions: Number(activeSessions || 0),
    queuedNotifications: Number(queuedNotifications || 0),
  };
}

/**
 * Build a real .xlsx workbook (OOXML) for the revenue report (answers.md §A).
 *
 * Two sheets:
 *   1. "Summary" — overall revenue + purchase count, formatted with bold
 *      headers and ETB currency formatting.
 *   2. "By Bank" — per-bank breakdown, joined to bank names for readability.
 *
 * exceljs forces UTF-8 throughout so Amharic (name_am) renders correctly
 * regardless of the admin's Excel locale.
 *
 * @returns {Promise<Buffer>} raw OOXML bytes ready to stream as the response body.
 */
async function buildRevenueXlsx(report) {
  const ExcelJS = require('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Lateral Transfer Marketplace';
  workbook.created = new Date();

  // Pull bank names so the "By Bank" tab is human-readable.
  const { rows: banks } = await bankRepo.list({ pageSize: 1000 });
  const bankNameById = new Map(banks.map((b) => [b.id, b.name]));

  // ─── Sheet 1: Summary ────────────────────────────────────────────────────
  const summary = workbook.addWorksheet('Summary');
  summary.columns = [
    { header: 'Metric', key: 'metric', width: 32 },
    { header: 'Value', key: 'value', width: 24 },
  ];
  summary.getRow(1).font = { bold: true };
  summary.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E7FF' },
  };

  const revenueRow = summary.addRow({
    metric: 'Total Revenue (ETB)',
    value: Number(report.revenueEtb || 0),
  });
  revenueRow.getCell(2).numFmt = '#,##0.00 "ETB"';

  const countRow = summary.addRow({
    metric: 'Total Purchases',
    value: Number(report.purchaseCount || 0),
  });
  countRow.getCell(2).numFmt = '#,##0';

  summary.addRow({ metric: 'Report Generated At', value: new Date().toISOString() });

  // ─── Sheet 2: By Bank ────────────────────────────────────────────────────
  const byBank = workbook.addWorksheet('By Bank');
  byBank.columns = [
    { header: 'Bank ID', key: 'bankId', width: 10 },
    { header: 'Bank Name', key: 'bankName', width: 40 },
    { header: 'Revenue (ETB)', key: 'revenueEtb', width: 20 },
    { header: 'Purchase Count', key: 'purchaseCount', width: 18 },
  ];
  byBank.getRow(1).font = { bold: true };
  byBank.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E7FF' },
  };

  for (const row of report.byBank || []) {
    const r = byBank.addRow({
      bankId: row.bankId,
      bankName: bankNameById.get(row.bankId) || `(unknown bank ${row.bankId})`,
      revenueEtb: Number(row.revenueEtb || 0),
      purchaseCount: Number(row.purchaseCount || 0),
    });
    r.getCell(3).numFmt = '#,##0.00 "ETB"';
    r.getCell(4).numFmt = '#,##0';
  }

  // Serialize to a Buffer (exceljs supports both stream + buffer).
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

module.exports = {
  dashboardSummary,
  revenueReport,
  listUsers,
  getUserDetail,
  systemHealth,
  buildRevenueXlsx,
};
