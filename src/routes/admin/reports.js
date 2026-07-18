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
 * GET /admin/api/v1/reports/export?type=revenue&format=xlsx|csv
 *
 * `format=xlsx` → real OOXML workbook via exceljs (answers.md §A):
 *   - Two sheets: "Summary" (overall revenue + purchase count) and
 *     "By Bank" (per-bank breakdown with bank names joined in).
 *   - Bold/formatted headers, autofit column widths, ETB currency format
 *     on amount cells.
 *   - UTF-8 throughout so Amharic (name_am) renders correctly regardless
 *     of the admin's Excel locale.
 *
 * `format=csv` (or omit `format`) → lightweight CSV stream (kept as a
 * secondary option for quick CLI downloads / shell pipelines).
 */
router.get('/export', requireRole(...Capabilities.viewRevenueReports), async (req, res, next) => {
  try {
    const report = await reportingService.revenueReport({
      from: req.query.from,
      to: req.query.to,
      bankId: req.query.bankId,
    });
    const format = (req.query.format || 'csv').toLowerCase();

    if (format === 'xlsx') {
      const buffer = await reportingService.buildRevenueXlsx(report);
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="revenue.xlsx"',
      );
      return res.status(200).send(buffer);
    }

    // Default: CSV (lightweight).
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
 * Ops monitoring — DB/Redis/audit-log ping, queue depths (§6.10, answers.md §I).
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
