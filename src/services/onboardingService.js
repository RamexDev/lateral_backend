/**
 * OnboardingService — drives the registration wizard (§6.3).
 *
 * The bot gateway (Telegram webhook in prod, direct internal calls in tests/Mini App)
 * invokes these steps one at a time, mutating the Redis-backed wizard session.
 *
 * Final step (grade) persists the users row and returns the userId so the caller
 * can issue a JWT.
 */
const bankRepo = require('../repositories/bankRepository');
const locationRepo = require('../repositories/locationRepository');
const gradeRepo = require('../repositories/gradeRepository');
const userRepo = require('../repositories/userRepository');
const session = require('./botSessionStore');
const { ApiError } = require('../utils/ApiError');
const i18n = require('./localizationService');
const { normalizePhone } = require('../utils/phone');
const auditService = require('./auditService');

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'am', label: 'አማርኛ' },
];

async function start({ telegramId, telegramUsername }) {
  // Already fully registered?
  const existing = await userRepo.findByTelegramId(telegramId);
  if (existing) {
    const bank = await bankRepo.findById(existing.bank_id, existing.preferred_language);
    const zone = await locationRepo.findById(
      existing.current_location_id,
      existing.preferred_language,
    );
    const region = zone?.parent_id
      ? await locationRepo.findById(zone.parent_id, existing.preferred_language)
      : null;
    return {
      step: 'already_registered',
      userId: existing.id,
      bankName: bank?.name,
      currentLocation: region ? `${zone?.name}, ${region.name}` : zone?.name,
      branchName: existing.branch_name,
      _message: i18n.t('onboarding.welcome_back', existing.preferred_language),
    };
  }

  // Resume existing session?
  const sess = await session.get(telegramId);
  if (sess) {
    if (
      sess.step === 'select_bank' ||
      sess.step === 'select_region' ||
      sess.step === 'select_zone'
    ) {
      const banks = await bankRepo.listActive(sess.languageChoice || 'en');
      return { step: sess.step, resumed: true, banks };
    }
  }

  // Fresh start.
  await session.set(telegramId, {
    step: 'select_language',
    telegramId,
    telegramUsername: telegramUsername ?? null,
    selectedInterestLocationIds: [],
  });

  return { step: 'select_language', languages: LANGUAGES };
}

async function setLanguage({ telegramId, language }) {
  if (!['en', 'am'].includes(language)) {
    throw ApiError.business('INVALID_LANGUAGE', i18n.t('INVALID_LANGUAGE', 'en'));
  }
  await session.update(telegramId, { step: 'share_contact', languageChoice: language });
  return {
    step: 'share_contact',
    prompt: i18n.t('onboarding.share_contact', language),
    requiresNativeContactShare: true,
  };
}

async function submitContact({ telegramId, telegramUsername, phoneNumber, contactIsSelf }) {
  const sess = await session.get(telegramId);
  const lang = sess?.languageChoice || 'en';
  if (!contactIsSelf) {
    throw ApiError.business('CONTACT_NOT_SELF', i18n.t('CONTACT_NOT_SELF', lang));
  }

  const normalized = normalizePhone(phoneNumber);
  await session.update(telegramId, {
    phoneNumber: normalized,
    telegramUsername: telegramUsername ?? sess?.telegramUsername ?? null,
  });

  const banks = await bankRepo.listActive(lang);

  const data = { step: 'select_bank', banks, page: 1, pageSize: 10, totalBanks: banks.length };
  const message = !telegramUsername ? i18n.t('onboarding.no_username', lang) : undefined;
  return { data, message, _lang: lang };
}

async function selectBank({ telegramId, bankId }) {
  const sess = await session.get(telegramId);
  const lang = sess?.languageChoice || 'en';

  const bank = await bankRepo.findById(bankId, lang);
  if (!bank || !bank.is_active) {
    throw ApiError.business('BANK_NOT_FOUND', i18n.t('BANK_NOT_FOUND', lang));
  }

  await session.update(telegramId, { step: 'select_region', pendingBankId: bankId });
  const regions = await locationRepo.listActiveRegions(lang);
  return { step: 'select_region', regions };
}

async function selectRegion({ telegramId, regionId }) {
  const sess = await session.get(telegramId);
  const lang = sess?.languageChoice || 'en';

  const region = await locationRepo.findById(regionId, lang);
  if (!region || region.level_type !== 'region' || !region.is_active) {
    throw ApiError.business('NOT_FOUND', i18n.t('NOT_FOUND', lang));
  }

  await session.update(telegramId, { step: 'select_zone', pendingRegionId: regionId });
  const zones = await locationRepo.listActiveZonesByRegion(regionId, lang);
  return { step: 'select_zone', region, zones };
}

async function selectZone({ telegramId, zoneId }) {
  const sess = await session.get(telegramId);
  const lang = sess?.languageChoice || 'en';

  const zone = await locationRepo.findById(zoneId, lang);
  if (!zone || zone.level_type !== 'zone_subcity' || !zone.is_active) {
    throw ApiError.business('NOT_FOUND', i18n.t('NOT_FOUND', lang));
  }
  if (sess?.pendingRegionId && zone.parent_id !== sess.pendingRegionId) {
    throw ApiError.business('ZONE_REGION_MISMATCH', i18n.t('ZONE_REGION_MISMATCH', lang));
  }

  await session.update(telegramId, { step: 'enter_branch_name', pendingZoneId: zoneId });
  const region = zone.parent_id ? await locationRepo.findById(zone.parent_id, lang) : null;
  const selectedPath = region ? `${region.name} > ${zone.name}` : zone.name;
  return {
    step: 'enter_branch_name',
    selectedPath,
    prompt: i18n.t('onboarding.enter_branch_name', lang),
  };
}

async function submitBranchDetails({ telegramId, branchName, neighborhood }) {
  const sess = await session.get(telegramId);
  const lang = sess?.languageChoice || 'en';

  if (!branchName || branchName.trim().length < 3) {
    throw ApiError.business('INVALID_BRANCH_NAME', i18n.t('INVALID_BRANCH_NAME', lang));
  }

  await session.update(telegramId, {
    step: 'select_grade',
    branchName: branchName.trim(),
    neighborhood: neighborhood?.trim() || null,
  });

  const bands = await gradeRepo.listDistinctBands(lang);
  const data = { step: 'select_grade', bands };
  const message = !neighborhood ? i18n.t('onboarding.neighborhood_skipped', lang) : undefined;
  return { data, message, _lang: lang };
}

async function selectGradeBand({ telegramId, bandLabel }) {
  const sess = await session.get(telegramId);
  const lang = sess?.languageChoice || 'en';

  const grades = await gradeRepo.listByBand(bandLabel, lang);
  if (!grades.length) {
    throw ApiError.business('BAND_NOT_FOUND', i18n.t('BAND_NOT_FOUND', lang));
  }
  const bands = await gradeRepo.listDistinctBands(lang);
  const band = bands.find((b) => b.band_label === bandLabel);

  await session.update(telegramId, { step: 'select_grade_number', pendingGradeBand: bandLabel });
  return {
    step: 'select_grade_number',
    band,
    grades,
  };
}

async function selectGrade({ telegramId, gradeId }) {
  const sess = await session.get(telegramId);
  const lang = sess?.languageChoice || 'en';

  const grade = await gradeRepo.findById(gradeId);
  if (!grade || !grade.is_active) {
    throw ApiError.business('NOT_FOUND', i18n.t('NOT_FOUND', lang));
  }
  if (sess?.pendingGradeBand && grade.band_label !== sess.pendingGradeBand) {
    throw ApiError.business('GRADE_BAND_MISMATCH', i18n.t('GRADE_BAND_MISMATCH', lang));
  }

  // FR-AUTH-003: phone already registered under a different Telegram account for the same bank.
  if (sess?.phoneNumber && sess?.pendingBankId) {
    const existing = await userRepo.findByPhoneAndBank(sess.phoneNumber, sess.pendingBankId);
    if (existing && existing.telegram_id !== telegramId) {
      throw ApiError.business('DUPLICATE_PHONE', i18n.t('DUPLICATE_PHONE', lang));
    }
  }

  const userId = await userRepo.create({
    telegram_id: telegramId,
    telegram_username: sess?.telegramUsername ?? null,
    phone_number: sess.phoneNumber,
    phone_verified_at: new Date(),
    bank_id: sess.pendingBankId,
    current_location_id: sess.pendingZoneId,
    branch_name: sess.branchName,
    neighborhood: sess.neighborhood,
    grade_id: gradeId,
    preferred_language: lang,
    is_active: true,
  });

  await session.clear(telegramId);

  const bank = await bankRepo.findById(sess.pendingBankId, lang);
  const zone = await locationRepo.findById(sess.pendingZoneId, lang);
  const region = zone?.parent_id ? await locationRepo.findById(zone.parent_id, lang) : null;

  await auditService.log({
    actorType: 'user',
    actorId: userId,
    action: 'user.register',
    entityType: 'user',
    entityId: userId,
    metadata: { bankId: sess.pendingBankId, zoneId: sess.pendingZoneId, gradeId },
  });

  return {
    step: 'profile_created',
    userId,
    summary: {
      bank: bank?.name,
      region: region?.name,
      zone: zone?.name,
      branchName: sess.branchName,
      grade: `Grade ${grade.grade_number} — ${grade.tier_classification}`,
    },
    _lang: lang,
  };
}

/**
 * Return the in-progress session (used by tests + by the interest wizard to know
 * whether the user is fully registered).
 */
async function getSession(telegramId) {
  return session.get(telegramId);
}

module.exports = {
  start,
  setLanguage,
  submitContact,
  selectBank,
  selectRegion,
  selectZone,
  submitBranchDetails,
  selectGradeBand,
  selectGrade,
  getSession,
  LANGUAGES,
};
