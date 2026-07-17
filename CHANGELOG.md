# Changelog

All notable changes to this project are documented here. The format follows
[Conventional Commits](https://www.conventionalcommits.org/) — each entry links to
the underlying commit type.

## [Unreleased] — 2026-07-17

This release migrates the ORM from Knex to Sequelize, brings the implementation
in line with `backend.md` wherever it had diverged, and adds a comprehensive
security + matching-engine test suite.

### ORM migration — `refactor(db): migrate knex to sequelize`

- **Removed**: `knex`, `knexfile.js`, `better-sqlite3` test driver, all 9 Knex
  migration files, the Knex seed runner, and the three Knex-based seed helper
  modules under `src/db/seed_lib/`.
- **Added**: `sequelize@^6.37.8`, `sequelize-cli@^6.6.3`, `sqlite3@^5.1.7` (test
  driver). New `.sequelizerc` config, `src/db/config.js` (per-env DB params),
  `src/db/sequelize.js` (instance).
- **Added**: 12 Sequelize models under `src/db/models/` (Bank, Location,
  LocationAncestor, Grade, User, TransferInterest, Purchase, Payment,
  Notification, Role, Staff, AuditLog) with explicit `belongsTo` / `hasMany`
  associations wired up in `src/db/models/index.js`.
- **Added**: 9 sequelize-cli migrations under `src/db/migrations/` reproducing
  the existing schema — same tables, FKs, ENUMs, JSON columns, indexes, and
  composite primary keys (notably `location_ancestors`).
- **Added**: 4 Sequelize seeders under `src/db/seeders/` (banks, geography,
  grades, super admin). All idempotent via upsert by natural key.
- **Added**: `src/db/seed_lib/closureRebuild.js` — portable closure-table
  rebuild helper used by both the geography seeder and `locationRepository`.
- **Ported**: all 10 repositories to Sequelize models. Queries use `raw: true`
  to return plain JS objects with snake_case keys, preserving the service-layer
  API.
- **Ported**: `matchingService`, `notificationService`, `reportingService` to
  Sequelize — raw queries via `sequelize.query()` with bound `replacements`,
  no string concatenation.
- **Ported**: test setup + 6 test files. New `tests/db.js` exposes a Knex-like
  shim over the Sequelize models so existing test bodies (`db('users').where(...)
  .first()`) keep working without rewrite.
- **Updated**: `package.json` scripts — `knex migrate:latest` →
  `sequelize-cli db:migrate`, `knex seed:run` → `sequelize-cli db:seed:all`.

### Incidental spec fixes that came along in the service rewrites

- **`fix(matching): compute true totalResults via COUNT(*)`** — the feed
  response's `totalResults` was previously set to `results.length` (the page
  size), which happened to match the spec example because the example only had
  2 results on a 10-result page. Now `matchingService.countMatchingCandidates()`
  runs the same predicate as the live feed query and returns the real total.
- **`fix(digest): apply bank + grade adjacency predicate`** — the daily digest
  job's match predicate was missing the `bank_id` and grade-adjacency clauses
  that §9 says it should share with the live feed query. Now it joins `users`
  on `bank_id` and `grades` on `ABS(rank_order - viewer_rank) <= adjacency`,
  matching the feed.

### Spec-compliance fixes — separate commits

- **`fix(security): wire rate-limiter-flexible on feed + purchases (SEC-008)`**
  — adds `src/middlewares/rateLimit.js` with two pre-built limiters (feed:
  60 req/60s, purchase: 10 req/60s, both per-user). Wired into
  `GET /marketplace/feed` and `POST /purchases`. The spec (§10 SEC-008) calls
  for explicit limits on these endpoints — previously only the admin-login IP
  limiter was wired.
- **`fix(security): add Telegram initData verification utility (SEC-003)`** —
  adds `src/utils/telegramInitData.js` implementing Telegram's documented
  HMAC-SHA256 validation algorithm for WebApp initData. Adds
  `src/middlewares/initData.js` with soft enforcement on `/api/v1/onboarding/*`:
  if the `X-Telegram-Init-Data` header is present, it's verified and the parsed
  `user.id` overrides `req.body.telegramId` (preventing Mini App impersonation);
  if absent, the request is allowed through as a trusted bot-gateway call. Adds
  `INVALID_INIT_DATA` to the en/am i18n catalogs.
- **`fix(purchase): hard-TTL the race-window mutex to prevent leaks`** —
  replaces the `cache.incr + cache.expire(5)` two-step with a single atomic
  `cache.add(key, value, ttl)` operation. The previous code could leak the
  lock forever if the process crashed between `incr` and `expire`. The new
  `cache.add` atomically sets the value AND the TTL, mirroring Redis's
  `SET key value NX EX ttl`. Adds the `add()` method to the in-memory cache
  backend.

### Tests — `test: add matching ranking, security, and Sequelize model/migration tests`

- **`tests/matching.ranking.test.js`** (8 tests): mutual > one-directional
  ranking, region-level `matchWarning`, SEC-010 contact hiding, BR-001 same
  bank, BR-003 grade adjacency, inactive/self exclusion, true `totalResults`.
- **`tests/security.test.js`** (19 tests): SEC-003 initData verification
  (valid/tampered/missing/no-token), SEC-008 rate limiting on feed + purchases,
  SEC-004 RBAC middleware + Capabilities matrix, SEC-011 router-scope, BR-006
  double-charge guard + mutex release, SEC-007 webhook secret verification.
- **`tests/sequelize.test.js`** (25 tests): all 12 models load with spec-required
  attributes + indexes, associations wired correctly, migrations produce the
  expected schema (12 tables, FKs, unique constraints), seeders populate 31
  banks + 14 regions + 91 zones + 18 grades + 4 roles, closure table rebuilt
  after geography seeding, all 4 seeders idempotent.
- **`tests/setup.js`**: reset rate-limiter counters in `beforeEach` so DB ID
  reuse (after `sqlite_sequence` reset) doesn't cause false-positive 403s.
- **`src/providers/telegramStars.js`**: read `TELEGRAM_WEBHOOK_SECRET` fresh
  from env on each `verifyWebhook` call so tests can toggle it without busting
  the module cache.
- **`src/middlewares/rateLimit.js`**: add `_resetForTests()` helper.

**Final test count: 146 passing / 146 total** (was 94 before this release).
Full output captured in `TEST_RESULTS.txt`.

### Documentation — `docs:` commits

- **`docs(audit): add pre-refactor audit of codebase vs backend.md`** —
  comprehensive audit document produced before any structural changes,
  enumerating ✅ spec-compliant / ⚠️ divergent / ❌ missing items per spec
  section. See `AUDIT.md`.
- **`docs(readme): document Sequelize setup/migration/seed commands`** —
  README rewritten with the new Sequelize layout, scripts, and conventions.
  Added `.env.example` referenced by the README.

## Open spec questions

See `OPEN_QUESTIONS.md` for the full list, including:
- The seed JSON has 91 zones, not the spec's stated 105.
- BullMQ workers are not wired (v1 inlines notification writes).
- XLSX export returns CSV (would need `exceljs` for real XLSX).
- SEC-009 admin idle timeout is a 30m hard JWT expiry, not a sliding window.
- Payment instrument (Stars vs. Chapa) remains open per §15 #1.
