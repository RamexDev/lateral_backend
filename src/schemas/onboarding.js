const { z } = require('zod');

const startSchema = z.object({
  telegramId: z.number().int().positive(),
  telegramUsername: z.string().max(64).optional().nullable(),
});

const languageSchema = z.object({
  telegramId: z.number().int().positive(),
  // Accept any string here — the service validates against ['en', 'am']
  // so it returns INVALID_LANGUAGE (a business error) rather than VALIDATION_FAILED.
  language: z.string().min(1).max(8),
});

const contactSchema = z.object({
  telegramId: z.number().int().positive(),
  telegramUsername: z.string().max(64).optional().nullable(),
  phoneNumber: z.string().min(4).max(20),
  contactIsSelf: z.boolean(),
});

const bankSchema = z.object({
  telegramId: z.number().int().positive(),
  bankId: z.number().int().positive(),
});

const regionSchema = z.object({
  telegramId: z.number().int().positive(),
  regionId: z.number().int().positive(),
});

const zoneSchema = z.object({
  telegramId: z.number().int().positive(),
  zoneId: z.number().int().positive(),
});

const branchDetailsSchema = z.object({
  telegramId: z.number().int().positive(),
  // Allow any non-empty string here — the service enforces the min-3 rule
  // so it returns INVALID_BRANCH_NAME (a business error) rather than VALIDATION_FAILED.
  branchName: z.string().min(1).max(150),
  neighborhood: z.string().max(150).optional().nullable(),
});

const gradeBandSchema = z.object({
  telegramId: z.number().int().positive(),
  bandLabel: z.string().min(1).max(60),
});

const gradeSchema = z.object({
  telegramId: z.number().int().positive(),
  gradeId: z.number().int().positive(),
});

const otpRequestSchema = z.object({
  telegramId: z.number().int().positive(),
  phoneNumber: z.string().min(4).max(20),
});

const otpVerifySchema = z.object({
  telegramId: z.number().int().positive(),
  code: z.string().min(4).max(10),
});

module.exports = {
  startSchema,
  languageSchema,
  contactSchema,
  bankSchema,
  regionSchema,
  zoneSchema,
  branchDetailsSchema,
  gradeBandSchema,
  gradeSchema,
  otpRequestSchema,
  otpVerifySchema,
};
