/**
 * InterestService — multi-select interest wizard state + CRUD on transfer_interests.
 * See backend.md §6.4.
 *
 * The in-progress selection set lives in the bot session (Redis in prod)
 * so it survives across many separate Telegram callback-query webhook calls.
 */
const interestRepo = require('../repositories/interestRepository');
const locationRepo = require('../repositories/locationRepository');
const session = require('./botSessionStore');
const { ApiError } = require('../utils/ApiError');
const i18n = require('./localizationService');

/**
 * GET /interests/zone-options — fetch zones for a region with checkbox state.
 * regionId optional — defaults to the user's own region (where their zone sits).
 */
async function getZoneOptions(user, regionId) {
  const lang = user.preferred_language;
  let region;
  let isUserHomeRegion = false;

  if (regionId) {
    region = await locationRepo.findById(regionId, lang);
    if (!region || region.level_type !== 'region') {
      throw ApiError.business('NOT_FOUND', i18n.t('NOT_FOUND', lang));
    }
  } else {
    // Default to user's own region.
    const zone = await locationRepo.findById(user.current_location_id, lang);
    region = zone?.parent_id ? await locationRepo.findById(zone.parent_id, lang) : null;
    isUserHomeRegion = true;
  }

  const zones = await locationRepo.listActiveZonesByRegion(region.id, lang);
  const sess = await session.get(user.telegram_id);
  const selectedSet = new Set(sess?.selectedInterestLocationIds || []);

  const zonesWithState = zones.map((z) => ({ ...z, selected: selectedSet.has(z.id) }));

  // Track which region the user is currently viewing — used by toggle to detect stale callbacks.
  await session.update(user.telegram_id, { viewingRegionId: region.id });

  return {
    region: { id: region.id, name: region.name },
    isUserHomeRegion,
    zones: zonesWithState,
    currentSelectionCount: selectedSet.size,
  };
}

/**
 * Toggle one zone's checkbox. Rejects stale callbacks (toggling a zone whose region
 * the user isn't currently viewing).
 */
async function toggleZone(user, { regionId, locationId }) {
  const lang = user.preferred_language;
  const sess = await session.get(user.telegram_id);
  if (!sess || sess.viewingRegionId !== regionId) {
    throw ApiError.business('STALE_INTERACTION', i18n.t('STALE_INTERACTION', lang));
  }

  // Validate the zone belongs to the viewed region.
  const zone = await locationRepo.findByIdRaw(locationId);
  if (!zone || zone.parent_id !== regionId) {
    throw ApiError.business('ZONE_REGION_MISMATCH', i18n.t('ZONE_REGION_MISMATCH', lang));
  }

  const selectedSet = new Set(sess.selectedInterestLocationIds || []);
  if (selectedSet.has(locationId)) {
    selectedSet.delete(locationId);
  } else {
    selectedSet.add(locationId);
  }

  await session.update(user.telegram_id, {
    selectedInterestLocationIds: Array.from(selectedSet),
  });

  const zones = await locationRepo.listActiveZonesByRegion(regionId, lang);
  const zonesWithState = zones.map((z) => ({ ...z, selected: selectedSet.has(z.id) }));

  return {
    region: { id: regionId, name: (await locationRepo.findById(regionId, lang)).name },
    zones: zonesWithState,
    currentSelectionCount: selectedSet.size,
  };
}

/**
 * Switch the wizard to a different region's zones — prior selections in other
 * regions are preserved in the session.
 */
async function changeRegion(user, newRegionId) {
  const lang = user.preferred_language;
  const region = await locationRepo.findById(newRegionId, lang);
  if (!region || region.level_type !== 'region') {
    throw ApiError.business('NOT_FOUND', i18n.t('NOT_FOUND', lang));
  }

  const userZone = await locationRepo.findById(user.current_location_id, lang);
  const isUserHomeRegion = userZone?.parent_id === newRegionId;

  await session.update(user.telegram_id, { viewingRegionId: newRegionId });

  const zones = await locationRepo.listActiveZonesByRegion(newRegionId, lang);
  const sess = await session.get(user.telegram_id);
  const selectedSet = new Set(sess.selectedInterestLocationIds || []);
  const zonesWithState = zones.map((z) => ({ ...z, selected: selectedSet.has(z.id) }));

  return {
    region: { id: region.id, name: region.name },
    isUserHomeRegion,
    zones: zonesWithState,
    currentSelectionCount: selectedSet.size,
  };
}

/**
 * Persist the accumulated selection set as transfer_interests rows (idempotent).
 */
async function confirmSelections(user) {
  const lang = user.preferred_language;
  const sess = await session.get(user.telegram_id);
  const ids = sess?.selectedInterestLocationIds || [];
  if (!ids.length) {
    throw ApiError.business('NO_SELECTION', i18n.t('NO_SELECTION', lang));
  }

  const created = [];
  for (const locationId of ids) {
    const id = await interestRepo.create({ user_id: user.id, location_id: locationId });
    const loc = await locationRepo.findById(locationId, lang);
    created.push({ id, locationId, locationName: loc?.name });
  }

  await session.update(user.telegram_id, { selectedInterestLocationIds: [] });

  const totalActive = await interestRepo.countByUser(user.id);

  return { createdInterests: created, totalActiveInterests: totalActive };
}

async function listMine(user) {
  return interestRepo.listByUser(user.id, user.preferred_language);
}

async function deleteMine(user, interestId) {
  const lang = user.preferred_language;
  const interest = await interestRepo.findById(interestId);
  if (!interest) {
    throw ApiError.notFound('NOT_FOUND', i18n.t('NOT_FOUND', lang));
  }
  if (interest.user_id !== user.id) {
    throw ApiError.forbidden('FORBIDDEN', i18n.t('FORBIDDEN', lang));
  }
  await interestRepo.deleteById(interestId);
  return { deletedId: Number(interestId) };
}

module.exports = {
  getZoneOptions,
  toggleZone,
  changeRegion,
  confirmSelections,
  listMine,
  deleteMine,
};
