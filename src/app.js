/**
 * Express app composition.
 *
 * Two independent routers (§6.0, SEC-011) with distinct CORS configs:
 *   /api/v1/*           — bot webhook + Mini App traffic
 *   /admin/api/v1/*     — Admin PWA traffic only
 *
 * Each router is fronted by router-scope enforcement that rejects mismatched tokens.
 */
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const config = require('./config');

const { rejectMismatchedScope } = require('./middlewares/routerScope');
const { errorHandler, notFoundHandler } = require('./middlewares/errorHandler');
const { requireStaff } = require('./middlewares/auth');

const onboardingRouter = require('./routes/onboarding');
const userRouter = require('./routes/user');
const adminAuthRouter = require('./routes/admin/auth');
const adminBanksRouter = require('./routes/admin/banks');
const adminLocationsRouter = require('./routes/admin/locations');
const adminGradesRouter = require('./routes/admin/grades');
const adminStaffRouter = require('./routes/admin/staff');
const adminUsersRouter = require('./routes/admin/users');
const adminNotificationsRouter = require('./routes/admin/notifications');
const adminReportsRouter = require('./routes/admin/reports');
const chapaWebhookRouter = require('./routes/webhooks/chapa');

// Register all BullMQ processors (or their inline fallbacks in test env)
// so the API process can enqueue jobs that get processed synchronously
// in tests and via real BullMQ workers in production.
require('./queues/registerAll').registerAll();

function createApp() {
  const app = express();

  app.use(helmet());
  app.use(express.json({ limit: '1mb' }));
  if (!config.isTest) app.use(morgan('tiny'));

  // Health check (unauthenticated) for LB probes.
  app.get('/healthz', async (req, res) => {
    res.status(200).json({ ok: true });
  });

  // ─── /api/v1/* — Mini App + bot webhook ─────────────────────────────────
  const apiV1 = express.Router();
  apiV1.use(cors({ origin: config.cors.miniappOrigin }));
  apiV1.use(rejectMismatchedScope('user')); // SEC-011: reject staff tokens here

  // Webhook for Chapa payment confirmations (no auth — verified via HMAC signature).
  apiV1.use('/webhooks/chapa', chapaWebhookRouter);

  // Onboarding wizard (called by the bot gateway or directly by the Mini App).
  apiV1.use('/', onboardingRouter);

  // Authenticated user routes (/me, /interests/me, /marketplace/feed, /purchases, ...).
  apiV1.use('/', userRouter);

  app.use('/api/v1', apiV1);

  // ─── /admin/api/v1/* — Admin PWA only ───────────────────────────────────
  const adminApi = express.Router();
  adminApi.use(cors({ origin: config.cors.adminPwaOrigin }));
  adminApi.use(rejectMismatchedScope('staff')); // SEC-011: reject user tokens here

  // Login is unauthenticated (it returns the token).
  adminApi.use('/auth', adminAuthRouter);

  // All other admin routes require a staff JWT.
  adminApi.use(requireStaff());
  adminApi.use('/banks', adminBanksRouter);
  adminApi.use('/locations', adminLocationsRouter);
  adminApi.use('/grades', adminGradesRouter);
  adminApi.use('/staff', adminStaffRouter);
  adminApi.use('/users', adminUsersRouter);
  adminApi.use('/notifications', adminNotificationsRouter);
  adminApi.use('/dashboard', adminReportsRouter);
  adminApi.use('/reports', adminReportsRouter);
  adminApi.use('/system', adminReportsRouter);

  app.use('/admin/api/v1', adminApi);

  // 404 + error handler (last).
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
