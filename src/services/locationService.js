/**
 * LocationService — admin CRUD on locations + closure-table maintenance.
 * See backend.md §3.1 (design note), §4.2 (closure maintenance), §6.9 (admin location endpoints).
 *
 * Side effects on every mutation: closure table is rebuilt (debounced in prod,
 * synchronous here — the table is small: 119 nodes).
 */
const locationRepo = require('../repositories/locationRepository');
const { ApiError } = require('../utils/ApiError');
const i18n = require('./localizationService');
const auditService = require('./auditService');

async function rebuildClosure() {
  return locationRepo.rebuildClosure();
}

async function listRegions(lang = 'en') {
  return locationRepo.listActiveRegions(lang);
}

async function listZonesByRegion(regionId, lang = 'en') {
  return locationRepo.listActiveZonesByRegion(regionId, lang);
}

async function getById(id, lang = 'en') {
  const loc = await locationRepo.findById(id, lang);
  if (!loc) throw ApiError.notFound('NOT_FOUND', i18n.t('NOT_FOUND', lang));
  return loc;
}

async function assertZoneBelongsToRegion(zoneId, regionId, lang = 'en') {
  const zone = await locationRepo.findByIdRaw(zoneId);
  if (!zone) {
    throw ApiError.notFound('NOT_FOUND', i18n.t('NOT_FOUND', lang));
  }
  if (zone.level_type !== 'zone_subcity') {
    throw ApiError.business('INVALID_ZONE', i18n.t('INVALID_ZONE', lang));
  }
  if (zone.parent_id !== regionId) {
    throw ApiError.business('ZONE_REGION_MISMATCH', i18n.t('ZONE_REGION_MISMATCH', lang));
  }
  return zone;
}

/**
 * Admin: create a region or zone.
 */
async function adminCreate({ name, nameAm, levelType, parentId }, actor) {
  if (levelType === 'zone_subcity') {
    if (!parentId) {
      throw ApiError.business('PARENT_REQUIRED', i18n.t('PARENT_REQUIRED', 'en'));
    }
    const parent = await locationRepo.findByIdRaw(parentId);
    if (!parent || parent.level_type !== 'region') {
      throw ApiError.business('INVALID_PARENT_LEVEL', i18n.t('INVALID_PARENT_LEVEL', 'en'));
    }
  } else if (parentId) {
    throw ApiError.business('REGION_CANNOT_HAVE_PARENT', i18n.t('REGION_CANNOT_HAVE_PARENT', 'en'));
  }

  const id = await locationRepo.create({
    parent_id: levelType === 'zone_subcity' ? parentId : null,
    name,
    name_am: nameAm,
    level_type: levelType,
    is_active: true,
  });

  await rebuildClosure();

  await auditService.log({
    actorType: actor?.type || 'staff',
    actorId: actor?.id,
    action: 'admin.location.create',
    entityType: 'location',
    entityId: id,
    metadata: { name, levelType, parentId },
    ipAddress: actor?.ipAddress,
  });

  return { id, closureRebuildQueued: true };
}

/**
 * Admin: rename / move / activate / deactivate a location.
 */
async function adminUpdate(id, patch, actor) {
  const existing = await locationRepo.findByIdRaw(id);
  if (!existing) throw ApiError.notFound('NOT_FOUND', i18n.t('NOT_FOUND', 'en'));

  // Region cannot take a parent.
  if (existing.level_type === 'region' && patch.parentId !== undefined && patch.parentId !== null) {
    throw ApiError.business('REGION_CANNOT_HAVE_PARENT', i18n.t('REGION_CANNOT_HAVE_PARENT', 'en'));
  }

  // Cycle detection: if parentId is being set, the new parent must not be a descendant.
  if (patch.parentId !== undefined && patch.parentId !== null) {
    if (patch.parentId === id) {
      throw ApiError.business('CYCLE_DETECTED', i18n.t('CYCLE_DETECTED', 'en'));
    }
    const depth = await locationRepo.isAncestorOf(id, patch.parentId);
    if (depth !== null) {
      // patch.parentId is a descendant of `id` → cycle.
      throw ApiError.business('CYCLE_DETECTED', i18n.t('CYCLE_DETECTED', 'en'));
    }
    const newParent = await locationRepo.findByIdRaw(patch.parentId);
    if (!newParent || newParent.level_type !== 'region') {
      throw ApiError.business('INVALID_PARENT_LEVEL', i18n.t('INVALID_PARENT_LEVEL', 'en'));
    }
  }

  // Deactivation guard.
  if (patch.isActive === false) {
    const activeUsers = await locationRepo.countActiveUsers(id);
    if (activeUsers > 0) {
      throw ApiError.business(
        'LOCATION_HAS_ACTIVE_USERS',
        i18n.t('LOCATION_HAS_ACTIVE_USERS', 'en'),
      );
    }
  }

  const dbPatch = {};
  if (patch.name !== undefined) dbPatch.name = patch.name;
  if (patch.nameAm !== undefined) dbPatch.name_am = patch.nameAm;
  if (patch.parentId !== undefined) dbPatch.parent_id = patch.parentId;
  if (patch.isActive !== undefined) dbPatch.is_active = patch.isActive;

  const updated = await locationRepo.update(id, dbPatch);
  if (Object.keys(dbPatch).length > 0) {
    await rebuildClosure();
  }

  await auditService.log({
    actorType: actor?.type || 'staff',
    actorId: actor?.id,
    action: 'admin.location.update',
    entityType: 'location',
    entityId: id,
    metadata: dbPatch,
    ipAddress: actor?.ipAddress,
  });

  return { id, updated, closureRebuildQueued: true };
}

module.exports = {
  rebuildClosure,
  listRegions,
  listZonesByRegion,
  getById,
  assertZoneBelongsToRegion,
  adminCreate,
  adminUpdate,
};
