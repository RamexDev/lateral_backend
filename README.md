# Lateral Transfer Marketplace — Backend

A backend service for a marketplace where Ethiopian bank employees can find lateral transfer opportunities. Employees register via a Telegram bot / Mini App wizard, declare their current branch and the zones they're interested in moving to, and browse a matching feed of other employees whose interests match their current location.

Built to the specification in [`backend.md`](./backend.md) (SRS v1.0, July 15, 2026).

## Tech stack

| Layer       | Choice                                                          | Why |
|-------------|------------------------------------------------------------------|-----|
| HTTP        | Express 4                                                        | Spec calls for Express |
| DB (prod)   | MySQL 8 via `mysql2` (pooled)                                    | Spec §1 |
| DB (tests)  | SQLite in-memory via `sqlite3`                                   | Fast, isolated, no external services required |
| ORM         | Sequelize v6 + sequelize-cli                                     | Migrations, models, seeders |
| Cache       | Redis (`ioredis`) in prod, in-memory `Map` in tests/dev          | Spec §7 |
| Validation  | Zod                                                              | Spec §10 |
| Auth        | JWT (`jsonwebtoken`) + `bcryptjs` for staff passwords            | Spec §10, SEC-002 |
| Rate limit  | `rate-limiter-flexible`                                          | Spec §10, SEC-005, SEC-008 |
| Tests       | Jest + Supertest                                                 | Spec §5 |
| Lint/Format | ESLint + Prettier                                                | Spec §3 |

## Architecture

```
src/
├── app.js                     Express app composition (two routers: /api/v1 + /admin/api/v1)
├── server.js                  Boot script
├── config/                    Env config
├── db/
│   ├── sequelize.js           Sequelize instance (MySQL prod / SQLite tests)
│   ├── config.js              Per-env connection params (consumed by sequelize-cli)
│   ├── models/                12 Sequelize models + associations (Bank, Location, …)
│   ├── migrations/            9 sequelize-cli migrations — schema as specified in §3.2
│   ├── seeders/               4 Sequelize seeders (banks, geography, grades, super admin)
│   └── seed_lib/              Seed JSON fixtures + closureRebuild helper
├── repositories/              Data access layer (one file per table, Sequelize models)
├── services/                  Business logic (Auth, Onboarding, Interest, Matching, Purchase, …)
├── middlewares/               auth, rbac, routerScope (SEC-011), validate, rateLimit, initData, errorHandler
├── routes/                    Express routers
│   ├── onboarding.js          Bot-wizard endpoints (§6.3) + initData verification (SEC-003)
│   ├── user.js                Authenticated user routes (§6.4–6.8) + rate limiters (SEC-008)
│   ├── admin/                 Admin PWA routes (§6.9–6.10)
│   └── webhooks/payments.js   Telegram payments webhook (§6.7)
├── schemas/                   Zod validation schemas
├── providers/telegramStars.js Payment provider interface (§8)
├── i18n/                      en.json + am.json message catalogs (§16)
└── utils/                     jwt, password, phone, cache, logger, response envelope, ApiError, telegramInitData
```

## Key features

- **Full onboarding wizard** (§6.3): language → contact-share → bank → region → zone → branch details → grade band → grade, with Redis-backed session FSM and resume capability.
- **Multi-select interest wizard** (§6.4): in-progress selections held in the bot session; idempotent persist via `uq_user_location` constraint.
- **Live matching engine** (§5): one-directional eligibility (BR-002) + mutuality boost + geographic specificity ranking. Feed cached in Redis for 30s, bypassed by `?fresh=true` (FR-MATCH-007). Identity fields hidden until a completed purchase exists (SEC-010). True `totalResults` via `COUNT(*)`.
- **Purchase + payment flow** (§6.7, §8): provider-agnostic `PaymentService` interface with a stub `TelegramStarsProvider`. Race-window mutex with hard TTL + DB unique constraint (BR-006). Idempotent webhook on `telegram_charge_id` (FR-PAY-002).
- **Admin RBAC** (§11): `super_admin` / `platform_admin` / `finance_officer` / `support_officer` roles with central `requireRole(...)` middleware.
- **Router-token binding** (SEC-011): staff JWTs only authenticate on `/admin/api/v1/*`, user JWTs only on `/api/v1/*` — server-side, independent of CORS.
- **Telegram initData verification** (SEC-003): HMAC-SHA256 validation of the `X-Telegram-Init-Data` header on Mini App requests, with the bot gateway path allowed as a trusted fallback.
- **Rate limiting** (SEC-005, SEC-008): per-IP lockout on admin login; per-user limits on feed (60/min) and purchase (10/min) endpoints.
- **Audit logging** (SEC-006): every sensitive action writes an `audit_logs` row.
- **i18n** (§16): English + Amharic message catalogs; reference data has parallel `name` / `name_am` columns; `code` stays a stable English identifier, only `message` is resolved through the catalog.
- **Closure-table location hierarchy** (§4.2): portable application-level walk — works on both MySQL 8 and SQLite (no `WITH RECURSIVE` dependency).

## Getting started

### Prerequisites

- Node.js 18+
- MySQL 8 (production) — OR just use SQLite for local dev/tests

### Install

```bash
npm install
```

### Run the tests (no external services required)

Tests use an in-memory SQLite DB. They run migrations + seeds automatically inside Jest's setup hook.

```bash
npm test
```

With coverage:

```bash
npm run test:coverage
```

### Run the app locally (MySQL required)

1. Copy `.env.example` to `.env` and fill in real values:
   ```bash
   cp .env.example .env
   ```

2. Run Sequelize migrations:
   ```bash
   npm run migrate
   ```
   Roll back the most recent migration:
   ```bash
   npm run migrate:rollback
   ```
   Generate a new migration:
   ```bash
   npm run migrate:make create_new_table
   ```

3. Seed reference data (banks, locations, grades, super admin):
   ```bash
   npm run seed          # runs all 4 seeders in order
   npm run seed:undo     # undoes all seeders (cleans reference data — use with care)
   npm run seed:geography # just banks + locations + closure rebuild
   npm run seed:grades    # just the grade matrix
   ```

4. Start the server:
   ```bash
   npm run dev   # or: npm start
   ```

The API will be available at `http://localhost:3000`. Health check: `GET /healthz`.

### Default super admin

After `npm run seed`, a super admin account is created with:

- Email: `superadmin@lateral.local`
- Password: `ChangeMe123!`

Override these via `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` env vars before seeding.

## Sequelize layout

```
.sequelizerc                           → points the CLI at our config/models/migrations/seeders paths
src/db/config.js                       → per-NODE_ENV DB params (test=sqlite memory, dev/prod=mysql)
src/db/sequelize.js                    → the Sequelize instance
src/db/models/                         → 12 models + index.js (associations)
src/db/migrations/                     → 9 sequelize-cli migrations
src/db/seeders/                        → 4 sequelize-cli seeders (idempotent)
src/db/seed_lib/                       → seed JSON fixtures + closureRebuild helper
```

The test setup (`tests/setup.js`) invokes the migration + seeder files directly against the
in-memory SQLite instance (rather than going through `sequelize-cli`) so the Jest worker
can stay self-contained. The same files run via `sequelize-cli db:migrate` /
`db:seed:all` in production — they're standard sequelize-cli migration/seeder modules.

### Conventions

- **Model attribute names** are snake_case to match the DB column names exactly. This
  keeps repository return values consistent (whether `raw: true` plain objects or model
  instances) and avoids a `camelCase` ↔ `snake_case` impedance mismatch with the
  existing service layer.
- **Underscored timestamps**: each model uses `underscored: true` so Sequelize maps
  `createdAt`/`updatedAt` JS attributes to `created_at`/`updated_at` columns.
- **Composite primary keys** (e.g. `location_ancestors`) are declared inline on the
  attribute definitions.
- **Migrations** use `queryInterface.createTable` + `addIndex` + `addConstraint` —
  portable across MySQL and SQLite. The `location_ancestors` migration uses
  `addConstraint` for the composite PK because `createTable`'s `primaryKey: true`
  on two columns isn't portable.
- **Seeders** are idempotent: banks upsert by `nickname`, locations by
  `(name, parent_id)`, grades by `grade_number`, super admin by `email`. Re-running
  `npm run seed` is safe.

## API summary

### End-user (`/api/v1/*`)

| Method | Path                                | Description |
|--------|-------------------------------------|-------------|
| POST   | `/onboarding/start`                 | Begin or resume registration |
| POST   | `/onboarding/language`              | Set preferred language |
| POST   | `/onboarding/contact`               | Verify phone via Telegram contact-share |
| POST   | `/onboarding/otp/request`           | OTP fallback (FR-AUTH-002) |
| POST   | `/onboarding/otp/verify`            | Verify OTP code |
| POST   | `/onboarding/bank`                  | Pick bank |
| POST   | `/onboarding/region`                | Pick region |
| POST   | `/onboarding/zone`                  | Pick zone/subcity |
| POST   | `/onboarding/branch-details`        | Free-text branch name + neighborhood |
| POST   | `/onboarding/grade-band`            | Pick grade band |
| POST   | `/onboarding/grade`                 | Finalize profile |
| POST   | `/auth/issue-token`                 | Exchange telegramId for user JWT (called by bot gateway) |
| GET    | `/interests/zone-options`           | Multi-select checkbox list |
| POST   | `/interests/toggle`                 | Toggle a zone on/off |
| POST   | `/interests/change-region`          | Switch to a different region's zones |
| POST   | `/interests/confirm`                | Persist selections |
| GET    | `/interests/me`                     | List user's interests |
| DELETE | `/interests/:id`                    | Remove an interest |
| GET    | `/me`                               | Get profile |
| PUT    | `/me`                               | Update profile (branch, neighborhood, region+zone, grade, language) |
| GET    | `/marketplace/feed`                 | Browse matching candidates (rate-limited: 60 req/min) |
| POST   | `/purchases`                        | Initiate a reveal purchase (rate-limited: 10 req/min) |
| GET    | `/me/purchases`                     | List own purchases |
| GET    | `/me/notifications`                 | List notifications |
| POST   | `/webhooks/telegram/payments`       | Telegram payments webhook (unauthenticated; verified via secret token) |

### Admin (`/admin/api/v1/*`)

| Method | Path                                | Roles |
|--------|-------------------------------------|-------|
| POST   | `/auth/login`                       | (public, rate-limited per IP) |
| GET    | `/banks`                            | super_admin, platform_admin |
| POST   | `/banks`                            | super_admin, platform_admin |
| PATCH  | `/banks/:id`                        | super_admin, platform_admin |
| GET    | `/locations`                        | super_admin, platform_admin |
| POST   | `/locations`                        | super_admin, platform_admin |
| PATCH  | `/locations/:id`                    | super_admin, platform_admin |
| GET    | `/grades`                           | super_admin, platform_admin |
| POST   | `/grades`                           | super_admin, platform_admin |
| PATCH  | `/grades/:id`                       | super_admin, platform_admin |
| GET    | `/staff`                            | super_admin |
| GET    | `/staff/roles`                      | super_admin |
| POST   | `/staff`                            | super_admin |
| GET    | `/users`                            | super_admin, platform_admin, finance_officer, support_officer |
| GET    | `/users/:id`                        | super_admin, platform_admin, finance_officer, support_officer |
| PATCH  | `/users/:id/status`                 | super_admin, platform_admin, support_officer |
| POST   | `/notifications/broadcast`          | super_admin, platform_admin |
| GET    | `/dashboard/summary`                | super_admin, platform_admin, finance_officer, support_officer |
| GET    | `/reports/revenue`                  | super_admin, finance_officer |
| GET    | `/reports/export`                   | super_admin, finance_officer |
| GET    | `/system/health`                    | super_admin, platform_admin, finance_officer, support_officer |

## Test summary

146 tests across 9 files covering:

- **Onboarding wizard (§6.3)** — full FSM, resume, validation, edge cases (DUPLICATE_PHONE, GRADE_BAND_MISMATCH, ZONE_REGION_MISMATCH, etc.)
- **Interests + Profile (§6.4, §6.5)** — toggle/confirm/list/delete, profile GET/PUT, all validation paths
- **Marketplace feed (§6.6)** — mutuality boost, BR-001 (same bank), BR-003 (grade adjacency), SEC-010 (contact hiding), FR-MATCH-007 (cache bypass)
- **Purchases + payments webhook (§6.7)** — full purchase lifecycle, BR-006 (double-charge guard), FR-PAY-002 (idempotent webhook)
- **Matching engine ranking (§5)** — focused tests: mutual > one-directional, region-level matchWarning, true totalResults, self-exclusion, inactive-exclusion
- **Admin auth (§6.9)** — login, rate limiting (SEC-005), router-token binding (SEC-011), disabled account rejection
- **Admin reference data (§6.9)** — banks/locations/grades CRUD with all edge cases, RBAC per role
- **Admin management (§6.9, §6.10)** — staff CRUD, user status, broadcasts, dashboard, revenue reports, system health
- **Security (SEC-003/004/007/008/011, BR-006)** — initData verification, rate limiting, RBAC matrix, webhook integrity, router-scope, double-charge guard + mutex release
- **Sequelize models + migrations + seeders (§3.2, §4)** — all 12 models load with correct attributes + indexes, associations wired, schema produces 12 tables with FKs and unique constraints, seeders populate 31 banks + 14 regions + 91 zones + 18 grades + 4 roles, closure table rebuilt, all seeders idempotent

Tests are isolated: domain tables (users, interests, purchases, etc.) are truncated before each test, while reference data (banks, locations, grades, roles) is preserved. Rate-limiter counters are also reset between tests.

## Linting & formatting

```bash
npm run lint
npm run lint:fix
npm run format
```

## Project structure conventions

- **Repository pattern** (`src/repositories/`) — every DB access goes through a repository module. Services that need joins/aggregates (matching, notification, reporting) use `sequelize.query()` with bound parameters — no raw string concatenation.
- **Service pattern** (`src/services/`) — business logic. Services throw `ApiError` for expected business-rule violations; the centralized error handler converts these to the standard envelope.
- **Standard response envelope** — every handler returns `{ success: true, data, message? }` or `{ success: false, error: { code, message } }` (§6.0).
- **Stable error codes** — uppercase snake_case identifiers (`DUPLICATE_PHONE`, `BANK_NOT_FOUND`, etc.) used as machine-readable branching keys; `message` is resolved through the i18n catalog.

## Environment variables

See [`backend.md` §13](./backend.md) for the full list. Critical ones:

| Var | Default | Notes |
|---|---|---|
| `NODE_ENV` | `development` | `test` → SQLite in-memory; `production` → MySQL with required env vars |
| `PORT` | `3000` | |
| `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` | — | MySQL connection (dev/prod); ignored in test env |
| `REDIS_URL` | — | If unset, falls back to in-memory Map (dev/test only) |
| `JWT_SECRET` | `dev-jwt-secret-change-me` | **Change in prod** |
| `ADMIN_SESSION_TTL_MINUTES` | `30` | SEC-009: staff JWT hard expiry |
| `TELEGRAM_BOT_TOKEN` | — | Required for initData verification (SEC-003) |
| `TELEGRAM_WEBHOOK_SECRET` | — | Required for webhook integrity (SEC-007) |
| `TELEGRAM_PAYMENTS_PROVIDER_TOKEN` | — | Stars provider token (Open Item §15 #1) |
| `MINIAPP_ORIGIN` / `ADMIN_PWA_ORIGIN` | `*` | CORS origins per router (SEC-011) |
| `DEFAULT_GRADE_ADJACENCY_RANGE` | `1` | BR-003 ±1 rank default |
| `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` | `superadmin@lateral.local` / `ChangeMe123!` | First-run bootstrap |
| `PAYMENT_AMOUNT_ETB` | `500` | Per-reveal price |
