// Import Zod for request validation.
import { z } from 'zod';

// Return the first defined value from a list of candidates.
function firstDefined(...values) {
  for (const value of values) {
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}

// Convert empty strings to null while preserving undefined and null.
function emptyToNull(value) {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  const text = String(value).trim();
  return text === '' ? null : text;
}

// Validate an ID route parameter.
export const idParamSchema = z.object({
  id: z.coerce.number().int().positive()
});

// Validate list query parameters.
export const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().positive().max(100).default(50),
  q: z.string().trim().optional(),
  is_active: z
    .enum(['true', 'false', '1', '0'])
    .optional()
    .transform((value) => {
      if (value === undefined) {
        return undefined;
      }
      return value === 'true' || value === '1';
    }),
  region_id: z.coerce.number().int().positive().optional()
});

// Create bank schema.
export const createBankSchema = z
  .object({
    name: z.string().trim().min(1).max(191).optional(),
    name_en: z.string().trim().min(1).max(191).optional(),
    name_am: z.string().trim().min(1).max(191),
    nickname: z.string().trim().min(1).max(90).optional(),
    alias_en: z.string().trim().min(1).max(90).optional(),
    alias_am: z.string().trim().min(1).max(90),
    swift_code: z.string().trim().max(12).nullable().optional(),
    year_established: z.number().int().min(1800).max(2100).nullable().optional(),
    year_established_note: z.string().trim().max(191).nullable().optional(),
    is_active: z.boolean().optional()
  })
  .transform((data) => ({
    name_en: firstDefined(data.name_en, data.name),
    name_am: data.name_am,
    alias_en: firstDefined(data.alias_en, data.nickname),
    alias_am: data.alias_am,
    swift_code: emptyToNull(data.swift_code),
    year_established: data.year_established === undefined ? undefined : data.year_established,
    year_established_note: emptyToNull(data.year_established_note),
    is_active: data.is_active === undefined ? true : data.is_active
  }))
  .refine((data) => data.name_en, {
    message: 'name_en or name is required',
    path: ['name_en']
  })
  .refine((data) => data.alias_en, {
    message: 'alias_en or nickname is required',
    path: ['alias_en']
  });

// Update bank schema.
export const updateBankSchema = z
  .object({
    name: z.string().trim().min(1).max(191).optional(),
    name_en: z.string().trim().min(1).max(191).optional(),
    name_am: z.string().trim().min(1).max(191).optional(),
    nickname: z.string().trim().min(1).max(90).optional(),
    alias_en: z.string().trim().min(1).max(90).optional(),
    alias_am: z.string().trim().min(1).max(90).optional(),
    swift_code: z.string().trim().max(12).nullable().optional(),
    year_established: z.number().int().min(1800).max(2100).nullable().optional(),
    year_established_note: z.string().trim().max(191).nullable().optional(),
    is_active: z.boolean().optional()
  })
  .transform((data) => ({
    name_en: firstDefined(data.name_en, data.name),
    name_am: data.name_am,
    alias_en: firstDefined(data.alias_en, data.nickname),
    alias_am: data.alias_am,
    swift_code: emptyToNull(data.swift_code),
    year_established: data.year_established === undefined ? undefined : data.year_established,
    year_established_note: emptyToNull(data.year_established_note),
    is_active: data.is_active
  }))
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'At least one field is required'
  });

// Create region schema.
export const createRegionSchema = z
  .object({
    name: z.string().trim().min(1).max(150).optional(),
    name_en: z.string().trim().min(1).max(150).optional(),
    name_am: z.string().trim().min(1).max(150),
    type: z.enum(['region', 'chartered_city']).optional(),
    is_active: z.boolean().optional()
  })
  .transform((data) => ({
    name_en: firstDefined(data.name_en, data.name),
    name_am: data.name_am,
    type: data.type === undefined ? 'region' : data.type,
    is_active: data.is_active === undefined ? true : data.is_active
  }))
  .refine((data) => data.name_en, {
    message: 'name_en or name is required',
    path: ['name_en']
  });

// Update region schema.
export const updateRegionSchema = z
  .object({
    name: z.string().trim().min(1).max(150).optional(),
    name_en: z.string().trim().min(1).max(150).optional(),
    name_am: z.string().trim().min(1).max(150).optional(),
    type: z.enum(['region', 'chartered_city']).optional(),
    is_active: z.boolean().optional()
  })
  .transform((data) => ({
    name_en: firstDefined(data.name_en, data.name),
    name_am: data.name_am,
    type: data.type,
    is_active: data.is_active
  }))
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'At least one field is required'
  });

// Create zone schema.
export const createZoneSchema = z
  .object({
    region_id: z.number().int().positive(),
    name: z.string().trim().min(1).max(150).optional(),
    name_en: z.string().trim().min(1).max(150).optional(),
    name_am: z.string().trim().min(1).max(150),
    note: z.string().trim().max(255).nullable().optional(),
    is_active: z.boolean().optional()
  })
  .transform((data) => ({
    region_id: data.region_id,
    name_en: firstDefined(data.name_en, data.name),
    name_am: data.name_am,
    note: emptyToNull(data.note),
    is_active: data.is_active === undefined ? true : data.is_active
  }))
  .refine((data) => data.name_en, {
    message: 'name_en or name is required',
    path: ['name_en']
  });

// Update zone schema.
export const updateZoneSchema = z
  .object({
    region_id: z.number().int().positive().optional(),
    name: z.string().trim().min(1).max(150).optional(),
    name_en: z.string().trim().min(1).max(150).optional(),
    name_am: z.string().trim().min(1).max(150).optional(),
    note: z.string().trim().max(255).nullable().optional(),
    is_active: z.boolean().optional()
  })
  .transform((data) => ({
    region_id: data.region_id,
    name_en: firstDefined(data.name_en, data.name),
    name_am: data.name_am,
    note: emptyToNull(data.note),
    is_active: data.is_active
  }))
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'At least one field is required'
  });

// Create grade schema.
export const createGradeSchema = z
  .object({
    grade_number: z.number().int().min(1).max(255),
    band_label: z.string().trim().min(1).max(80).optional(),
    band_label_en: z.string().trim().min(1).max(80).optional(),
    band_label_am: z.string().trim().min(1).max(80),
    tier_classification: z.string().trim().min(1).max(80).optional(),
    tier_classification_en: z.string().trim().min(1).max(80).optional(),
    tier_classification_am: z.string().trim().min(1).max(80),
    rank_order: z.number().int().min(1).max(255).optional(),
    is_active: z.boolean().optional()
  })
  .transform((data) => ({
    grade_number: data.grade_number,
    band_label_en: firstDefined(data.band_label_en, data.band_label),
    band_label_am: data.band_label_am,
    tier_classification_en: firstDefined(data.tier_classification_en, data.tier_classification),
    tier_classification_am: data.tier_classification_am,
    rank_order: data.rank_order === undefined ? data.grade_number : data.rank_order,
    is_active: data.is_active === undefined ? true : data.is_active
  }))
  .refine((data) => data.band_label_en, {
    message: 'band_label_en or band_label is required',
    path: ['band_label_en']
  })
  .refine((data) => data.tier_classification_en, {
    message: 'tier_classification_en or tier_classification is required',
    path: ['tier_classification_en']
  });

// Update grade schema.
export const updateGradeSchema = z
  .object({
    band_label: z.string().trim().min(1).max(80).optional(),
    band_label_en: z.string().trim().min(1).max(80).optional(),
    band_label_am: z.string().trim().min(1).max(80).optional(),
    tier_classification: z.string().trim().min(1).max(80).optional(),
    tier_classification_en: z.string().trim().min(1).max(80).optional(),
    tier_classification_am: z.string().trim().min(1).max(80).optional(),
    rank_order: z.number().int().min(1).max(255).optional(),
    is_active: z.boolean().optional()
  })
  .transform((data) => ({
    band_label_en: firstDefined(data.band_label_en, data.band_label),
    band_label_am: data.band_label_am,
    tier_classification_en: firstDefined(data.tier_classification_en, data.tier_classification),
    tier_classification_am: data.tier_classification_am,
    rank_order: data.rank_order,
    is_active: data.is_active
  }))
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'At least one field is required'
  });
