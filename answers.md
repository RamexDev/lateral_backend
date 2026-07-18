# Answers for Open Questions

Consolidated decisions covering SRS v1.0 §16, `backend.md` §15, and
`OPEN_QUESTIONS.md`. Status as of July 18, 2026.

Legend: ✅ Resolved · 🟡 Decided this session · 🔴 Still open (needs your input)

---

## Part 1 — SRS §16 / backend.md §15 items

### 1. Payment instrument (Stars vs. Chapa) — 🟡 Decided
**Decision:** Off-platform Chapa checkout. Deep-link the user out of the
Mini App/bot to a Chapa-hosted checkout page; Chapa's webhook confirms
payment back to our own `PaymentService`, which then triggers the reveal.
Accepted trade-off: the bot/Mini App may not be eligible for listing to
mobile users for this digital-goods flow, since it isn't routed through
Telegram's native Stars checkout (`sendInvoice`/Bot Payments API).

**Implementation implications:**
- `PaymentService` implements a `ChapaProvider` (not `TelegramStarsProvider`)
  behind the existing provider interface — no schema change, `payments.provider
  = 'chapa'`, `payments.raw_payload` stores Chapa's webhook payload.
- Purchase flow changes from "pay inline via Telegram Bot Payments" to
  "generate a Chapa checkout link → user completes payment on Chapa's page →
  Chapa webhook hits our endpoint → `PurchaseService` unlocks the reveal and
  notifies the user via Telegram." Needs a new webhook route
  (`/webhooks/chapa` or similar) alongside the existing Telegram webhook,
  with the same idempotency/signature-validation treatment as SEC-007.
- The bot/Mini App UI needs a "you'll be taken to a secure payment page"
  step instead of Telegram's native invoice sheet.
- `FR-PAY-001` (SRS §5.7) should be updated to reflect Chapa as the
  confirmed provider, not "Telegram Bot Payments."

---

### 2. Location/grade change after registration — ✅ Resolved
Self-service. `PUT /me` mutates `current_location_id` / `grade_id` directly,
reusing the `ZONE_REGION_MISMATCH` validation from onboarding. No
`profile_change_requests` table. No action needed.

---

### 3. Exact revealed fields on purchase — ✅ Resolved
All four fields ship: `telegramUsername`, `phone`, `branchName`,
`neighborhood`. Matches the SRS §6.6 example. `purchases.revealed_fields JSON`
supports any subset already, so this stays config-flippable without a
migration if the business wants to reveal fewer fields later.

---

### 4. Digest frequency configurable per user — ✅ Decided: daily-only for launch
v1 ships daily-only, as already built. `users.digest_frequency` stays
unbuilt/deferred — no schema change now. Revisit post-launch if there's
demand for a weekly option.

---

### 5. Grade scheme — ✅ Resolved
Shared, industry-standard 1–18 grade matrix across all banks (not per-bank).
This also settles how grade-adjacency (BR-003) compares across banks with
different internal scales — it can't be an issue since everyone shares one
scale now. No action needed.

---

## Part 2 — `OPEN_QUESTIONS.md` items A–J

### A. XLSX export returns CSV, not real XLSX — 🟡 Decided: build real .xlsx now
Reason: multi-sheet reports, real Excel formatting, and guaranteed-correct
Amharic rendering (CSV has no reliable encoding metadata for non-Latin text,
which matters given `name_am` fields throughout the reference data).

**Implementation:**
- Add `exceljs` as a dependency.
- `GET /admin/api/v1/reports/export?type=revenue&format=xlsx` builds a real
  OOXML workbook in memory — proper `Content-Type:
  application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`,
  bold/formatted headers, column widths, currency formatting on revenue
  figures.
- Multi-sheet support where useful (e.g., a summary tab + detail tab for
  revenue-by-bank breakdowns) instead of forcing one flat table per download.
- Explicit UTF-8 handling for Amharic (`name_am`, `band_label_am`, etc.) so
  Amharic text renders correctly regardless of the admin's Excel locale.
- CSV export can stay as a secondary lightweight option if useful, but
  `format=xlsx` should return a real workbook, not CSV mislabeled as one.

---

### B. BullMQ workers not wired — 🟡 Decided this session: **build before launch**
You confirmed this is needed before launch given the 1,000+-user NFR target.
Scope:
- `worker.js` entry point booting BullMQ consumers for the three queues in
  §7 (digest fan-out, broadcast fan-out, payment-webhook post-processing).
- Move the currently-inline writes (`Notification.bulkCreate` on broadcast,
  the synchronous payment+notification+audit inserts on the webhook handler)
  into queue processors.
- `scheduler.js` (or system cron) that actually enqueues/calls
  `runDailyDigest()` — right now nothing triggers it.
- Containerize `worker` separately from `api` per `backend.md` §14
  (`CMD ["node", "src/worker.js"]`), sharing the same MySQL/Redis instances.

No schema changes required — this is process-topology and queue-wiring work
on top of what's already designed in §1/§7.

**Next step:** I'll scope this into concrete implementation tasks — let me
know if you want that as code changes now or as a separate ticket/plan
first.

---

### C. `totalResults` is now a real `COUNT(*)` — ✅ Decided: keep true count, ranked pagination confirmed
True `COUNT(*)` via `countMatchingCandidates()` is correct — it's what a
real pagination UI needs (page-size-as-total from the pre-refactor code was
wrong). Confirmed: results should be a properly paginated list with rank as
the ordering mechanism — higher-specificity matches (branch-level before
subcity/zone before region/district) shown first, which is already what the
existing `is_mutual_match DESC, la.depth ASC, ti.created_at DESC` ordering
does (see "spec-compliant, no changes" note below). No further change
needed beyond keeping the true-count `totalResults`.

---

### D. SEC-009 admin idle timeout — 🟡 Decided: 10-minute frontend-enforced timeout
**Decision:** 10-minute inactivity timeout, enforced in the Admin PWA
frontend (idle-detection timer that logs the staff member out / clears the
session after 10 minutes of no interaction), rather than a backend
sliding-window session.

**One trade-off worth flagging:** a frontend-only timeout controls the UI
experience, but doesn't by itself shorten how long a stolen/leaked JWT stays
valid server-side — if the token's own expiry is longer than 10 minutes, an
attacker with the raw token could still use it against the API directly
after the frontend has "logged out." Two ways to close that gap without
building the Redis sliding-window session:
- Set the JWT's own expiry to something short and close to the idle window
  (e.g. 10–15 min) so the backend token naturally dies around the same time
  the frontend enforces logout, or
- Keep the JWT expiry as-is (30 min) purely as a hard ceiling, with the
  frontend's 10-minute idle logout as the practical UX control — acceptable
  if the admin surface isn't handling especially sensitive actions and the
  30-minute hard ceiling is an acceptable worst case.

**Final decision:** Keep the JWT access token at a 30-minute hard expiry as
the backstop, backed by a 7-day refresh token. Combined with the frontend's
10-minute idle timeout, this gives: idle staff get logged out client-side
after 10 minutes; even an active/leaked access token dies within 30 minutes
regardless; and legitimate staff don't have to fully re-authenticate with
username/password every 30 minutes — they can silently refresh as long as
they're within the 7-day window and haven't hit the idle timeout.

**Implementation implications (new — not in `backend.md` §6/§7 as written):**
- Add a `POST /admin/api/v1/auth/refresh` endpoint accepting the refresh
  token and issuing a new 30-min access token.
- Refresh tokens need their own storage/invalidation path — likely a
  `staff_refresh_tokens` table (or a Redis key keyed by staff ID) so a
  refresh token can be revoked on logout, password change, or staff
  deactivation (FR-ADM-003), rather than living purely as a stateless JWT
  for 7 days with no revocation path.
- Frontend idle-timeout logic (10 min) should also clear/invalidate the
  refresh token client-side on logout, not just stop silent-refreshing.

---

### E. Seed-data geography count: 91 zones, not 105 — ✅ Decided: replace seed wholesale with vendor-supplied 111-zone dataset
`backend.md` says 105 zones/119 nodes total in one place and repeats it
inconsistently elsewhere (§3.1 and §4.1 both say 119 nodes; the later
seed-summary block says 105). The actual `seed-data.geography.json` (as
built) has 91 zones (105 nodes total). Tests assert the real seed count.

**Public-source research (inconclusive, not used):** I initially checked
Wikipedia and Statoids.org for Ethiopia's zone breakdown. Both disagreed
with each other and with the project's own numbers (Statoids counted 85
zones; Wikipedia flags its own count as unclear/outdated). This wasn't a
safe basis for filling gaps, so I held off — see prior note in git history
of this doc.

**Vendor source received and audited:** the maintainer supplied the original
"Ethiopian Banks and Geographic Hierarchy Seed Data" document. I counted
its actual flat table/JSON directly rather than trusting its own header
summary, and found it **also self-contradicts**, the same failure pattern
as `backend.md`:

| Source | Regions | Zones | Total nodes |
|---|---|---|---|
| Current production seed | 14 | 91 | 105 |
| Vendor doc's own header claim | 14 | 105 | 119 |
| **Vendor doc's actual flat table/JSON (verified by count)** | 14 | **111** | **125** |
| Original SRS/`backend.md` claim | 14 | 105 | 119 |

The vendor document's real data (111 zones, IDs 1–125, fully named and
parent-mapped) is the strongest ground truth available — concrete and
verifiable, not a summary line — so none of the three other numbers (91,
105, 105) match it and shouldn't be treated as authoritative.

**Decision:** Replace the current seed wholesale with this 111-zone
dataset, rather than trying to reconcile it as a small patch against the
old 91-zone seed.

**Blocker before this can actually be seeded:** the vendor document has
**no Amharic (`name_am`) fields at all** — not for the 31 banks, not for
any of the 125 location nodes. `backend.md` §16.1 enforces `NOT NULL` on
`name_am` columns specifically as a deployment gate, so seeding this data
as-is will fail that constraint. Amharic translations for all 156 rows (31
banks + 125 locations) need to be sourced and approved before this seed can
ship, per the existing §16.1 requirement that Amharic strings be
"finalized and approved by the business/HR before the initial production
seed is run."

**Next step:** update `scripts/seed-geography.js` and
`seed-data.geography.json` to match this dataset's structure (it already
matches the `regions[].zones_subcities[]` shape `backend.md` §4.1 expects),
pending the Amharic translation pass.

---

### F. Seed-data banks count: 31 — ✅ Resolved
`seed-data.banks.json` has exactly 31 banks, matching `backend.md` §16. No
action needed.

---

### G. `INVALID_CREDENTIALS` message text — 🟡 Decided: standard industry phrasing
**New English copy:** "The email or password you entered is incorrect." —
this is the commonly-used phrasing across most login forms (deliberately
generic/security-conscious: it doesn't reveal whether the email or the
password was the wrong part, avoiding user enumeration).

**Needs a follow-up:** the Amharic string needs a proper translation of this
new copy, not a reuse of the old placeholder — flagging this for the same
translation-review pass mentioned in `backend.md` §16.1 ("Amharic strings
finalized and approved by the business/HR before the initial production
seed"). Let me know if you want me to draft a proposed Amharic translation
for review, or if that should go through your usual translation process.

---

### H. `tests/setup.js` runs migrations/seeders directly, not via `sequelize-cli` — ✅ No action needed
Faster test setup; same migration/seeder files run via `sequelize-cli` in
production. Only observable difference is `SequelizeMeta` isn't populated in
tests, and the test suite already handles that gracefully.

---

### I. `auditService.log` failure mode — 🟡 Decided: add a health check
Audit failures are caught and logged to stderr without failing the request
— intentional per "audit failures must never crash the request" — but a
broken audit pipeline could go unnoticed in production.

**Decision:** Add a health check that verifies `audit_logs` inserts succeed
(e.g. a periodic synthetic write-and-verify against `audit_logs`, surfaced
through the existing `GET /healthz` endpoint alongside the DB/Redis pings
`backend.md` §14 already describes, or a dedicated check if you'd rather
keep it separate from the liveness probe). Not blocking BullMQ wiring — can
be scoped as a small follow-up.

---

### J. `tests/db.js` Knex-like shim is test-only — 🟡 Decided: rewrite tests, delete the shim
Added to avoid rewriting all 6 test files' bodies against Sequelize models
directly. Minimal, only supports the query shapes the tests actually use.

**Decision:** Rewrite the 6 test files to use the Sequelize models directly
and delete `tests/db.js`. Larger diff than keeping the shim, but cleaner
and avoids maintaining a second, parallel query-shape-limited data-access
layer just for tests.

---

## Part 3 — Confirmed as spec-compliant, no changes made
(From `OPEN_QUESTIONS.md`'s "Spec sections we did NOT change" — listed here
for completeness, no action needed on any of these:)

- §4.2 closure-table rebuild (application-level walk, per spec's own fallback
  allowance)
- §5 matching engine ranking (`is_mutual_match DESC, la.depth ASC,
  ti.created_at DESC` — matches spec SQL exactly)
- §6.5 `PUT /me` zone-only update (`ZONE_REGION_MISMATCH` only fires when
  both region and zone are supplied, per spec)
- §6.7 `revealed_fields` static post-payment value (matches Item #3's
  resolution above)
- §9 registration confirmation (the onboarding flow's `profile_created`
  response already serves as the confirmation; a separate `notifications` row
  would be redundant)

---

## Summary — all items decided

| # | Item | Decision |
|---|---|---|
| 1 | Payment instrument | Off-platform Chapa checkout; new webhook + purchase flow needed |
| 2 | Location/grade change | ✅ Already resolved (self-service) |
| 3 | Revealed fields | ✅ Already resolved (all four fields) |
| 4 | Digest frequency | Daily-only for launch |
| 5 | Grade scheme | ✅ Already resolved (shared matrix) |
| A | XLSX export | Build real `.xlsx` with `exceljs` (formatting, multi-sheet, Amharic-safe) |
| B | BullMQ wiring | Build before launch — next up |
| C | `totalResults` | Keep true `COUNT(*)`; rank ordering confirmed correct |
| D | SEC-009 idle timeout | 10-min frontend idle logout + 30-min JWT + 7-day refresh token |
| E | Geography count (91 vs 105) | Replace seed wholesale with vendor's 111-zone dataset — blocked on Amharic translations (156 rows) before seeding |
| F | Banks count | ✅ Already resolved (matches) |
| G | INVALID_CREDENTIALS copy | Reworded to standard phrasing; Amharic translation still needed |
| H | Test setup via sequelize-cli | ✅ No action needed |
| I | Audit log hardening | Add a health check on `audit_logs` inserts |
| J | `tests/db.js` shim | Rewrite 6 test files to use Sequelize directly, delete shim |

**All 15 items now have a decision.** Item E's seed replacement is ready
structurally, but still needs the Amharic translation pass (156 rows)
before it can actually be seeded into the database — flagging that as a
dependency, not a blocker on anything else in this list.

**Next up, since you asked for BullMQ first:** I'll scope B into concrete
implementation work now.