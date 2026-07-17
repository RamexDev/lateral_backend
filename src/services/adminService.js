/**
 * AdminService — reference-data CRUD + staff/user management (§6.9).
 * Every mutation writes an audit_logs row (SEC-006).
 */
const bankRepo = require('../repositories/bankRepository');
const gradeRepo = require('../repositories/gradeRepository');
const staffRepo = require('../repositories/staffRepository');
const userRepo = require('../repositories/userRepository');
const passwordUtil = require('../utils/password');
const { ApiError } = require('../utils/ApiError');
const i18n = require('./localizationService');
const auditService = require('./auditService');
const locationService = require('./locationService');

// ─── Banks ────────────────────────────────────────────────────────────────────

async function createBank({ name, nameAm, nickname, swiftCode, yearEstablished }, actor) {
  const existing = await bankRepo.findByNickname(nickname);
  if (existing) {
    throw ApiError.business('DUPLICATE_NICKNAME', i18n.t('DUPLICATE_NICKNAME', 'en'));
  }
  const id = await bankRepo.create({
    name,
    name_am: nameAm,
    nickname,
    swift_code: swiftCode ?? null,
    year_established: yearEstablished ?? null,
    is_active: true,
  });

  await auditService.log({
    actorType: actor?.type || 'staff',
    actorId: actor?.id,
    action: 'admin.bank.create',
    entityType: 'bank',
    entityId: id,
    metadata: { name, nickname },
    ipAddress: actor?.ipAddress,
  });

  return { id };
}

async function updateBank(id, patch, actor) {
  const existing = await bankRepo.findByIdRaw(id);
  if (!existing) throw ApiError.notFound('NOT_FOUND', i18n.t('NOT_FOUND', 'en'));

  if (patch.nickname && patch.nickname !== existing.nickname) {
    const other = await bankRepo.findByNickname(patch.nickname);
    if (other && other.id !== id) {
      throw ApiError.business('DUPLICATE_NICKNAME', i18n.t('DUPLICATE_NICKNAME', 'en'));
    }
  }

  if (patch.isActive === false) {
    const activeUsers = await bankRepo.countActiveUsers(id);
    if (activeUsers > 0) {
      throw ApiError.business('BANK_HAS_ACTIVE_USERS', i18n.t('BANK_HAS_ACTIVE_USERS', 'en'));
    }
  }

  const dbPatch = {};
  if (patch.name !== undefined) dbPatch.name = patch.name;
  if (patch.nameAm !== undefined) dbPatch.name_am = patch.nameAm;
  if (patch.nickname !== undefined) dbPatch.nickname = patch.nickname;
  if (patch.swiftCode !== undefined) dbPatch.swift_code = patch.swiftCode;
  if (patch.yearEstablished !== undefined) dbPatch.year_established = patch.yearEstablished;
  if (patch.isActive !== undefined) dbPatch.is_active = patch.isActive;

  const updated = await bankRepo.update(id, dbPatch);

  await auditService.log({
    actorType: actor?.type || 'staff',
    actorId: actor?.id,
    action: 'admin.bank.update',
    entityType: 'bank',
    entityId: id,
    metadata: dbPatch,
    ipAddress: actor?.ipAddress,
  });

  return { id, updated };
}

// ─── Locations — delegated to locationService ─────────────────────────────────

const createLocation = locationService.adminCreate;
const updateLocation = locationService.adminUpdate;

// ─── Grades ───────────────────────────────────────────────────────────────────

async function createGrade(data, actor) {
  const existing = await gradeRepo.findByGradeNumber(data.gradeNumber);
  if (existing) {
    throw ApiError.business('DUPLICATE_GRADE_NUMBER', i18n.t('DUPLICATE_GRADE_NUMBER', 'en'));
  }
  const id = await gradeRepo.create({
    grade_number: data.gradeNumber,
    band_label: data.bandLabel,
    band_label_am: data.bandLabelAm,
    tier_classification: data.tierClassification,
    tier_classification_am: data.tierClassificationAm,
    typical_roles: data.typicalRoles,
    typical_roles_am: data.typicalRolesAm,
    rank_order: data.rankOrder ?? data.gradeNumber,
    is_active: true,
  });

  await auditService.log({
    actorType: actor?.type || 'staff',
    actorId: actor?.id,
    action: 'admin.grade.create',
    entityType: 'grade',
    entityId: id,
    metadata: { gradeNumber: data.gradeNumber },
    ipAddress: actor?.ipAddress,
  });

  return { id };
}

async function updateGrade(id, patch, actor) {
  const existing = await gradeRepo.findById(id);
  if (!existing) throw ApiError.notFound('NOT_FOUND', i18n.t('NOT_FOUND', 'en'));

  if (patch.isActive === false) {
    const activeUsers = await gradeRepo.countActiveUsers(id);
    if (activeUsers > 0) {
      throw ApiError.business('GRADE_HAS_ACTIVE_USERS', i18n.t('GRADE_HAS_ACTIVE_USERS', 'en'));
    }
  }

  const dbPatch = {};
  if (patch.bandLabel !== undefined) dbPatch.band_label = patch.bandLabel;
  if (patch.bandLabelAm !== undefined) dbPatch.band_label_am = patch.bandLabelAm;
  if (patch.tierClassification !== undefined)
    dbPatch.tier_classification = patch.tierClassification;
  if (patch.tierClassificationAm !== undefined)
    dbPatch.tier_classification_am = patch.tierClassificationAm;
  if (patch.typicalRoles !== undefined) dbPatch.typical_roles = patch.typicalRoles;
  if (patch.typicalRolesAm !== undefined) dbPatch.typical_roles_am = patch.typicalRolesAm;
  if (patch.rankOrder !== undefined) dbPatch.rank_order = patch.rankOrder;
  if (patch.isActive !== undefined) dbPatch.is_active = patch.isActive;

  const updated = await gradeRepo.update(id, dbPatch);

  await auditService.log({
    actorType: actor?.type || 'staff',
    actorId: actor?.id,
    action: 'admin.grade.update',
    entityType: 'grade',
    entityId: id,
    metadata: dbPatch,
    ipAddress: actor?.ipAddress,
  });

  return { id, updated };
}

// ─── Staff ────────────────────────────────────────────────────────────────────

async function createStaff(
  { fullName, email, password, roleName, preferredLanguage = 'en' },
  actor,
) {
  const role = await staffRepo.findRoleByName(roleName);
  if (!role) {
    throw ApiError.business('VALIDATION_FAILED', `Unknown role: ${roleName}`);
  }
  const existing = await staffRepo.findByEmail(email);
  if (existing) {
    throw ApiError.business('DUPLICATE_NICKNAME', `Email already in use.`); // Reusing code; could add DUPLICATE_EMAIL
  }
  const passwordHash = await passwordUtil.hash(password);
  const id = await staffRepo.create({
    full_name: fullName,
    email: email.toLowerCase(),
    password_hash: passwordHash,
    role_id: role.id,
    preferred_language: preferredLanguage,
    is_active: true,
  });

  await auditService.log({
    actorType: actor?.type || 'staff',
    actorId: actor?.id,
    action: 'admin.staff.create',
    entityType: 'staff',
    entityId: id,
    metadata: { email, roleName },
    ipAddress: actor?.ipAddress,
  });

  return { id };
}

async function listStaff({ page = 1, pageSize = 50, isActive } = {}) {
  return staffRepo.list({ page, pageSize, isActive });
}

async function listRoles() {
  return staffRepo.listRoles();
}

// ─── User status management ──────────────────────────────────────────────────

async function setUserStatus(id, { isActive, reason }, actor) {
  const user = await userRepo.findById(id);
  if (!user) throw ApiError.notFound('NOT_FOUND', i18n.t('NOT_FOUND', 'en'));

  await userRepo.update(id, { is_active: isActive });

  await auditService.log({
    actorType: actor?.type || 'staff',
    actorId: actor?.id,
    action: 'admin.user.status_change',
    entityType: 'user',
    entityId: id,
    metadata: { isActive, reason },
    ipAddress: actor?.ipAddress,
  });

  return { userId: id, isActive };
}

module.exports = {
  createBank,
  updateBank,
  createLocation,
  updateLocation,
  createGrade,
  updateGrade,
  createStaff,
  listStaff,
  listRoles,
  setUserStatus,
};
