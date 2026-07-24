// Import Zod for request validation.
import { z } from 'zod';

// Validate feed query parameters.
// F.7: adds mutual_only, grade_band, region_id, zone_id filters.
// NOTE: .transform() without .default() — defaults handled in controller.
export const feedQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().positive().max(50).default(10),
  fresh: z
    .enum(['true', 'false', '1', '0'])
    .optional()
    .transform((value) => value === 'true' || value === '1'),
  mutual_only: z
    .enum(['true', 'false', '1', '0'])
    .optional()
    .transform((value) => value === 'true' || value === '1'),
  grade_band: z.coerce.number().int().min(1).max(6).optional(),
  region_id: z.coerce.number().int().positive().optional(),
  zone_id: z.coerce.number().int().positive().optional()
});

// Validate people query parameters.
// F.7: same filters as feed.
export const peopleQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().positive().max(50).default(10),
  fresh: z
    .enum(['true', 'false', '1', '0'])
    .optional()
    .transform((value) => value === 'true' || value === '1'),
  mutual_only: z
    .enum(['true', 'false', '1', '0'])
    .optional()
    .transform((value) => value === 'true' || value === '1'),
  grade_band: z.coerce.number().int().min(1).max(6).optional(),
  region_id: z.coerce.number().int().positive().optional(),
  zone_id: z.coerce.number().int().positive().optional()
});
