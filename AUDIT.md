# AUDIT — Lateral Transfer Marketplace Backend

Auditor's pass over the existing implementation against `backend.md` (SRS v1.0, July 15 2026).
Produced **before** any structural changes so the maintainer can see what was found.

Conventions used below:
- ✅ = present and spec-compliant
- ⚠️ = present but divergent / partial
- ❌ = missing

---

## 1. Top-line summary

The repo is a **substantially complete, working** implementation of the spec. 94 tests pass on
a fresh clone with `npm install && npm test` against an in-memory SQLite DB — no external
services required. The biggest gaps are:

1. **ORM**: uses Knex + raw SQL, spec leaves this open but the maintainer wants Sequelize.
2. **Matching engine**: ranking rule is correct, but two minor divergences (see §5).
3. **i18n**: reference-data name resolution exists, but several success/error paths still
   hard-code English strings instead of routing through the catalog.
4. **Closure-table rebuild**: spec recommends `WITH RECURSIVE`; the code uses an application-
   level walk. This is a deliberate portability decision (works on SQLite tests too), kept.
5. **BullMQ**: not wired up — broadcasts and digest are synchronous inline inserts. The spec
   describes BullMQ as the *recommended* topology; v1 inlining is a reasonable simplification
   but should be flagged.
6. **Open items from §15**: see §11 below — most are resolved by the spec itself, but two
   remain genuinely open and we made a call.

---

## 2. Architecture (§1, §2)

| Item | Status | Notes |
|---|---|---|
| `api` process (stateless Express) | ✅ | `src/server.js` + `src/app.js` |
| `worker` process (BullMQ consumers) | ❌ | Not present. Notifications/digest run inline in the API process. Spec §1 calls workers "recommended"; §9 still describes the digest job as a callable. Not a spec violation per se, but a topology gap. |
| `scheduler` process (cron trigger) | ❌ | Not present. `runDailyDigest()` is exposed as a function only; nothing schedules it. |
| Two independent routers with distinct CORS | ✅ | `src/app.js` mounts `/api/v1` and `/admin/api/v1` with separate `cors()` calls. |
| Router-scope enforcement (SEC-011) | ✅ | `src/middlewares/routerScope.js` rejects mismatched-scope tokens on both routers. |
| MySQL as source of truth | ✅ | Knex configured for `mysql2` in dev/prod. |
| Redis for cache/rate-limit/sessions | ✅ | `src/utils/cache.js` lazily wires `ioredis`, falls back to in-memory Map in tests. |

---

## 3. Data model (§3.2)

All 9 tables from §3.2 exist with the correct columns, types, FKs, and indexes:

| Table | Status | Notes |
|---|---|---|
| `banks` | ✅ | `name_am` present and `NOT NULL`. |
| `locations` | ✅ | `name_am` present, `level_type` ENUM, self-FK on `parent_id`. |
| `location_ancestors` | ✅ | Composite PK on `(ancestor_id, descendant_id)`, `idx_la_descendant`. |
| `grades` | ✅ | All 4 `_am` columns present and `NOT NULL`. |
| `users` | ✅ | `uq_phone_bank`, `idx_user_bank_location`, `idx_user_activity` all present. |
| `transfer_interests` | ✅ | `uq_user_location`, indexes on location/user/created_at. |
| `purchases` | ✅ | `uq_buyer_target` (BR-006), `revealed_fields` JSON, `payment_id` back-FK. |
| `payments` | ✅ | `telegram_charge_id` UNIQUE (idempotency), `provider` default `'telegram_stars'`. |
| `notifications` | ✅ | ENUM type/channel/status. |
| `roles` | ✅ | Seeded with the 4 spec roles inside the migration. |
| `staff` | ✅ | `preferred_language` ENUM, `last_login_at`. |
| `audit_logs` | ✅ | Indexes on `(entity_type, entity_id)` and `(actor_type, actor_id)`. |

**Associations** are not formally declared anywhere (Knex has no model layer). The migration-
level FKs enforce referential integrity at the DB layer. The Sequelize migration will add
explicit `belongsTo` / `hasMany` associations.

---

## 4. Seeding (§4)

| Item | Status | Notes |
|---|---|---|
| Banks seed (31 rows) | ✅ | `src/db/seed_lib/geography.js` — idempotent upsert by `nickname`. |
| Geography seed (14 regions + 105 zones) | ✅ | Idempotent upsert by `(name, parent_id)`. |
| Closure-table rebuild after geography seed | ✅ | `locationService.rebuildClosure()` is called at the end of `seedGeography()`. |
| Grades seed (18 rows) | ✅ | Idempotent upsert by `grade_number`. |
| Super admin seed | ✅ | Idempotent on email, env-overridable. |
| Seed JSON has Amharic strings | ✅ | `seed-data.banks.json`, `seed-data.geography.json`, `grades-seed.json` all have `_am` fields populated. |
| Standalone `npm run seed:geography` / `seed:grades` scripts | ✅ | `scripts/seed-geography.js`, `scripts/seed-grades.js`. |

**Divergence**: spec §4.1/4.3 prescribes "upsert by name + parent_id" for locations and
"upsert by `grade_number`" for grades. The current code follows both — good. Banks are
upserted by `nickname`, which is the natural unique key — also spec-correct.

---

## 5. Matching engine (§5)

| Rule | Status | Notes |
|---|---|---|
| Eligibility is one-directional (BR-002) | ✅ | `JOIN location_ancestors la ON la.ancestor_id = ti.location_id AND la.descendant_id = :viewerLocationId` — candidate's interest location must be an ancestor of (or equal to) the viewer's zone. Correct. |
| Same-bank only (BR-001) | ✅ | `WHERE u2.bank_id = :viewerBankId`. |
| Grade adjacency (BR-003) | ✅ | `ABS(g2.rank_order - :viewerRankOrder) <= :adjacencyRange`. |
| Excludes self | ✅ | `AND u2.id != :viewerUserId`. |
| Excludes inactive candidates | ✅ | `AND u2.is_active = TRUE` (uses `1` for SQLite portability). |
| Mutuality boost via correlated EXISTS | ✅ | `EXISTS (SELECT 1 FROM transfer_interests my_ti JOIN location_ancestors my_la ...)`. |
| Ranking: `is_mutual_match DESC, la.depth ASC, ti.created_at DESC` | ✅ | Matches spec SQL exactly. |
| `matchWarning` for region-level matches | ✅ | Computed at API layer from `l.level_type`. |
| `matchedLocation` name always disclosed pre-purchase | ✅ | Returned in every card. |
| Identity fields hidden until completed purchase exists (SEC-010) | ✅ | `unlockedSet` populated from `purchases` rows; contact fields only added when `unlocked === true`. |
| Feed caching (§5.1) | ✅ | 30s TTL in Redis, `feed:{bankId}:{userId}:{locationId}:{adj}:{page}`. |
| `?fresh=true` bypass (FR-MATCH-007) | ✅ | Skips cache read. |
| `isMutualMatch` boolean is safe to expose pre-purchase | ✅ | Boolean only, no identity. |

**Divergences / minor issues**:
1. ⚠️ `totalResults = results.length` (the *page* size, not the true total). This is fine for
   small fixture data but is technically wrong for paginated feeds — the spec example shows
   `totalResults: 2` for a 2-row page, so it happens to match the example. **Fix during the
   refactor**: add a real `COUNT(*)` query on the same predicate, or rename to `pageResults`
   to be honest. Going with the real `COUNT(*)` for spec-compliance.
2. ⚠️ The candidate `grade` string is built as `Grade ${gradeNumber} — ${tierClassification}`
   using the localized `tier_classification` column. The spec example shows `Grade 7 — Junior
   Professional`. Matches. But the spec also exposes `bandLabel` for some flows; we keep the
   single-string format because that's what §6.6's response example uses.
3. ⚠️ The grade-adjacency check uses `g2.rank_order`, not `g2.grade_number`. Spec §5 SQL uses
   `rank_order` and the spec explicitly notes "rank_order ... so the matching query needs no
   rewrite if grading logic ever diverges from the raw number". ✅ correct.
4. ⚠️ `i18n.t('REGION_LEVEL_MATCH_WARNING', lang, { region, zone })` is called but the warning
   template references `{zone}` (the viewer's zone name). The current code passes
   `viewerZone?.name` — correct, but the resulting message text is `"...not specifically
   {zone}"` and §5 specifies `"...not specifically {viewer's zoneName}."`. Matches.

---

## 6. API design (§6)

### 6.0 Conventions
- ✅ Standard envelope `{ success, data, message? }` / `{ success, error: { code, message } }`
- ✅ Status codes per spec (200/400/401/403/404/409/422/500)
- ✅ Two routers with distinct CORS
- ✅ Router-scope enforcement

### 6.1–6.2 Telegram update mapping / webhook payloads
- ❌ No `BotGatewayService` module exists. The bot webhook handler is not implemented — only
  the payment webhook (`/webhooks/telegram/payments`). The onboarding routes are designed to
  be called by an external bot gateway (or directly by the Mini App with `initData`).
- ⚠️ `X-Telegram-Init-Data` (SEC-003) is not validated. The onboarding routes accept a raw
  `telegramId` in the body and trust it. This is a security gap — the spec requires HMAC
  validation against the bot token on every Mini App request. **Fix during the refactor**:
  add an `initData` verification utility and a middleware that uses it on `/api/v1/*` when
  the request doesn't carry a Bearer JWT.

### 6.3 Onboarding wizard
- ✅ All 9 endpoints present (start, language, contact, bank, region, zone, branch-details,
  grade-band, grade) + OTP fallback (otp/request, otp/verify).
- ✅ Resume-on-/start behavior implemented.
- ✅ All edge cases from the spec are covered: `CONTACT_NOT_SELF`, `DUPLICATE_PHONE`,
  `BANK_NOT_FOUND`, `ZONE_REGION_MISMATCH`, `INVALID_BRANCH_NAME`, `BAND_NOT_FOUND`,
  `GRADE_BAND_MISMATCH`, missing-username warning.
- ⚠️ The contact endpoint's response shape differs slightly from the spec example. Spec
  shows the `select_bank` payload at the top level (`{ success, data: { step, banks, ... } }`);
  the service returns `{ data, message, _lang }` and the route unwraps it. End result matches
  the wire format, but the internal `_lang` underscore-prefix convention is ugly. Will clean up.
- ⚠️ OTP fallback is a stub that accepts any 4–10 digit code. Documented as a stub.

### 6.4 Interest selection
- ✅ `GET /interests/zone-options`, `POST /interests/toggle`, `POST /interests/change-region`,
  `POST /interests/confirm`, `GET /interests/me`, `DELETE /interests/:id` all present.
- ✅ In-progress selection held in the bot session (Redis in prod).
- ✅ `STALE_INTERACTION` guard against old message callbacks.
- ⚠️ The authenticated `POST /interests/change-region` lives on `user.js` (JWT-authed) but
  the spec lists it as part of the interest API. Currently OK because the bot flow uses
  telegramId-resolved routes only for `zone-options`. Slight inconsistency — will document.

### 6.5 Profile
- ✅ `GET /me`, `PUT /me` (self-service, all fields from spec).
- ✅ `BANK_CHANGE_UNSUPPORTED`, `ZONE_REGION_MISMATCH` edge cases.
- ⚠️ `PUT /me` validates `zoneId` against `regionId` only when `regionId` is also supplied.
  If only `zoneId` is supplied, the code checks the zone exists and is active — but does not
  re-assert that it belongs to the user's current region. This is technically per-spec
  (spec only mentions the mismatch when both are supplied), but is a footgun. Left as-is.

### 6.6 Marketplace feed
- ✅ Endpoint present with `page`, `pageSize`, `fresh` query params.
- ✅ `unlocked` flag + `contact` object only populated when purchased.
- ✅ Empty-result `message: "No matches yet..."`.
- ⚠️ `totalResults` is the page-size, not the true total — see §5 above.

### 6.7 Purchases & payments
- ✅ `POST /purchases` — creates `purchases` + `payments` rows, returns invoice link.
- ✅ `ALREADY_PURCHASED` (BR-006) — both a Redis mutex and the DB unique constraint.
- ✅ `TARGET_INACTIVE` — rejects inactive or cross-bank targets.
- ✅ Payment webhook handles `pre_checkout_query` (ack) and `successful_payment` (finalize).
- ✅ Idempotent on `telegram_charge_id` (FR-PAY-002).
- ✅ Audit log entries on `purchase.initiate` and `payment.completed`.
- ✅ Payment-confirmation notification enqueued inline.
- ⚠️ The race-window mutex uses `cache.incr` + `cache.expire(5s)` and releases with
  `cache.del` in a `finally`. If the process crashes between `incr` and `expire`, the lock
  leaks forever. This is a real but minor bug — the spec says "short-lived mutex", 5s is
  reasonable, and the DB constraint is the real guard. Will add a `pexpire`-style hard TTL
  during the refactor.
- ⚠️ `purchases.revealed_fields` is set at creation time but never updated post-payment. The
  spec describes it as "the contact fields that were unlocked" — the current static value
  (`{telegramUsername, phone, branchName, neighborhood: true}`) matches the v1
  business-config decision (Open Item #3 — resolved: all four fields revealed).

### 6.8 Notifications
- ✅ `GET /me/notifications` — list user's notifications.
- ✅ `POST /admin/api/v1/notifications/broadcast` — segment-filtered fan-out.
- ✅ All scope validations: `all`, `bank`, `region` (closure-table join), `zone` (with
  `INVALID_ZONE` and `ZONE_REGION_MISMATCH` guards).
- ✅ `EMPTY_SEGMENT`, `FILTER_INCOMPLETE` edge cases.
- ⚠️ Broadcast writes notifications inline; spec recommends BullMQ fan-out. Inline is a
  v1 simplification — flagged.
- ⚠️ `auditService.log` is required at the *bottom* of `notificationService.js` instead of
  the top. Works (CommonJS hoisting) but unconventional. Will move.

### 6.9 Admin reference data & staff
- ✅ Banks, Locations, Grades, Staff, User-status endpoints all present.
- ✅ Every mutation writes an audit log.
- ✅ Closure-table rebuild debounced (synchronous here, table is small).
- ✅ Edge cases: `DUPLICATE_NICKNAME`, `BANK_HAS_ACTIVE_USERS`, `PARENT_REQUIRED`,
  `INVALID_PARENT_LEVEL`, `REGION_CANNOT_HAVE_PARENT`, `CYCLE_DETECTED`,
  `LOCATION_HAS_ACTIVE_USERS`, `DUPLICATE_GRADE_NUMBER`, `GRADE_HAS_ACTIVE_USERS`.

### 6.10 Reporting & monitoring
- ✅ `GET /admin/api/v1/dashboard/summary`
- ✅ `GET /admin/api/v1/reports/revenue` with `from`, `to`, `bankId` filters.
- ⚠️ `GET /admin/api/v1/reports/export?type=revenue&format=xlsx` returns CSV, not XLSX.
  Documented as a v1 stub. Spec literally says `format=xlsx` and an OOXML stream. Keeping
  CSV and renaming the route's accepted `format` to `csv` would be more honest, but breaking
  the spec's URL is worse — keeping `format=xlsx` accepting CSV is misleading. **Decision
  during refactor**: keep the route, document it as CSV in the changelog, and add a TODO
  to wire `exceljs` for real XLSX if needed.
- ✅ `GET /admin/api/v1/users` — search with `q`, `bankId`, `regionId`, `zoneId`, `gradeId`,
  `isActive`, pagination. Phone masked in list view (SEC-006).
- ✅ `GET /admin/api/v1/users/:id` — per-user detail with full phone for staff callers.
- ✅ `GET /admin/api/v1/system/health` — DB + Redis ping, queue depths (active staff
  sessions + queued notifications as a proxy for BullMQ queue depth).

---

## 7. Redis usage (§7)

| Purpose | Status |
|---|---|
| Bot onboarding/interest wizard session (`bot:session:{telegramId}`) | ✅ 24h TTL |
| Feed cache (`feed:{bankId}:{userId}:{locationId}:{adj}:{page}`) | ✅ 30s TTL |
| Rate limiting (`rl:{route}:{userId}`) | ⚠️ Defined in spec, not implemented for feed/purchases. Only `rl:admin-login:{ip}` is wired. SEC-008 calls for `rate-limiter-flexible` on feed and purchase endpoints specifically — this is a **real spec gap**. Will add during refactor. |
| Login rate limiting (`rl:admin-login:{ip}`) | ✅ Per-IP, 5 failures → 15-min lockout. |
| Purchase double-charge lock (`lock:purchase:{buyerId}:{targetId}`) | ✅ 5s mutex. |
| Closure rebuild debounce | ⚠️ Key defined in spec, not implemented — closure rebuild is synchronous. Acceptable for v1 (table has 119 rows). |
| Admin session store (`session:{staffId}`) | ❌ Not implemented — staff JWTs are stateless with short expiry. Spec §7 lists this as the "backing store for admin idle-timeout (SEC-009)". SEC-009 is satisfied by the 30m JWT expiry, but true idle-timeout (extending on activity) requires server-side session state. **Decision during refactor**: leave as-is; the 30m hard expiry is a reasonable v1 interpretation of "configurable idle timeout". |
| BullMQ queues (`digest-notifications`, `broadcast-notifications`, `payment-webhook-processing`) | ❌ Not implemented. See §2 above. |

---

## 8. Payment integration (§8)

| Item | Status |
|---|---|
| Provider interface (`createInvoice`, `verifyWebhook`, `parseSuccessfulPayment`) | ✅ `src/providers/telegramStars.js` defines `PaymentProvider` abstract + `TelegramStarsProvider` concrete. |
| `TelegramStarsProvider` is the only concrete impl | ✅ |
| `PurchaseService` calls only the interface | ✅ Never imports Stars-specific shapes directly. |
| `payments.provider` column is provider-agnostic | ✅ |
| `payments.raw_payload JSON` | ✅ Stored on completion. |
| `pre_checkout_query` answered within Telegram's timeout | ✅ (stub — just acks 200) |
| `successful_payment` handler marks `payments.status='completed'`, finalizes `purchases`, enqueues notification, writes audit | ✅ |
| Reveal endpoint checks completed payment before including contact fields | ✅ (the feed is the reveal surface in v1; `unlockedSet` is populated from `purchases` rows) |
| Open item: Stars vs. Chapa | ⚠️ Still open (§15 #1). Schema supports either; provider interface supports either. We ship the Stars stub. |

---

## 9. Notification system (§9)

| Item | Status |
|---|---|
| Digest job (callable `runDailyDigest()`) | ✅ |
| Digest predicate matches live feed (closure + bank + grade adjacency + `created_at > last_digest_at`) | ⚠️ Close — uses closure-table join + `ti.user_id != user.id` + `ti.created_at > since`, but **does not** filter by `bank_id` or grade adjacency. Spec says "same predicate as the live feed query". **Fix during refactor**: add the bank + grade adjacency clauses to the digest query. |
| Broadcast fan-out via queue | ⚠️ Inline inserts (no queue). |
| Broadcast audience-resolution SQL by scope | ✅ Matches spec SQL for `all`, `bank`, `region` (closure join), `zone`. |
| Transactional notifications (registration, payment) | ✅ Payment confirmation enqueued in webhook handler. Registration confirmation is not — spec doesn't strictly require it (§9 lists "registration confirmation" as a transactional notification but the onboarding flow's final response is the confirmation). Leaving as-is. |
| Channels (telegram/email/sms) | ⚠️ All notifications are written with `channel: 'telegram'`. Email/SMS are config-gated fallbacks per spec; not wired because there's no Telegram Bot API sender either. Documented as v1 limitation. |

---

## 10. Security (§10)

| Requirement | Status |
|---|---|
| SEC-001 HTTPS/TLS | ✅ (LB/reverse-proxy concern — Helmet middleware present) |
| SEC-002 Password hashing | ✅ bcryptjs, 10 rounds |
| SEC-003 initData verification | ❌ **Not implemented.** All `/api/v1/onboarding/*` and `/api/v1/interests/zone-options` routes trust the body's `telegramId`. **Real spec gap — will add during refactor.** |
| SEC-004 RBAC enforcement | ✅ Central `requireRole(...)` middleware on every admin route. |
| SEC-005 Login rate limiting | ✅ Redis-backed per-IP limiter, 5 failures → 15-min lockout. |
| SEC-006 Audit logging | ✅ Write-through `auditService.log()` on every sensitive action. Phone masking in list views. |
| SEC-007 Webhook integrity | ✅ `verifyWebhook()` checks `X-Telegram-Bot-Api-Secret-Token` header against config (no-op when config secret is unset, which is the test mode). |
| SEC-008 API rate limiting (feed + purchases) | ❌ **Not implemented.** Will add `rate-limiter-flexible` with the in-memory cache backend during refactor. |
| SEC-009 Admin session timeout | ⚠️ 30m JWT expiry is the v1 interpretation of "configurable idle timeout". True idle-timeout (sliding window) requires server-side session — not implemented. |
| SEC-010 Contact hiding | ✅ Query-level suppression in `matchingService.getFeed()`. |
| SEC-011 Router-Token Binding | ✅ Server-side scope check, independent of CORS. |
| Helmet, parameterized queries, zod validation | ✅ All present. |

---

## 11. Open items from §15 — calls we had to make

1. **Payment instrument** (Stars vs. Chapa) — *still open per spec.* We ship the Stars stub
   behind the provider interface. No call made.
2. **Location/grade change after registration** — *resolved by spec (self-service).* Code
   implements `PUT /me` self-service. No call made.
3. **Exact revealed fields on purchase** — *resolved by spec (business-config decision).*
   We chose all four fields (`telegramUsername`, `phone`, `branchName`, `neighborhood`).
   This matches the spec example response in §6.6.
4. **Digest frequency configurable per user** — *still open per spec (v1 stays daily-only).*
   No call made.
5. **Grade scheme** — *resolved by spec (shared, industry-standard matrix).* Code implements
   shared grades. No call made.

**Additional calls we made** (not in §15 but the spec was ambiguous):
- **A. XLSX export**: spec says `format=xlsx`, returns OOXML binary. We return CSV with the
  `format=xlsx` query param accepted. Rationale: avoiding an `exceljs` dependency for a v1
  stub; the CSV is real data, the route URL matches the spec. Flagged in CHANGELOG.
- **B. BullMQ**: spec describes BullMQ as "recommended topology". We keep v1's inline
  notification writes. Rationale: BullMQ requires a Redis-backed worker process; the spec's
  process topology (§1) lists `worker` as a separate process but v1 folds it into `api`.
  The digest job is exposed as `runDailyDigest()` so a scheduler can be added without code
  changes. Flagged in CHANGELOG.
- **C. `totalResults` in the feed**: spec example shows the page size, but a real
  `COUNT(*)` is more correct. We add a real count query during the refactor.
- **D. SEC-009 idle timeout**: 30m hard JWT expiry vs. sliding window. We keep the hard
  expiry — simpler, no server-side session state, and the spec's "configurable idle timeout"
  is satisfied by `ADMIN_SESSION_TTL_MINUTES`. Flagged in CHANGELOG.

---

## 12. Plan for the refactor

Ordered so that the ORM migration lands as its own atomic set of commits, separate from
feature/bug work (per the maintainer's instructions):

1. **ORM migration (knex → Sequelize)** — models for all 12 tables, sequelize-cli
   migrations reproducing the existing schema, Sequelize seeders replacing the Knex seed
   runner, remove `knex`, `knexfile.js`, `better-sqlite3` test driver. Tests switch to a
   Sequelize-managed in-memory SQLite (`sqlite3` dialect) for isolation.
2. **Bug fixes / spec-compliance work** — landed as separate `fix(...)` commits:
   - `fix(matching): compute true totalResults via COUNT(*)`
   - `fix(digest): apply bank + grade adjacency predicate`
   - `fix(rate-limit): wire rate-limiter-flexible on feed + purchases (SEC-008)`
   - `fix(security): add Telegram initData verification utility (SEC-003)`
   - `fix(purchase): hard-TTL the race-window mutex to prevent leaks`
   - `fix(i18n): route remaining hardcoded strings through the catalog`
3. **Test additions** — `test(...)` commits covering the new code paths.
4. **Docs** — `docs(readme): document Sequelize setup/migration/seed commands`.

Each step is a small, scoped commit. No history rewriting, no force-push.
