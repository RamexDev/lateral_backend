# Lateral Transfer Marketplace — Backend

A backend service for a marketplace where Ethiopian bank employees can find lateral transfer opportunities. Employees register via a Telegram bot / Mini App wizard, declare their current branch and the zones they're interested in moving to, and browse a matching feed of other employees whose interests match their current location.

Built to the specification in [`backend.md`](./backend.md) (SRS v1.0, July 15, 2026).

## Tech stack

| Layer       | Choice                                                          | Why |
|-------------|------------------------------------------------------------------|-----|
| HTTP        | Express 4                                                        | Spec calls for Express |
| DB (prod)   | MySQL 8 via `mysql2` (pooled)                                    | Spec §1 |
| DB (tests)  | SQLite in-memory via `better-sqlite3`                            | Fast, isolated, no external services required |
| Migrations  | Knex                                                             | Same query builder works on both MySQL and SQLite |
| Cache       | Redis (`ioredis`) in prod, in-memory `Map` in tests/dev          | Spec §7 |
| Validation  | Zod                                                              | Spec §10 |
| Auth        | JWT (`jsonwebtoken`) + `bcryptjs` for staff passwords            | Spec §10, SEC-002 |
| Tests       | Jest + Supertest                                                 | Spec §5 |
| Lint/Format | ESLint + Prettier                                                | Spec §3 |

## Architecture

```
src/
├── app.js                     Express app composition (two routers: /api/v1 + /admin/api/v1)
├── server.js                  Boot script
├── config/                    Env config
├── db/
│   ├── knex.js                Knex instance (MySQL prod / SQLite tests)
│   ├── migrations/            9 migrations — schema as specified in §3.2
│   ├── seeds/                 Knex seed runner
│   └── seed_lib/              Seed helpers + JSON fixtures (31 banks, 14 regions + 105 zones, 18 grades)
├── repositories/              Data access layer (one file per table)
├── services/                  Business logic (Auth, Onboarding, Interest, Matching, Purchase, …)
├── middlewares/               auth, rbac, routerScope (SEC-011), validate, errorHandler
├── routes/                    Express routers
│   ├── onboarding.js          Bot-wizard endpoints (§6.3)
│   ├── user.js                Authenticated user routes (§6.4–6.8)
│   ├── admin/                 Admin PWA routes (§6.9–6.10)
│   └── webhooks/payments.js   Telegram payments webhook (§6.7)
├── schemas/                   Zod validation schemas
├── providers/telegramStars.js Payment provider interface (§8)
├── i18n/                      en.json + am.json message catalogs (§16)
└── utils/                     jwt, password, phone, cache, logger, response envelope, ApiError
```

## Key features

- **Full onboarding wizard** (§6.3): language → contact-share → bank → region → zone → branch details → grade band → grade, with Redis-backed session FSM and resume capability.
- **Multi-select interest wizard** (§6.4): in-progress selections held in the bot session; idempotent persist via `uq_user_location` constraint.
- **Live matching engine** (§5): one-directional eligibility (BR-002) + mutuality boost + geographic specificity ranking. Feed cached in Redis for 30s, bypassed by `?fresh=true` (FR-MATCH-007). Identity fields hidden until a completed purchase exists (SEC-010).
- **Purchase + payment flow** (§6.7, §8): provider-agnostic `PaymentService` interface with a stub `TelegramStarsProvider`. Race-window mutex + DB unique constraint (BR-006). Idempotent webhook on `telegram_charge_id` (FR-PAY-002).
- **Admin RBAC** (§11): `super_admin` / `platform_admin` / `finance_officer` / `support_officer` roles with central `requireRole(...)` middleware.
- **Router-token binding** (SEC-011): staff JWTs only authenticate on `/admin/api/v1/*`, user JWTs only on `/api/v1/*` — server-side, independent of CORS.
- **Login rate limiting** (SEC-005): per-IP lockout after 5 failed admin logins.
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

2. Run migrations:
   ```bash
   npm run migrate
   ```

3. Seed reference data (banks, locations, grades, super admin):
   ```bash
   npm run seed
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
| GET    | `/marketplace/feed`                 | Browse matching candidates |
| POST   | `/purchases`                        | Initiate a reveal purchase |
| GET    | `/me/purchases`                     | List own purchases |
| GET    | `/me/notifications`                 | List notifications |
| POST   | `/webhooks/telegram/payments`       | Telegram payments webhook (unauthenticated; verified via secret token) |

### Admin (`/admin/api/v1/*`)

| Method | Path                                | Roles |
|--------|-------------------------------------|-------|
| POST   | `/auth/login`                       | (public) |
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

94 tests across 6 files covering:

- **User authentication flow** — full onboarding wizard, JWT issuance, edge cases (DUPLICATE_PHONE, GRADE_BAND_MISMATCH, ZONE_REGION_MISMATCH, etc.)
- **User management flow** — profile GET/PUT, interest CRUD, marketplace feed (with mutuality boost + BR-001/BR-003 enforcement + SEC-010 contact hiding)
- **Admin authentication flow** — login, rate limiting (SEC-005), router-token binding (SEC-011), disabled account rejection
- **Admin management flow** — banks/locations/grades CRUD with all edge cases (DUPLICATE_NICKNAME, BANK_HAS_ACTIVE_USERS, CYCLE_DETECTED, etc.), staff CRUD, user status, broadcasts
- **Authorization & permissions** — every role tested against every restricted endpoint
- **Validation failures** — Zod schema rejections + service-level business rule violations
- **Error scenarios** — 404s, 409 conflicts, 422 business violations
- **Success scenarios** — full purchase lifecycle including webhook idempotency (FR-PAY-002)

Tests are isolated: domain tables (users, interests, purchases, etc.) are truncated before each test, while reference data (banks, locations, grades, roles) is preserved.

## Linting & formatting

```bash
npm run lint
npm run lint:fix
npm run format
```

## Project structure conventions

- **Repository pattern** (`src/repositories/`) — every DB access goes through a repository module. No raw `db('table')` calls outside repositories (except in services that need joins/aggregates not naturally belonging to one repo, like the matching query).
- **Service pattern** (`src/services/`) — business logic. Services throw `ApiError` for expected business-rule violations; the centralized error handler converts these to the standard envelope.
- **Standard response envelope** — every handler returns `{ success: true, data, message? }` or `{ success: false, error: { code, message } }` (§6.0).
- **Stable error codes** — uppercase snake_case identifiers (`DUPLICATE_PHONE`, `BANK_NOT_FOUND`, etc.) used as machine-readable branching keys; `message` is resolved through the i18n catalog.
