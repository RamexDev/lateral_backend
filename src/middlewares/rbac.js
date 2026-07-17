/**
 * RBAC middleware — SEC-004, §11.
 *
 * Usage:
 *   router.post('/banks', requireStaff(), requireRole('super_admin', 'platform_admin'), handler)
 *
 * The middleware reads `req.authPayload.roleName` (set by requireStaff) and rejects
 * with INSUFFICIENT_ROLE if the staff's role isn't in the allowed list.
 */
const { ApiError } = require('../utils/ApiError');
const i18n = require('../services/localizationService');

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const role = req.authPayload?.roleName;
    if (!role) {
      return next(ApiError.unauthorized('INVALID_TOKEN', i18n.t('INVALID_TOKEN', 'en')));
    }
    if (!allowedRoles.includes(role)) {
      return next(ApiError.forbidden('INSUFFICIENT_ROLE', i18n.t('INSUFFICIENT_ROLE', 'en')));
    }
    next();
  };
}

// Convenience maps for the matrix in §11.
const Roles = {
  SUPER_ADMIN: 'super_admin',
  PLATFORM_ADMIN: 'platform_admin',
  FINANCE_OFFICER: 'finance_officer',
  SUPPORT_OFFICER: 'support_officer',
};

const Capabilities = {
  // Manage reference data (banks/locations/grades): super_admin, platform_admin
  manageReferenceData: [Roles.SUPER_ADMIN, Roles.PLATFORM_ADMIN],
  // Manage staff & roles: super_admin only
  manageStaff: [Roles.SUPER_ADMIN],
  // Activate/deactivate user accounts: super_admin, platform_admin, support_officer
  manageUserStatus: [Roles.SUPER_ADMIN, Roles.PLATFORM_ADMIN, Roles.SUPPORT_OFFICER],
  // Send broadcast notifications: super_admin, platform_admin
  sendBroadcast: [Roles.SUPER_ADMIN, Roles.PLATFORM_ADMIN],
  // View revenue/payment reports: super_admin, finance_officer
  viewRevenueReports: [Roles.SUPER_ADMIN, Roles.FINANCE_OFFICER],
  // View activity/interest reports & monitor users: all staff (read-only for support)
  viewUserReports: [
    Roles.SUPER_ADMIN,
    Roles.PLATFORM_ADMIN,
    Roles.FINANCE_OFFICER,
    Roles.SUPPORT_OFFICER,
  ],
};

module.exports = { requireRole, Roles, Capabilities };
