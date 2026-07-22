// Import Zod for request validation.
import { z } from 'zod';

// Convert empty strings to NULL while preserving undefined and null.
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

// Create an optional bilingual text field with minimum length when filled.
function optionalText(minLength) {
  return z
    .string()
    .max(150)
    .optional()
    .nullable()
    .transform(emptyToNull)
    .pipe(z.string().min(minLength).max(150).nullable().optional());
}

// Validate Telegram initData auth request.
export const telegramAuthSchema = z
  .object({
    init_data: z.string().min(1).optional(),
    initData: z.string().min(1).optional()
  })
  .transform((data) => ({
    init_data: data.init_data || data.initData
  }))
  .refine((data) => data.init_data, {
    message: 'init_data is required',
    path: ['init_data']
  });

// Validate internal issue-token request.
export const issueTokenSchema = z.object({
  telegram_id: z.number().int().positive()
});

// Validate profile update request.
export const updateProfileSchema = z
  .object({
    full_name_en: optionalText(1),
    full_name_am: optionalText(1),
    branch_name_en: optionalText(3),
    branch_name_am: optionalText(3),
    neighborhood_en: optionalText(2),
    neighborhood_am: optionalText(2),
    grade_id: z.number().int().positive().optional().nullable(),
    region_id: z.number().int().positive().optional(),
    zone_id: z.number().int().positive().optional(),
    preferred_language: z.enum(['en', 'am']).optional(),
    bank_id: z.any().optional()
  })
  .transform((data) => ({
    full_name_en: data.full_name_en,
    full_name_am: data.full_name_am,
    branch_name_en: data.branch_name_en,
    branch_name_am: data.branch_name_am,
    neighborhood_en: data.neighborhood_en,
    neighborhood_am: data.neighborhood_am,
    grade_id: data.grade_id,
    region_id: data.region_id,
    zone_id: data.zone_id,
    preferred_language: data.preferred_language,
    bank_id: data.bank_id
  }))
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'At least one field is required'
  })
  .refine((data) => (data.region_id === undefined) === (data.zone_id === undefined), {
    message: 'region_id and zone_id must be provided together',
    path: ['zone_id']
  });
