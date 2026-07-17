# Open spec questions

Decisions made and questions still open after the refactor. Cross-references
`backend.md` §15 and the pre-refactor `AUDIT.md`.

## §15 open items — calls we had to make

1. **Payment instrument (Stars vs. Chapa)** — *still open per spec.* We ship the
   `TelegramStarsProvider` stub behind the provider interface. The
   `payments.provider` column and `payments.raw_payload JSON` are
   provider-agnostic, so a `ChapaProvider` can be added later as a new adapter
   with no schema change and no changes to `PurchaseService` (which calls only
   the interface). **No call made.**

2. **Location/grade change after registration** — *resolved by spec
   (self-service).* `PUT /me` directly mutates `current_location_id` /
   `grade_id` with the same `ZONE_REGION_MISMATCH` validation used during
   onboarding. **No call made.**

3. **Exact revealed fields on purchase** — *resolved by spec (business-config
   decision, not schema).* We chose all four fields: `telegramUsername`,
   `phone`, `branchName`, `neighborhood`. This matches the §6.6 example
   response. The `purchases.revealed_fields` JSON column already supports any
   subset, so this is config-flippable without a migration.

4. **Digest frequency configurable per user** — *still open per spec (v1 stays
   daily-only).* If required later, add `users.digest_frequency
   ENUM('daily','weekly') DEFAULT 'daily'` and branch the scheduler query
   accordingly. **No call made.**

5. **Grade scheme** — *resolved by spec (shared, industry-standard matrix, not
   per-bank).* Code implements shared grades. **No call made.**

## Additional calls we made (not in §15 but the spec was ambiguous)

### A. XLSX export route returns CSV, not real XLSX

`GET /admin/api/v1/reports/export?type=revenue&format=xlsx` returns a CSV
stream with `Content-Type: text/csv`. The spec literally says `format=xlsx`
and an OOXML binary stream. Rationale: avoiding an `exceljs` dependency for a
v1 stub; the CSV is real data, the route URL matches the spec, and the export
is genuinely useful as-is. **To make it spec-correct**: add `exceljs`, build a
real `.xlsx` workbook in memory, and stream it with the correct content type.

### B. BullMQ workers are not wired

The spec (§1, §7, §9) describes BullMQ as the *recommended* topology for
digest fan-out, broadcast fan-out, and payment-webhook post-processing. v1
inlines these writes into the API process (broadcast does synchronous
`Notification.bulkCreate`; the webhook handler does synchronous
payment+notification+audit inserts; `runDailyDigest()` is a callable but
nothing schedules it). Rationale: BullMQ requires a Redis-backed worker
process, and v1's process topology folds `worker` into `api`. The
`runDailyDigest()` function is exposed so a scheduler (cron, BullMQ repeatable
job) can be added without code changes. **To make it spec-correct**: introduce
a `worker.js` entry point that boots BullMQ consumers on the three queues
listed in §7, move the inline writes to queue processors, and add a
`scheduler.js` (or system cron) that enqueues the daily digest.

### C. `totalResults` in the feed is now a real `COUNT(*)`

The spec example (`§6.6`) shows `totalResults: 2` for a 2-row page, which
happens to match a page-size-as-total implementation. The pre-refactor code
set `totalResults = results.length`. We added `countMatchingCandidates()` to
run the same predicate and return the true total. This is more correct for
pagination but is technically a behavior change. **Flagging in case the
spec author intended the page-size semantics** (unlikely, but possible).

### D. SEC-009 admin idle timeout is a 30m hard JWT expiry, not a sliding window

The spec says "configurable idle timeout" — strict reading implies a sliding
window where activity extends the session. v1 uses a 30m *hard* JWT expiry
(`ADMIN_SESSION_TTL_MINUTES`), which is simpler and requires no server-side
session state. The spec's §7 mentions a `session:{staffId}` Redis key as the
backing store for the idle timeout — we don't use it. **To make it
spec-correct**: implement sliding-window expiry by either (a) issuing a fresh
JWT on each admin request (churning), or (b) keeping a `session:{staffId}`
Redis key with a 30m TTL that's touched on each request and checked by
`requireStaff()`. Option (b) is closer to the spec.

### E. Seed-data geography count: 91 zones, not 105

`backend.md` §3.2 says "14 top-level Regions/Chartered Cities and 105
Zones/Subcities/Special Woredas (119 nodes total)". The actual
`seed-data.geography.json` has 14 regions + 91 zones = 105 nodes (not 119).
The `tests/sequelize.test.js` count tests assert the actual seed count (91)
and flag the discrepancy. **The seed JSON is the source of truth** for what
gets inserted — the spec's 105-zone count may be from a different version of
the seed or aspirational. **Action item for the maintainer**: confirm whether
the seed JSON is missing 14 zones (and if so, add them), or update the spec
text to say "91 zones (105 nodes total)".

### F. Seed-data banks count: 31 (matches spec)

`backend.md` §16 says "31 rows seeded from the provided list". The
`seed-data.banks.json` has exactly 31 banks. ✓ Matches.

### G. `INVALID_CREDENTIALS` message is generic

`§6.9` doesn't specify the exact message text for `INVALID_CREDENTIALS`. We
use "Invalid email or password." — same on both `en` and `am`. The spec's
§6.9 doesn't show an example response for failed login, so this is a
reasonable default.

### H. `tests/setup.js` runs migrations + seeders directly, not via sequelize-cli

The test setup invokes the migration and seeder modules' `up()` functions
directly against the in-memory SQLite instance (rather than spawning
`sequelize-cli db:migrate` as a subprocess). This is faster and lets the Jest
worker stay self-contained. The same files run via `sequelize-cli` in
production — they're standard sequelize-cli modules. The only observable
difference: the `SequelizeMeta` table is **not** populated in tests
(`tests/sequelize.test.js` handles this gracefully by falling back to a
table-count check). **No action needed**, but worth flagging if the maintainer
expects `SequelizeMeta` to be present in test snapshots.

### I. The `auditService.log` failure mode

`auditService.log()` catches errors and logs them to stderr without failing
the request. This is intentional per the spec ("audit failures must never
crash the request") but means a broken audit log can go unnoticed in
production. **To make it more robust**: add a health check that verifies
`audit_logs` inserts succeed, or wire an alert on the stderr log line.

### J. The `tests/db.js` Knex-like shim is test-only

To avoid rewriting all 6 test files' bodies, I added `tests/db.js` — a small
shim that maps `db('table').where(...).first()` to raw SQL via
`sequelize.query()`. This is intentionally minimal (only the query shapes
the tests use are supported). **If the maintainer prefers**: rewrite the
test bodies to use the Sequelize models directly and delete the shim. It's
cleaner but a larger diff.

## Spec sections we did NOT change

These were flagged in `AUDIT.md` as potentially divergent but on closer
reading are spec-compliant as-is:

- **§4.2 closure-table rebuild**: the spec recommends `WITH RECURSIVE` for
  MySQL 8+, with a fallback to application-level walk on MySQL 5.7. The
  application-level walk is what we have (works on both MySQL and SQLite),
  and the spec explicitly allows it. **No change.**

- **§5 matching engine ranking**: `is_mutual_match DESC, la.depth ASC,
  ti.created_at DESC` — matches the spec SQL exactly. **No change.**

- **§6.5 `PUT /me` zone-only update**: when only `zoneId` is supplied (no
  `regionId`), the code checks the zone exists and is active but doesn't
  re-assert it belongs to the user's current region. This is per-spec (the
  `ZONE_REGION_MISMATCH` check only fires when both are supplied). **No
  change.**

- **§6.7 `revealed_fields` not updated post-payment**: the spec describes it
  as "the contact fields that were unlocked" — the current static value
  (`{telegramUsername, phone, branchName, neighborhood: true}`) matches the
  v1 business-config decision (Open Item #3 resolved: all four fields
  revealed). **No change.**

- **§9 transactional notification for registration**: the spec lists
  "registration confirmation" as a transactional notification, but the
  onboarding flow's final `profile_created` response *is* the confirmation.
  Adding a separate `notifications` row would be redundant. **No change.**
