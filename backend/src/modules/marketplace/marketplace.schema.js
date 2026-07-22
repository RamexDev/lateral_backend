// Import Zod for request validation.
import { z } from 'zod';

// Validate feed query parameters.
export const feedQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().positive().max(50).default(10),
  fresh: z
    .enum(['true', 'false', '1', '0'])
    .optional()
    .transform((value) => value === 'true' || value === '1')
});

// Validate people query parameters.
export const peopleQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().positive().max(50).default(10)
});
