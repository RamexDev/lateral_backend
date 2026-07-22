// Import Express.
import express from 'express';

// Import path helpers.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Import environment variables.
import { env } from './config/env.js';

// Import the shared logger.
import { logger } from './lib/logger.js';

// Import error handling middleware.
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';

// Import security middleware.
import { requestId, securityHeaders, cors } from './middleware/security.js';

// Import route modules.
import adminAuthRoutes from './modules/admin/auth/adminAuth.routes.js';
import adminReferenceRoutes from './modules/admin/reference/reference.routes.js';
import broadcastRoutes from './modules/admin/broadcast/broadcast.routes.js';
import managementRoutes from './modules/admin/management/management.routes.js';
import onboardingRoutes from './modules/onboarding/onboarding.routes.js';
import telegramWebhookRoutes from './modules/telegram/webhook.routes.js';
import userRoutes from './modules/user/user.routes.js';
import photoRoutes from './modules/user/photo.routes.js';
import interestsRoutes from './modules/interests/interests.routes.js';
import marketplaceRoutes from './modules/marketplace/marketplace.routes.js';
import purchasesRoutes from './modules/purchases/purchases.routes.js';
import webhooksRoutes from './modules/webhooks/webhooks.routes.js';
import notificationsRoutes from './modules/notifications/notifications.routes.js';

// Resolve the avatars directory.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const avatarsDir = path.join(__dirname, '..', 'storage', 'avatars');

// Create the Express application.
const app = express();

// Trust one proxy hop for correct client IP detection.
app.set('trust proxy', 1);

// Disable the Express powered-by header.
app.disable('x-powered-by');

// Security middleware.
app.use(requestId);
app.use(securityHeaders);
app.use(cors);

// Parse JSON request bodies.
app.use(express.json({ limit: '1mb' }));

// Parse URL-encoded request bodies.
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Serve uploaded avatar files statically.
app.use('/avatars', express.static(avatarsDir));

// Public health endpoints.
app.get('/healthz', (req, res) => {
  res.json({ ok: true });
});

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/livez', (req, res) => {
  res.json({ ok: true });
});

// Admin routes.
app.use('/admin/api/v1/auth', adminAuthRoutes);
app.use('/admin/api/v1/notifications/broadcast', broadcastRoutes);
app.use('/admin/api/v1', managementRoutes);
app.use('/admin/api/v1', adminReferenceRoutes);

// User routes.
app.use('/api/v1/onboarding', onboardingRoutes);
app.use('/api/v1/telegram/webhook', telegramWebhookRoutes);
app.use('/api/v1/webhooks', webhooksRoutes);
app.use('/api/v1', userRoutes);
app.use('/api/v1', photoRoutes);
app.use('/api/v1/interests', interestsRoutes);
app.use('/api/v1/marketplace', marketplaceRoutes);
app.use('/api/v1/purchases', purchasesRoutes);
app.use('/api/v1/webhooks', webhooksRoutes);
app.use('/api/v1/notifications', notificationsRoutes);

// Handle unknown routes.
app.use(notFoundHandler);

// Handle errors centrally.
app.use(errorHandler);

// Export the app for tests and server startup.
export default app;
