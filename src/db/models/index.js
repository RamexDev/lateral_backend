/**
 * Sequelize models index — wires up the instance + every model + associations.
 *
 * Required by sequelize-cli (the `models-path` in .sequelizerc) and by application
 * code that wants `require('../db/models')` to get the full model registry.
 *
 * Each model file declares its own attributes + options; this file declares the
 * associations (belongsTo / hasMany) between them, mirroring §3.2's FK graph.
 */
const sequelize = require('../sequelize');
const Bank = require('./Bank');
const Location = require('./Location');
const LocationAncestor = require('./LocationAncestor');
const Grade = require('./Grade');
const User = require('./User');
const TransferInterest = require('./TransferInterest');
const Purchase = require('./Purchase');
const Payment = require('./Payment');
const Notification = require('./Notification');
const Role = require('./Role');
const Staff = require('./Staff');
const AuditLog = require('./AuditLog');

// ─── Associations (§3.3 key relationships recap) ────────────────────────────

// Bank → Users
Bank.hasMany(User, { foreignKey: 'bank_id', as: 'users' });
User.belongsTo(Bank, { foreignKey: 'bank_id', as: 'bank' });

// Location self-reference (region → zone_subcity)
Location.belongsTo(Location, { foreignKey: 'parent_id', as: 'parent' });
Location.hasMany(Location, { foreignKey: 'parent_id', as: 'children' });

// Location closure table (no model-level association — managed via raw queries,
// but expose the model for repository use).
LocationAncestor.belongsTo(Location, { foreignKey: 'ancestor_id', as: 'ancestor' });
LocationAncestor.belongsTo(Location, { foreignKey: 'descendant_id', as: 'descendant' });

// User → current_location (zone_subcity), grade, transfer_interests, purchases.
User.belongsTo(Location, { foreignKey: 'current_location_id', as: 'currentLocation' });
User.belongsTo(Grade, { foreignKey: 'grade_id', as: 'grade' });
User.hasMany(TransferInterest, { foreignKey: 'user_id', as: 'interests' });
User.hasMany(Purchase, { foreignKey: 'buyer_id', as: 'purchasesMade' });
User.hasMany(Purchase, { foreignKey: 'target_user_id', as: 'purchasesOfMe' });
User.hasMany(Notification, { foreignKey: 'user_id', as: 'notifications' });

// TransferInterest → user, location
TransferInterest.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
TransferInterest.belongsTo(Location, { foreignKey: 'location_id', as: 'location' });

// Purchase → buyer, target, payment, matched_interest
Purchase.belongsTo(User, { foreignKey: 'buyer_id', as: 'buyer' });
Purchase.belongsTo(User, { foreignKey: 'target_user_id', as: 'target' });
Purchase.belongsTo(TransferInterest, { foreignKey: 'matched_interest_id', as: 'matchedInterest' });
Purchase.belongsTo(Payment, { foreignKey: 'payment_id', as: 'payment' });

// Payment → purchase
Payment.belongsTo(Purchase, { foreignKey: 'purchase_id', as: 'purchase' });

// Notification → user
Notification.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Role → Staff
Role.hasMany(Staff, { foreignKey: 'role_id', as: 'staff' });
Staff.belongsTo(Role, { foreignKey: 'role_id', as: 'role' });

// AuditLog is intentionally association-free (polymorphic actor/entity refs).

module.exports = {
  sequelize,
  Sequelize: sequelize.constructor,
  Bank,
  Location,
  LocationAncestor,
  Grade,
  User,
  TransferInterest,
  Purchase,
  Payment,
  Notification,
  Role,
  Staff,
  AuditLog,
};
