// Import Zod for request validation.
import { z } from 'zod';

// Validate admin login request.
export const loginSchema = z.object({
  email: z.string().trim().email().max(150),
  password: z.string().min(1).max(200)
});

// Validate refresh token request.
export const refreshTokenSchema = z.object({
  refresh_token: z.string().trim().min(20).max(300)
});

// Logout uses same shape as refresh.
export const logoutSchema = refreshTokenSchema;
