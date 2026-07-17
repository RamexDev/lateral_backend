/**
 * AuditService — thin wrapper that fire-and-forgets audit log writes.
 * SEC-006: every sensitive action writes a row here.
 */
const auditRepository = require('../repositories/auditRepository');

async function log(entry) {
  try {
    await auditRepository.log(entry);
  } catch (err) {
    // Audit failures must never crash the request — log and move on.
    // eslint-disable-next-line no-console
    console.error('[audit] write failed:', err.message);
  }
}

module.exports = { log };
