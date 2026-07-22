// Profile + interest form validation helpers.
//
// These enforce UX rules client-side; the backend has final authority and
// will reject anything that violates its own constraints.

import type { Interest, Lang, MeUser } from './types';

// ─── Profile form ──────────────────────────────────────────────────────────

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

// Build a form state from a MeUser (or empty when not loaded yet).
// Region/zone are pre-selected from the user's current location — the user
// can change them, but the bank is fixed (we don't even render a bank field).
export function createProfileFormState(me?: MeUser | null): ProfileFormState {
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

// Validate the profile form. Returns a map of field -> translation key.
export function validateProfileForm(form: ProfileFormState): Record<string, string> {
  const errors: Record<string, string> = {};

  // Full name needs at least one language.
  if (!form.full_name_en.trim() && !form.full_name_am.trim()) {
    errors.full_name = 'requiredOneLanguage';
  }

  // Branch needs at least one language.
  if (!form.branch_name_en.trim() && !form.branch_name_am.trim()) {
    errors.branch_name = 'requiredOneLanguage';
  }
  // Per-field minimums (only checked when the field is filled in).
  if (form.branch_name_en.trim() && form.branch_name_en.trim().length < 3) {
    errors.branch_name_en = 'branchMin';
  }
  if (form.branch_name_am.trim() && form.branch_name_am.trim().length < 3) {
    errors.branch_name_am = 'branchMin';
  }

  // Neighborhood needs at least one language.
  if (!form.neighborhood_en.trim() && !form.neighborhood_am.trim()) {
    errors.neighborhood = 'requiredOneLanguage';
  }
  if (form.neighborhood_en.trim() && form.neighborhood_en.trim().length < 2) {
    errors.neighborhood_en = 'neighborhoodMin';
  }
  if (form.neighborhood_am.trim() && form.neighborhood_am.trim().length < 2) {
    errors.neighborhood_am = 'neighborhoodMin';
  }

  // Backend requires an active grade for profile_complete.
  if (!form.grade_id) {
    errors.grade_id = 'gradeRequired';
  }

  // Region + zone are required and must change together.
  if (!form.region_id) {
    errors.region_id = 'regionRequired';
  }
  if (!form.zone_id) {
    errors.zone_id = 'zoneRequired';
  }

  return errors;
}

// ─── Interest normalization ────────────────────────────────────────────────
// Rules from the SRS / backend interests.service.js:
//   - Max 3 distinct regions
//   - Max 3 zones per region
//   - A region cannot have BOTH a broad interest AND specific zones
//     (zones override broad for that region)
//   - Picking a zone implies its region

export function normalizeInterests(input: Interest[]): Interest[] {
  const seen = new Set<string>();
  const deduped: Interest[] = [];

  // First pass: dedupe by (region_id, zone_id) key.
  for (const item of input) {
    const key = `${item.region_id}:${item.zone_id ?? 'broad'}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push({
      region_id: Number(item.region_id),
      zone_id: item.zone_id == null ? null : Number(item.zone_id)
    });
  }

  // Cap to first 3 distinct regions.
  const regionIds = [...new Set(deduped.map(i => i.region_id))].slice(0, 3);
  const limited = deduped.filter(i => regionIds.includes(i.region_id));

  const final: Interest[] = [];

  // For each region: if any zones exist, drop the broad entry. Cap zones at 3.
  for (const regionId of regionIds) {
    const regionItems = limited.filter(i => i.region_id === regionId);
    const zoneItems = regionItems.filter(i => i.zone_id != null).slice(0, 3);
    const hasBroad = regionItems.some(i => i.zone_id == null);

    if (zoneItems.length > 0) {
      // Zones override broad — drop the broad entry, keep zones.
      final.push(...zoneItems);
    } else if (hasBroad) {
      // No zones, but a broad interest exists — keep one broad entry.
      final.push({ region_id: regionId, zone_id: null });
    }
  }

  return final;
}
