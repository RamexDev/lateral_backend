// Profile and interests validation/normalization helpers.

import type { Lang, MeUser } from '../types';

// Shape of the profile edit form state.
export interface ProfileFormState {
  full_name_en: string;
  full_name_am: string;
  branch_name_en: string;
  branch_name_am: string;
  neighborhood_en: string;
  neighborhood_am: string;
  grade_id: string;
  region_id: string;
  zone_id: string;
  preferred_language: Lang;
}

// Build a fresh form state from a MeUser object.
export function createProfileFormState(me: MeUser | null): ProfileFormState {
  return {
    full_name_en: me?.full_name_en ?? '',
    full_name_am: me?.full_name_am ?? '',
    branch_name_en: me?.branch_name_en ?? '',
    branch_name_am: me?.branch_name_am ?? '',
    neighborhood_en: me?.neighborhood_en ?? '',
    neighborhood_am: me?.neighborhood_am ?? '',
    grade_id: me?.grade?.id ? String(me.grade.id) : '',
    region_id: me?.region?.id ? String(me.region.id) : '',
    zone_id: me?.zone?.id ? String(me.zone.id) : '',
    preferred_language: me?.preferred_language ?? 'en'
  };
}

// Validation error keyed by field name.
export type ProfileFormErrors = Partial<Record<keyof ProfileFormState, string>>;

// Validate the profile form. Returns an errors object — empty if valid.
// Rule: at least one language version of name/branch/neighborhood is required,
// plus grade, region, and zone.
export function validateProfileForm(form: ProfileFormState, t: (key: string) => string): ProfileFormErrors {
  const errors: ProfileFormErrors = {};

  if (!form.full_name_en && !form.full_name_am) {
    errors.full_name_en = t('validation.requiredOneLanguage');
  }
  if (form.branch_name_en && form.branch_name_en.length < 3) {
    errors.branch_name_en = t('validation.branchMin');
  }
  if (form.branch_name_am && form.branch_name_am.length < 3) {
    errors.branch_name_am = t('validation.branchMin');
  }
  if (!form.branch_name_en && !form.branch_name_am) {
    errors.branch_name_en = t('validation.requiredOneLanguage');
  }
  if (form.neighborhood_en && form.neighborhood_en.length < 2) {
    errors.neighborhood_en = t('validation.neighborhoodMin');
  }
  if (form.neighborhood_am && form.neighborhood_am.length < 2) {
    errors.neighborhood_am = t('validation.neighborhoodMin');
  }
  if (!form.neighborhood_en && !form.neighborhood_am) {
    errors.neighborhood_en = t('validation.requiredOneLanguage');
  }
  if (!form.grade_id) {
    errors.grade_id = t('validation.gradeRequired');
  }
  if (!form.region_id) {
    errors.region_id = t('validation.regionRequired');
  }
  if (!form.zone_id) {
    errors.zone_id = t('validation.zoneRequired');
  }

  return errors;
}

// Validate a photo file before upload.
// Returns null if valid, or a translation key string if invalid.
export function isValidPhoto(file: File): true | string {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return 'validation.invalidPhotoType';
  }
  const maxSize = 5 * 1024 * 1024; // 5 MB
  if (file.size > maxSize) {
    return 'validation.invalidPhotoSize';
  }
  return true;
}

// Validate a Telegram ID string (numeric, positive).
export function isValidTelegramId(value: string): boolean {
  return /^\d+$/.test(value) && Number(value) > 0;
}
