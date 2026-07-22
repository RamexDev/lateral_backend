// Misc small helpers shared across screens.

import type { Lang } from './types';

// Format an ISO timestamp as a localized date.
// 'am-ET' locale may not exist on every runtime; falls back gracefully.
export function formatDate(value: string | null | undefined, lang: Lang): string {
  if (!value) return '';

  const locale = lang === 'am' ? 'am-ET' : 'en-ET';
  try {
    return new Date(value).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return new Date(value).toLocaleDateString();
  }
}

// Format an ISO timestamp as a localized date + time.
export function formatDateTime(value: string | null | undefined, lang: Lang): string {
  if (!value) return '';

  const locale = lang === 'am' ? 'am-ET' : 'en-ET';
  try {
    return new Date(value).toLocaleString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return new Date(value).toLocaleString();
  }
}

// Format an ETB amount. Backend returns plain numbers; we add thousands
// separators and the currency suffix.
export function formatEtb(amount: number | null | undefined, currency = 'ETB'): string {
  const value = Number(amount ?? 0);
  const formatted = value.toLocaleString('en-ET', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
  return `${formatted} ${currency}`;
}

// Build initials from a name. Masked names get a placeholder glyph.
export function initials(name: string | null | undefined): string {
  if (!name || name === '*' || !name.trim()) return '?';

  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('');
}

// Validate a profile photo file client-side before uploading.
// Returns null if valid, or a translation key for the error message.
export function isValidPhoto(file: File): string | null {
  const validTypes = ['image/jpeg', 'image/png', 'image/webp'];

  if (!validTypes.includes(file.type)) {
    return 'invalidPhotoType';
  }

  // 5 MB hard cap, same as backend multer config.
  if (file.size > 5 * 1024 * 1024) {
    return 'invalidPhotoSize';
  }

  return null;
}

// Convert an ISO timestamp to epoch-ms, used for "newest seen" tracking.
export function toEpochMs(value: string | null | undefined): number {
  if (!value) return 0;
  return new Date(value).getTime();
}

// Class names combiner — minimal clsx stand-in.
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

// Format a grade object into a localized display string.
// Pattern: "Grade 5 · Associate" or "ደረጃ 5 · ረዳት"
export function formatGrade(
  grade: {
    tier_classification_en: string;
    tier_classification_am: string;
    band_label_en: string;
    band_label_am: string;
  } | null | undefined,
  lang: Lang
): string | null {
  if (!grade) return null;

  const tier = lang === 'am'
    ? (grade.tier_classification_am || grade.tier_classification_en)
    : (grade.tier_classification_en || grade.tier_classification_am);

  const band = lang === 'am'
    ? (grade.band_label_am || grade.band_label_en)
    : (grade.band_label_en || grade.band_label_am);

  if (!tier) return band || null;
  if (!band) return tier || null;

  return `${tier} · ${band}`;
}
