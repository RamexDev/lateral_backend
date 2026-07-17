/**
 * ProfileService — /me GET + PUT (§6.5).
 *
 * Self-service updates: branch_name, neighborhood, regionId+zoneId, gradeId,
 * preferredLanguage. Bank cannot be changed post-registration (Open Item #2 resolved).
 */
const userRepo = require('../repositories/userRepository');
const bankRepo = require('../repositories/bankRepository');
const locationRepo = require('../repositories/locationRepository');
const gradeRepo = require('../repositories/gradeRepository');
const { ApiError } = require('../utils/ApiError');
const i18n = require('./localizationService');
const auditService = require('./auditService');

async function getMe(user) {
  const lang = user.preferred_language;
  const [bank, zone, grade] = await Promise.all([
    bankRepo.findById(user.bank_id, lang),
    locationRepo.findById(user.current_location_id, lang),
    gradeRepo.findById(user.grade_id),
  ]);
  const region = zone?.parent_id ? await locationRepo.findById(zone.parent_id, lang) : null;

  return {
    userId: user.id,
    bank: bank?.name,
    region: region?.name,
    zone: zone?.name,
    branchName: user.branch_name,
    neighborhood: user.neighborhood,
    grade: grade
      ? {
          gradeNumber: grade.grade_number,
          bandLabel: grade.band_label,
          tierClassification: grade.tier_classification,
        }
      : null,
    preferredLanguage: user.preferred_language,
  };
}

async function updateMe(user, patch, actor) {
  const lang = user.preferred_language;

  // Bank change is unsupported (§6.5).
  if (patch.bankId !== undefined) {
    throw ApiError.business('BANK_CHANGE_UNSUPPORTED', i18n.t('BANK_CHANGE_UNSUPPORTED', lang));
  }

  // Validate zone+region pair.
  if (patch.zoneId !== undefined || patch.regionId !== undefined) {
    const newZoneId = patch.zoneId ?? user.current_location_id;
    const newRegionId = patch.regionId;
    if (newRegionId !== undefined) {
      await locationService_assertZoneBelongsToRegion(newZoneId, newRegionId, lang);
    } else {
      // Just a zone change — verify the zone exists.
      const zone = await locationRepo.findByIdRaw(newZoneId);
      if (!zone || zone.level_type !== 'zone_subcity' || !zone.is_active) {
        throw ApiError.notFound('NOT_FOUND', i18n.t('NOT_FOUND', lang));
      }
    }
  }

  // Validate grade.
  if (patch.gradeId !== undefined) {
    const grade = await gradeRepo.findById(patch.gradeId);
    if (!grade || !grade.is_active) {
      throw ApiError.notFound('NOT_FOUND', i18n.t('NOT_FOUND', lang));
    }
  }

  // Validate preferredLanguage.
  if (patch.preferredLanguage !== undefined && !['en', 'am'].includes(patch.preferredLanguage)) {
    throw ApiError.business('INVALID_LANGUAGE', i18n.t('INVALID_LANGUAGE', lang));
  }

  const dbPatch = {};
  if (patch.branchName !== undefined) dbPatch.branch_name = patch.branchName;
  if (patch.neighborhood !== undefined) dbPatch.neighborhood = patch.neighborhood;
  if (patch.zoneId !== undefined) dbPatch.current_location_id = patch.zoneId;
  if (patch.gradeId !== undefined) dbPatch.grade_id = patch.gradeId;
  if (patch.preferredLanguage !== undefined) dbPatch.preferred_language = patch.preferredLanguage;

  if (Object.keys(dbPatch).length === 0) {
    return { updated: false };
  }

  await userRepo.update(user.id, dbPatch);

  await auditService.log({
    actorType: 'user',
    actorId: user.id,
    action: 'user.profile.update',
    entityType: 'user',
    entityId: user.id,
    metadata: dbPatch,
    ipAddress: actor?.ipAddress,
  });

  return { updated: true };
}

async function locationService_assertZoneBelongsToRegion(zoneId, regionId, lang) {
  const zone = await locationRepo.findByIdRaw(zoneId);
  if (!zone) throw ApiError.notFound('NOT_FOUND', i18n.t('NOT_FOUND', lang));
  if (zone.level_type !== 'zone_subcity') {
    throw ApiError.business('INVALID_ZONE', i18n.t('INVALID_ZONE', lang));
  }
  if (zone.parent_id !== regionId) {
    throw ApiError.business('ZONE_REGION_MISMATCH', i18n.t('ZONE_REGION_MISMATCH', lang));
  }
}

module.exports = { getMe, updateMe };
