# Zwuwur Backend Implementation Guide

Version: 1.2 - Current Implementation State
Date: July 22, 2026
Stack: Express 5, Node.js ESM, MySQL 8, Redis 7, BullMQ, Telegram Bot + Mini App, Admin PWA, pure JavaScript raw SQL via mysql2/promise, local file storage via multer.

---

## 0. Document Purpose and Authority

This document is the practical backend manual for engineers.

It is the implementation source of truth for:

- API endpoints
- database schema
- seed data expectations
- middleware stack
- background jobs
- security rules
- deployment constraints
- testing expectations

### Source of truth

- SRS v1.0 remains the product source of truth for business rules, scope, and acceptance criteria.
- backend-summary.md is treated as the authoritative snapshot of the currently implemented backend.
- Where older backend notes differ from backend-summary.md, this revision favors the implemented backend.

---

## 0.1 Major Corrections from Previous Backend Docs

| # | Area | Older Doc | Current Backend |
|---:|---|---|---|
| 1 | Express version | Generic Express | Express 5 ESM |
| 2 | Marketplace paths | /api/v1/feed and /api/v1/people | /api/v1/marketplace/feed and /api/v1/marketplace/people |
| 3 | Feed cache TTL | 30 seconds | 5 minutes |
| 4 | Bank fields | nickname | alias_en, alias_am, swift_code, year_established_note |
| 5 | Region fields | Basic names | Adds type enum: region, chartered_city |
| 6 | Zone fields | Basic names | Adds note and unique constraints per region |
| 7 | Grade fields | Basic band fields | Adds tier_classification_en and tier_classification_am |
| 8 | Purchases table | Had payment_id FK | Has amount, currency, revealed_fields; payments reference purchase |
| 9 | Payments table | provider_charge_id required, duplicate_ignored | provider_charge_id nullable unique, tx_ref unique, amount check |
| 10 | Broadcasts | Not fully modeled | Dedicated broadcasts table |
| 11 | Notifications | Basic sent_at model | Adds broadcast_id and status enum |
| 12 | Staff | Had preferred_language | Current summary does not include staff preferred_language |
| 13 | Users | Had last_digest_at | Current summary exposes last_activity_at; no dedicated last_digest_at in summary |
| 14 | Queues | Multiple queues | Active queues: telegram-send and digest-notifications |
| 15 | Payment providers | Chapa and Telebirr equal | Chapa active, Telebirr stub |
| 16 | Health endpoints | /healthz only | /healthz, /health, /livez |
| 17 | Admin auth | No /me | Adds GET /admin/api/v1/auth/me |
| 18 | Seed banks | Older 31-bank list | Current list includes Tsehay Bank and excludes Debub Global Bank |
| 19 | Seed grades | Not fully documented | 18 grades, 6 bands, labels and tier classifications |
| 20 | Production guardrails | Partial | Startup fails on dev secrets, weak DB password, weak super admin password |

---

## 1. Architecture Overview

### 1.1 Runtime processes

Run three separate Node.js processes in production:

| Process | Entry point | Purpose |
|---|---|---|
| API | src/server.js | HTTP server for Mini App, Admin PWA, Telegram webhook, payment webhooks |
| Worker | src/worker.js | BullMQ worker process |
| Scheduler | src/scheduler.js | Registers repeatable cron jobs, currently daily digest |

For MVP, all three may run on one host.

Because photos are stored locally, the API should run as:

- a single instance for MVP, or
- multiple instances only if they share a persistent /avatars volume and static files are served consistently.

### 1.2 Runtime stack

- Node.js 20+ LTS
- JavaScript only, no TypeScript
- ES Modules: package.json type module
- Express 5
- MySQL 8 via mysql2/promise
- Redis 7 via ioredis
- BullMQ for background jobs
- Zod for validation
- Pino for logging
- JWT via jsonwebtoken
- Password hashing via @node-rs/bcrypt
- Multer for local avatar uploads
- Vitest + Supertest + Testcontainers for tests

---

## 2. Repository Structure

Current implemented structure:

    backend/
      src/
        app.js
        server.js
        worker.js
        scheduler.js
        config/
          env.js
        db/
          pool.js
          migrate.js
          migrations/
            001_init.sql
        lib/
          logger.js
          redis.js
          http.js
          errors.js
          dbErrors.js
          telegram.js
          telegramInitData.js
          telegramPhoto.js
          adminTokens.js
          userTokens.js
          pagination.js
          audit.js
        middleware/
          auth.js
          userAuth.js
          errorHandler.js
          validate.js
          security.js
          rateLimit.js
          purchaseRateLimit.js
          marketplaceRateLimit.js
          verifyChapaSignature.js
        modules/
          admin/
            auth/
            reference/
            management/
            broadcast/
          onboarding/
          telegram/
          user/
          interests/
          marketplace/
          purchases/
          notifications/
          webhooks/
        queues/
          index.js
          processors/
            telegramSend.js
        seed/
          index.js
          data/
            banks.js
            regions.js
            zones.js
            grades.js
      tests/
      storage/avatars/
      docs/
      package.json
      vitest.config.js
      eslint.config.js
      docker-compose.yml
      .env.example

---

## 3. Environment Configuration

All environment variables are validated via Zod in src/config/env.js.

### 3.1 Core

| Variable | Default | Description |
|---|---:|---|
| NODE_ENV | development | development, test, or production |
| PORT | 3000 | HTTP server port |
| BASE_URL | http://localhost:3000 | Public API base URL |
| LOG_LEVEL | info | Pino log level |
| CORS_ORIGIN | * | CORS allowed origin |

### 3.2 MySQL

| Variable | Default | Description |
|---|---:|---|
| DB_HOST | 127.0.0.1 | MySQL host |
| DB_PORT | 3306 | MySQL port |
| DB_USER | zwuwur | MySQL user |
| DB_PASSWORD | changeme | MySQL password |
| DB_NAME | zwuwur | Database name |
| DB_CONNECTION_LIMIT | 10 | Pool connection limit |

### 3.3 Redis

| Variable | Default | Description |
|---|---:|---|
| REDIS_URL | redis://127.0.0.1:6379 | Redis connection URL |

### 3.4 JWT and session secrets

| Variable | Default | Description |
|---|---:|---|
| USER_JWT_SECRET | dev-user-secret-change-me | User JWT secret |
| USER_JWT_EXPIRES_IN | 30d | User JWT expiry |
| ADMIN_ACCESS_TOKEN_SECRET | dev-admin-secret-change-me | Admin access token secret |
| ADMIN_ACCESS_TOKEN_EXPIRES_IN | 15m | Admin access token expiry |
| ADMIN_REFRESH_TOKEN_EXPIRES_IN | 7d | Admin refresh token expiry |

### 3.5 Telegram

| Variable | Default | Description |
|---|---:|---|
| TELEGRAM_BOT_TOKEN | dev-telegram-token | Telegram bot token |
| TELEGRAM_WEBHOOK_SECRET | dev-telegram-webhook-secret | Webhook secret |
| MINI_APP_URL | https://t.me/zwuwur_bot/app | Mini App deep link |

### 3.6 Payments

| Variable | Default | Description |
|---|---:|---|
| PAYMENT_PROVIDER | chapa | chapa or telebirr |
| CHAPA_SECRET_KEY | dev-chapa-secret | Chapa API key |
| CHAPA_WEBHOOK_SECRET | dev-chapa-webhook-secret | Chapa webhook secret |
| CHAPA_BASE_URL | https://api.chapa.co/v1 | Chapa API base |
| CURRENCY | ETB | Default currency |
| REVEAL_PRICE_ETB | 500 | Contact reveal price |

Telebirr remains adapter-ready/stubbed in the current implementation.

### 3.7 Digest and notifications

| Variable | Default | Description |
|---|---:|---|
| DIGEST_CRON | 0 6 * * * | Daily digest cron |
| DIGEST_TIMEZONE | Africa/Addis_Ababa | Digest timezone |

### 3.8 Super admin bootstrap

| Variable | Default | Description |
|---|---:|---|
| SUPER_ADMIN_EMAIL | admin@zwuwur.app | Bootstrap super admin email |
| SUPER_ADMIN_PASSWORD | ChangeMe123! | Bootstrap super admin password |
| SUPER_ADMIN_FULL_NAME | Root Admin | Bootstrap super admin name |

### 3.9 Uploads and assets

| Variable | Default | Description |
|---|---:|---|
| AVATAR_STORAGE_DIR | ./storage/avatars | Avatar file path |
| MAX_UPLOAD_MB | 5 | Max upload size |
| PUBLIC_ASSET_BASE_URL | http://localhost:3000 | Public asset URL |

### 3.10 Production guardrails

In NODE_ENV=production, startup must fail if:

- any secret starts with dev-
- DB_PASSWORD is changeme
- SUPER_ADMIN_PASSWORD is ChangeMe123!

This prevents accidental production deployment with development defaults.

---

## 4. Database Design

### 4.1 General rules

- MySQL 8
- InnoDB
- charset utf8mb4
- collation utf8mb4_unicode_ci
- raw SQL migrations, no ORM
- BIGINT UNSIGNED for user-facing IDs
- INT UNSIGNED for reference data IDs
- empty strings normalized to NULL in application code before insert/update
- reference data uses is_active soft deactivation
- reference data is not hard-deleted while referenced

Canonical schema file:

    src/db/migrations/001_init.sql

The migration is idempotent and creates the full schema.

### 4.2 Business tables

The current implementation has 13 core business tables:

1. banks
2. regions
3. zones
4. grades
5. users
6. transfer_interests
7. purchases
8. payments
9. staff
10. broadcasts
11. notifications
12. staff_refresh_tokens
13. audit_logs

A schema_migrations table is also used by the migration runner.

---

## 4.3 Table Summary

### banks

| Column | Type | Notes |
|---|---|---|
| id | INT UNSIGNED | PK AUTO_INCREMENT |
| name_en | VARCHAR(191) | UNIQUE |
| name_am | VARCHAR(191) | UNIQUE |
| alias_en | VARCHAR(90) | UNIQUE |
| alias_am | VARCHAR(90) | UNIQUE |
| swift_code | VARCHAR(12) | NULL UNIQUE |
| year_established | SMALLINT UNSIGNED | NULL |
| year_established_note | VARCHAR(191) | NULL |
| is_active | BOOLEAN | DEFAULT TRUE |

### regions

| Column | Type | Notes |
|---|---|---|
| id | INT UNSIGNED | PK AUTO_INCREMENT |
| name_en | VARCHAR(150) | UNIQUE |
| name_am | VARCHAR(150) | UNIQUE |
| type | ENUM('region','chartered_city') | DEFAULT 'region' |
| is_active | BOOLEAN | DEFAULT TRUE |

### zones

| Column | Type | Notes |
|---|---|---|
| id | INT UNSIGNED | PK AUTO_INCREMENT |
| region_id | INT UNSIGNED | FK -> regions(id) |
| name_en | VARCHAR(150) | UNIQUE(region_id, name_en) |
| name_am | VARCHAR(150) | UNIQUE(region_id, name_am) |
| note | VARCHAR(255) | NULL |
| is_active | BOOLEAN | DEFAULT TRUE |

### grades

| Column | Type | Notes |
|---|---|---|
| id | INT UNSIGNED | PK AUTO_INCREMENT |
| grade_number | TINYINT UNSIGNED | UNIQUE, 1-18 |
| band_number | TINYINT UNSIGNED | 1-6, CEIL(grade_number / 3) |
| band_label_en | VARCHAR(80) |  |
| band_label_am | VARCHAR(80) |  |
| tier_classification_en | VARCHAR(80) |  |
| tier_classification_am | VARCHAR(80) |  |
| rank_order | TINYINT UNSIGNED | UNIQUE |
| is_active | BOOLEAN | DEFAULT TRUE |

### users

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED | PK AUTO_INCREMENT |
| telegram_id | BIGINT UNSIGNED | UNIQUE |
| telegram_username | VARCHAR(64) | NULL |
| phone_number | VARCHAR(20) | UNIQUE(bank_id, phone_number) |
| bank_id | INT UNSIGNED | FK -> banks(id) |
| region_id | INT UNSIGNED | FK -> regions(id) |
| zone_id | INT UNSIGNED | FK -> zones(id) |
| grade_id | INT UNSIGNED | NULL FK -> grades(id) |
| full_name_en | VARCHAR(150) | NULL |
| full_name_am | VARCHAR(150) | NULL |
| branch_name_en | VARCHAR(150) | NULL |
| branch_name_am | VARCHAR(150) | NULL |
| neighborhood_en | VARCHAR(150) | NULL |
| neighborhood_am | VARCHAR(150) | NULL |
| photo_url | VARCHAR(500) | NULL |
| photo_source | ENUM('telegram','custom','placeholder') | DEFAULT 'placeholder' |
| preferred_language | ENUM('en','am') | DEFAULT 'en' |
| is_active | BOOLEAN | DEFAULT TRUE |
| profile_completed_at | DATETIME | NULL |
| last_activity_at | DATETIME | NULL |

### transfer_interests

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED | PK AUTO_INCREMENT |
| user_id | BIGINT UNSIGNED | FK -> users(id) ON DELETE CASCADE |
| region_id | INT UNSIGNED | FK -> regions(id) |
| zone_id | INT UNSIGNED | NULL FK -> zones(id) |
| UNIQUE |  | (user_id, region_id, zone_id) |

zone_id IS NULL means a broad region-level interest.

### purchases

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED | PK AUTO_INCREMENT |
| buyer_id | BIGINT UNSIGNED | FK -> users(id) |
| target_user_id | BIGINT UNSIGNED | FK -> users(id) |
| status | ENUM('pending','completed') | DEFAULT 'pending' |
| amount | DECIMAL(10,2) | NULL |
| currency | CHAR(3) | NULL |
| revealed_fields | JSON | NULL |
| UNIQUE |  | (buyer_id, target_user_id) |

The unique buyer/target pair prevents duplicate purchases and double charging.

### payments

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED | PK AUTO_INCREMENT |
| purchase_id | BIGINT UNSIGNED | FK -> purchases(id) |
| provider | ENUM('chapa','telebirr') |  |
| provider_charge_id | VARCHAR(191) | NULL UNIQUE |
| tx_ref | VARCHAR(191) | UNIQUE |
| amount | DECIMAL(10,2) | CHECK amount > 0 |
| currency | CHAR(3) | DEFAULT 'ETB' |
| status | ENUM('pending','completed','failed','refunded') | DEFAULT 'pending' |
| raw_payload | JSON | NULL |

### staff

| Column | Type | Notes |
|---|---|---|
| id | INT UNSIGNED | PK AUTO_INCREMENT |
| full_name | VARCHAR(150) |  |
| email | VARCHAR(150) | UNIQUE |
| password_hash | VARCHAR(255) |  |
| role | ENUM('super_admin','admin') |  |
| is_active | BOOLEAN | DEFAULT TRUE |
| last_login_at | DATETIME | NULL |

### broadcasts

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED | PK AUTO_INCREMENT |
| staff_id | INT UNSIGNED | FK -> staff(id) |
| scope | ENUM('all','bank','region','zone') | DEFAULT 'all' |
| message_en | TEXT |  |
| message_am | TEXT |  |
| recipient_count | INT UNSIGNED | DEFAULT 0 |
| status | ENUM('queued','sending','sent','failed') | DEFAULT 'queued' |

### notifications

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED | PK AUTO_INCREMENT |
| user_id | BIGINT UNSIGNED | FK -> users(id) ON DELETE CASCADE |
| broadcast_id | BIGINT UNSIGNED | NULL FK -> broadcasts(id) |
| type | ENUM('digest','broadcast','payment_confirmation','profile_nudge') |  |
| payload | JSON | NULL |
| status | ENUM('queued','sent','failed') | DEFAULT 'queued' |

### staff_refresh_tokens

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED | PK AUTO_INCREMENT |
| staff_id | INT UNSIGNED | FK -> staff(id) ON DELETE CASCADE |
| token_hash | CHAR(64) | UNIQUE, SHA-256 hex |
| expires_at | DATETIME |  |
| revoked_at | DATETIME | NULL |

### audit_logs

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED | PK AUTO_INCREMENT |
| actor_type | ENUM('staff','user','system') |  |
| actor_id | BIGINT UNSIGNED | NULL |
| action | VARCHAR(100) |  |
| entity_type | VARCHAR(100) | NULL |
| entity_id | BIGINT UNSIGNED | NULL |
| metadata | JSON | NULL |

### schema_migrations

| Column | Type | Notes |
|---|---|---|
| name | VARCHAR(191) | PK |
| applied_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |

---

## 5. Seed Data

Seed order:

    banks -> regions -> zones -> grades -> super admin

All seed operations are idempotent using INSERT ... ON DUPLICATE KEY UPDATE.

### 5.1 Seed counts

| Entity | Count |
|---|---:|
| Banks | 31 |
| Regions / chartered cities | 14 |
| Zones / subcities / special woredas | 111 |
| Grades | 18 |
| Bands | 6 |
| Super admin | 1 bootstrap account |

### 5.2 Current bank list

The current backend seed includes:

1. Commercial Bank of Ethiopia
2. Awash Bank
3. Dashen Bank
4. Bank of Abyssinia
5. Wegagen Bank
6. Hibret Bank
7. Nib International Bank
8. Cooperative Bank of Oromia
9. Lion International Bank
10. Zemen Bank
11. Oromia International Bank
12. Bunna Bank
13. Berhan Bank
14. Abay Bank
15. Addis International Bank
16. Enat Bank
17. Global Bank Ethiopia
18. Zamzam Bank
19. Hijra Bank
20. Goh Betoch Bank
21. Siinqee Bank
22. Ahadu Bank
23. Amhara Bank
24. Tsehay Bank
25. Gadaa Bank
26. Tsedey Bank
27. Sidama Bank
28. Omo Bank
29. Shabelle Bank
30. Rammis Bank
31. Siket Bank

Debub Global Bank is not part of the current active 31-bank seed list.

### 5.3 Regions

14 regions and chartered cities are seeded:

- Addis Ababa
- Dire Dawa
- Oromia
- Amhara
- Tigray
- Somali
- Sidama
- South West Ethiopia Peoples'
- South Ethiopia
- Central Ethiopia
- Afar
- Benishangul-Gumuz
- Gambela
- Harari

### 5.4 Zones

111 zones/subcities/special woredas are seeded.

Special rules:

- Addis Ababa zones are subcities.
- Dire Dawa has urban and rural subdivisions.
- Finfinne Special Zone Surrounding Oromia is inactive by default.
- Amharic names require production translator review.

### 5.5 Grades

18 grades are seeded in 6 bands of 3.

| Band | Grades | Label EN |
|---:|---:|---|
| 1 | 1-3 | Support |
| 2 | 4-6 | Associate |
| 3 | 7-9 | Senior |
| 4 | 10-12 | Manager |
| 5 | 13-15 | Director |
| 6 | 16-18 | Executive |

Band formula:

    band_number = CEIL(grade_number / 3)

### 5.6 Super admin

A bootstrap super admin is created from environment variables:

- SUPER_ADMIN_EMAIL
- SUPER_ADMIN_PASSWORD
- SUPER_ADMIN_FULL_NAME

The seeder skips creation if the super admin already exists.

---

## 6. Authentication and Authorization

### 6.1 User authentication

Users enter through Telegram.

Two main entry points:

1. Telegram Bot onboarding
2. Telegram Mini App authentication via initData

Mini App auth flow:

    POST /api/v1/auth/telegram

The backend verifies Telegram WebApp initData using HMAC-SHA256.

Recommended max auth_date age: 24 hours.

If valid, the backend issues a user JWT.

User JWT expiry:

    USER_JWT_EXPIRES_IN=30d

### 6.2 Admin authentication

Admin PWA users authenticate with email and password.

Passwords are hashed with bcrypt.

Admin session uses:

- short-lived access token
- rotating opaque refresh token
- refresh token stored as SHA-256 hash

Access token expiry:

    ADMIN_ACCESS_TOKEN_EXPIRES_IN=15m

Refresh token expiry:

    ADMIN_REFRESH_TOKEN_EXPIRES_IN=7d

Refresh token reuse detection should revoke all active refresh tokens for that staff account.

### 6.3 Token scope enforcement

User tokens must be rejected on admin routes.

Admin tokens must be rejected on user routes.

### 6.4 RBAC roles

Roles:

- super_admin
- admin
- implicit user

| Capability | super_admin | admin |
|---|---:|---:|
| Manage banks / regions / zones / grades | Yes | Yes |
| Manage staff | Yes | No |
| Activate/deactivate users | Yes | Yes |
| Send broadcasts | Yes | Yes |
| View reports | Yes | Yes |
| View dashboard | Yes | Yes |
| View system health | Yes | Yes |

---

## 7. API Conventions

### 7.1 Base URLs

| Router | Base URL |
|---|---|
| User / Mini App | /api/v1 |
| Admin PWA | /admin/api/v1 |
| Telegram webhook | /api/v1/telegram/webhook |
| Chapa webhook | /api/v1/webhooks/chapa |

### 7.2 Response envelope

Success:

    {
      success: true,
      data: {}
    }

Error:

    {
      success: false,
      error: {
        code: MACHINE_READABLE_CODE,
        message: Human-readable message
      }
    }

### 7.3 HTTP status codes

| Status | Meaning |
|---:|---|
| 200 | Success |
| 201 | Created |
| 400 | Validation failed |
| 401 | Unauthorized / invalid token / invalid credentials |
| 403 | Forbidden / disabled / rate limited |
| 404 | Not found |
| 409 | Conflict / already purchased / duplicate |
| 422 | Business rule violation |
| 500 | Internal error |

### 7.4 Common error codes

- VALIDATION_FAILED
- NOT_FOUND
- INVALID_TOKEN
- SCOPE_FORBIDDEN
- ACCOUNT_DISABLED
- INSUFFICIENT_ROLE
- RATE_LIMITED
- BANK_CHANGE_UNSUPPORTED
- ZONE_REGION_MISMATCH
- PROFILE_INCOMPLETE
- DUPLICATE_PHONE_BANK
- CONTACT_NOT_SELF
- ALREADY_PURCHASED
- TARGET_INACTIVE
- INTEREST_LIMIT_EXCEEDED
- BROAD_WITH_ZONES_NOT_ALLOWED
- EMPTY_SEGMENT
- INVALID_SIGNATURE

---

## 8. Implemented API Endpoints

### 8.1 Health

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /healthz | Public | Health check |
| GET | /health | Public | Health check |
| GET | /livez | Public | Liveness check |

### 8.2 Admin auth

Base:

    /admin/api/v1/auth

| Method | Path | Middleware | Description |
|---|---|---|---|
| POST | /login | adminLoginRateLimit, validate(loginSchema) | Staff login |
| POST | /refresh | validate(refreshTokenSchema) | Rotate refresh token |
| POST | /logout | validate(logoutSchema) | Revoke refresh token |
| GET | /me | authenticateStaff | Current staff profile |

### 8.3 Admin broadcast

Base:

    /admin/api/v1/notifications

| Method | Path | Middleware | Description |
|---|---|---|---|
| POST | /broadcast | authenticateStaff, validate(broadcastSchema) | Send broadcast notification |

Supported scopes:

- all
- bank
- region
- zone

Broadcast messages must be bilingual:

- message_en
- message_am

### 8.4 Admin management

Base:

    /admin/api/v1

| Method | Path | Middleware | Description |
|---|---|---|---|
| GET | /dashboard/summary | authenticateStaff | Dashboard stats |
| GET | /users | authenticateStaff, validate(userListSchema) | List users, paginated |
| GET | /users/:id | authenticateStaff, validate(userIdParamSchema) | User detail |
| PATCH | /users/:id/status | authenticateStaff, validate(userStatusSchema) | Activate/deactivate user |
| GET | /staff | authenticateStaff, requireRole('super_admin') | List admin staff |
| POST | /staff | authenticateStaff, requireRole('super_admin') | Create staff |
| PATCH | /staff/:id | authenticateStaff, requireRole('super_admin') | Update staff |
| GET | /reports/revenue | authenticateStaff, validate(reportQuerySchema) | Revenue report |
| GET | /reports/users | authenticateStaff, validate(reportQuerySchema) | User registration/activity report |
| GET | /reports/interests | authenticateStaff, validate(reportQuerySchema) | Interest trends report |
| GET | /system/health | authenticateStaff | System health check |

### 8.5 Admin reference data

Banks, regions, zones, and grades each follow the same CRUD pattern:

| Method | Path | Description |
|---|---|---|
| GET | /banks | List banks |
| POST | /banks | Create bank |
| PATCH | /banks/:id | Update bank |
| GET | /regions | List regions |
| POST | /regions | Create region |
| PATCH | /regions/:id | Update region |
| GET | /zones | List zones |
| POST | /zones | Create zone |
| PATCH | /zones/:id | Update zone |
| GET | /grades | List grades |
| POST | /grades | Create grade |
| PATCH | /grades/:id | Update grade |

All reference routes require staff authentication.

Reference data is not hard-deleted. Deactivation is blocked while active users, interests, or child reference data depend on it.

### 8.6 Onboarding

Base:

    /api/v1/onboarding

8-step Telegram bot onboarding flow:

| Method | Path | Middleware | Description |
|---|---|---|---|
| POST | /start | validate(startSchema) | Initialize session |
| POST | /language | validate(languageSchema) | Choose language |
| POST | /contact | validate(contactSchema) | Share phone number |
| POST | /bank | validate(bankSchema) | Select bank |
| POST | /region | validate(regionSchema) | Select region |
| POST | /zone | validate(zoneSchema) | Select zone/subcity |
| POST | /otp/request | validate(otpRequestSchema) | Request SMS verification |
| POST | /otp/verify | validate(otpVerifySchema) | Verify OTP and create user |

OTP is a fallback stub in non-production environments.

Bot onboarding collects only:

- language
- phone
- bank
- region
- zone

All remaining profile fields are completed in the Mini App.

### 8.7 Telegram webhook

| Method | Path | Middleware | Description |
|---|---|---|---|
| POST | /api/v1/telegram/webhook | secret token verification | Handles bot updates, currently /start |

The webhook secret is compared using a constant-time comparison.

Heavy work is queued rather than processed inline.

### 8.8 User auth and profile

Base:

    /api/v1

| Method | Path | Middleware | Description |
|---|---|---|---|
| POST | /auth/telegram | validate(telegramAuthSchema) | Verify initData |
| POST | /auth/issue-token | validate(issueTokenSchema) | Issue JWT for Mini App |
| GET | /me | authenticateUser | Current user profile |
| PUT | /me | authenticateUser, validate(updateProfileSchema) | Update profile |
| GET | /me/completeness | authenticateUser | Profile completion and nudge state |
| POST | /me/photo | authenticateUser, multer | Upload avatar |
| DELETE | /me/photo | authenticateUser | Delete avatar |

### 8.9 Interests

Base:

    /api/v1/interests

| Method | Path | Middleware | Description |
|---|---|---|---|
| GET | /me | authenticateUser | User's transfer interests |
| GET | /options | authenticateUser, validate(optionsQuerySchema) | Available options, filtered |
| PUT | /me | authenticateUser, validate(saveInterestsSchema) | Save interests |
| DELETE | /:id | authenticateUser, validate(interestIdParamSchema) | Remove an interest |

Interest constraints:

- max 3 regions
- max 3 zones per region
- selecting a zone implies its parent region
- a region may be selected without zones as a broad interest
- a broad region interest should not coexist with zone interests for the same region

### 8.10 Marketplace

Base:

    /api/v1/marketplace

| Method | Path | Middleware | Description |
|---|---|---|---|
| GET | /feed | authenticateUser, userFeedRateLimit, validate(feedQuerySchema) | Candidates wanting the viewer's area |
| GET | /people | authenticateUser, userPeopleRateLimit, validate(peopleQuerySchema) | Candidates in the viewer's desired areas |

Both endpoints use:

- Redis caching with 5-minute TTL
- same-bank matching
- complete-profile gating
- active-user filtering
- grade band proximity matching
- mutual interest detection
- card serialization with paywalled fields masked as asterisk

### 8.11 Purchases

Base:

    /api/v1/purchases

| Method | Path | Middleware | Description |
|---|---|---|---|
| POST | / | authenticateUser, purchaseRateLimit, validate(createPurchaseSchema) | Initiate purchase and payment |
| GET | /me | authenticateUser, validate(listPurchasesSchema) | User's purchase history |

Purchase rate limit:

    10 requests/min per user

Purchase rules:

- buyer must be complete and active
- target must exist, be active, be complete, and be in the same bank
- completed purchase is permanent for buyer/target pair
- buyer is never charged twice for the same target
- pending payment may be reused if still valid
- completed purchase reveals contact fields

### 8.12 Notifications

Base:

    /api/v1/notifications

| Method | Path | Middleware | Description |
|---|---|---|---|
| GET | /me | authenticateUser, validate(listNotificationsSchema) | User notifications |

Notification types:

- digest
- broadcast
- payment_confirmation
- profile_nudge

Notification delivery is Telegram-only.

### 8.13 External webhooks

| Method | Path | Middleware | Description |
|---|---|---|---|
| POST | /api/v1/webhooks/chapa | verifyChapaSignature | Chapa payment callback |

Telebirr is stub/adapter-ready but not exposed as an active production webhook in the current implementation.

### 8.14 Static files

| Path | Description |
|---|---|
| /avatars | Static file serving for uploaded avatars |

---

## 9. Middleware Stack

### 9.1 Global middleware

Applied in order in src/app.js:

1. requestId
2. securityHeaders
3. cors
4. express.json with 1mb limit
5. express.urlencoded with 1mb limit

requestId adds:

    X-Request-Id: uuid

Security headers include:

- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- HSTS
- CSP
- related hardening headers

CORS allows:

- Telegram web app origins
- localhost development origins
- configured origins

### 9.2 Route-level middleware

| Middleware | Purpose |
|---|---|
| authenticateStaff | Bearer JWT -> req.auth, req.staff |
| requireRole(...roles) | super_admin or admin |
| authenticateUser | Bearer JWT + DB lookup -> req.user |
| validate(schema, source) | Zod validation -> req.validated |
| adminLoginRateLimit | 5 attempts / 15 min per IP |
| purchaseRateLimit | 10 req/min per user |
| userFeedRateLimit | 60 req/min per user |
| userPeopleRateLimit | 60 req/min per user |
| verifyChapaSignature | Chapa webhook HMAC verification |

### 9.3 Error handlers

Terminal middleware:

| Handler | Purpose |
|---|---|
| notFoundHandler | 404 JSON response |
| errorHandler | Centralized error JSON response |

---

## 10. Marketplace Matching Engine

### 10.1 Core matching rules

Matching must never cross bank boundaries.

A candidate appears in the viewer's Feed when:

- candidate is not the viewer
- candidate is active
- candidate has a complete profile
- candidate belongs to the same bank
- candidate grade is within +/-1 band of viewer grade
- candidate has expressed interest in:
  - viewer's zone, zone-level match, or
  - viewer's region with zone_id IS NULL, region-broad match

### 10.2 Feed ranking

Feed ranking order:

1. mutual matches first
2. match specificity: zone-level above region-broad
3. grade proximity: smaller grade distance first
4. interest recency

This produces progressive broadening:

- zone-level matches appear first
- region-broad matches appear later
- feed does not empty while any candidate wants the viewer's region

### 10.3 People tab

People tab shows candidates located in the viewer's desired areas.

A candidate qualifies when:

- same bank
- active
- complete profile
- grade within +/-1 band
- viewer has an interest in:
  - candidate's zone, or
  - candidate's region broadly

People ranking:

1. grade proximity
2. recency

If viewer has no interests, return an empty state prompting the user to add interests.

---

## 11. Paywall Masking Contract

The backend is the single source of truth for reveal state.

The frontend is a dumb renderer.

For unpurchased candidates, paywalled fields must be returned as asterisk.

Paywalled fields:

- full_name_en
- full_name_am
- branch_name_en
- branch_name_am
- neighborhood_en
- neighborhood_am
- phone_number
- telegram_username

Public fields:

- photo_url
- grade information
- region information
- zone information
- match_type
- is_mutual
- purchased

Photo is never paywalled and never masked.

---

## 12. Purchases and Payments

### 12.1 Reveal price

Default reveal price:

    REVEAL_PRICE_ETB=500

Currency:

    CURRENCY=ETB

### 12.2 Purchase creation

Endpoint:

    POST /api/v1/purchases

Rules:

- buyer must be complete and active
- target must be complete, active, same bank
- if completed purchase exists: return 409 ALREADY_PURCHASED
- if valid pending payment exists: return existing checkout URL
- otherwise create new payment attempt

### 12.3 Provider design

Payment integration is provider-agnostic.

Active provider:

    Chapa

Stub/adapter-ready provider:

    Telebirr

### 12.4 Chapa checkout

Create invoice using:

- CHAPA_SECRET_KEY
- CHAPA_BASE_URL

Recommended tx_ref:

    zwuwur-payment-{paymentId}

This allows webhook resolution to the exact payment attempt.

### 12.5 Chapa webhook

Endpoint:

    POST /api/v1/webhooks/chapa

Handler must:

1. verify HMAC signature using raw body
2. parse payload
3. extract tx_ref, amount, currency, status, provider reference
4. load payment by tx_ref or provider_charge_id
5. validate amount and currency
6. mark payment completed if not already completed
7. complete associated purchase if not already completed
8. snapshot revealed fields into purchases.revealed_fields
9. enqueue payment confirmation notification
10. respond quickly with 200 OK

### 12.6 Idempotency

Idempotency is enforced through:

- unique payments.tx_ref
- nullable unique payments.provider_charge_id
- unique purchases(buyer_id, target_user_id)
- purchase status transition guard
- payment status transition guard

Repeated webhook delivery must not:

- reveal twice
- charge twice
- create duplicate notifications
- double-count revenue

### 12.7 Payment statuses

- pending
- completed
- failed
- refunded

---

## 13. Notifications

### 13.1 Notification types

| Type | Trigger |
|---|---|
| digest | daily digest job |
| broadcast | admin broadcast |
| payment_confirmation | successful payment |
| profile_nudge | incomplete profile reminder |

### 13.2 Delivery channel

All notifications are delivered via Telegram Bot API.

No email.

No SMS.

### 13.3 Daily digest

Scheduler registers a repeatable BullMQ job using:

    DIGEST_CRON=0 6 * * *
    DIGEST_TIMEZONE=Africa/Addis_Ababa

Digest behavior:

- runs daily
- finds new qualifying interests for active complete users
- uses same-bank and grade-adjacency rules
- creates notification rows
- sends Telegram messages through the telegram-send queue

### 13.4 Broadcasts

Admin broadcast endpoint:

    POST /admin/api/v1/notifications/broadcast

Scopes:

- all
- bank
- region
- zone

Broadcast row stores:

- staff author
- scope
- bilingual message
- recipient count
- status

Broadcast statuses:

- queued
- sending
- sent
- failed

Notification statuses:

- queued
- sent
- failed

---

## 14. Redis Usage

Current implementation uses Redis for:

- marketplace caching
- rate limiting
- bot onboarding sessions
- distributed locks
- BullMQ queues

Recommended key patterns:

| Key pattern | TTL | Purpose |
|---|---:|---|
| bot:session:{telegramId} | 24h | bot onboarding state |
| cache:marketplace:feed:{userId}:{page}:{pageSize} | 5m | feed cache |
| cache:marketplace:people:{userId}:{page}:{pageSize} | 5m | people cache |
| lock:purchase:{buyerId}:{targetId} | 5s | purchase race lock |
| rl:admin-login:{ip} | 15m | admin login lockout |
| rl:user-feed:{userId} | 60s | feed rate limit |
| rl:user-people:{userId} | 60s | people rate limit |
| rl:user-purchase:{userId} | 60s | purchase rate limit |
| bull:* | - | queues |

fresh=true should bypass marketplace cache where supported.

---

## 15. BullMQ Queues

Current active queues:

| Queue | Worker | Description |
|---|---|---|
| telegram-send | telegramSend.js | Sends Telegram messages asynchronously |
| digest-notifications | scheduler-triggered processing | Daily digest job |

Worker process:

    npm run dev:worker

Scheduler process:

    npm run dev:scheduler

---

## 16. Photo Management

### 16.1 Telegram photo auto-fetch

On user creation, the system should fetch the user's Telegram profile photo using:

- getUserProfilePhotos
- getFile

The photo is downloaded and stored locally:

    storage/avatars/{userId}-telegram.jpg

Then:

    photo_source = 'telegram'

If no Telegram photo exists:

    photo_source = 'placeholder'
    photo_url = NULL

Photo fetching runs in the background queue, not inline with onboarding.

### 16.2 Custom upload

Endpoint:

    POST /api/v1/me/photo

Validation:

- max 5 MB
- MIME whitelist:
  - image/jpeg
  - image/png
  - image/webp
- sanitized unique filename
- stored in AVATAR_STORAGE_DIR

After upload:

    photo_source = 'custom'

### 16.3 Delete custom photo

Endpoint:

    DELETE /api/v1/me/photo

Behavior:

- if Telegram photo exists, revert to Telegram photo
- otherwise revert to placeholder

### 16.4 Photo visibility

Photo is a public card field.

It is never paywalled.

It is never masked as asterisk.

---

## 17. Security Requirements

Implemented security controls:

- bcrypt password hashing for staff
- JWT with configurable expiry
- SHA-256 hashed refresh tokens
- Redis-backed rate limiting
- Chapa webhook HMAC signature verification
- Telegram initData HMAC-SHA256 verification
- Telegram webhook secret constant-time comparison
- production guardrails against dev-default secrets
- audit logging for admin and sensitive operations
- security headers
- CORS restricted to allowed origins
- multer upload validation
- profile photo source tracking
- server-side paywall masking

### 17.1 Paywall security

The API must never send hidden fields to the frontend and rely on client-side masking.

Unpurchased:

    asterisk

Purchased:

    real value

The backend decides what is revealed.

---

## 18. Observability

Logging uses Pino.

Log:

- request ID
- method
- path
- status
- duration
- user ID or staff ID where available
- error stack in non-production

Do not log:

- full tokens
- passwords
- sensitive raw webhook payloads in plain logs

---

## 19. Testing Strategy

Recommended and implemented tooling:

- Vitest
- Supertest
- Testcontainers for MySQL and Redis

Critical test areas:

- Telegram initData verification
- user JWT issuance
- admin login
- refresh token rotation
- scope rejection
- incomplete-profile gating
- bilingual validation
- branch and neighborhood minimum length
- bank immutability
- region/zone mismatch
- self-service region/zone change
- interest limits
- broad-region handling
- same-bank feed rule
- grade-band constraint
- zone vs region matching
- mutual ranking
- masking contract
- purchased reveal
- photo never masked
- duplicate purchase prevention
- webhook idempotency
- reveal price configuration
- RBAC
- reference-data deactivation blocks
- broadcast segmentation

---

## 20. Local Development Setup

### 20.1 Prerequisites

- Node.js 20+
- Docker
- MySQL 8
- Redis 7

### 20.2 Docker Compose services

    services:
      mysql:
        image: mysql:8
        environment:
          MYSQL_DATABASE: zwuwur
          MYSQL_USER: zwuwur
          MYSQL_PASSWORD: changeme
          MYSQL_ROOT_PASSWORD: root
        ports:
          - 3306:3306

      redis:
        image: redis:7
        ports:
          - 6379:6379

### 20.3 Setup commands

    cp .env.example .env
    npm install
    npm run migrate
    npm run seed
    npm run dev
    npm run dev:worker
    npm run dev:scheduler

---

## 21. NPM Scripts

Example:

    {
      scripts: {
        dev: node --watch src/server.js,
        dev:worker: node --watch src/worker.js,
        dev:scheduler: node --watch src/scheduler.js,
        migrate: node src/db/migrate.js,
        seed: node src/seed/index.js,
        test: vitest run,
        lint: eslint .
      }
    }

---

## 22. Deployment Notes

### 22.1 Production processes

Run separately:

- API
- worker
- scheduler

Use PM2, systemd, or containers.

### 22.2 Static avatar serving

Serve /avatars via:

- Express static middleware, or
- nginx

### 22.3 HTTPS

Terminate TLS at:

- nginx
- Caddy
- cloud load balancer

### 22.4 Backups

Daily backup:

- MySQL database
- storage/avatars
- Redis persisted state

### 22.5 Single-instance constraint

Because photo storage is local, the API should run as a single instance for MVP.

Horizontal scaling requires a shared persistent volume and consistent static serving.

---

## 23. Performance Notes

### 23.1 Marketplace caching

Marketplace responses are cached for 5 minutes.

fresh=true bypasses cache where supported.

Important indexes:

- transfer_interests(region_id, zone_id)
- transfer_interests(user_id)
- users(bank_id, is_active, profile_completed_at)
- users(zone_id)
- users(region_id)

### 23.2 Targets

| Metric | Target |
|---|---:|
| Feed response | under 3 seconds |
| Feed cached response | sub-200 ms |
| Reveal confirmation | within 5 seconds of payment webhook |
| Payment status reflection | within 1 minute |
| Availability | 99% |

---

## 24. Acceptance Checklist

### Registration

- bot onboarding creates incomplete user
- duplicate Telegram ID handled
- duplicate phone+bank handled
- bank fixed at registration

### Profile

- marketplace gated until complete
- bilingual validation works
- branch minimum length works
- neighborhood minimum length works
- language-aware nudge works
- region/zone self-service works
- bank change blocked

### Interests

- max 3 regions enforced
- max 3 zones per region enforced
- broad region interest works
- zone parent validation works

### Feed

- same bank only
- complete/active candidates only
- grade-band constraint works
- zone-level ranks above region-broad
- mutual matches rank first
- masking contract returns asterisk
- purchased cards return full values
- photo is never masked
- cache TTL is 5 minutes

### People

- requires interests
- shows candidates in desired areas
- ranking correct

### Purchases

- cannot purchase same target twice
- webhook idempotent
- reveal permanent
- duplicate payment ignored
- price defaults to 500 ETB
- price configurable

### Admin

- RBAC enforced
- reference-data deactivation blocked when referenced
- broadcasts segmented correctly
- reports accurate
- no PDF/Excel export shipped

---

## 25. Open Items and Production Gates

| Item | Status |
|---|---|
| Amharic translations for banks, regions, zones, grades, system messages | Required before production |
| Finfinne Special Zone Surrounding Oromia | Seeded inactive by default |
| Enat Bank establishment year | Needs confirmation |
| Amhara zone count convention | Needs confirmation |
| Telebirr final activation | Stub/adapter-ready |
| Tsehay Bank metadata | Confirm SWIFT/year if available |
| Debub Global Bank removal | Confirm legacy handling if previously seeded |