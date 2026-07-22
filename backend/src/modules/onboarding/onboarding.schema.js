// Import Zod for request validation.
import { z } from 'zod';

// Validate onboarding start.
export const startSchema = z.object({
  telegram_id: z.number().int().positive(),
  telegram_username: z.string().trim().max(64).optional()
});

// Validate language selection.
export const languageSchema = z.object({
  telegram_id: z.number().int().positive(),
  language: z.enum(['en', 'am'])
});

// Validate contact share.
export const contactSchema = z.object({
  telegram_id: z.number().int().positive(),
  phone_number: z.string().trim().min(5).max(20),
  contact_is_self: z.boolean()
});

// Validate bank selection.
export const bankSchema = z.object({
  telegram_id: z.number().int().positive(),
  bank_id: z.number().int().positive()
});

// Validate region selection.
export const regionSchema = z.object({
  telegram_id: z.number().int().positive(),
  region_id: z.number().int().positive()
});

// Validate zone selection.
export const zoneSchema = z.object({
  telegram_id: z.number().int().positive(),
  zone_id: z.number().int().positive()
});

// Validate OTP request stub.
export const otpRequestSchema = z.object({
  telegram_id: z.number().int().positive(),
  phone_number: z.string().trim().min(5).max(20)
});

// Validate OTP verify stub.
export const otpVerifySchema = z.object({
  telegram_id: z.number().int().positive(),
  code: z.string().trim().min(6).max(6)
});
