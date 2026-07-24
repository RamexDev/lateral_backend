// Shortlist schema.

import { z } from 'zod';

// Validate add-shortlist request body.
export const addShortlistSchema = z.object({
  target_user_id: z.number().int().positive()
});

// Validate list-shortlist query.
export const listShortlistSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().positive().max(50).default(20)
});

// Validate target_user_id param.
export const targetUserParamSchema = z.object({
  target_user_id: z.coerce.number().int().positive()
});
