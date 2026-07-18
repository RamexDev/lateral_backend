# Lateral Transfer Marketplace — Backend Specification

**Version:** 2.0 (post-`answers.md` decisions, July 18, 2026)
**Derived from:** SRS v1.0 (July 15, 2026), `answers.md` (decisions log), the vendor-supplied Ethiopian Banks & Geographic Hierarchy seed data, and the confirmed bot onboarding/interest-selection conversational flow.
**Stack:** Express.js (Node.js) · MySQL 8 · Redis · BullMQ · Chapa (payments) · Telegram Bot API / Mini App · Admin PWA
**Audience:** Backend engineers, DBAs, DevOps, technical reviewers

This document is the source of truth for the current backend implementation. It reflects every decision in `answers.md` (Chapa payment integration, BullMQ worker wiring, the 10-min/30-min/7-day session timeout, the reworded `INVALID_CREDENTIALS` message, the real `.xlsx` export, the `tests/db.js` shim removal, the 111-zone geography seed, the audit-log healthcheck, and the staff refresh-token flow).

---

## 📑 Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Core Backend Modules](#2-core-backend-modules)
3. [Data Model (MySQL)](#3-data-model-mysql)
4. [Location Hierarchy Seeding](#4-location-hierarchy-seeding)
5. [Matching Engine](#5-matching-engine)
6. [API Design](#6-api-design)
   - 6.0 Conventions
   - 6.1 Onboarding wizard API
   - 6.2 Auth (user JWT issuance)
   - 6.3 Interests API
   - 6.4 Profile API
   - 6.5 Marketplace feed
   - 6.6 Purchases & Chapa payment webhook
   - 6.7 Notifications
   - 6.8 Admin auth (login / refresh / logout)
   - 6.9 Admin reference data & staff management
   - 6.10 Admin user monitoring & reports
   - 6.11 Chapa payment webhook
7. [Redis Usage](#7-redis-usage)
8. [Payment Integration (Chapa)](#8-payment-integration-chapa)
9. [Notification System](#9-notification-system)
10. [Security](#10-security)
11. [RBAC Matrix](#11-rbac-matrix)
12. [Non-Functional Implementation Notes](#12-non-functional-implementation-notes)
13. [Environment Configuration](#13-environment-configuration)
14. [Deployment Notes](#14-deployment-notes)
15. [Localization (i18n)](#15-localization-i18n)
16. [Known Issues & Translation Review](#16-known-issues--translation-review)

---

## 1. Architecture Overview

```
                     ┌──────────────────────┐
                     │   Telegram Bot API    │
                     │  (webhook + Mini App) │
                     └──────────┬───────────┘
                                │
                                ▼
                     ┌──────────────────────┐         ┌─────────────────┐
                     │     api (Express)    │◄───────►│   MySQL 8       │
   /api/v1/*         │  - onboarding        │         │  - 13 tables    │
   /admin/api/v1/*   │  - marketplace       │         │  - FKs + indexes│
                     │  - admin PWA REST    │         └─────────────────┘
                     │  - Chapa webhook     │
                     └──────────┬───────────┘         ┌─────────────────┐
                                │                     │   Redis         │
                                ├────────────────────►│  - cache        │
                                │                     │  - BullMQ queues│
                                ▼                     │  - rate limit   │
                     ┌──────────────────────┐         │  - bot sessions │
                     │  worker (BullMQ)     │◄───────►│  - refresh-token│
                     │  - digest fan-out    │         │    lookup cache │
                     │  - broadcast fan-out │         └─────────────────┘
                     │  - payment-webhook   │
                     │    post-processing   │
                     └──────────────────────┘
                     ┌──────────────────────┐
                     │  scheduler (cron)    │
                     │  - daily digest      │
                     │    repeatable job    │
                     └──────────────────────┘
                                │
                                ▼
                     ┌──────────────────────┐
                     │   Chapa Checkout     │
                     │  (off-platform)      │
                     │  - /transaction/     │
                     │    initialize        │
                     │  - webhook →         │
                     │    /api/v1/webhooks/ │
                     │    chapa             │
                     └──────────────────────┘
```

### Process topology (§1.1, `answers.md` §B)

Three separately-deployable processes share the same MySQL + Redis instances:

| Process | Entry point | Purpose |
|---|---|---|
| `api` | `src/server.js` (`npm start` / `npm run dev`) | Express HTTP server for bot webhook + Mini App REST + Admin PWA REST + Chapa webhook. Horizontally scalable behind a load balancer. |
| `worker` | `src/worker.js` (`npm run worker`) | BullMQ consumers on `digest-notifications`, `broadcast-notifications`, `payment-webhook-processing`. Scaled independently of `api` since notification fan-out is bursty. |
| `scheduler` | `src/scheduler.js` (`npm run scheduler`) | Registers the daily repeatable job on `digest-notifications` (cron from `DIGEST_SCHEDULE_CRON`, default `0 6 * * *`). Kept logically separate from `worker` so a worker redeploy doesn't skip a scheduled tick. |

**Test/dev fallback:** When `NODE_ENV === 'test'` OR `REDIS_URL` is unset, the queue layer (`src/queues/index.js`) falls back to **inline synchronous execution** — `enqueue()` runs the processor body in the same call stack. This keeps the test suite self-contained (no Redis dependency) and the dev loop simple. Production deployments MUST run `worker` + `scheduler` separately.

---

## 2. Core Backend Modules

```
src/
├── app.js                     Express app composition (two routers: /api/v1 + /admin/api/v1)
├── server.js                  API process boot script
├── worker.js                  BullMQ worker process
├── scheduler.js               Scheduler process (daily digest cron)
├── config/index.js            Centralized env config
├── db/
│   ├── sequelize.js           Sequelize instance (MySQL prod / SQLite tests)
│   ├── config.js              Per-env connection params (consumed by sequelize-cli)
│   ├── models/                13 Sequelize models + associations
│   ├── migrations/            10 sequelize-cli migrations
│   ├── seeders/               4 Sequelize seeders (banks, geography, grades, super admin)
│   └── seed_lib/              Seed JSON fixtures + closureRebuild helper
├── queues/                    BullMQ queue layer (§7, answers.md §B)
│   ├── index.js               Queue + worker registration; inline fallback for tests
│   ├── registerAll.js         Registers all 3 processors (called at API/worker/scheduler boot)
│   └── processors/            digest.js, broadcast.js, paymentWebhook.js
├── repositories/              Data access layer (one file per table, Sequelize models)
├── services/                  Business logic (Auth, Onboarding, Interest, Matching, Purchase, …, RefreshToken)
├── middlewares/               auth, rbac, routerScope (SEC-011), validate, rateLimit, initData, errorHandler
├── routes/
│   ├── onboarding.js          Bot-wizard endpoints + /auth/issue-token + /interests/zone-options
│   ├── user.js                Authenticated user routes (/me, /interests/me, /marketplace/feed, /purchases, …)
│   ├── admin/                 Admin PWA routes (auth, banks, locations, grades, staff, users, notifications, reports)
│   └── webhooks/chapa.js      Chapa payment confirmation webhook
├── schemas/                   Zod validation schemas (onboarding, interests, profile, marketplace, admin)
├── providers/chapa.js         Payment provider interface + Chapa implementation (§8, answers.md §1)
├── i18n/                      en.json + am.json message catalogs (§15)
└── utils/                     jwt, password, phone, cache, logger, response envelope, ApiError, telegramInitData
```

---

## 3. Data Model (MySQL)

### 3.1 Design note: location hierarchy vs. free-text branch identity

The `locations` table is a structured two-level hierarchy (Region → Zone/Subcity), seeded from the vendor-supplied 111-zone dataset (see §4). The `users` table stores `current_location_id` (a zone FK) **plus** free-text `branch_name` and `neighborhood` — branches are too granular and change too often to model as a separate table.

The closure table `location_ancestors` is the workhorse for the matching engine (§5): it allows a single `JOIN` to answer "does this candidate's interest closure-match the viewer's current location?" without recursive CTEs (portable across MySQL 8 and SQLite).

### 3.2 Schema (DDL — 13 tables)

| # | Table | Purpose | Key constraints |
|---|---|---|---|
| 1 | `banks` | Bank directory (31 rows seeded) | `nickname UNIQUE`, `name_am NOT NULL` |
| 2 | `locations` | Region + zone/subcity hierarchy (125 nodes seeded: 14 regions + 111 zones) | self-FK `parent_id → locations.id`, `name_am NOT NULL` |
| 3 | `location_ancestors` | Closure table (236 rows after rebuild: 125 self-rows + 111 zone→region edges) | composite PK `(ancestor_id, descendant_id)`, `depth` column |
| 4 | `grades` | Shared 1–18 grade matrix across all banks | `grade_number UNIQUE`, all `_am` columns NOT NULL |
| 5 | `roles` | RBAC roles: `super_admin`, `platform_admin`, `finance_officer`, `support_officer` | `name UNIQUE` |
| 6 | `staff` | Admin PWA users (RBAC-scoped) | `email UNIQUE`, FK `role_id → roles.id` |
| 7 | `staff_refresh_tokens` | Backing storage for 7-day staff refresh tokens (answers.md §D) | `token_hash UNIQUE` (SHA-256), FK `staff_id → staff.id` ON DELETE CASCADE |
| 8 | `users` | Registered bank employees | `telegram_id UNIQUE`, `uq_phone_bank (phone_number, bank_id)`, FKs to banks/locations/grades |
| 9 | `transfer_interests` | "I want to move to zone X" declarations | `uq_user_location (user_id, location_id)`, FKs to users/locations |
| 10 | `purchases` | Reveal purchase records (one per buyer/target pair) | `uq_buyer_target (buyer_id, target_user_id)` — BR-006 |
| 11 | `payments` | Chapa payment records | `provider_charge_id UNIQUE` — FR-PAY-002 idempotency key |
| 12 | `notifications` | Queued/sent notifications per user | FK `user_id → users.id` |
| 13 | `audit_logs` | SEC-006 audit trail (every sensitive action) | polymorphic `actor_type`/`actor_id` + `entity_type`/`entity_id` |

#### Column reference — key tables

**`users`** (registered bank employees):

| Column | Type | Notes |
|---|---|---|
| `id` | BIGINT UNSIGNED PK AUTO_INCREMENT | |
| `telegram_id` | BIGINT UNSIGNED UNIQUE NOT NULL | Telegram user ID |
| `telegram_username` | VARCHAR(64) NULL | Optional; used in reveal if present |
| `phone_number` | VARCHAR(20) NOT NULL | E.164-normalized |
| `phone_verified_at` | DATETIME NULL | Set when contact-share verified |
| `bank_id` | INT UNSIGNED NOT NULL | FK → banks.id |
| `current_location_id` | BIGINT UNSIGNED NOT NULL | FK → locations.id (zone_subcity) |
| `branch_name` | VARCHAR(150) NOT NULL | Free text |
| `neighborhood` | VARCHAR(150) NULL | Free text, optional |
| `grade_id` | INT UNSIGNED NOT NULL | FK → grades.id |
| `preferred_language` | ENUM('en','am') NOT NULL DEFAULT 'en' | |
| `is_active` | BOOLEAN NOT NULL DEFAULT TRUE | |
| `last_digest_at` | DATETIME NULL | Updated by daily digest job |
| `last_activity_at` | DATETIME NULL | Updated on authenticated requests |
| `created_at`, `updated_at` | DATETIME | Underscored timestamps |

**`payments`** (Chapa payment records):

| Column | Type | Notes |
|---|---|---|
| `id` | BIGINT UNSIGNED PK AUTO_INCREMENT | |
| `purchase_id` | BIGINT UNSIGNED NULL | FK → purchases.id ON DELETE SET NULL |
| `provider_charge_id` | VARCHAR(100) UNIQUE NULL | **Idempotency key (FR-PAY-002).** For Chapa, this is the `tx_ref` (format: `purchase:<purchaseId>`). Originally `telegram_charge_id`; renamed when the default provider switched to Chapa. |
| `provider` | VARCHAR(30) NOT NULL DEFAULT 'chapa' | Provider-agnostic |
| `amount` | DECIMAL(12,2) NOT NULL | ETB amount |
| `currency` | VARCHAR(10) NOT NULL | ISO 4217 |
| `status` | ENUM('pending','completed','failed','refunded') NOT NULL DEFAULT 'pending' | |
| `raw_payload` | JSON NULL | Full Chapa webhook `data` object |
| `created_at`, `updated_at` | DATETIME | |

**`staff_refresh_tokens`** (answers.md §D):

| Column | Type | Notes |
|---|---|---|
| `id` | BIGINT UNSIGNED PK AUTO_INCREMENT | |
| `staff_id` | BIGINT UNSIGNED NOT NULL | FK → staff.id ON DELETE CASCADE |
| `token_hash` | CHAR(64) UNIQUE NOT NULL | SHA-256 hex of the raw refresh token |
| `expires_at` | DATETIME NOT NULL | Default: 7 days from issue |
| `revoked_at` | DATETIME NULL | NULL = active; non-NULL = revoked (logout, password change, staff deactivation, or rotation) |
| `created_at` | DATETIME | |

Indexes: `idx_staff_refresh_tokens_staff (staff_id)`, `idx_staff_refresh_tokens_expires (expires_at)`.

### 3.3 Key relationships recap

```
banks 1───N users
grades 1───N users
locations 1───N users (current_location_id → zone_subcity)
locations 1───N locations (parent_id: region → zone_subcity)
location_ancestors N───N locations (closure table)
users 1───N transfer_interests
locations 1───N transfer_interests
users 1───N purchases (as buyer)
users 1───N purchases (as target_user_id)
purchases 1───1 payments (optional — payment_id FK on purchases)
users 1───N notifications
roles 1───N staff
staff 1───N staff_refresh_tokens
```

---

## 4. Location Hierarchy Seeding

### 4.1 Seeding the shared geography

The seed data lives in `src/db/seed_lib/seed-data.geography.json`. It is the **vendor-supplied 111-zone dataset** (per `answers.md` §E), replacing the prior 91-zone seed wholesale. Counts:

| Metric | Value |
|---|---|
| Regions / Chartered Cities | 14 |
| Zones / Subcities / Special Woredas | 111 |
| Total geographic nodes | 125 |

The seeder (`src/db/seeders/20240101000002-geography.js`) is idempotent: regions upsert by `(name, level_type='region', parent_id IS NULL)`; zones upsert by `(name, parent_id, level_type='zone_subcity')`. Re-running `npm run seed` is safe.

After seeding, `src/db/seed_lib/closureRebuild.js` rebuilds the `location_ancestors` closure table via an application-level walk (portable across MySQL 8 and SQLite — no `WITH RECURSIVE` dependency, per spec §4.2's fallback allowance).

### 4.2 Closure table maintenance (FR-LOC-003)

`location_ancestors` has 236 rows after the seed:
- 125 self-rows (`depth = 0`) — every location is its own ancestor at depth 0
- 111 zone→region rows (`depth = 1`) — each zone's parent region is an ancestor at depth 1

The matching engine's `JOIN location_ancestors la ON la.ancestor_id = ti.location_id AND la.descendant_id = <viewer's current_location_id>` is O(1) per row regardless of hierarchy depth.

When an admin mutates the location tree (`POST/PATCH /admin/api/v1/locations`), `locationService` rebuilds the closure table synchronously (debounced in prod — the table is small at 125 nodes).

### 4.3 Seeding the grade matrix

`src/db/seeders/20240101000003-grades.js` populates 18 grades (1–18) shared across all banks (per `answers.md` §5 — shared, industry-standard matrix, not per-bank). Each grade row has:

- `grade_number` (1–18)
- `band_label` + `band_label_am` (e.g. "Junior", "Mid", "Senior", "Director")
- `tier_classification` + `tier_classification_am`
- `typical_roles` + `typical_roles_am`
- `rank_order` (default = grade_number; used by BR-003 grade adjacency)
- `is_active` boolean

### 4.4 Seeding the banks

`src/db/seeders/20240101000001-banks.js` populates 31 Ethiopian commercial banks (per `answers.md` §F — matches spec). Each row has English `name` + Amharic `name_am`, a stable `nickname` (e.g. `cbe`, `awash`, `dashen`), optional `swift_code` and `year_established`.

### 4.5 Super-admin bootstrap

`src/db/seeders/20240101000004-super-admin.js` creates the first staff account on first run. Credentials come from env vars (defaults shown):

- `SUPER_ADMIN_EMAIL` = `superadmin@lateral.local`
- `SUPER_ADMIN_PASSWORD` = `ChangeMe123!`
- `SUPER_ADMIN_NAME` = `Super Admin`

Idempotent on `email` — re-running the seeder won't reset the password on an existing account.

---

## 5. Matching Engine (FR-MATCH-001…007, BR-001…004, BR-008)

### 5.1 Eligibility predicate

A candidate appears in the viewer's feed if **all** of the following are true:

1. **Same bank** (BR-001): `candidate.bank_id = viewer.bank_id`
2. **One-directional interest** (BR-002): the candidate has a `transfer_interests` row whose `location_id` closure-matches the viewer's `current_location_id`:
   ```
   EXISTS (
     SELECT 1 FROM transfer_interests ti
     JOIN location_ancestors la
       ON la.ancestor_id   = ti.location_id
      AND la.descendant_id = viewer.current_location_id
     WHERE ti.user_id = candidate.id
   )
   ```
3. **Grade adjacency** (BR-003): `ABS(candidate.rank_order - viewer.rank_order) <= DEFAULT_GRADE_ADJACENCY_RANGE` (default ±1).
4. **Not self** (BR-004): `candidate.id != viewer.id`
5. **Active** (BR-008): `candidate.is_active = 1`

### 5.2 Ranking

Results are ordered by `is_mutual_match DESC, la.depth ASC, ti.created_at DESC`:

1. **Mutuality boost** (FR-MATCH-005): candidates who *also* currently sit somewhere the viewer has expressed interest in rank first.
2. **Geographic specificity**: deeper matches (zone-level, `la.depth = 0`) rank above broader matches (region-level, `la.depth = 1`).
3. **Recency**: newer interests rank above older ones at the same specificity.

### 5.3 Feed caching

The feed is cached in Redis for 30s (keyed by `feed:{bankId}:{userId}:{locationId}:{adjacencyRange}:{page}`). `?fresh=true` bypasses the cache (FR-MATCH-007) — used by the bot's "refresh" button.

### 5.4 SEC-010 contact hiding

Until a `purchases` row exists for `(buyer=viewer, target=candidate)` with a `completed` payment, the candidate's contact fields (`telegramUsername`, `phone`, `branchName`, `neighborhood`) are omitted from the feed card. The `unlocked` boolean on each card tells the client whether the `contact` object is populated.

### 5.5 True total count

`totalResults` is a real `COUNT(*)` running the same predicate (per `answers.md` §C) — not the page-size-as-total from the pre-refactor code. This is what a real pagination UI needs.

---

## 6. API Design

### 6.0 Conventions

#### Base URLs

| Router | Base URL | CORS origin | Token scope |
|---|---|---|---|
| Bot webhook + Mini App | `/api/v1` | `MINIAPP_ORIGIN` | `scope: 'user'` JWT |
| Admin PWA | `/admin/api/v1` | `ADMIN_PWA_ORIGIN` | `scope: 'staff'` JWT |
| Chapa webhook | `/api/v1/webhooks/chapa` | `MINIAPP_ORIGIN` | none (HMAC-signed) |

Router-token binding (SEC-011): a `scope: 'user'` JWT is rejected on `/admin/api/v1/*` and vice versa — server-side, independent of CORS.

#### Standard response envelope

Every endpoint returns one of:

```json
// Success
{
  "success": true,
  "data": { ... },
  "message": "Optional human-readable message (i18n-resolved)"
}

// Error
{
  "success": false,
  "error": {
    "code": "MACHINE_READABLE_CODE",
    "message": "Human-readable message (i18n-resolved)"
  }
}
```

#### HTTP status codes

| Status | Meaning |
|---|---|
| 200 | Success (GET, PUT, PATCH, POST that returns existing resource) |
| 201 | Created (POST that creates a new resource) |
| 400 | `VALIDATION_FAILED` — request body/query failed Zod validation |
| 401 | `INVALID_TOKEN`, `INVALID_TOKEN_FOR_ROUTER`, `INVALID_CREDENTIALS` |
| 403 | `INSUFFICIENT_ROLE`, `ACCOUNT_DISABLED`, `RATE_LIMITED` |
| 404 | `NOT_FOUND` |
| 409 | `ALREADY_PURCHASED`, `DUPLICATE_NICKNAME`, `DUPLICATE_GRADE_NUMBER` |
| 422 | Business rule violation (`BANK_NOT_FOUND`, `ZONE_REGION_MISMATCH`, `GRADE_BAND_MISMATCH`, `EMPTY_SEGMENT`, `BANK_HAS_ACTIVE_USERS`, etc.) |
| 500 | `INTERNAL_ERROR` — unexpected exception |

#### Authentication

All `/api/v1/*` routes (except onboarding + Chapa webhook) require:

```
Authorization: Bearer <user-jwt>
```

All `/admin/api/v1/*` routes (except `/auth/login`, `/auth/refresh`, `/auth/logout`) require:

```
Authorization: Bearer <staff-jwt>
```

User JWTs are issued by `POST /api/v1/auth/issue-token` (called by the bot gateway after onboarding completes). Staff JWTs are issued by `POST /admin/api/v1/auth/login`.

#### Common error codes

`INVALID_TOKEN`, `INVALID_TOKEN_FOR_ROUTER`, `INVALID_CREDENTIALS`, `ACCOUNT_DISABLED`, `INSUFFICIENT_ROLE`, `VALIDATION_FAILED`, `RATE_LIMITED`, `NOT_FOUND`, `INTERNAL_ERROR`.

---

### 6.1 Onboarding wizard API (`/api/v1/onboarding/*`)

The bot gateway (Telegram webhook in prod, direct internal calls in tests/Mini App) drives these steps one at a time, mutating a Redis-backed wizard session.

SEC-003: the `X-Telegram-Init-Data` header is verified on all onboarding routes if present. If absent (bot-gateway internal call), the request is allowed through as a trusted fallback.

#### POST /api/v1/onboarding/start

Begin or resume the registration wizard.

**Request body:**
```json
{
  "telegramId": 987654321,
  "telegramUsername": "tester"
}
```

**Response (brand-new user):**
```json
{
  "success": true,
  "data": {
    "step": "select_language",
    "languages": [
      { "code": "en", "label": "English" },
      { "code": "am", "label": "አማርኛ" }
    ]
  }
}
```

**Response (already registered):**
```json
{
  "success": true,
  "data": {
    "step": "already_registered",
    "userId": 42,
    "bankName": "Commercial Bank of Ethiopia",
    "currentLocation": "East Shewa, Oromia",
    "branchName": "Adama Main Branch"
  },
  "message": "Welcome back! Use /feed to browse the marketplace or /profile to update your details."
}
```

#### POST /api/v1/onboarding/language

**Request body:**
```json
{ "telegramId": 987654321, "language": "en" }
```

**Response:**
```json
{
  "success": true,
  "data": {
    "step": "share_contact",
    "prompt": "To continue, please share your phone number.",
    "requiresNativeContactShare": true
  }
}
```

**Errors:** `INVALID_LANGUAGE` (422) if `language` is not `'en'` or `'am'`.

#### POST /api/v1/onboarding/contact

Verify contact-share and proceed to bank selection.

**Request body:**
```json
{
  "telegramId": 987654321,
  "telegramUsername": "tester",
  "phoneNumber": "+251911000000",
  "contactIsSelf": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "step": "select_bank",
    "banks": [
      { "id": 1, "nickname": "cbe", "name": "Commercial Bank of Ethiopia", "is_active": true },
      { "id": 2, "nickname": "awash", "name": "Awash Bank", "is_active": true }
    ],
    "page": 1,
    "pageSize": 10,
    "totalBanks": 31
  }
}
```

**Errors:** `CONTACT_NOT_SELF` (422) if `contactIsSelf` is `false`.

If `telegramUsername` is missing, a `message` field is included warning the user that buyers will see phone/branch on reveal instead.

#### POST /api/v1/onboarding/bank

**Request body:**
```json
{ "telegramId": 987654321, "bankId": 1 }
```

**Response:**
```json
{
  "success": true,
  "data": {
    "step": "select_region",
    "regions": [
      { "id": 1, "name": "Addis Ababa", "is_active": true },
      { "id": 16, "name": "Oromia", "is_active": true }
    ]
  }
}
```

**Errors:** `BANK_NOT_FOUND` (422) if the bank doesn't exist or is inactive.

#### POST /api/v1/onboarding/region

**Request body:**
```json
{ "telegramId": 987654321, "regionId": 16 }
```

**Response:**
```json
{
  "success": true,
  "data": {
    "step": "select_zone",
    "region": { "id": 16, "name": "Oromia", "is_active": true },
    "zones": [
      { "id": 17, "name": "Arsi", "is_active": true },
      { "id": 25, "name": "East Shewa", "is_active": true }
    ]
  }
}
```

**Errors:** `NOT_FOUND` (404) if the region doesn't exist or isn't a region.

#### POST /api/v1/onboarding/zone

**Request body:**
```json
{ "telegramId": 987654321, "zoneId": 25 }
```

**Response:**
```json
{
  "success": true,
  "data": {
    "step": "enter_branch_name",
    "selectedPath": "Oromia > East Shewa",
    "prompt": "What is the name of your branch? (e.g. 'Adama Main Branch')"
  }
}
```

**Errors:** `NOT_FOUND` (404) if the zone doesn't exist or isn't a zone_subcity. `ZONE_REGION_MISMATCH` (422) if the zone doesn't belong to the previously selected region.

#### POST /api/v1/onboarding/branch-details

**Request body:**
```json
{
  "telegramId": 987654321,
  "branchName": "Adama Main Branch",
  "neighborhood": "Bole Road"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "step": "select_grade",
    "bands": [
      { "band_label": "Junior", "band_label_am": "ጁኒየር" },
      { "band_label": "Mid", "band_label_am": "መካከለኛ" }
    ]
  }
}
```

**Errors:** `INVALID_BRANCH_NAME` (422) if `branchName` is less than 3 characters.

If `neighborhood` is omitted, a `message` field notes it was skipped.

#### POST /api/v1/onboarding/grade-band

**Request body:**
```json
{ "telegramId": 987654321, "bandLabel": "Mid" }
```

**Response:**
```json
{
  "success": true,
  "data": {
    "step": "select_grade_number",
    "band": { "band_label": "Mid", "band_label_am": "መካከለኛ" },
    "grades": [
      { "id": 7, "grade_number": 7, "tier_classification": "Officer I" },
      { "id": 8, "grade_number": 8, "tier_classification": "Officer II" }
    ]
  }
}
```

**Errors:** `BAND_NOT_FOUND` (422) if `bandLabel` doesn't match any seeded band.

#### POST /api/v1/onboarding/grade

Finalize the profile. Returns `userId`; the bot gateway then calls `/auth/issue-token` to mint the user JWT.

**Request body:**
```json
{ "telegramId": 987654321, "gradeId": 7 }
```

**Response:**
```json
{
  "success": true,
  "data": {
    "step": "profile_created",
    "userId": 42,
    "summary": {
      "bank": "Commercial Bank of Ethiopia",
      "region": "Oromia",
      "zone": "East Shewa",
      "branchName": "Adama Main Branch",
      "grade": "Grade 7 — Officer I"
    }
  },
  "message": "Profile created successfully."
}
```

**Errors:** `NOT_FOUND` (404) if `gradeId` doesn't exist. `GRADE_BAND_MISMATCH` (422) if the grade doesn't belong to the previously selected band. `DUPLICATE_PHONE` (422) if the phone number is already registered under the same bank with a different Telegram account (FR-AUTH-003).

#### POST /api/v1/onboarding/otp/request

OTP fallback (FR-AUTH-002). Stub — in production this would actually send an OTP via SMS.

**Request body:**
```json
{ "telegramId": 987654321, "phoneNumber": "+251911000000" }
```

**Response:**
```json
{
  "success": true,
  "data": { "step": "otp_verify", "otpExpiresInSeconds": 300 }
}
```

#### POST /api/v1/onboarding/otp/verify

**Request body:**
```json
{ "telegramId": 987654321, "code": "123456" }
```

**Response:** Same shape as `/onboarding/contact` (proceeds to `select_bank`).

**Errors:** `OTP_INVALID` (422) if the code isn't 4–10 digits.

---

### 6.2 Auth — user JWT issuance

#### POST /api/v1/auth/issue-token

Exchange a freshly-onboarded `telegramId` for a user JWT. Called by the bot gateway right after `profile_created`. Only succeeds if the user exists in the DB.

**Request body:**
```json
{ "telegramId": 987654321 }
```

**Response:**
```json
{
  "success": true,
  "data": { "token": "eyJhbGciOi...", "userId": 42 }
}
```

**Errors:** `VALIDATION_FAILED` (400) if `telegramId` is missing. `NOT_FOUND` (404) if no user has that Telegram ID.

The returned JWT has `scope: 'user'`, `expiresIn: '7d'` (configurable via `JWT_EXPIRES_IN`). It is the only token accepted on `/api/v1/*` routes (except onboarding + Chapa webhook).

---

### 6.3 Interests API

Two flavors: the bot-side `GET /interests/zone-options` (unauthenticated, identified by `telegramId` query param — used by the bot gateway) and the authenticated user-side endpoints (identified by JWT).

#### GET /api/v1/interests/zone-options

Fetch zones for a region with checkbox state. Used by the bot to render the multi-select keyboard.

**Query params:**
```
?telegramId=987654321&regionId=16
```

`regionId` is optional — defaults to the user's own region (where their zone sits).

**Response:**
```json
{
  "success": true,
  "data": {
    "region": { "id": 16, "name": "Oromia" },
    "isUserHomeRegion": true,
    "zones": [
      { "id": 17, "name": "Arsi", "selected": false },
      { "id": 25, "name": "East Shewa", "selected": true },
      { "id": 26, "name": "West Shewa", "selected": false }
    ],
    "currentSelectionCount": 1
  }
}
```

**Errors:** `PROFILE_INCOMPLETE` (422) if no user exists for `telegramId`. `NOT_FOUND` (404) if `regionId` doesn't reference a region.

#### POST /api/v1/interests/toggle

Toggle one zone's checkbox in the in-progress selection set (held in the bot session).

**Request body:**
```json
{ "telegramId": 987654321, "regionId": 16, "locationId": 25 }
```

**Response:** Same shape as `/interests/zone-options` (returns the full updated zone list for the region).

**Errors:** `STALE_INTERACTION` (422) if the user isn't currently viewing that region (stale callback). `ZONE_REGION_MISMATCH` (422) if the zone doesn't belong to the region.

#### POST /api/v1/interests/change-region

Switch the wizard to a different region's zones. Prior selections in other regions are preserved in the session.

**Request body:**
```json
{ "telegramId": 987654321, "newRegionId": 41 }
```

**Response:**
```json
{
  "success": true,
  "data": {
    "region": { "id": 41, "name": "Amhara" },
    "isUserHomeRegion": false,
    "zones": [
      { "id": 42, "name": "North Gondar", "selected": false }
    ],
    "currentSelectionCount": 1
  },
  "message": "Your 1 selections in other regions are still kept. Confirm when done."
}
```

**Errors:** `NOT_FOUND` (404) if `newRegionId` doesn't reference a region.

#### POST /api/v1/interests/confirm

Persist the accumulated selection set as `transfer_interests` rows. Idempotent via `uq_user_location` constraint.

**Request body:**
```json
{ "telegramId": 987654321 }
```

**Response:**
```json
{
  "success": true,
  "data": {
    "createdInterests": [
      { "id": 10, "locationId": 25, "locationName": "East Shewa" }
    ],
    "totalActiveInterests": 1
  },
  "message": "You'll be notified when a matching lead appears. Use /feed anytime to browse now."
}
```

**Errors:** `NO_SELECTION` (422) if the in-progress selection set is empty.

#### GET /api/v1/interests/me

List the authenticated user's persisted interests.

**Response:**
```json
{
  "success": true,
  "data": {
    "interests": [
      { "id": 10, "locationId": 25, "locationName": "East Shewa", "createdAt": "2026-07-18T..." }
    ]
  }
}
```

#### DELETE /api/v1/interests/:id

Remove one of the user's own interests.

**Response:**
```json
{ "success": true, "data": { "deletedId": 10 } }
```

**Errors:** `NOT_FOUND` (404) if the interest doesn't exist. `FORBIDDEN` (403) if the interest belongs to a different user.

---

### 6.4 Profile API

#### GET /api/v1/me

Get the authenticated user's profile.

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": 42,
    "bank": "Commercial Bank of Ethiopia",
    "region": "Oromia",
    "zone": "East Shewa",
    "branchName": "Adama Main Branch",
    "neighborhood": "Bole Road",
    "grade": {
      "gradeNumber": 7,
      "bandLabel": "Mid",
      "tierClassification": "Officer I"
    },
    "preferredLanguage": "en"
  }
}
```

#### PUT /api/v1/me

Self-service profile update. Bank cannot be changed post-registration (`BANK_CHANGE_UNSUPPORTED`).

**Request body (any subset):**
```json
{
  "branchName": "Adama Main Branch 2",
  "neighborhood": "Near the roundabout",
  "regionId": 16,
  "zoneId": 26,
  "gradeId": 8,
  "preferredLanguage": "am"
}
```

**Response:**
```json
{ "success": true, "data": { "updated": true } }
```

**Errors:** `BANK_CHANGE_UNSUPPORTED` (422) if `bankId` is supplied. `ZONE_REGION_MISMATCH` (422) if `zoneId` doesn't belong to `regionId`. `NOT_FOUND` (404) if `zoneId` or `gradeId` don't exist. `INVALID_LANGUAGE` (422) if `preferredLanguage` isn't `'en'` or `'am'`. `VALIDATION_FAILED` (400) if an unknown field is supplied (schema is `.strict()`).

---

### 6.5 Marketplace feed

#### GET /api/v1/marketplace/feed

Browse matching candidates. Rate-limited: 60 req/min per user (SEC-008).

**Query params:**
```
?page=1&pageSize=10&fresh=true
```

| Param | Default | Notes |
|---|---|---|
| `page` | 1 | 1-indexed |
| `pageSize` | 10 | Max 100 |
| `fresh` | false | Bypass the 30s Redis cache (FR-MATCH-007) |

**Response (no matches):**
```json
{
  "success": true,
  "data": { "results": [], "page": 1, "pageSize": 10, "totalResults": 0 },
  "message": "No matches yet. We'll notify you as soon as one appears."
}
```

**Response (with matches):**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "candidateId": "c_43",
        "candidateUserId": 43,
        "matchedInterestId": 11,
        "grade": "Grade 8 — Officer II",
        "matchedLocation": "East Shewa",
        "specificity": "zone_subcity",
        "isMutualMatch": true,
        "matchWarning": null,
        "unlocked": false
      },
      {
        "candidateId": "c_44",
        "candidateUserId": 44,
        "matchedInterestId": 12,
        "grade": "Grade 7 — Officer I",
        "matchedLocation": "Oromia",
        "specificity": "region",
        "isMutualMatch": false,
        "matchWarning": "This candidate is interested in the broader Oromia region, not specifically East Shewa.",
        "unlocked": true,
        "contact": {
          "telegramUsername": "target_user",
          "phone": "+251911000108",
          "branchName": "Adama Main Branch",
          "neighborhood": "Bole Road"
        }
      }
    ],
    "page": 1,
    "pageSize": 10,
    "totalResults": 2
  }
}
```

The `contact` object is only present when `unlocked: true` (a completed purchase exists for `(buyer=viewer, target=candidate)` — SEC-010).

---

### 6.6 Purchases & Chapa payment webhook

#### POST /api/v1/purchases

Initiate a reveal purchase. Rate-limited: 10 req/min per user (SEC-008). BR-006: a buyer can never purchase the same target twice — enforced by both a short-lived Redis mutex (closes the race window) and the `uq_buyer_target` DB unique constraint (the real guard).

**Request body:**
```json
{ "targetUserId": 43 }
```

**Response:**
```json
{
  "success": true,
  "data": {
    "purchaseId": 100,
    "paymentId": 100,
    "status": "pending",
    "checkoutUrl": "https://checkout.chapa.co/test/purchase:100_500_ETB"
  }
}
```

The bot/Mini App deep-links the user to `checkoutUrl` (Chapa's hosted checkout page). After the user completes payment on Chapa, Chapa POSTs to `/api/v1/webhooks/chapa` (see §6.11).

**Errors:** `ALREADY_PURCHASED` (409) if a purchase already exists for this `(buyer, target)` pair. `TARGET_INACTIVE` (422) if the target user doesn't exist, is inactive, or belongs to a different bank (BR-001).

#### GET /api/v1/me/purchases

List the buyer's own purchases.

**Response:**
```json
{
  "success": true,
  "data": {
    "purchases": [
      {
        "purchaseId": 100,
        "targetUserId": 43,
        "status": "pending",
        "createdAt": "2026-07-18T..."
      },
      {
        "purchaseId": 99,
        "targetUserId": 44,
        "status": "completed",
        "createdAt": "2026-07-17T..."
      }
    ]
  }
}
```

`status` is `'completed'` if a completed payment exists for the purchase, else `'pending'`.

---

### 6.7 Notifications

#### GET /api/v1/me/notifications

List the authenticated user's notifications (digests, broadcasts, payment confirmations).

**Response:**
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "type": "digest",
        "sentAt": "2026-07-18T06:00:00.000Z",
        "summary": "3 new matches near your location",
        "payload": { "summary": "3 new matches near your location" }
      },
      {
        "type": "broadcast",
        "sentAt": "2026-07-17T15:30:00.000Z",
        "summary": null,
        "payload": {
          "message": { "en": "Maintenance tonight", "am": "የጥገና ስራ ዛሬ ማታ" },
          "scope": "all"
        }
      },
      {
        "type": "payment_confirmation",
        "sentAt": "2026-07-17T14:00:00.000Z",
        "summary": null,
        "payload": {
          "purchaseId": 99,
          "amountEtb": 500,
          "targetUserId": 44
        }
      }
    ]
  }
}
```

---

### 6.8 Admin auth (login / refresh / logout)

`answers.md` §D — staff auth uses a 30-minute access JWT + 7-day opaque refresh token (stored hashed in `staff_refresh_tokens`).

#### POST /admin/api/v1/auth/login

Staff login. Rate-limited per IP (SEC-005): 5 failed attempts → 15-minute lockout.

**Request body:**
```json
{ "email": "superadmin@lateral.local", "password": "ChangeMe123!" }
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOi...",
    "refreshToken": "v1.kp3_x9...",
    "refreshExpiresAt": "2026-07-25T12:00:00.000Z",
    "staff": {
      "id": 1,
      "fullName": "Super Admin",
      "email": "superadmin@lateral.local",
      "roleId": 1,
      "preferredLanguage": "en"
    }
  }
}
```

The access `token` has `scope: 'staff'`, `expiresIn: '30m'` (configurable via `ADMIN_JWT_EXPIRES_IN`). The `refreshToken` is an opaque high-entropy string (NOT a JWT) — only its SHA-256 hash is stored in the DB, so a DB leak doesn't immediately compromise active sessions.

**Errors:** `INVALID_CREDENTIALS` (401) — message: `"The email or password you entered is incorrect."` (reworded per `answers.md` §G — deliberately generic to avoid user enumeration). `ACCOUNT_DISABLED` (403) if the staff account is inactive. `RATE_LIMITED` (403) after 5 failed attempts from the same IP.

#### POST /admin/api/v1/auth/refresh

Exchange a valid refresh token for a new access token + rotated refresh token. The old refresh token is revoked on use (rotation) — reuse of a revoked token triggers defensive revocation of ALL tokens for that staff member (possible theft, per RFC 6749 §10.4).

**Request body:**
```json
{ "refreshToken": "v1.kp3_x9..." }
```

**Response:** Same shape as `/auth/login`.

**Errors:** `INVALID_TOKEN` (401) if the refresh token is unknown, expired, or already revoked.

#### POST /admin/api/v1/auth/logout

Revoke the supplied refresh token. Idempotent — calling logout with an unknown or already-revoked token returns 200.

Optionally authenticated (if the access token is still valid, the staff id from it is used for the audit log; otherwise logout proceeds anyway).

**Request body:**
```json
{ "refreshToken": "v1.kp3_x9..." }
```

**Response:**
```json
{ "success": true, "data": { "loggedOut": true } }
```

**Revocation triggers:** logout (single token), password change (all tokens for that staff), staff deactivation via FR-ADM-003 (all tokens for that staff), refresh-token reuse detection (all tokens for that staff — defensive).

---

### 6.9 Admin reference data & staff management

All routes require a staff JWT with the appropriate role (see §11 RBAC matrix).

#### GET /admin/api/v1/banks

List all banks (admin view, includes inactive).

**Query params:** `?page=1&pageSize=50&isActive=true`

**Response:**
```json
{
  "success": true,
  "data": {
    "banks": [
      {
        "id": 1,
        "name": "Commercial Bank of Ethiopia",
        "name_am": "የኢትዮጵያ ንግድ ባንክ",
        "nickname": "cbe",
        "swift_code": "CBETETAA",
        "year_established": 1963,
        "is_active": true
      }
    ],
    "page": 1,
    "pageSize": 50,
    "totalResults": 31
  }
}
```

**Roles:** `super_admin`, `platform_admin`.

#### POST /admin/api/v1/banks

**Request body:**
```json
{
  "name": "Test Bank S.C.",
  "nameAm": "ቴስት ባንክ",
  "nickname": "testbank",
  "swiftCode": "TESTETAA",
  "yearEstablished": 2024
}
```

**Response (201):**
```json
{ "success": true, "data": { "id": 32 } }
```

**Errors:** `DUPLICATE_NICKNAME` (409).

**Roles:** `super_admin`, `platform_admin`.

#### PATCH /admin/api/v1/banks/:id

**Request body (any subset):**
```json
{ "isActive": false }
```

**Response:**
```json
{ "success": true, "data": { "id": 1, "updated": true } }
```

**Errors:** `NOT_FOUND` (404). `BANK_HAS_ACTIVE_USERS` (422) if trying to deactivate a bank with active users. `DUPLICATE_NICKNAME` (409) if renaming to a collision.

**Roles:** `super_admin`, `platform_admin`.

#### GET /admin/api/v1/locations

List the regions + zones tree (admin view).

**Response:**
```json
{
  "success": true,
  "data": {
    "locations": [
      {
        "id": 1,
        "name": "Addis Ababa",
        "name_am": "አዲስ አበባ",
        "level_type": "region",
        "is_active": true,
        "zones": [
          { "id": 2, "name": "Addis Ketema", "name_am": "አዲስ ከተማ", "level_type": "zone_subcity", "is_active": true }
        ]
      }
    ]
  }
}
```

**Roles:** `super_admin`, `platform_admin`.

#### POST /admin/api/v1/locations

Add a region or a zone.

**Request body (region):**
```json
{ "name": "New Region", "nameAm": "ኒው ሪጅን", "levelType": "region" }
```

**Request body (zone):**
```json
{ "name": "New Zone", "nameAm": "ኒው ዞን", "levelType": "zone_subcity", "parentId": 100 }
```

**Response (201):**
```json
{ "success": true, "data": { "id": 200, "closureRebuildQueued": true } }
```

The closure table is rebuilt synchronously after each location mutation.

**Errors:** `PARENT_REQUIRED` (422) if `levelType='zone_subcity'` but no `parentId`. `INVALID_PARENT_LEVEL` (422) if `parentId` isn't a region. `REGION_CANNOT_HAVE_PARENT` (422) if `levelType='region'` but `parentId` supplied.

**Roles:** `super_admin`, `platform_admin`.

#### PATCH /admin/api/v1/locations/:id

Rename / move / activate / deactivate.

**Request body (any subset):**
```json
{ "name": "Renamed Zone", "nameAm": "እንደገና የተሰየመ ዞን", "isActive": false }
```

**Response:**
```json
{ "success": true, "data": { "id": 200, "updated": true, "closureRebuildQueued": true } }
```

**Errors:** `NOT_FOUND` (404). `LOCATION_HAS_ACTIVE_USERS` (422) if deactivating a location with active users. `CYCLE_DETECTED` (422) if moving a location under its own descendant.

**Roles:** `super_admin`, `platform_admin`.

#### GET /admin/api/v1/grades

List all grades (admin view).

**Response:**
```json
{
  "success": true,
  "data": {
    "grades": [
      {
        "id": 7,
        "grade_number": 7,
        "band_label": "Mid",
        "band_label_am": "መካከለኛ",
        "tier_classification": "Officer I",
        "tier_classification_am": "ኦፊሰር I",
        "typical_roles": "...",
        "typical_roles_am": "...",
        "rank_order": 7,
        "is_active": true
      }
    ]
  }
}
```

**Roles:** `super_admin`, `platform_admin`.

#### POST /admin/api/v1/grades

**Request body:**
```json
{
  "gradeNumber": 19,
  "bandLabel": "Director",
  "bandLabelAm": "ዳይሬክተር",
  "tierClassification": "Director I",
  "tierClassificationAm": "ዳይሬክተር I",
  "typicalRoles": "...",
  "typicalRolesAm": "...",
  "rankOrder": 19
}
```

**Response (201):**
```json
{ "success": true, "data": { "id": 19 } }
```

**Errors:** `DUPLICATE_GRADE_NUMBER` (409).

**Roles:** `super_admin`, `platform_admin`.

#### PATCH /admin/api/v1/grades/:id

**Request body (any subset):**
```json
{ "isActive": false }
```

**Errors:** `GRADE_HAS_ACTIVE_USERS` (422) if deactivating a grade with active users.

**Roles:** `super_admin`, `platform_admin`.

#### GET /admin/api/v1/staff

List staff accounts. **Roles:** `super_admin` only.

**Query params:** `?page=1&pageSize=50&isActive=true`

**Response:**
```json
{
  "success": true,
  "data": {
    "staff": [
      {
        "id": 1,
        "fullName": "Super Admin",
        "email": "superadmin@lateral.local",
        "roleId": 1,
        "roleName": "super_admin",
        "preferredLanguage": "en",
        "isActive": true,
        "lastLoginAt": "2026-07-18T...",
        "createdAt": "2026-07-01T..."
      }
    ],
    "page": 1,
    "pageSize": 50,
    "totalResults": 1
  }
}
```

#### GET /admin/api/v1/staff/roles

List available roles (for the staff creation form). **Roles:** `super_admin` only.

**Response:**
```json
{
  "success": true,
  "data": {
    "roles": [
      { "id": 1, "name": "super_admin" },
      { "id": 2, "name": "platform_admin" },
      { "id": 3, "name": "finance_officer" },
      { "id": 4, "name": "support_officer" }
    ]
  }
}
```

#### POST /admin/api/v1/staff

Create a new staff account. **Roles:** `super_admin` only.

**Request body:**
```json
{
  "fullName": "Jane Doe",
  "email": "jane@lateral.local",
  "password": "SecurePassword123!",
  "roleName": "platform_admin",
  "preferredLanguage": "en"
}
```

**Response (201):**
```json
{ "success": true, "data": { "id": 5 } }
```

**Errors:** `VALIDATION_FAILED` (400) if `roleName` isn't one of the 4 known roles. `DUPLICATE_NICKNAME` (409) (code reused for duplicate email — would be `DUPLICATE_EMAIL` in a future refactor).

---

### 6.10 Admin user monitoring & reports

#### GET /admin/api/v1/users

Search/list users for monitoring. Phone is masked (SEC-006).

**Query params:** `?q=jane&bankId=1&regionId=16&zoneId=25&gradeId=7&isActive=true&page=1&pageSize=25`

**Response:**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": 42,
        "telegramId": 987654321,
        "telegramUsername": "tester",
        "phone": "+251911***000",
        "bankId": 1,
        "currentLocationId": 25,
        "gradeId": 7,
        "isActive": true,
        "createdAt": "2026-07-18T..."
      }
    ],
    "page": 1,
    "pageSize": 25,
    "totalResults": 1
  }
}
```

**Roles:** all staff (read-only for support).

#### GET /admin/api/v1/users/:id

Per-user monitor view. Returns full phone (SEC-006 — staff callers permitted).

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 42,
    "profile": {
      "bankName": "Commercial Bank of Ethiopia",
      "regionName": "Oromia",
      "zoneName": "East Shewa",
      "branchName": "Adama Main Branch",
      "gradeLabel": "Grade 7 — Officer I",
      "preferredLanguage": "en",
      "isActive": true,
      "createdAt": "2026-07-18T...",
      "phone": "+251911000000"
    },
    "stats": {
      "interestsCount": 3,
      "purchasesMadeCount": 5,
      "purchasesOfMeCount": 2,
      "totalSpentEtb": 2500,
      "totalRevealedByOthersEtb": 1000
    },
    "activity": [
      { "at": "2026-07-18T...", "type": "registration_complete" },
      { "at": "2026-07-17T...", "type": "purchase", "targetUserId": 43, "amountEtb": 500 }
    ]
  }
}
```

**Errors:** `NOT_FOUND` (404).

**Roles:** all staff.

#### PATCH /admin/api/v1/users/:id/status

Activate/deactivate a user.

**Request body:**
```json
{ "isActive": false, "reason": "Spam reports" }
```

**Response:**
```json
{ "success": true, "data": { "userId": 42, "isActive": false } }
```

**Roles:** `super_admin`, `platform_admin`, `support_officer`.

#### POST /admin/api/v1/notifications/broadcast

Send a promotion to a chosen audience (§6.8 of SRS). Enqueues a `broadcast-notifications` fan-out job.

**Request body:**
```json
{
  "segmentFilter": {
    "scope": "all"
  },
  "message": {
    "en": "Maintenance tonight",
    "am": "የጥገና ስራ ዛሬ ማታ"
  }
}
```

`segmentFilter.scope` is one of:
- `"all"` — every active user
- `"bank"` — active users in one bank (requires `bankId`)
- `"region"` — active users whose `current_location_id` resolves under `regionId` (optional `bankId`)
- `"zone"` — active users whose `current_location_id = zoneId` (optional `regionId` for cross-validation)

**Response:**
```json
{
  "success": true,
  "data": { "queuedRecipients": 1234 },
  "message": "Broadcast queued for 1234 recipients."
}
```

**Errors:** `FILTER_INCOMPLETE` (422) if `scope='bank'` without `bankId`, etc. `INVALID_ZONE` (422) if `scope='zone'` but `zoneId` references a region. `ZONE_REGION_MISMATCH` (422) if `zoneId` doesn't belong to `regionId` when both supplied. `EMPTY_SEGMENT` (422) if the segment resolves to zero users.

**Roles:** `super_admin`, `platform_admin`.

#### GET /admin/api/v1/dashboard/summary

Top-line metrics.

**Response:**
```json
{
  "success": true,
  "data": {
    "activeUsers": 1234,
    "totalInterests": 5678,
    "totalPurchases": 90,
    "revenueEtb": 45000
  }
}
```

**Roles:** all staff.

#### GET /admin/api/v1/reports/revenue

Revenue report (overall + per-bank breakdown).

**Query params:** `?from=2026-07-01&to=2026-07-31&bankId=1`

**Response:**
```json
{
  "success": true,
  "data": {
    "revenueEtb": 45000,
    "purchaseCount": 90,
    "byBank": [
      { "bankId": 1, "revenueEtb": 30000, "purchaseCount": 60 },
      { "bankId": 2, "revenueEtb": 15000, "purchaseCount": 30 }
    ]
  }
}
```

**Roles:** `super_admin`, `finance_officer`.

#### GET /admin/api/v1/reports/export?type=revenue&format=xlsx|csv

Export the revenue report. `format=xlsx` returns a real OOXML workbook via `exceljs` (`answers.md` §A) with two sheets (Summary + By Bank), bold/formatted headers, ETB currency formatting, and UTF-8 Amharic-safe rendering. `format=csv` (or omit `format`) returns a lightweight CSV stream.

**Response (xlsx):**
- Status: `200`
- `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- `Content-Disposition: attachment; filename="revenue.xlsx"`
- Body: OOXML binary (starts with `PK\x03\x04` zip magic bytes)

**Response (csv):**
- Status: `200`
- `Content-Type: text/csv`
- `Content-Disposition: attachment; filename="revenue.csv"`
- Body:
  ```
  metric,value
  revenueEtb,45000
  purchaseCount,90
  bank_1_revenueEtb,30000
  bank_2_revenueEtb,15000
  ```

**Roles:** `super_admin`, `finance_officer`.

#### GET /admin/api/v1/system/health

Ops monitoring — DB/Redis/audit-log ping, queue depths. The `auditLog` probe does a synthetic write-and-verify on `audit_logs` (tagged `action='healthcheck'` for cleanup) to catch a broken audit pipeline (`answers.md` §I).

**Response:**
```json
{
  "success": true,
  "data": {
    "mysql": "ok",
    "redis": "ok",
    "auditLog": "ok",
    "activeStaffSessions": 3,
    "queuedNotifications": 12
  }
}
```

**Roles:** all staff.

---

### 6.11 Chapa payment webhook

#### POST /api/v1/webhooks/chapa

Chapa payment confirmation webhook (`answers.md` §1). Unauthenticated — verified via HMAC-SHA256 of the raw body with the shared `CHAPA_WEBHOOK_SECRET`.

The handler:
1. Verifies the `Chapa-Signature` header (timing-safe HMAC comparison).
2. Parses the payload to extract the `tx_ref` (which carries our `purchase:<purchaseId>` identifier), `amount`, `currency`, `status`.
3. Delegates to `purchaseService.handleSuccessfulPayment()` which marks the payment + purchase complete and enqueues the post-processing work (notification + audit) on the `payment-webhook-processing` queue.

**Request headers:**
```
Content-Type: application/json
Chapa-Signature: <hex HMAC-SHA256 of the raw body>
```

**Request body (Chapa success event):**
```json
{
  "event": "charge.success",
  "data": {
    "tx_ref": "purchase:100",
    "amount": "500",
    "currency": "ETB",
    "status": "success",
    "reference": "chapa-ref-abc123"
  }
}
```

**Response (success):**
```json
{ "ok": true }
```

**Response (unknown payload — Chapa shouldn't retry):**
```json
{ "ok": true, "ignored": true }
```

**Response (signature mismatch):**
- Status: `401`
```json
{
  "success": false,
  "error": { "code": "INVALID_TOKEN", "message": "Authentication required." }
}
```

**Idempotency (FR-PAY-002):** if the same `provider_charge_id` (`tx_ref`) is delivered twice, the second delivery is a no-op — the payment row already has `status='completed'`.

---

## 7. Redis Usage

| Key pattern | TTL | Purpose |
|---|---|---|
| `bot:session:{telegramId}` | 24h (`BOT_SESSION_TTL_HOURS`) | Onboarding wizard + interest selection state |
| `feed:{bankId}:{userId}:{locationId}:{adjacencyRange}:{page}` | 30s | Marketplace feed cache (FR-MATCH-007) |
| `lock:purchase:{buyerId}:{targetId}` | 5s | Race-window mutex for double-charge prevention (BR-006) |
| `rl:admin-login:{ipAddress}` | 15min after 5th failure | SEC-005 per-IP admin login lockout |
| `rl:user-feed:{userId}` | 60s | SEC-008 per-user feed rate limit (60 req/min) |
| `rl:user-purchase:{userId}` | 60s | SEC-008 per-user purchase rate limit (10 req/min) |
| `healthz` | 5s | Used by the system-health probe |
| `bull:digest-notifications:*` | — | BullMQ queue (daily digest) |
| `bull:broadcast-notifications:*` | — | BullMQ queue (admin-triggered fan-out) |
| `bull:payment-webhook-processing:*` | — | BullMQ queue (Chapa webhook post-processing) |

**BullMQ queues** (`answers.md` §B):
- `digest-notifications` — daily repeatable job; for each active user, computes "new qualifying interests since last digest" and enqueues a notification-send.
- `broadcast-notifications` — admin-triggered ad hoc fan-out to all users or a filtered segment.
- `payment-webhook-processing` — decouples Chapa webhook receipt (must ack fast) from downstream work (notification send + audit log), with retry/backoff on transient failures.

In test env / no-`REDIS_URL` dev, all the above fall back to in-memory equivalents (cache → `Map`, queues → inline synchronous execution).

---

## 8. Payment Integration (Chapa)

`answers.md` §1 — off-platform Chapa checkout. The bot/Mini App deep-links the user out to a Chapa-hosted checkout page; Chapa's webhook confirms payment back to our `/api/v1/webhooks/chapa` endpoint.

### 8.1 Provider interface

`src/providers/chapa.js` exposes a `ChapaProvider` extending the `PaymentProvider` interface with three methods:

| Method | Purpose |
|---|---|
| `createInvoice({ purchaseId, amountEtb, currency })` | Calls Chapa's `/transaction/initialize` endpoint with the secret key in the `Authorization: Bearer` header. Returns Chapa's `checkout_url`. The `tx_ref` field carries `purchase:<purchaseId>` so the webhook can route the confirmation back to the right purchase. In test env (no secret key), returns a deterministic fake URL. |
| `verifyWebhook(req)` | HMAC-SHA256 verification of the `Chapa-Signature` header against the raw body. Reads the secret fresh from env on each call so tests can toggle it. An empty secret means "no validation" (test default). |
| `parseSuccessfulPayment(payload)` | Extracts `tx_ref` (→ `chargeId`), `amount`, `currency`, and the raw `data` object from Chapa's webhook body. Returns `null` for non-success events. |

### 8.2 Purchase + payment flow

1. **`POST /api/v1/purchases`** — `purchaseService.initiatePurchase()`:
   - Acquires the Redis mutex `lock:purchase:{buyerId}:{targetId}` (5s TTL — closes the race window before the DB constraint applies).
   - Validates: target exists, active, same bank (BR-001).
   - Creates `purchases` row (`revealed_fields` set, `payment_id` NULL).
   - Creates `payments` row (`provider='chapa'`, `status='pending'`, `provider_charge_id` NULL).
   - Calls `provider.createInvoice()` → returns `checkoutUrl`.
   - Returns `{ purchaseId, paymentId, status: 'pending', checkoutUrl }`.

2. **User completes payment on Chapa's hosted page.**

3. **Chapa POSTs to `/api/v1/webhooks/chapa`** — `purchaseService.handleSuccessfulPayment()`:
   - Verifies the HMAC signature.
   - Parses `tx_ref` → `purchaseId`.
   - Idempotency check: if a payment with this `provider_charge_id` already has `status='completed'`, return early (FR-PAY-002).
   - Updates `payments` row: `status='completed'`, `provider_charge_id=tx_ref`, `raw_payload=full Chapa data`.
   - Enqueues a `payment-webhook-processing` job carrying `{ paymentId, purchaseId, chargeId, amountEtb }`.

4. **Worker consumes the `payment-webhook-processing` job** (`src/queues/processors/paymentWebhook.js`):
   - Creates a `payment_confirmation` notification for the buyer.
   - Writes an `audit_logs` row (`action='payment.completed'`).

5. **Next time the buyer loads `/marketplace/feed`**, the candidate's card shows `unlocked: true` and includes the `contact` object (SEC-010 lift).

### 8.3 Why off-platform Chapa (not Telegram Stars)?

Per `answers.md` §1, the accepted trade-off is that the bot/Mini App may not be eligible for listing to mobile users for this digital-goods flow, since it isn't routed through Telegram's native Stars checkout (`sendInvoice`/Bot Payments API). Chapa was chosen as the off-platform provider for local payment method coverage (Ethiopian cards, telebirr, CBE Birr, etc.).

### 8.4 Revealed fields on purchase

Per `answers.md` §3 — all four contact fields ship on reveal:

```json
{
  "telegramUsername": "target_user",
  "phone": "+251911000108",
  "branchName": "Adama Main Branch",
  "neighborhood": "Bole Road"
}
```

The `purchases.revealed_fields` JSON column supports any subset, so this stays config-flippable without a migration if the business wants to reveal fewer fields later.

---

## 9. Notification System (FR-NOT-001…004)

### 9.1 Notification types

| `type` | Trigger | Channel |
|---|---|---|
| `digest` | Daily repeatable job (6:00 AM by default) — per-user summary of new matching interests since `last_digest_at` | telegram |
| `broadcast` | Admin-triggered ad-hoc fan-out (`POST /admin/api/v1/notifications/broadcast`) | telegram |
| `payment_confirmation` | Chapa webhook confirms a successful payment | telegram |
| `registration_confirmation` | (Skipped — the onboarding flow's `profile_created` response IS the confirmation; a separate `notifications` row would be redundant per `answers.md` Part 3) | — |

### 9.2 Daily digest job

`notificationService.runDailyDigest()` is the queue processor body for the `digest-notifications` queue. For each active user, it:

1. Queries `transfer_interests` created since the user's `last_digest_at` whose `location_id` closure-matches the user's `current_location_id`, within their bank and grade adjacency (same predicate as the live feed query per §5).
2. If count > 0: creates a `digest` notification row + updates `last_digest_at`.
3. Returns `{ processedUsers, sentDigests }`.

The scheduler registers the repeatable job on the `digest-notifications` queue using the cron from `DIGEST_SCHEDULE_CRON` (default `0 6 * * *` — 6:00 AM every day, server timezone).

### 9.3 Broadcast fan-out

`notificationService.broadcast()` resolves the recipient user-id list synchronously (a fast read), then enqueues a single `broadcast-notifications` job carrying the resolved list + message. The worker processor inserts one `notifications` row per user.

Segment scopes: `all`, `bank`, `region` (closure-match), `zone` (exact `current_location_id` match).

---

## 10. Security (SEC-001…011)

| Code | Control | Implementation |
|---|---|---|
| SEC-002 | Staff password hashing | `bcryptjs` with 10 rounds |
| SEC-003 | Telegram initData verification | `src/utils/telegramInitData.js` — HMAC-SHA256 validation of `X-Telegram-Init-Data` header on Mini App requests; bot gateway path allowed as trusted fallback |
| SEC-004 | RBAC middleware | `src/middlewares/rbac.js` — `requireRole(...allowedRoles)` reads `req.authPayload.roleName` |
| SEC-005 | Admin login rate limit | Per-IP: 5 failed attempts → 15-min lockout (Redis-backed) |
| SEC-006 | Audit logging | Every sensitive action writes an `audit_logs` row. Phone masked in admin user list view; full phone only on detail view for staff callers. |
| SEC-007 | Webhook integrity | Chapa webhook verified via HMAC-SHA256 of raw body with shared secret (timing-safe comparison) |
| SEC-008 | API rate limiting | `rate-limiter-flexible`: feed 60 req/min per user, purchase 10 req/min per user |
| SEC-009 | Admin idle timeout | 30-min staff access JWT hard expiry (backstop) + 10-min frontend idle logout (`ADMIN_IDLE_TIMEOUT_MINUTES`, documentation-only) + 7-day refresh token (`answers.md` §D) |
| SEC-010 | Contact hiding | Marketplace feed omits `telegramUsername`, `phone`, `branchName`, `neighborhood` until a completed purchase exists |
| SEC-011 | Router-token binding | `scope: 'user'` JWTs rejected on `/admin/api/v1/*` and vice versa — server-side, independent of CORS |

### 10.1 Refresh token security (`answers.md` §D)

- Refresh tokens are **opaque** (not JWTs) — 48 random bytes, base64url-encoded.
- Stored in `staff_refresh_tokens` as a **SHA-256 hash** (never plaintext) — a DB leak doesn't immediately compromise active sessions.
- **Rotation on use**: every `/auth/refresh` call revokes the old refresh token and issues a new one.
- **Reuse detection**: if a revoked token is presented again, ALL tokens for that staff member are revoked (RFC 6749 §10.4 defensive pattern — possible theft).
- **Revocation triggers**: logout (single token), password change (all tokens), staff deactivation via FR-ADM-003 (all tokens), reuse detection (all tokens).

### 10.2 Audit log healthcheck (`answers.md` §I)

`GET /admin/api/v1/system/health` includes an `auditLog` probe that:
1. Does a synthetic `auditService.log({ actorType: 'system', action: 'healthcheck', ... })` write.
2. Verifies the row is readable (catches silent insert failures where the service swallowed the error but didn't actually persist).
3. Reports `'ok'` or `'down'`.

Healthcheck rows are tagged `action='healthcheck'` so a periodic cleanup job can purge them without touching real audit entries.

---

## 11. RBAC Matrix (FR-RBAC-001…003)

| Capability | super_admin | platform_admin | finance_officer | support_officer |
|---|---|---|---|---|
| Manage reference data (banks/locations/grades) | ✅ | ✅ | ❌ | ❌ |
| Manage staff & roles | ✅ | ❌ | ❌ | ❌ |
| Activate/deactivate user accounts | ✅ | ✅ | ❌ | ✅ |
| Send broadcast notifications | ✅ | ✅ | ❌ | ❌ |
| View revenue/payment reports | ✅ | ❌ | ✅ | ❌ |
| View activity/interest reports & monitor users | ✅ | ✅ | ✅ | ✅ (read-only) |
| Dashboard summary | ✅ | ✅ | ✅ | ✅ (read-only) |
| System health | ✅ | ✅ | ✅ | ✅ |

Defined in `src/middlewares/rbac.js` as the `Capabilities` map. Each admin route uses `requireRole(...Capabilities.X)` to enforce.

---

## 12. Non-Functional Implementation Notes

- **Reveal confirmation < 5s of payment confirmation**: the Chapa webhook handler does the minimal synchronous work (mark payment + purchase complete) and defers notification send + audit logging to the `payment-webhook-processing` queue.
- **Payment status reflected within 1 minute**: webhook-driven (push), not polling.
- **99% uptime target**: run `api` behind a load balancer with ≥2 instances; MySQL with automated daily backups (SRS §11 Backup); Redis used only for cache/queue/rate-limit/session state (nothing there is the sole source of truth) so a Redis restart doesn't lose durable data — BullMQ jobs should be safe to replay.
- **Scalability to 1,000+ users**: queue-based fan-out (§7) and closure-table matching (§5) are the two load-bearing scalability decisions in this design.
- **Sub-200ms feed response time**: feed cached in Redis for 30s; closure-table `JOIN` is O(1) per row regardless of hierarchy depth.

---

## 13. Environment Configuration

See [`.env.example`](./.env.example) for the full list with placeholder values and one-line comments per variable. Every variable listed there is actually read by the codebase (the list was built by scanning for `process.env.*` usage, not by guessing).

### 13.1 Critical variables

| Var | Default | Notes |
|---|---|---|
| `NODE_ENV` | `development` | `test` → SQLite in-memory + inline queue fallback; `production` → MySQL + BullMQ workers required |
| `PORT` | `3000` | API server port |
| `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` | — | MySQL connection (dev/prod); ignored in test env |
| `REDIS_URL` | — | Required for `worker` + `scheduler` processes; if unset, the API process falls back to in-memory cache + inline queue execution (dev/test only) |
| `JWT_SECRET` | `dev-jwt-secret-change-me` | **Change in prod** — signs all JWTs + hashes refresh tokens |
| `ADMIN_JWT_EXPIRES_IN` | `30m` | Staff access token hard expiry (SEC-009 backstop) |
| `ADMIN_REFRESH_TOKEN_EXPIRES_IN` | `7d` | Staff refresh token TTL (`answers.md` §D) |
| `ADMIN_IDLE_TIMEOUT_MINUTES` | `10` | Frontend-enforced idle timeout (documentation only — backend doesn't enforce; see `answers.md` §D) |
| `TELEGRAM_BOT_TOKEN` | — | Required for initData verification (SEC-003) |
| `CHAPA_SECRET_KEY` / `CHAPA_PUBLIC_KEY` / `CHAPA_WEBHOOK_SECRET` / `CHAPA_API_BASE` | — | Chapa provider config (`answers.md` §1) |
| `MINIAPP_ORIGIN` / `ADMIN_PWA_ORIGIN` | `*` | CORS origins per router (SEC-011) |
| `DEFAULT_GRADE_ADJACENCY_RANGE` | `1` | BR-003 ±1 rank default |
| `DIGEST_SCHEDULE_CRON` | `0 6 * * *` | Daily digest cron (consumed by `scheduler.js`) |
| `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` | `superadmin@lateral.local` / `ChangeMe123!` | First-run bootstrap |
| `PAYMENT_AMOUNT_ETB` | `500` | Per-reveal price |

### 13.2 Test-only flags

| Var | Notes |
|---|---|
| `TEST_SKIP_INIT_DATA` | Set to `'1'` to skip Telegram initData verification in tests (only honored when `NODE_ENV === 'test'`) |

---

## 14. Deployment Notes

### 14.1 Process topology

Run three separate processes (per §1.1):

```bash
# API server (behind a load balancer, ≥2 instances for HA)
npm start                # or: npm run dev

# BullMQ worker (≥1 instance; scale independently of API)
npm run worker

# Scheduler (single instance — repeatable jobs are idempotent on the repeat key,
# but running multiple schedulers just duplicates the enqueue)
npm run scheduler
```

All three share the same MySQL + Redis instances.

### 14.2 Database setup

```bash
# Create the database (one-time)
mysql -u root -p -e "CREATE DATABASE lateral_transfer CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Run migrations
npm run migrate

# Seed reference data (banks, geography, grades, super admin)
npm run seed
```

### 14.3 Containerization

Per `answers.md` §B, containerize `worker` separately from `api`:

```dockerfile
# API container
CMD ["node", "src/server.js"]

# Worker container
CMD ["node", "src/worker.js"]

# Scheduler container
CMD ["node", "src/scheduler.js"]
```

All three share the same image; only the `CMD` differs.

### 14.4 Health checks

- `GET /healthz` (unauthenticated) — for load balancer liveness probes. Returns `{ ok: true }`.
- `GET /admin/api/v1/system/health` (staff-authenticated) — for ops monitoring. Includes DB/Redis/audit-log status + queue depths.

---

## 15. Localization (i18n)

### 15.1 Reference data translation (schema)

Every reference-data table has parallel English + Amharic columns:

| Table | English column | Amharic column |
|---|---|---|
| `banks` | `name` | `name_am` |
| `locations` | `name` | `name_am` |
| `grades` | `band_label`, `tier_classification`, `typical_roles` | `band_label_am`, `tier_classification_am`, `typical_roles_am` |

All `_am` columns are `NOT NULL` — enforced from day 1 per `backend.md` §16.1 (deployment gate: Amharic strings must be finalized and approved by the business/HR before the initial production seed is run).

### 15.2 Message catalog (API/bot response text)

`src/i18n/en.json` and `src/i18n/am.json` hold the message catalogs. Keys are stable identifiers (`INVALID_CREDENTIALS`, `ZONE_REGION_MISMATCH`, etc.); values are the localized strings.

The `INVALID_CREDENTIALS` message was reworded in `answers.md` §G:

- **English:** `"The email or password you entered is incorrect."`
- **Amharic:** `"የገቡት ኢሜይል ወይም የይለፍ ቃል የተሳሳተ ነው።"` (best-effort draft — see §16)

The phrasing is deliberately generic (doesn't reveal whether the email or the password was wrong) to avoid user enumeration.

### 15.3 Resolving `lang` per request

- **User routes**: `req.user.preferred_language` (set during onboarding, mutable via `PUT /me`).
- **Admin routes**: `req.staff.preferred_language` (set during staff creation).
- **Bot gateway / onboarding**: read from the Redis session (`sess.languageChoice`).
- **Default**: `'en'` if nothing is set.

### 15.4 Notification/broadcast messages

Broadcasts carry both `en` and `am` copies in the `message` field — the client renders whichever matches the user's `preferred_language`. Reference-data names (`bankName`, `zoneName`, etc.) are resolved through the catalog at query time via the `lang` parameter on repository methods.

---

## 16. Known Issues & Translation Review

Per `backend.md` §16.1, Amharic (`name_am`) strings must be finalized and approved by the business/HR before the initial production seed is run. The following items are flagged for translation review:

### 16.1 `INVALID_CREDENTIALS` Amharic (`src/i18n/am.json`)

The new English copy is `"The email or password you entered is incorrect."` (`answers.md` §G). The Amharic string `"የገቡት ኢሜይል ወይም የይለፍ ቃል የተሳሳተ ነው።"` is a best-effort draft — needs review by your translator.

### 16.2 Geography seed Amharic (`src/db/seed_lib/seed-data.geography.json`)

The vendor-supplied 111-zone dataset (`answers.md` §E) did not include Amharic translations. Existing translations from the prior 91-zone seed were reused where names overlapped (~80 zones); the remaining ~30 newly-added zones have best-effort Amharic drafts that need translator review before production seeding.

### 16.3 Pre-existing lint errors (not blocking)

20 `no-unused-vars` errors exist in files unrelated to the `answers.md` decisions (`src/repositories/*`, `src/middlewares/rateLimit.js`, `src/services/reportingService.js`, `src/db/config.js`, `src/utils/logger.js`, `scripts/seed-geography.js`, `tests/matching.ranking.test.js`, `tests/security.test.js`, `tests/setup.js`). These are pre-existing — none were introduced by the `answers.md` changes. They should be cleaned up in a separate maintenance pass.
