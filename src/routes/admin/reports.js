const express = require('express');
const router = express.Router();

const reportingService = require('../../services/reportingService');
const { validate } = require('../../middlewares/validate');
const { success } = require('../../utils/response');
const { adminRevenueQuerySchema } = require('../../schemas/admin');
const { requireRole, Capabilities } = require('../../middlewares/rbac');

/**
 * GET /admin/api/v1/dashboard/summary
 * Top-line metrics. Viewable by all staff (read-only for support).
 */
router.get('/summary', requireRole(...Capabilities.viewUserReports), async (req, res, next) => {
  try {
    const data = await reportingService.dashboardSummary();
    return success(res, data);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /admin/api/v1/reports/revenue?from=&to=&bankId=
 * Revenue report. Super admin + finance only (§11).
 */
router.get(
  '/revenue',
  requireRole(...Capabilities.viewRevenueReports),
  validate(adminRevenueQuerySchema, 'query'),
  async (req, res, next) => {
    try {
      const data = await reportingService.revenueReport({
        from: req.query.from,
        to: req.query.to,
        bankId: req.query.bankId,
      });
      return success(res, data);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /admin/api/v1/reports/export?type=revenue&format=xlsx
 * Stub — returns a CSV-style plaintext in v1 (would be a real xlsx stream in production).
 */
router.get('/export', requireRole(...Capabilities.viewRevenueReports), async (req, res, next) => {
  try {
    const report = await reportingService.revenueReport({
      from: req.query.from,
      to: req.query.to,
      bankId: req.query.bankId,
    });
    // Minimal CSV export (would use exceljs in production).
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="revenue.csv"');
    const lines = [
      'metric,value',
      `revenueEtb,${report.revenueEtb}`,
      `purchaseCount,${report.purchaseCount}`,
      ...report.byBank.map((b) => `bank_${b.bankId}_revenueEtb,${b.revenueEtb}`),
    ];
    return res.status(200).send(lines.join('\n'));
  } catch (err) {
    next(err);
  }
});

/**
 * GET /admin/api/v1/system/health
 * Ops monitoring — DB/Redis ping, queue depths (§6.10).
 */
router.get('/health', requireRole(...Capabilities.viewUserReports), async (req, res, next) => {
  try {
    const data = await reportingService.systemHealth();
    return success(res, data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
