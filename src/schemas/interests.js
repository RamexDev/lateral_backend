const { z } = require('zod');

const zoneOptionsQuerySchema = z.object({
  telegramId: z.coerce.number().int().positive(),
  regionId: z.coerce.number().int().positive().optional(),
});

const toggleSchema = z.object({
  telegramId: z.number().int().positive(),
  regionId: z.number().int().positive(),
  locationId: z.number().int().positive(),
});

const changeRegionSchema = z.object({
  telegramId: z.number().int().positive(),
  newRegionId: z.number().int().positive(),
});

const confirmSchema = z.object({
  telegramId: z.number().int().positive(),
});

module.exports = {
  zoneOptionsQuerySchema,
  toggleSchema,
  changeRegionSchema,
  confirmSchema,
};
