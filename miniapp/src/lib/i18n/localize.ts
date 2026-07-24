// Localized field helpers — handle bilingual field rendering.

import type { Lang } from '../../types';

// Returns true if a value is the masked sentinel "*".
export function isMaskedValue(value: unknown): boolean {
  return value === '*';
}

// Get a localized field from an object that has both _en and _am variants.
// e.g. localizedField(card, 'full_name', 'en') → card.full_name_en
// Generic over T so it accepts any object with string-keyed fields.
export function localizedField<T>(
  item: T,
  base: string,
  lang: Lang
): string {
  const key = base + '_' + lang;
  const value = (item as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : '';
}

// Returns the localized value if neither variant is masked, else "*".
export function maskedOrLocalized<T>(
  item: T,
  base: string,
  lang: Lang
): string {
  const record = item as Record<string, unknown>;
  const enValue = record[base + '_en'];
  const amValue = record[base + '_am'];
  if (enValue === '*' || amValue === '*') return '*';
  return localizedField(item, base, lang);
}

// Get a localized name from a Bank/Region/Zone object.
export function localizedName<T>(item: T, lang: Lang): string {
  return localizedField(item, 'name', lang);
}
