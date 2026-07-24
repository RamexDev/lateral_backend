// Impressions schema.

import { z } from 'zod';

// Validate impression recording request body.
export const impressionsSchema = z.object({
  candidate_ids: z.array(z.number().int().positive()).max(100).default([])
});
