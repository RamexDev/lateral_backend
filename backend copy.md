# 🚀 Lateral Transfer Marketplace System
> **Backend Design & Implementation Specification**

---
## 📑 Table of Contents
- Architecture
- Backend Modules
- Data Model
- Seeding
- Matching Engine
- API Design
- Security
- Deployment

---
# Lateral Transfer Marketplace System — Backend Design & Implementation Specification

**Derived from:** SRS v1.0 (July 15, 2026), the Ethiopian Banks & Geographic Hierarchy seed data,
and the confirmed bot onboarding/interest-selection conversational flow
**Stack:** Express.js (Node.js) · MySQL · Redis · BullMQ · Telegram Bot API / Mini App · Admin PWA
**Audience:** Backend engineers, DBAs, DevOps, technical reviewers

This document translates the SRS's functional and business requirements into a concrete backend
architecture: schema, APIs (with full request/response examples and edge cases), matching
algorithm, job/queue design, payments, security, and deployment. Section numbers cross-reference
the corresponding SRS requirement IDs (FR-*, BR-*, SEC-*) so reviewers can trace design decisions
back to source requirements.

---

## 1. Architecture Overview

```
                         ┌─────────────────────┐
                         │   Telegram Servers   │
                         └─────────┬───────────┘
                    Bot updates /  │  \ WebApp initData
                    payment events │   \
                                   ▼    ▼
                 ┌───────────────────────────────────┐
                 │      Express.js API Gateway        │
                 │  /webhooks/telegram/bot  /api/v1   │
                 │  /admin/api/v1                      │
                 │  (auth, RBAC, router-scope, cors)  │
                 └──────┬───────────────┬─────────────┘
                        │               │
              ┌─────────▼──────┐   ┌────▼─────────┐
              │     MySQL       │   │    Redis      │
              │ (source of      │   │ cache / rate  │
              │  truth)         │   │ limit / locks │
              │                 │   │ + bot session  │
              │                 │   │   / wizard FSM │
              └─────────────────┘   └────┬──────────┘
                                          │
                                   ┌──────▼───────────┐
                                   │  BullMQ Workers    │
                                   │ - digest job        │
                                   │ - broadcast job      │
                                   │ - payment-webhook job│
                                   └──────────────────┘

              ┌───────────────────────────────┐
              │  Admin PWA (static SPA)         │
              │  talks to /admin/api/v1 only     │
              └───────────────────────────────┘
```

**Process topology (recommended):**
1. `api` — stateless Express HTTP process(es) behind a load balancer, handles the Telegram bot
   webhook, Mini App REST calls, and Admin PWA REST calls. Horizontally scalable.
2. `worker` — separate Node process(es) running BullMQ consumers (digest fan-out, broadcast
   fan-out, payment-webhook post-processing, closure-table rebuild). Scaled independently of
   `api` since notification fan-out is bursty.
3. `scheduler` — a lightweight cron trigger (BullMQ repeatable job or system cron) that enqueues
   the daily digest job; kept logically separate from `worker` so a redeploy of workers doesn't
   skip a scheduled tick.

All three share the same MySQL and Redis instances. This satisfies the NFR requirement for
queue-based notification fan-out rather than naive per-user loops, and lets `api` stay responsive
under notification load.

---

## 2. Core Backend Modules

| Module | Responsibility | Key SRS refs |
|---|---|---|
| `BotGatewayService` | Receives Telegram webhook updates, dispatches to the wizard/interest FSM, sends outgoing Telegram Bot API calls (`sendMessage`, `editMessageReplyMarkup`, `answerCallbackQuery`) | — |
| `AuthService` | Telegram user identity (contact-share verification, OTP fallback), admin auth (JWT/session) | FR-AUTH-001…007 |
| `OnboardingService` | Drives the registration wizard, owns the Redis-backed session/FSM state | FR-PROFILE-001…003 |
| `LocationService` | Location tree CRUD (region/zone_subcity), closure-table maintenance | FR-LOC-001…004 |
| `InterestService` | Multi-select interest wizard state, create/list/remove transfer interests | FR-INT-001…003 |
| `MatchingService` | Live marketplace feed query + ranking | FR-MATCH-001…007, BR-001…004,008 |
| `PurchaseService` | Reveal purchase orchestration, double-charge guard | FR-PUR-001…004, BR-005,006 |
| `PaymentService` | Telegram Bot Payments integration, webhook handling | FR-PAY-001…005 |
| `NotificationService` | Digest job, broadcast, transactional notifications | FR-NOT-001…004 |
| `AdminService` | Reference data admin (banks, locations, grades), staff/role management, monitoring | FR-ADM-001…006 |
| `ReportingService` | Dashboard summaries, exportable reports, user activity monitoring | FR-ADM-004…006 |
| `RbacMiddleware` | Role-based endpoint authorization | FR-RBAC-001…003 |
| `AuditService` | Write-through audit log for sensitive actions | SEC-006 |

---

## 3. Data Model (MySQL)

### 3.1 Design note: location hierarchy vs. free-text branch identity

The seed data (`Part 2: Geographic Hierarchy`) provides only the **shared, bank-agnostic
administrative geography**: 14 top-level Regions/Chartered Cities and 105 Zones/Subcities/Special
Woredas (119 nodes total). Per the confirmed registration flow, a user's precise workplace is
captured as **free text** — branch name and neighborhood — rather than as a separate,
admin-managed "branch" node in the location tree.

Consequences for the schema:
- `locations` contains **only two levels** — `region` and `zone_subcity` — and is identical
  across all banks (no `bank_id` column needed; it is pure shared reference data, satisfying
  FR-LOC-002 at the geography level).
- A user's `current_location_id` points at the most granular seeded node they picked (their
  zone/subcity). This is the node used for hierarchy-based matching.
- `branch_name` and `neighborhood` are descriptive free-text attributes on the `users` row —
  shown to a buyer only after a paid reveal (SEC-010) — but are **not** used for matching. This
  satisfies FR-PROFILE-003 ("only a branch-level location is selectable as current location") by
  treating the zone/subcity as the matching-granularity "current location," with the literal
  branch identity captured alongside it as text rather than a separate pre-seeded node.
- `transfer_interests.location_id` still references `locations` generically (region or
  zone_subcity), so a future "interest in an entire region" option needs no schema change — the
  bot UI described below simply only exposes zone/subcity-level checkboxes today.

### 3.2 Schema (DDL)

```sql
-- ─────────────────────────────────────────────────────────────
-- Reference data
-- ─────────────────────────────────────────────────────────────
CREATE TABLE banks (
  id                INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name              VARCHAR(150) NOT NULL,
  name_am           VARCHAR(150) NOT NULL,          -- Amharic display name (robust from day 1)
  nickname          VARCHAR(30)  NOT NULL UNIQUE,
  swift_code        VARCHAR(11)  NULL,
  year_established  SMALLINT     NULL,
  is_active         BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE locations (
  id           BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  parent_id    BIGINT UNSIGNED NULL,
  name         VARCHAR(150) NOT NULL,
  name_am      VARCHAR(150) NOT NULL,          -- Amharic display name (robust from day 1)
  level_type   ENUM('region','zone_subcity') NOT NULL,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_loc_parent FOREIGN KEY (parent_id) REFERENCES locations(id),
  INDEX idx_loc_parent (parent_id),
  INDEX idx_loc_level (level_type)
);

-- Precomputed transitive closure over `locations` (FR-LOC-003).
-- depth = 0 rows are self-references; depth > 0 rows are true ancestors.
CREATE TABLE location_ancestors (
  ancestor_id   BIGINT UNSIGNED NOT NULL,
  descendant_id BIGINT UNSIGNED NOT NULL,
  depth         INT NOT NULL,
  PRIMARY KEY (ancestor_id, descendant_id),
  INDEX idx_la_descendant (descendant_id),
  CONSTRAINT fk_la_ancestor   FOREIGN KEY (ancestor_id)   REFERENCES locations(id),
  CONSTRAINT fk_la_descendant FOREIGN KEY (descendant_id) REFERENCES locations(id)
);

-- Shared, industry-standard grade matrix (Ethiopian Banking Grade Matrix), seeded once and
-- shared across all banks — same model as the shared `locations` geography. Not bank-scoped:
-- every bank uses the same 1–18 rank scale, which is what makes grade-adjacency matching
-- (FR-MATCH-004, BR-003) consistent across banks rather than comparing incompatible per-bank
-- scales.
CREATE TABLE grades (
  id                   INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  grade_number         TINYINT UNSIGNED NOT NULL UNIQUE, -- 1–18, shared across all banks
  band_label           VARCHAR(40)  NOT NULL,            -- e.g. "Grades 6–9"
  band_label_am        VARCHAR(60)  NOT NULL,            -- Amharic (robust from day 1)
  tier_classification  VARCHAR(60)  NOT NULL,            -- e.g. "Junior Professional"
  tier_classification_am VARCHAR(80)  NOT NULL,          -- Amharic (robust from day 1)
  typical_roles        VARCHAR(255) NOT NULL,            -- e.g. "CSO I, Junior IT, Junior Auditor"
  typical_roles_am     VARCHAR(255) NOT NULL,            -- Amharic (robust from day 1)
  rank_order           INT NOT NULL,                     -- = grade_number; kept as its own column
                                                            -- so the matching query (Section 5)
                                                            -- needs no rewrite if grading logic
                                                            -- ever diverges from the raw number
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────────────────────
-- Core domain
-- ─────────────────────────────────────────────────────────────
CREATE TABLE users (
  id                   BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  telegram_id          BIGINT UNSIGNED NOT NULL UNIQUE,
  telegram_username    VARCHAR(64) NULL,          -- nullable: not every Telegram user has one
  phone_number         VARCHAR(20) NOT NULL,
  phone_verified_at    TIMESTAMP NULL,
  bank_id              INT UNSIGNED NOT NULL,
  current_location_id  BIGINT UNSIGNED NOT NULL,  -- references locations.level_type='zone_subcity'
  branch_name          VARCHAR(150) NOT NULL,     -- free text, e.g. "Adama Main Branch"
  neighborhood         VARCHAR(150) NULL,         -- free text, e.g. "Bole Road, near Adama Stadium"
  grade_id             INT UNSIGNED NOT NULL,
  preferred_language   ENUM('en','am') NOT NULL DEFAULT 'en',
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  last_digest_at       TIMESTAMP NULL,            -- updated by the digest worker after each user's digest is sent
  last_activity_at     TIMESTAMP NULL,            -- updated on feed view, purchase, interest change (best-effort, throttled)
  created_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_bank     FOREIGN KEY (bank_id) REFERENCES banks(id),
  CONSTRAINT fk_user_location FOREIGN KEY (current_location_id) REFERENCES locations(id),
  CONSTRAINT fk_user_grade    FOREIGN KEY (grade_id) REFERENCES grades(id),
  UNIQUE KEY uq_phone_bank (phone_number, bank_id),  -- FR-AUTH-003 dup guard
  INDEX idx_user_bank_location (bank_id, current_location_id),
  INDEX idx_user_activity (is_active, last_activity_at)
);

CREATE TABLE transfer_interests (
  id           BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id      BIGINT UNSIGNED NOT NULL,
  location_id  BIGINT UNSIGNED NOT NULL,          -- zone_subcity today; region supported by schema
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ti_user     FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_ti_location FOREIGN KEY (location_id) REFERENCES locations(id),
  UNIQUE KEY uq_user_location (user_id, location_id),  -- idempotent re-confirm, no duplicate rows
  INDEX idx_ti_location (location_id),
  INDEX idx_ti_user (user_id),
  INDEX idx_ti_created (created_at)
);

CREATE TABLE purchases (
  id                   BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  buyer_id             BIGINT UNSIGNED NOT NULL,
  target_user_id       BIGINT UNSIGNED NOT NULL,
  matched_interest_id  BIGINT UNSIGNED NULL,      -- the transfer_interests row that produced the match, if still present
  revealed_fields      JSON NOT NULL,             -- e.g. {"username":true,"phone":true,"branchName":true,"neighborhood":true}
  payment_id           BIGINT UNSIGNED NULL,
  created_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pur_buyer  FOREIGN KEY (buyer_id) REFERENCES users(id),
  CONSTRAINT fk_pur_target FOREIGN KEY (target_user_id) REFERENCES users(id),
  UNIQUE KEY uq_buyer_target (buyer_id, target_user_id)   -- BR-006: never charge twice
);

CREATE TABLE payments (
  id                  BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  purchase_id         BIGINT UNSIGNED NULL,
  telegram_charge_id  VARCHAR(100) NULL UNIQUE,   -- idempotency key (FR-PAY-002)
  provider             VARCHAR(30) NOT NULL DEFAULT 'telegram_stars',
  amount               DECIMAL(12,2) NOT NULL,
  currency             VARCHAR(10) NOT NULL,
  status               ENUM('pending','completed','failed','refunded') NOT NULL DEFAULT 'pending',
  raw_payload           JSON NULL,
  created_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_pay_purchase FOREIGN KEY (purchase_id) REFERENCES purchases(id)
);

CREATE TABLE notifications (
  id          BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id     BIGINT UNSIGNED NOT NULL,
  type        ENUM('registration','digest','payment_confirmation','broadcast') NOT NULL,
  channel     ENUM('telegram','email','sms') NOT NULL DEFAULT 'telegram',
  payload     JSON NOT NULL,
  status      ENUM('queued','sent','failed') NOT NULL DEFAULT 'queued',
  sent_at     TIMESTAMP NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_notif_user (user_id, created_at)
);

-- ─────────────────────────────────────────────────────────────
-- Staff / RBAC
-- ─────────────────────────────────────────────────────────────
CREATE TABLE roles (
  id    INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name  VARCHAR(50) NOT NULL UNIQUE   -- super_admin | platform_admin | finance_officer | support_officer
);

CREATE TABLE staff (
  id                 BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  full_name          VARCHAR(150) NOT NULL,
  email              VARCHAR(150) NOT NULL UNIQUE,
  password_hash      VARCHAR(255) NOT NULL,
  role_id            INT UNSIGNED NOT NULL,
  preferred_language ENUM('en','am') NOT NULL DEFAULT 'en', -- Section 16.3: Admin PWA locale for staff
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at  TIMESTAMP NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_staff_role FOREIGN KEY (role_id) REFERENCES roles(id)
);

CREATE TABLE audit_logs (
  id           BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  actor_type   ENUM('user','staff','system') NOT NULL,
  actor_id     BIGINT UNSIGNED NULL,
  action       VARCHAR(100) NOT NULL,             -- e.g. 'purchase.reveal', 'admin.location.update'
  entity_type  VARCHAR(50) NOT NULL,
  entity_id    BIGINT UNSIGNED NULL,
  metadata     JSON NULL,
  ip_address   VARCHAR(45) NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_entity (entity_type, entity_id),
  INDEX idx_audit_actor (actor_type, actor_id)
);
```

### 3.3 Key relationships recap
- One `bank` → many `users`. Location geography and the grade matrix are both shared across all
  banks (no `bank_id` on `locations` or `grades`). Adding a bank impacts only the `banks` table.
- `locations` self-references via `parent_id` (region → zone_subcity); `location_ancestors` is
  the flattened closure.
- One `user` → exactly one `current_location_id` (a zone_subcity) plus free-text
  `branch_name`/`neighborhood`, and one `grade_id`.
- One `user` → many `transfer_interests`.
- One `user` (buyer) → many `purchases`; each `purchase` targets exactly one other `user`.
- `purchases.payment_id` links to the confirming `payments` row.

---

## 4. Location Hierarchy Seeding

### 4.1 Seeding the shared geography
Load the 31 banks and 119 shared administrative nodes from the provided seed JSON directly into
`banks` and `locations`. The seed JSON must contain both English and Amharic names. A one-time Node script:

```js
// scripts/seed-geography.js
async function seedGeography(db, seedJson) {
  const idMap = new Map(); // seedId -> real inserted id

  for (const region of seedJson.regions) {
    const [regionRow] = await db.query(
      `INSERT INTO locations (parent_id, name, name_am, level_type) 
       VALUES (NULL, ?, ?, 'region')`,
      [region.name, region.nameAm]
    );
    idMap.set(region.id, regionRow.insertId);

    for (const child of region.zones_subcities) {
      const [childRow] = await db.query(
        `INSERT INTO locations (parent_id, name, name_am, level_type) 
         VALUES (?, ?, ?, 'zone_subcity')`,
        [idMap.get(region.id), child.name, child.nameAm]
      );
      idMap.set(child.id, childRow.insertId);
    }
  }
  return idMap;
}
```

Banks load 1:1 from `seedJson.banks` into the `banks` table (`nickname`, `swift_code`,
`year_established`, `name_am` map directly; `status: "Active"` → `is_active = true`). No per-bank branch
seeding step is needed — a user's exact branch is captured as free text at registration time
(Section 6.3).

### 4.2 Closure table maintenance (FR-LOC-003)
Rebuild `location_ancestors` whenever a location is inserted, moved, or deactivated. Given the
fixed, small size of the shared geography (119 nodes, rarely changed post-launch), a full rebuild
after each admin write is simplest and fast enough.

```sql
TRUNCATE TABLE location_ancestors;

INSERT INTO location_ancestors (ancestor_id, descendant_id, depth)
WITH RECURSIVE chain (descendant_id, ancestor_id, depth) AS (
  SELECT id, id, 0 FROM locations                       -- self rows
  UNION ALL
  SELECT c.descendant_id, l.parent_id, c.depth + 1
  FROM chain c
  JOIN locations l ON l.id = c.ancestor_id
  WHERE l.parent_id IS NOT NULL
)
SELECT descendant_id, ancestor_id, depth FROM chain;
```
(MySQL 8+ supports `WITH RECURSIVE`; on MySQL 5.7 do this rebuild in application code instead —
walk each node's `parent_id` chain and batch-insert the closure rows.)

### 4.3 Seeding the grade matrix

Load the 18 shared grade rows from `grades-seed.json` (Ethiopian Banking Grade Matrix) directly
into `grades`. The seed JSON must contain both English and Amharic strings for all fields. 
One-time, idempotent on re-run (upsert by `grade_number`):

```js
// scripts/seed-grades.js
async function seedGrades(db, gradesSeedJson) {
  for (const g of gradesSeedJson.grades) {
    await db.query(
      `INSERT INTO grades (grade_number, band_label, band_label_am, tier_classification, tier_classification_am, typical_roles, typical_roles_am, rank_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         band_label = VALUES(band_label),
         band_label_am = VALUES(band_label_am),
         tier_classification = VALUES(tier_classification),
         tier_classification_am = VALUES(tier_classification_am),
         typical_roles = VALUES(typical_roles),
         typical_roles_am = VALUES(typical_roles_am),
         rank_order = VALUES(rank_order)`,
      [g.gradeNumber, g.bandLabel, g.bandLabelAm, g.tierClassification, g.tierClassificationAm, g.typicalRoles, g.typicalRolesAm, g.gradeNumber]
    );
  }
}
```

No per-bank grade seeding step is needed — unlike branch identity (free text per user), grade is
shared, standardized reference data across the industry.

---

## 5. Matching Engine (FR-MATCH-001…007, BR-001…004,008)

The feed is a **live query, never persisted** (BR-008).

**Eligibility is unchanged and strictly one-directional (BR-002):** a candidate only ever appears
because *their* interest matches *my* current branch — this is the one thing verifiable from data
both people entered themselves, and it's what keeps the marketplace honest (a candidate can never
appear solely because they happen to sit where I want to go, with zero interest in coming to me —
that would be selling a lead that isn't actually one).

**Ranking adds a mutuality boost layered on top (extends FR-MATCH-005, confirmed in design
review — not in SRS v1.0 text, flagged here for traceability):** among candidates who already qualify, ones
who are *also* currently sitting at a location I've expressed interest in are genuine two-way swap
opportunities and rank above one-directional leads. This is computed with a correlated `EXISTS`
against my own interests and never loosens the eligibility `WHERE` clause above — it only affects
`ORDER BY`. Like the primary match, it's evaluated on `current_location_id` (structured
zone/subcity) only, never on free-text `branch_name`/`neighborhood`.

```sql
SELECT
  ti.user_id             AS candidate_user_id,
  g2.name                 AS candidate_grade,
  ti.location_id            AS matched_location_id,
  l.name                     AS matched_location_name,
  l.level_type                 AS matched_location_level,
  la.depth                       AS specificity_depth,   -- 0 = exact zone/subcity match, higher = broader (region)
  ti.created_at                    AS interest_created_at,
  EXISTS (                                                 -- mutuality boost: am I interested in
    SELECT 1 FROM transfer_interests my_ti                 -- somewhere the candidate currently sits?
    JOIN location_ancestors my_la
      ON my_la.ancestor_id = my_ti.location_id
     AND my_la.descendant_id = u2.current_location_id
    WHERE my_ti.user_id = :requestingUserId
  )                                 AS is_mutual_match
FROM transfer_interests ti
JOIN users  u2 ON u2.id = ti.user_id
JOIN grades g2 ON g2.id = u2.grade_id
JOIN location_ancestors la
     ON la.ancestor_id   = ti.location_id
    AND la.descendant_id = :requestingUserLocationId          -- BR-002: interest location must be
                                                                 -- ancestor-of-or-equal-to my zone/subcity
JOIN locations l ON l.id = ti.location_id
WHERE u2.bank_id  = :requestingUserBankId                     -- BR-001: same bank only
  AND u2.id       != :requestingUserId
  AND u2.is_active = TRUE
  AND ABS(g2.rank_order - :requestingUserRankOrder) <= :adjacencyRange  -- BR-003
ORDER BY is_mutual_match DESC, la.depth ASC, ti.created_at DESC
LIMIT :pageSize OFFSET :offset;
```

**Notes:**
- `la.depth = 0` covers the "equal to" case in BR-002 because a location is its own ancestor at
  depth 0 in the closure table.
- Ranking (FR-MATCH-005) is now two-tier: `is_mutual_match DESC` first, then `la.depth ASC` (geographic
  specificity) within each tier, then recency.
- `is_mutual_match` is safe to expose on unpurchased cards — it's a boolean signal, not identity —
  so buyers can see *why* a lead is worth paying for before they pay (FR-MATCH-006 still hides
  `telegram_username`, `phone_number`, `branch_name`, `neighborhood`).
- **`matchedLocation`'s actual name is always disclosed pre-purchase, at whatever specificity the
  match was made** — region name for a region-level interest, zone/subcity name for a zone-level
  one. This is a firm rule, not an incidental default: knowing *which* region or zone someone
  wants isn't identifying on its own, and withholding it (e.g. showing only "somewhere nearby"
  for region-level matches while naming the zone for precise ones) would be an inconsistent,
  confusing product decision. Full transparency on match facts, privacy only on identity —
  consistent with the "don't sell false info" principle behind the mutuality boost above.
- **Region-level matches (`matched_location_level = 'region'`) get an explicit warning at the API
  layer**, computed from the already-selected `l.level_type`, not a new SQL condition:
  `matchWarning: "{candidateGrade's interest} is interested in the broader {regionName} region,
  not specifically {viewer's zoneName}."` (localized en/am). `null` for zone/subcity-level
  matches. This keeps a candidate visible and honestly labeled rather than either hiding them or
  letting a buyer mistake a broad interest for a precise one.
- `adjacencyRange` is a configurable admin setting; default suggestion ±1 rank.
- Feed cards must **not** include `telegram_username`, `phone_number`, `branch_name`, or
  `neighborhood` for unpurchased entries (FR-MATCH-006) — the API layer selects only grade,
  matched location, specificity, `is_mutual_match`, and `matchWarning` until a `purchases` row
  exists for `(requestingUserId, candidate_user_id)`.

### 5.1 Feed caching
Cache the feed response in Redis for a short TTL (30–60s) keyed by
`feed:{bankId}:{userId}:{locationId}:{gradeAdjacency}:{page}`, bypassed by the user-triggered
`?fresh=true` refresh (FR-MATCH-007).

---

## 6. API Design

### 6.0 Conventions

- **Base URL:** `https://api.<domain>`
- **Auth:**
  - Bot webhook (`POST /webhooks/telegram/bot`) — authenticated via Telegram's
    `X-Telegram-Bot-Api-Secret-Token` header (SEC-007), set via `setWebhook`.
  - Onboarding/interest wizard endpoints (Section 6.3–6.4) — called server-side by
    `BotGatewayService` as trusted internal calls, **or** directly by the Mini App with a
    `X-Telegram-Init-Data` header validated per SEC-003.
  - All other end-user endpoints — `Authorization: Bearer <session-jwt>` issued after
    onboarding completes.
  - Admin PWA endpoints (`/admin/api/v1/*`) — `Authorization: Bearer <staff-jwt>`, RBAC-checked.
- **Response envelope (success):**
  ```json
  { "success": true, "data": { }, "message": "optional human-readable note" }
  ```
- **Response envelope (error):**
  ```json
  { "success": false, "error": { "code": "MACHINE_READABLE_CODE", "message": "human-readable" } }
  ```
- **HTTP status codes:** `200` success, `400` validation error, `401` unauthenticated,
  `403` forbidden/RBAC, `404` not found, `409` conflict (e.g. duplicate purchase), `422`
  business-rule violation, `500` server error.
- **Route separation, CORS & Router-Token Binding (SEC-011):** two independent Express routers, mounted at distinct prefixes with distinct `cors()` configs — never a single shared router:
  - `/api/v1/*` — bot webhook + Mini App traffic. `cors({ origin: process.env.MINIAPP_ORIGIN })`.
  - `/admin/api/v1/*` — Admin PWA traffic only. `cors({ origin: process.env.ADMIN_PWA_ORIGIN })`.
  A browser request from the Admin PWA's origin to `/api/v1/*` (or vice versa) fails CORS preflight
  and never reaches the handler. CORS alone only constrains browsers, though — see SEC-011
  (Section 10) for the server-side check that also blocks a stolen token replayed via a
  non-browser client.

**Router-Scope Enforcement Implementation Sketch:**
```js
// /api/v1 router — rejects staff tokens
app.use('/api/v1', (req, res, next) => {
  if (req.auth?.scope === 'staff') {
    return res.status(401).json({ success: false,
      error: { code: 'INVALID_TOKEN_FOR_ROUTER',
               message: 'Staff tokens cannot access Mini App endpoints.' }});
  }
  next();
});

// /admin/api/v1 router — rejects user tokens
app.use('/admin/api/v1', (req, res, next) => {
  if (req.auth?.scope === 'user') {
    return res.status(401).json({ success: false,
      error: { code: 'INVALID_TOKEN_FOR_ROUTER',
               message: 'User tokens cannot access admin endpoints.' }});
  }
  next();
});
```
Issue staff JWTs with `{ scope: 'staff', roleId }` and user JWTs with `{ scope: 'user', userId }` so the check is a single claim comparison, not a DB lookup.

### 6.1 Telegram update → internal call mapping

| Telegram update | Internal call | Bot's outgoing action |
|---|---|---|
| `message.text = "/start"` | `POST /onboarding/start` | `sendMessage` with language inline keyboard |
| `callback_query.data = "lang:am"` | `POST /onboarding/language` | `editMessageText` with contact-share prompt + reply keyboard (`request_contact: true`) |
| `message.contact` | `POST /onboarding/contact` | `sendMessage` with bank inline keyboard (paginated) |
| `callback_query.data = "bank:1"` | `POST /onboarding/bank` | `editMessageText` with region inline keyboard |
| `callback_query.data = "region:16"` | `POST /onboarding/region` | `editMessageText` with zone/subcity inline keyboard + "🔄 Change region" |
| `callback_query.data = "zone:25"` | `POST /onboarding/zone` | `editMessageText` asking for branch name (free text) |
| `message.text = "<branch name>"` | (buffered in session) | `sendMessage` asking for neighborhood |
| `message.text = "<neighborhood>"` | `POST /onboarding/branch-details` | `sendMessage` with grade-band inline keyboard (8 bands) |
| `callback_query.data = "gradeband:6-9"` | `POST /onboarding/grade-band` | `editMessageText` with grade-number inline keyboard for that band |
| `callback_query.data = "grade:7"` | `POST /onboarding/grade` | `sendMessage` profile summary, then `GET /interests/zone-options` → interest checkboxes |
| `callback_query.data = "int:toggle:26"` | `POST /interests/toggle` | `editMessageReplyMarkup` — same message, checkbox re-rendered ✅/⬜ |
| `callback_query.data = "int:change_region"` | (client-side prompt) → `region` picker → `POST /interests/change-region` | `editMessageText` with new region's zone checkboxes |
| `callback_query.data = "int:confirm"` | `POST /interests/confirm` | `sendMessage` confirmation + marketplace hint |

### 6.2 Example Telegram webhook payloads

**`/start`**
```json
POST /webhooks/telegram/bot
{
  "update_id": 900001,
  "message": {
    "message_id": 1,
    "from": { "id": 123456789, "username": "abebe_kebede", "is_bot": false },
    "chat": { "id": 123456789, "type": "private" },
    "text": "/start"
  }
}
```
Bot's outgoing `sendMessage`:
```json
{
  "chat_id": 123456789,
  "text": "Welcome! Please choose your language / እባክዎ ቋንቋ ይምረጡ:",
  "reply_markup": {
    "inline_keyboard": [[
      { "text": "English", "callback_data": "lang:en" },
      { "text": "አማርኛ", "callback_data": "lang:am" }
    ]]
  }
}
```

**Contact share**
```json
POST /webhooks/telegram/bot
{
  "update_id": 900002,
  "message": {
    "message_id": 3,
    "from": { "id": 123456789, "username": "abebe_kebede" },
    "chat": { "id": 123456789, "type": "private" },
    "contact": { "phone_number": "+251911223344", "first_name": "Abebe", "user_id": 123456789 }
  }
}
```
`user_id` on the contact matches `from.id` → `contactIsSelf: true` is derived server-side and
passed to `POST /onboarding/contact` (Section 6.3).

**Interest checkbox toggle**
```json
POST /webhooks/telegram/bot
{
  "update_id": 900011,
  "callback_query": {
    "id": "cbq_1",
    "from": { "id": 123456789 },
    "message": { "message_id": 14, "chat": { "id": 123456789 } },
    "data": "int:toggle:26"
  }
}
```
Bot's outgoing action is `answerCallbackQuery` (silent ack) + `editMessageReplyMarkup` on
`message_id: 14` with the updated checkbox states from the `POST /interests/toggle` response.

### 6.3 Onboarding wizard API

#### `POST /onboarding/start`
Request:
```json
{ "telegramId": 123456789, "telegramUsername": "abebe_kebede" }
```
Response — new user:
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
Edge case — already fully registered:
```json
{
  "success": true,
  "data": {
    "step": "already_registered",
    "userId": 4521,
    "bankName": "Commercial Bank of Ethiopia",
    "currentLocation": "East Shewa, Oromia",
    "branchName": "Adama Main Branch"
  },
  "message": "Welcome back! Use /feed to browse the marketplace or /profile to update your details."
}
```
Edge case — abandoned mid-flow, session resumed at last completed step:
```json
{ "success": true, "data": { "step": "select_bank", "resumed": true, "banks": [ "..." ] } }
```

#### `POST /onboarding/language`
Request: `{ "telegramId": 123456789, "language": "am" }`
Response:
```json
{
  "success": true,
  "data": {
    "step": "share_contact",
    "prompt": "ለመቀጠል የስልክ ቁጥርዎን ያጋሩ።",
    "requiresNativeContactShare": true
  }
}
```
Edge case — unsupported language:
```json
{ "success": false, "error": { "code": "INVALID_LANGUAGE", "message": "Supported languages are 'en' and 'am'." } }
```

#### `POST /onboarding/contact`
Request:
```json
{
  "telegramId": 123456789,
  "telegramUsername": "abebe_kebede",
  "phoneNumber": "+251911223344",
  "contactIsSelf": true
}
```
Response:
```json
{
  "success": true,
  "data": {
    "step": "select_bank",
    "banks": [
      { "id": 1, "name": "Commercial Bank of Ethiopia", "nickname": "cbe" },
      { "id": 2, "name": "Awash Bank", "nickname": "awash" }
    ],
    "page": 1, "pageSize": 10, "totalBanks": 31
  }
}
```
Edge case — shared contact belongs to someone else:
```json
{ "success": false, "error": { "code": "CONTACT_NOT_SELF", "message": "Please share your own contact, not someone else's." } }
```
Edge case — phone already registered under a different Telegram account for the same bank (FR-AUTH-003):
```json
{
  "success": false,
  "error": {
    "code": "DUPLICATE_PHONE",
    "message": "This phone number is already registered with Commercial Bank of Ethiopia under a different Telegram account."
  }
}
```
Edge case — no Telegram username set (allowed to proceed, flagged for later):
```json
{
  "success": true,
  "data": { "step": "select_bank", "banks": [ "..." ] },
  "message": "No Telegram username found — buyers will see your phone/branch on reveal instead. You can add a username in Telegram Settings anytime."
}
```
**OTP fallback** (used only if native contact-share is unavailable, per FR-AUTH-002):
`POST /onboarding/otp/request` → `{ "telegramId": 123456789, "phoneNumber": "+251911223344" }` →
`{ "success": true, "data": { "step": "otp_verify", "otpExpiresInSeconds": 300 } }`
`POST /onboarding/otp/verify` → `{ "telegramId": 123456789, "code": "482913" }` → same response
shape as `contact` success above, or `{ "success": false, "error": { "code": "OTP_INVALID", "message": "Incorrect or expired code." } }`.

#### `POST /onboarding/bank`
Request: `{ "telegramId": 123456789, "bankId": 1 }`
Response:
```json
{
  "success": true,
  "data": {
    "step": "select_region",
    "regions": [
      { "id": 1, "name": "Addis Ababa", "levelType": "region" },
      { "id": 16, "name": "Oromia", "levelType": "region" },
      { "id": 41, "name": "Amhara", "levelType": "region" }
    ]
  }
}
```
Edge case — invalid/inactive bank:
```json
{ "success": false, "error": { "code": "BANK_NOT_FOUND", "message": "Selected bank is not available." } }
```

#### `POST /onboarding/region`
Request: `{ "telegramId": 123456789, "regionId": 16 }`
Response:
```json
{
  "success": true,
  "data": {
    "step": "select_zone",
    "region": { "id": 16, "name": "Oromia" },
    "zones": [
      { "id": 25, "name": "East Shewa" },
      { "id": 35, "name": "Jimma" },
      { "id": 39, "name": "Sheger City" }
    ]
  }
}
```

#### `POST /onboarding/zone`
Request: `{ "telegramId": 123456789, "zoneId": 25 }`
Response:
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
Edge case — `zoneId` doesn't belong to the previously selected region (stale/tampered client state):
```json
{ "success": false, "error": { "code": "ZONE_REGION_MISMATCH", "message": "Please pick a zone from the region you selected." } }
```

#### `POST /onboarding/branch-details`
Request:
```json
{
  "telegramId": 123456789,
  "branchName": "Adama Main Branch",
  "neighborhood": "Bole Road, near Adama Stadium"
}
```
Response:
```json
{
  "success": true,
  "data": {
    "step": "select_grade",
    "grades": [
      { "id": 11, "name": "Officer I" },
      { "id": 12, "name": "Officer II" },
      { "id": 13, "name": "Senior Officer" }
    ]
  }
}
```
Edge case — branch name too short:
```json
{ "success": false, "error": { "code": "INVALID_BRANCH_NAME", "message": "Branch name must be at least 3 characters." } }
```
Edge case — neighborhood omitted (allowed, it's optional):
```json
{ "success": true, "data": { "step": "select_grade", "grades": [ "..." ] }, "message": "Neighborhood skipped — you can add it later from /profile." }
```

#### `POST /onboarding/grade-band`
Grade is shared, industry-standard reference data (not bank-scoped, Section 3.1/3.3) — 18
individual grade numbers don't fit one inline-keyboard screen, so selection is two-tier: pick a
band first, then a specific grade number within it (same UX pattern as region → zone).

Request: `{ "telegramId": 123456789, "bandLabel": "Grades 6–9" }`
Response:
```json
{
  "success": true,
  "data": {
    "step": "select_grade_number",
    "band": { "bandLabel": "Grades 6–9", "tierClassification": "Junior Professional" },
    "grades": [
      { "id": 6, "gradeNumber": 6, "typicalRoles": "CSO I, Junior IT, Junior Auditor" },
      { "id": 7, "gradeNumber": 7, "typicalRoles": "CSO I, Junior IT, Junior Auditor" },
      { "id": 8, "gradeNumber": 8, "typicalRoles": "CSO I, Junior IT, Junior Auditor" },
      { "id": 9, "gradeNumber": 9, "typicalRoles": "CSO I, Junior IT, Junior Auditor" }
    ]
  }
}
```
Edge case — unknown/inactive band: `{ "success": false, "error": { "code": "BAND_NOT_FOUND", "message": "Selected grade band is not available." } }`

#### `POST /onboarding/grade`
Request: `{ "telegramId": 123456789, "gradeId": 7 }`
Response — profile created and activated:
```json
{
  "success": true,
  "data": {
    "step": "profile_created",
    "userId": 4521,
    "summary": {
      "bank": "Commercial Bank of Ethiopia",
      "region": "Oromia",
      "zone": "East Shewa",
      "branchName": "Adama Main Branch",
      "grade": "Grade 7 — Junior Professional"
    }
  }
}
```
Edge case — `gradeId` doesn't belong to the previously selected band (stale/tampered client state):
```json
{ "success": false, "error": { "code": "GRADE_BAND_MISMATCH", "message": "Please pick a grade from the band you selected." } }
```

The bot chains this directly into the interest step by calling
`GET /interests/zone-options` (Section 6.4) immediately after showing the profile summary.

### 6.4 Interest selection API

Interest selection defaults to the user's **own** region, shown as a multi-select checkbox list,
with a "🔄 Change region" action to browse and pick from a different region's zones. The
in-progress multi-select set is held server-side in the same Redis wizard session (keyed by
`telegramId`) so it survives across the many separate Telegram callback-query webhook calls one
checkbox toggle produces.

#### `GET /interests/zone-options?telegramId=123456789&regionId=16`
(`regionId` optional — defaults to the user's own region when omitted)

Response:
```json
{
  "success": true,
  "data": {
    "region": { "id": 16, "name": "Oromia" },
    "isUserHomeRegion": true,
    "zones": [
      { "id": 25, "name": "East Shewa", "selected": false },
      { "id": 26, "name": "West Shewa", "selected": false },
      { "id": 35, "name": "Jimma", "selected": true },
      { "id": 39, "name": "Sheger City", "selected": false }
    ],
    "currentSelectionCount": 1
  }
}
```
Edge case — called before registration finished:
```json
{ "success": false, "error": { "code": "PROFILE_INCOMPLETE", "message": "Please finish registration before selecting transfer interests." } }
```

#### `POST /interests/toggle`
Toggles one zone's checkbox (fired on every inline-keyboard tap so the bot can `editMessageReplyMarkup` in place):
Request: `{ "telegramId": 123456789, "regionId": 16, "locationId": 26 }`
Response:
```json
{
  "success": true,
  "data": {
    "region": { "id": 16, "name": "Oromia" },
    "zones": [
      { "id": 25, "name": "East Shewa", "selected": false },
      { "id": 26, "name": "West Shewa", "selected": true },
      { "id": 35, "name": "Jimma", "selected": true },
      { "id": 39, "name": "Sheger City", "selected": false }
    ],
    "currentSelectionCount": 2
  }
}
```
Edge case — toggling a zone from a region the user isn't currently viewing (stale callback from an old message):
```json
{ "success": false, "error": { "code": "STALE_INTERACTION", "message": "This selection screen has expired — please reopen /interests." } }
```

#### `POST /interests/change-region`
Request: `{ "telegramId": 123456789, "newRegionId": 41 }`
Response — re-fetches the new region's zones; prior picks in other regions are kept in the session:
```json
{
  "success": true,
  "data": {
    "region": { "id": 41, "name": "Amhara" },
    "isUserHomeRegion": false,
    "zones": [
      { "id": 42, "name": "North Gondar", "selected": false },
      { "id": 53, "name": "Bahir Dar Special Zone", "selected": false }
    ],
    "currentSelectionCount": 2
  },
  "message": "Your 2 selections in other regions are still kept. Confirm when done."
}
```

#### `POST /interests/confirm`
Persists the accumulated selection set as `transfer_interests` rows (idempotent — re-confirming
existing picks is a no-op thanks to the `uq_user_location` constraint).
Request: `{ "telegramId": 123456789 }`
Response:
```json
{
  "success": true,
  "data": {
    "createdInterests": [
      { "id": 9001, "locationId": 26, "locationName": "West Shewa" },
      { "id": 9002, "locationId": 35, "locationName": "Jimma" }
    ],
    "totalActiveInterests": 2
  },
  "message": "You'll be notified when a matching lead appears. Use /feed anytime to browse now."
}
```
Edge case — confirm called with nothing selected:
```json
{ "success": false, "error": { "code": "NO_SELECTION", "message": "Select at least one location before confirming." } }
```

#### `GET /interests/me`
Response:
```json
{
  "success": true,
  "data": {
    "interests": [
      { "id": 9001, "locationId": 26, "locationName": "West Shewa", "levelType": "zone_subcity", "createdAt": "2026-07-10T08:12:00Z" },
      { "id": 9002, "locationId": 35, "locationName": "Jimma", "levelType": "zone_subcity", "createdAt": "2026-07-10T08:12:00Z" }
    ]
  }
}
```

#### `DELETE /interests/:id`
Response: `{ "success": true, "data": { "deletedId": 9002 } }`
Edge case — not the owner:
```json
{ "success": false, "error": { "code": "FORBIDDEN", "message": "You can only remove your own interests." } }
```
Edge case — not found: `{ "success": false, "error": { "code": "NOT_FOUND", "message": "Interest not found." } }`

### 6.5 Profile

#### `GET /me`
Response:
```json
{
  "success": true,
  "data": {
    "userId": 4521, "bank": "Commercial Bank of Ethiopia",
    "region": "Oromia", "zone": "East Shewa",
    "branchName": "Adama Main Branch", "neighborhood": "Bole Road, near Adama Stadium",
    "grade": { "gradeNumber": 7, "bandLabel": "Grades 6–9", "tierClassification": "Junior Professional" },
    "preferredLanguage": "am"
  }
}
```

#### `PUT /me`
Self-service (Open Item #2 in Section 15 resolved: no admin verification gate). Any subset of
`branchName`, `neighborhood`, `regionId`+`zoneId`, `gradeId`, `preferredLanguage` may be updated directly; bank cannot
be changed post-registration (would invalidate matching/purchase history — unsupported in v1).
Request: `{ "branchName": "Adama Main Branch 2", "neighborhood": "Near the roundabout", "regionId": 16, "zoneId": 26, "gradeId": 8, "preferredLanguage": "en" }`
Response: `{ "success": true, "data": { "updated": true } }`
Edge case — `zoneId` doesn't belong to `regionId` (same validation as onboarding):
```json
{ "success": false, "error": { "code": "ZONE_REGION_MISMATCH", "message": "Please pick a zone from the region you selected." } }
```
Edge case — attempting to change `bankId`:
```json
{ "success": false, "error": { "code": "BANK_CHANGE_UNSUPPORTED", "message": "Changing your bank isn't supported — please contact support." } }
```

### 6.6 Marketplace feed

#### `GET /marketplace/feed?page=1&pageSize=10&fresh=false`
Response — sorted mutual matches first (Section 5), then by specificity, region-level matches
naturally sink further down but stay visible with a `matchWarning`:
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "candidateId": "c_7742",
        "grade": "Grade 8 — Junior Professional",
        "matchedLocation": "East Shewa, Oromia",
        "specificity": "zone_subcity",
        "isMutualMatch": true,
        "matchWarning": null,
        "unlocked": false
      },
      {
        "candidateId": "c_9931",
        "grade": "Grade 7 — Junior Professional",
        "matchedLocation": "Oromia",
        "specificity": "region",
        "isMutualMatch": false,
        "matchWarning": "This candidate is interested in the broader Oromia region, not specifically East Shewa.",
        "unlocked": true,
        "contact": { "telegramUsername": "sara_bekele", "phone": "+251911998877", "branchName": "Bole Branch" }
      }
    ],
    "page": 1, "pageSize": 10, "totalResults": 2
  }
}
```
`isMutualMatch: true` means this candidate is also currently sitting somewhere the requesting
user has expressed interest in — a two-way swap opportunity, not just a one-directional lead
(Section 5). `matchedLocation` and `matchWarning` are always free regardless of specificity —
only identity fields (`telegramUsername`, `phone`, `branchName`) require a purchase.

Edge case — no matches yet:
```json
{ "success": true, "data": { "results": [], "page": 1, "pageSize": 10, "totalResults": 0 }, "message": "No matches yet. We'll notify you as soon as one appears." }
```

### 6.7 Purchases & payments

#### `POST /purchases`
Request: `{ "targetUserId": 9931 }`
Response — invoice created, awaiting payment:
```json
{
  "success": true,
  "data": {
    "purchaseId": 5501,
    "paymentId": 8801,
    "status": "pending",
    "telegramInvoiceLink": "https://t.me/invoice/xxxxx"
  }
}
```
Edge case — already purchased (BR-006):
```json
{ "success": false, "error": { "code": "ALREADY_PURCHASED", "message": "You've already unlocked this contact." } }
```
Edge case — target no longer active:
```json
{ "success": false, "error": { "code": "TARGET_INACTIVE", "message": "This candidate is no longer available." } }
```

#### `POST /webhooks/telegram/payments`
Handles `pre_checkout_query` (must be answered within Telegram's timeout) and `successful_payment`.
Request (successful_payment excerpt):
```json
{
  "update_id": 900050,
  "message": {
    "successful_payment": {
      "telegram_payment_charge_id": "tg_charge_abc123",
      "total_amount": 5000,
      "currency": "ETB",
      "invoice_payload": "purchase:5501"
    }
  }
}
```
Response (to Telegram): `200 OK` (empty body). Internally: marks `payments.status='completed'`,
finalizes the `purchases` row, enqueues a payment-confirmation notification, writes an audit log.
Edge case — duplicate webhook delivery (same `telegram_payment_charge_id` already completed):
processed as a no-op, still returns `200 OK` (idempotency, FR-PAY-002).

#### `GET /me/purchases`
Response:
```json
{ "success": true, "data": { "purchases": [ { "purchaseId": 5501, "targetUserId": 9931, "status": "completed", "createdAt": "2026-07-15T09:00:00Z" } ] } }
```

### 6.8 Notifications

#### `GET /me/notifications`
Response:
```json
{ "success": true, "data": { "notifications": [ { "type": "digest", "sentAt": "2026-07-16T06:00:00Z", "summary": "2 new matches near East Shewa" } ] } }
```

#### `POST /admin/api/v1/notifications/broadcast`

Sends a promotion to a chosen audience. `segmentFilter.scope` controls reach:
- `"all"` — every active user (no further filter required; bankId/regionId/zoneId ignored)
- `"bank"` — all active users in one bank (requires `bankId`)
- `"region"` — all active users whose `current_location_id` resolves under `regionId`
  (uses the location_ancestors closure; covers every zone/subcity in that region)
- `"zone"` — all active users whose `current_location_id = zoneId` (zone/subcity only)

Filters can be combined where it makes sense: `bank` + `region` narrows to users of
that bank in that region; `bank` + `zone` narrows further. The endpoint validates the
combination and rejects contradictions (e.g. `zoneId` whose parent isn't `regionId`).

Request — all users:
```json
{
  "segmentFilter": { "scope": "all" },
  "message": { "en": "Platform maintenance tonight 11pm-12am.", "am": "..." }
}
```

Request — region-scoped (optionally within a bank):
```json
{
  "segmentFilter": { "scope": "region", "regionId": 16, "bankId": 1 },
  "message": { "en": "...", "am": "..." }
}
```

Request — zone-scoped:
```json
{
  "segmentFilter": { "scope": "zone", "zoneId": 25, "bankId": 1 },
  "message": { "en": "...", "am": "..." }
}
```

Response:
```json
{ "success": true, "data": { "queuedRecipients": 214 } }
```

Edge case — empty segment:
```json
{ "success": false, "error": { "code": "EMPTY_SEGMENT", "message": "No users match this filter." } }
```
Edge case — `zoneId` not a `zone_subcity` (e.g. someone passes a region id):
```json
{ "success": false, "error": { "code": "INVALID_ZONE", "message": "zoneId must reference a zone_subcity, not a region." } }
```
Edge case — `zoneId`'s parent doesn't match `regionId` (when both supplied):
```json
{ "success": false, "error": { "code": "ZONE_REGION_MISMATCH", "message": "The selected zone does not belong to the selected region." } }
```
Edge case — region/zone scope without the corresponding id:
```json
{ "success": false, "error": { "code": "FILTER_INCOMPLETE", "message": "scope 'region' requires regionId; scope 'zone' requires zoneId." } }
```

### 6.9 Admin reference data & staff

All endpoints under `/admin/api/v1`, RBAC-gated (Super Admin or Platform Admin only, per Section 11).
Every mutation writes an `audit_logs` row (SEC-006) and, for location mutations, debounces a
closure-table rebuild (Section 4.2).

#### Banks — add (banks table only, never touches locations/grades)

`POST /admin/api/v1/banks`
Request:
```json
{
  "name": "New Bank S.C.",
  "nameAm": "ኒው ባንክ ኤስ.ሲ.",
  "nickname": "newbank",
  "swiftCode": "NEWBETAA",
  "yearEstablished": 2026
}
```
Response: `{ "success": true, "data": { "id": 32 } }`
Edge case — duplicate nickname:
```json
{ "success": false, "error": { "code": "DUPLICATE_NICKNAME", "message": "Nickname already in use." } }
```

#### Banks — edit

`PATCH /admin/api/v1/banks/:id`
Request (any subset): `{ "name": "New Bank S.C. (Renamed)", "nameAm": "...", "isActive": false }`
Response: `{ "success": true, "data": { "id": 32, "updated": true } }`
Edge case — nickname collision on another row:
```json
{ "success": false, "error": { "code": "DUPLICATE_NICKNAME", "message": "Nickname already in use." } }
```
Edge case — bank has active users and admin tries to deactivate:
```json
{
  "success": false,
  "error": {
    "code": "BANK_HAS_ACTIVE_USERS",
    "message": "Cannot deactivate a bank with active users. Reassign or deactivate users first."
  }
}
```
*Note: editing a bank never modifies locations or grades — they share no foreign key.*

#### Locations — add region or zone

`POST /admin/api/v1/locations`
Request (region):
```json
{ "name": "New Region", "nameAm": "...", "levelType": "region" }
```
Request (zone):
```json
{ "name": "New Zone", "nameAm": "...", "levelType": "zone_subcity", "parentId": 16 }
```
Response: `{ "success": true, "data": { "id": 200, "closureRebuildQueued": true } }`
Edge case — zone without parentId:
```json
{ "success": false, "error": { "code": "PARENT_REQUIRED", "message": "A zone/subcity must specify a parent region." } }
```
Edge case — parent is not a region:
```json
{ "success": false, "error": { "code": "INVALID_PARENT_LEVEL", "message": "Parent must be a region." } }
```

#### Locations — edit (rename, move, activate/deactivate)

`PATCH /admin/api/v1/locations/:id`
Request (any subset): `{ "name": "Renamed Zone", "nameAm": "...", "parentId": 41, "isActive": true }`
Response: `{ "success": true, "data": { "id": 200, "updated": true, "closureRebuildQueued": true } }`
Edge case — moving a region (regions have no parent):
```json
{ "success": false, "error": { "code": "REGION_CANNOT_HAVE_PARENT", "message": "Regions are top-level and cannot be reassigned a parent." } }
```
Edge case — setting `parentId` creates a cycle (a location reparented under its own descendant):
```json
{ "success": false, "error": { "code": "CYCLE_DETECTED", "message": "A location cannot be moved under its own descendant." } }
```
Edge case — location has active users and admin tries to deactivate:
```json
{ "success": false, "error": { "code": "LOCATION_HAS_ACTIVE_USERS", "message": "Cannot deactivate a location with active users." } }
```
*Side effect: every successful PATCH triggers the debounced closure rebuild (Section 4.2) so matching stays correct.*

#### Grades — add

`POST /admin/api/v1/grades`
Request:
```json
{
  "gradeNumber": 19,
  "bandLabel": "Grade 18+",
  "bandLabelAm": "...",
  "tierClassification": "Executive / C-Suite",
  "tierClassificationAm": "...",
  "typicalRoles": "Group CEO",
  "typicalRolesAm": "...",
  "rankOrder": 19
}
```
Response: `{ "success": true, "data": { "id": 19 } }`
Edge case — duplicate grade number:
```json
{ "success": false, "error": { "code": "DUPLICATE_GRADE_NUMBER", "message": "Grade number already exists." } }
```

#### Grades — edit

`PATCH /admin/api/v1/grades/:id`
Request (any subset): `{ "bandLabel": "Grades 18+", "bandLabelAm": "...", "typicalRolesAm": "...", "isActive": true }`
Response: `{ "success": true, "data": { "id": 19, "updated": true } }`
Edge case — grade has active users and admin tries to deactivate:
```json
{ "success": false, "error": { "code": "GRADE_HAS_ACTIVE_USERS", "message": "Cannot deactivate a grade with active users." } }
```
*Note: editing a grade never modifies banks or locations.*

#### Staff & User Status Management

`PATCH /admin/api/v1/users/:id/status`
Request: `{ "isActive": false, "reason": "Duplicate account, merged with #4521" }`
Response: `{ "success": true, "data": { "userId": 4599, "isActive": false } }`

### 6.10 Reporting & Monitoring

#### `GET /admin/api/v1/dashboard/summary`
Response:
```json
{
  "success": true,
  "data": { "activeUsers": 1834, "totalInterests": 3021, "totalPurchases": 412, "revenueEtb": 206000 }
}
```

#### `GET /admin/api/v1/reports/revenue?from=2026-07-01&to=2026-07-15&bankId=1`
Response:
```json
{ "success": true, "data": { "revenueEtb": 62500, "purchaseCount": 125, "byBank": [ { "bankId": 1, "revenueEtb": 62500 } ] } }
```

#### `GET /admin/api/v1/reports/export?type=revenue&format=xlsx`
Response: `200 OK`, `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, binary file stream.

#### `GET /admin/api/v1/users?q=&bankId=&regionId=&zoneId=&gradeId=&isActive=&page=&pageSize=`
Search/list users for monitoring. `q` matches phone, telegram_username, branch_name.

Response:
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": 4521, "phone": "+251911***344", "telegramUsername": "abebe_kebede",
        "bankId": 1, "bankName": "Commercial Bank of Ethiopia",
        "regionId": 16, "regionName": "Oromia",
        "zoneId": 25, "zoneName": "East Shewa",
        "branchName": "Adama Main Branch",
        "gradeId": 7, "gradeLabel": "Grade 7 — Junior Professional",
        "isActive": true, "interestsCount": 2, "purchasesCount": 0,
        "createdAt": "2026-07-10T08:00:00Z", "lastActivityAt": "2026-07-16T06:14:00Z"
      }
    ],
    "page": 1, "pageSize": 25, "totalResults": 1834
  }
}
```
*Note: phone is masked in list view; full phone only on the detail view, and only if the staff caller has Support Officer role or higher (SEC-006 audit log fires).*

#### `GET /admin/api/v1/users/:id`
Per-user monitor view — registration timeline, interest history, purchases made, purchases of this user by others, last feed refresh, last notification sent.

Response:
```json
{
  "success": true,
  "data": {
    "id": 4521,
    "profile": {
      "bankName": "Commercial Bank of Ethiopia",
      "regionName": "Oromia", "zoneName": "East Shewa",
      "branchName": "Adama Main Branch",
      "gradeLabel": "Grade 7 — Junior Professional",
      "preferredLanguage": "am", "isActive": true, "createdAt": "2026-07-10T08:00:00Z"
    },
    "stats": {
      "interestsCount": 2, "purchasesMadeCount": 0,
      "purchasesOfMeCount": 3, "totalSpentEtb": 0,
      "totalRevealedByOthersEtb": 1500
    },
    "activity": [
      { "at": "2026-07-16T06:14:00Z", "type": "feed_view" },
      { "at": "2026-07-15T09:00:00Z", "type": "purchase", "targetUserId": 9931, "amountEtb": 500 },
      { "at": "2026-07-10T08:12:00Z", "type": "registration_complete" }
    ]
  }
}
```

#### `GET /admin/api/v1/system/health`
Queue depths, webhook delivery success rate (last 1h), payment success rate (last 24h), MySQL/Redis ping, active sessions count. For ops monitoring, not end-user data.

---

## 7. Redis Usage

| Purpose | Key pattern | TTL / notes |
|---|---|---|
| Bot onboarding/interest wizard session (FSM) | `bot:session:{telegramId}` | 24h TTL; holds `{step, languageChoice, pendingBankId, pendingRegionId, pendingZoneId, branchName, neighborhood, pendingGradeBand, selectedInterestLocationIds:[...]}` |
| Feed cache | `feed:{bankId}:{userId}:{locationId}:{adj}:{page}` | 30–60s; bypassed by `?fresh=true` |
| Rate limiting (per-user) | `rl:{route}:{userId}` | Sliding window via `rate-limiter-flexible` (SEC-008) |
| Rate limiting (admin login) | `rl:admin-login:{ip}` | Locks out after N failures (SEC-005) |
| Purchase double-charge lock | `lock:purchase:{buyerId}:{targetId}` | Short-lived mutex around purchase creation to close the race window before the DB unique constraint applies |
| Closure rebuild debounce | `debounce:closure-rebuild` | Coalesces bursts of admin location edits |
| Session store (admin) | `session:{staffId}` | Backing store for admin idle-timeout (SEC-009) |

**BullMQ queues:**
- `digest-notifications` — daily repeatable job; for each active user, computes "new qualifying
  interests since last digest" and enqueues one notification-send task per user (batched, not a
  per-request loop).
- `broadcast-notifications` — admin-triggered ad hoc fan-out to all users or a filtered segment.
- `payment-webhook-processing` — decouples Telegram webhook receipt (must ack fast) from
  downstream work (mark payment completed, create purchase reveal, send confirmation, write audit
  log), with retry/backoff on transient failures.

---

## 8. Payment Integration (FR-PAY-001…005)

**Provider-agnostic by design (payment instrument remains an open item — SRS §16, Section 15
below).** `PaymentService` must be implemented behind a provider interface —
`createInvoice(purchase)`, `verifyWebhook(req)`, `parseSuccessfulPayment(payload)` — with a
`TelegramStarsProvider` as the only concrete implementation for now. Core `PurchaseService` logic
(Section 6.7, this section) must call only the interface, never Stars-specific request/response
shapes directly, so a `ChapaProvider` (or others) can be added later purely as a new adapter — no
changes to `purchases`/`payments` schema (already provider-agnostic via `payments.provider` and
`raw_payload JSON`) or to calling code.

Flow:
1. User selects a feed entry → `POST /purchases` creates a `purchases` row in a pre-payment state
   and a corresponding `payments` row (`status='pending'`).
2. Server calls Telegram's invoice API (Stars or a configured provider — see Open Item below) to
   generate an invoice for the bot/Mini App to present.
3. Telegram sends a `pre_checkout_query` webhook — the server must answer within Telegram's
   timeout window, re-validating the purchase is still valid (not already paid, target still
   active).
4. On `successful_payment`, the webhook handler:
   - Looks up `payments` by `telegram_charge_id` — if already `completed`, no-op (idempotency,
     FR-PAY-002).
   - Marks `payments.status = 'completed'`.
   - Marks the linked `purchases` row as finalized, populating `revealed_fields`.
   - Enqueues a payment-confirmation notification (FR-PAY-004).
   - Writes an `audit_logs` entry.
5. The reveal endpoint (feed / `GET /purchases/:id`) checks for a completed `payments` row before
   including contact fields in the response (SEC-010).

**Open item carried from SRS §16 / §5.7:** confirm whether Telegram Stars or a third-party
provider (e.g., Chapa) will be used before implementing `FR-PAY-001` — Telegram's current
digital-goods policy may require Stars for in-bot/Mini-App digital purchases. The `payments.provider`
column is designed to support either without a schema change.

---

## 9. Notification System (FR-NOT-001…004)

- **Digest job** (`digest-notifications`, scheduled daily): for each active user, query
  `transfer_interests` created since `users.last_digest_at` whose `location_id` closure-matches
  the user's `current_location_id`, within their bank and grade adjacency (same predicate as the
  live feed query, scoped by `created_at > last_digest_at`). If any qualifying rows exist, enqueue
  a notification task and update `last_digest_at`.
- **Broadcast**: admin-composed message + segment filter (all users, or filtered by bank/region/
  grade); fanned out via the same queue infrastructure to avoid blocking the API process.
  Audience-resolution SQL by scope:
  ```sql
  -- scope = 'all'
  SELECT id FROM users WHERE is_active = TRUE;

  -- scope = 'bank'
  SELECT id FROM users WHERE is_active = TRUE AND bank_id = :bankId;

  -- scope = 'region'
  SELECT u.id FROM users u
  JOIN location_ancestors la ON la.descendant_id = u.current_location_id
  WHERE u.is_active = TRUE
    AND la.ancestor_id = :regionId
    AND (:bankId IS NULL OR u.bank_id = :bankId);

  -- scope = 'zone'
  SELECT id FROM users
  WHERE is_active = TRUE
    AND current_location_id = :zoneId
    AND (:bankId IS NULL OR bank_id = :bankId);
  ```
- **Transactional**: registration confirmation, payment confirmation — enqueued inline at the
  point of the triggering event.
- **Channels**: Telegram Bot messages are primary; email/SMS are optional fallback channels
  (config per notification type), useful mainly for staff/admin alerts.

---

## 10. Security (SEC-001…011)

| Requirement | Implementation |
|---|---|
| SEC-001 HTTPS/TLS | Terminate TLS at load balancer/reverse proxy; enforce `Strict-Transport-Security` |
| SEC-002 Password hashing | `bcrypt` or `argon2id` for `staff.password_hash` |
| SEC-003 initData verification | Validate Telegram WebApp `initData` HMAC using the bot token per Telegram's documented algorithm, on every Mini App request |
| SEC-004 RBAC enforcement | Central `requireRole([...])` Express middleware on every Admin PWA/API route |
| SEC-005 Login rate limiting | Redis-backed limiter + exponential lockout on repeated admin login failures |
| SEC-006 Audit logging | Write-through `AuditService.log()` call inside purchase, payment, and all admin mutation handlers |
| SEC-007 Webhook integrity | Verify Telegram webhook secret token header; process `successful_payment` idempotently keyed on `telegram_charge_id` |
| SEC-008 API rate limiting | `rate-limiter-flexible` with Redis store on feed and purchase endpoints specifically (scraping/abuse vectors) |
| SEC-009 Admin session timeout | Configurable idle timeout on staff JWT/session (e.g., 30 min) |
| SEC-010 Contact hiding | Query-level field suppression — contact fields are only ever selected/serialized when a completed `purchases` row exists for that buyer/target pair |
| SEC-011 Router-Token Binding | Every request is gated by a `router-scope` check that matches the token type to the router: staff JWTs only authenticate on `/admin/api/v1/*`; user JWTs / Telegram initData only authenticate on `/api/v1/*`. A stolen staff token replayed against `/api/v1/*` (or vice versa) returns `401 invalid_token_for_router` before any handler runs. This is server-side and independent of CORS, which only constrains browsers. |

Additional standard hardening: `helmet` middleware, parameterized queries / query builder (no raw
string concatenation), input validation (e.g., `zod` or `joi`) on every mutating endpoint,
`express-mysql-session` or JWT with short expiry + refresh for admin auth.

---

## 11. RBAC Matrix (FR-RBAC-001…003)

| Capability | Super Admin | Platform Admin | Finance/Reconciliation | Support Officer | Employee |
|---|:---:|:---:|:---:|:---:|:---:|
| Manage reference data (banks/locations/grades) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Manage staff accounts & roles | ✅ | ❌ | ❌ | ❌ | ❌ |
| Activate/deactivate user accounts | ✅ | ✅ | ❌ | ✅ | ❌ |
| Send broadcast notifications | ✅ | ✅ | ❌ | ❌ | ❌ |
| View revenue/payment reports | ✅ | ❌ | ✅ | ❌ | ❌ |
| View activity/interest reports & monitor users | ✅ | ✅ | ✅ | ✅ (read-only) | ❌ |
| View audit logs | ✅ | ✅ | ❌ | ❌ | ❌ |
| Own profile, interests, feed, purchases | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## 12. Non-Functional Implementation Notes

- **Feed response < 3s @ 1,000+ users:** indexed `location_ancestors` join + Redis feed cache +
  MySQL connection pooling (`mysql2` pool, sized to `worker_count * pool_per_worker`).
- **Reveal confirmation < 5s of payment confirmation:** webhook handler does the minimal
  synchronous work (mark payment + purchase complete) and defers notification send + audit
  logging to the queue.
- **Payment status reflected within 1 minute:** webhook-driven (push), not polling.
- **99% uptime target:** run `api` behind a load balancer with ≥2 instances; MySQL with automated
  daily backups (SRS §11 Backup); Redis used only for cache/queue/rate-limit/session state
  (nothing there is the sole source of truth) so a Redis restart doesn't lose durable data —
  BullMQ jobs should be safe to replay.
- **Scalability to 1,000+ users:** queue-based fan-out (Section 7) and closure-table matching
  (Section 5) are the two load-bearing scalability decisions in this design.

---

## 13. Environment Configuration

```
# Server
PORT=3000
NODE_ENV=production

# MySQL
DB_HOST=
DB_PORT=3306
DB_NAME=lateral_transfer
DB_USER=
DB_PASSWORD=
DB_POOL_MIN=2
DB_POOL_MAX=20

# Redis
REDIS_URL=

# Telegram
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
TELEGRAM_PAYMENTS_PROVIDER_TOKEN=   # or leave unset if using Telegram Stars

# Auth
JWT_SECRET=
ADMIN_SESSION_TTL_MINUTES=30

# CORS / Router Origins
MINIAPP_ORIGIN=https://miniapp.yourdomain.com
ADMIN_PWA_ORIGIN=https://admin.yourdomain.com

# Notifications (optional fallback channels)
SMS_GATEWAY_API_KEY=
EMAIL_SMTP_URL=

# Business config
DEFAULT_GRADE_ADJACENCY_RANGE=1    # meaningful globally — all banks share one 1-18 grade scale
DIGEST_SCHEDULE_CRON=0 6 * * *      # daily 06:00
BOT_SESSION_TTL_HOURS=24
```

Recommended migration tooling: `knex` or `Prisma Migrate` for versioned schema changes; the
geography seed script (Section 4.1) runs once via `npm run seed:geography`, idempotent on re-run
(upsert by `name` + `parent_id`).

---

## 14. Deployment Notes

- Containerize `api` and `worker` as separate images/services from the same codebase
  (`CMD ["node", "src/server.js"]` vs `CMD ["node", "src/worker.js"]`) so they scale
  independently.
- Admin PWA is a static SPA build, served either from a CDN/static host or from the same Express
  app behind `/admin`; it only ever talks to `/admin/api/v1/*`.
- Use a process manager (PM2) or a container orchestrator (Docker Compose for staging,
  Kubernetes/ECS for production) with health checks on `GET /healthz` (DB + Redis ping).
- Telegram webhook URL must be HTTPS and registered via `setWebhook`; keep
  `TELEGRAM_WEBHOOK_SECRET` validated on every incoming webhook request.

---

## 15. Open Items Affecting Backend Implementation

Carried from SRS §16, updated with decisions confirmed July 16, 2026:

1. **Payment instrument** (Stars vs. third-party e.g. Chapa) — **still open.** Affects which
   `PaymentService` provider adapter ships first, and `payments.provider` values; schema already
   supports either. Build behind the provider interface described in Section 8 so this can be
   decided without blocking the rest of Section 6.7/8.
2. **Location/grade change after registration — RESOLVED: self-service.** No
   `profile_change_requests` table. `PUT /me` (Section 6.5) directly mutates
   `current_location_id`/`grade_id` with the same validation used during onboarding
   (`ZONE_REGION_MISMATCH`). `branch_name`/`neighborhood` were already self-service.
3. **Exact revealed fields on purchase** (username / phone / branch, or combination) — already
   modeled as `purchases.revealed_fields JSON`, so this is a business-config decision, not a
   schema change.
4. **Digest frequency configurable per user** — still open, v1 stays daily-only. If required
   later, add `users.digest_frequency ENUM('daily','weekly') DEFAULT 'daily'` and branch the
   scheduler query accordingly; omitted from the v1 schema pending confirmation.
5. **Grade scheme — RESOLVED: shared, industry-standard matrix, not per-bank.** See Section
   3.1/3.3/4.3. This also resolves the previously-open question of how grade-adjacency (BR-003)
   could be compared consistently across banks with different grade scales — it can't be an
   issue anymore since every bank now shares one 1–18 rank scale.

---

## 16. Localization (i18n)

Two distinct problems, handled differently — don't conflate them:

1. **Reference data has two names** (a bank name, a region/zone name, a grade band/tier label) —
   this is translated *content*, stored per-row.
2. **API/bot messages are templated** (`"Selected bank is not available."`, `"Welcome back!
   Use /feed..."`) — this is a *message catalog* keyed by a stable code, resolved per-request.

### 16.1 Reference data translation (schema)

Non-nullable `_am` columns sit alongside the existing English columns directly in the base schema
(Section 3.2: `banks.name_am`, `locations.name_am`, `grades.band_label_am` /
`tier_classification_am` / `typical_roles_am`, `staff.preferred_language`) — parallel columns, not
a separate translations table, since the reference data is small (31 banks, 119 locations, 18
grades) and a join on every matching/feed query would cost more than it's worth. 

Because we are enforcing Amharic as a first-class citizen from day one, all seed scripts (`scripts/seed-geography.js`, `scripts/seed-grades.js`) explicitly map Amharic fields from the source JSON into the database. The database enforces `NOT NULL` on these columns, ensuring incomplete seed data fails fast during deployment rather than silently rendering English.

(`users.preferred_language` also already lives in Section 3.2 — it's the column this whole system
resolves against for end users.)

**Resolution rule, applied at the query/serialization layer, never left to the client:**
```sql
SELECT IF(:lang = 'am', name_am, name) AS name FROM banks;
```
Every endpoint that returns a bank/location/grade name (onboarding pickers, `PUT /me`'s zone
validation echo, feed's `matchedLocation`, `matchWarning`'s embedded place names, notification
digests) returns **one already-resolved `name` field**, not `{name, nameAm}` pairs — the server
picks the right string once, so the bot and Mini App never have to carry their own copy of the
reference data or decide which language to render. 

**Content ownership:** `grades-seed.json`, `seed-data.json` (banks and locations) must have the Amharic strings finalized and approved by the business/HR before the initial production seed is run. The schema strictness (`NOT NULL`) acts as a deployment gate to guarantee this.

### 16.2 Message catalog (API/bot response text)

Every hardcoded English string in this document's request/response examples (Section 6) is a
**catalog entry**, not literal text to ship as-is. Two files, one key set:

```
/i18n/en.json   { "CONTACT_NOT_SELF": "Please share your own contact, not someone else's.",
                  "onboarding.welcome": "Welcome! Please choose your language:", ... }
/i18n/am.json   { "CONTACT_NOT_SELF": "እባክዎ የራስዎን እውቂያ ያጋሩ፣ የሌላ ሰው አይደለም።",
                  "onboarding.welcome": "እንኳን ደህና መጡ! እባክዎ ቋንቋ ይምረጡ:", ... }
```

`LocalizationService.t(key, lang, params?)` is the single call site every response builder and
the central error-handling middleware goes through. **The `code` in the error envelope
(`{"error":{"code":"CONTACT_NOT_SELF", "message": "..."}}`) stays a stable, English, uppercase
identifier always** — it's what the bot/Mini App branch logic on. Only `message` (and any
top-level success `message`) is resolved through the catalog. This matches the existing envelope
shape in Section 6.0 exactly — no breaking change, `message` was already documented as "optional
human-readable note," it just now has a language behind it instead of being hardcoded English.

### 16.3 Resolving `lang` per request

- **Bot/onboarding, before a `users` row exists:** `POST /onboarding/language` (Section 6.3) is
  already the very first real step — persist the choice into the Redis wizard session
  (`bot:session:{telegramId}.languageChoice`, Section 7) immediately, so every subsequent
  onboarding response — bank list, region list, error messages, all of it — resolves against it
  from that point on, not just the final profile.
- **At `profile_created`:** the session's `languageChoice` is written to `users.preferred_language`
  — no separate step, it's already been captured.
- **Every authenticated request after that** (Mini App, bot commands post-registration):
  `lang = users.preferred_language`, looked up once per request alongside the existing auth check.
- **Admin PWA:** `lang = staff.preferred_language` (added above) for the "key admin screens"
  SRS §1.1 requires in Amharic; most internal admin tooling can stay English-only by default
  (`en`) since Support Officers/Finance are staff, not the bilingual end-user base — flag to the
  business which specific screens need Amharic if not all of them.
- **Changing language later:** self-service, same pattern as Decision #3 (Section 0) —
  `PUT /me` (Section 6.5) accepts `preferredLanguage` alongside branch/zone/grade updates. Add
  `"preferredLanguage": "am"` to that endpoint's already-mutable field set.

### 16.4 Notification/broadcast messages

`POST /admin/api/v1/notifications/broadcast` (Section 6.8) already takes `{"message": {"en": "...",
"am": "..."}}` — that's the correct pattern, unchanged. The digest job (Section 9) picks
`message.am` or `message.en` per recipient from `users.preferred_language` at send time, same
resolution as everything else — no separate logic needed there.

---

- **Banks:** 31 rows seeded from the provided list (`id`, `name`, `name_am`, `nickname`, `swift_code`,
  `year_established`, `is_active`) — see `seed-data.json → banks`. Amharic names are populated.
- **Shared geography:** 14 top-level Regions/Chartered Cities (Addis Ababa, Dire Dawa, Oromia,
  Amhara, Tigray, Somali, Sidama, South West Ethiopia Peoples', South Ethiopia, Central Ethiopia,
  Afar, Benishangul-Gumuz, Gambela, Harari) and 105 child Zones/Subcities/Special Woredas — see
  `seed-data.json → regions[].zones_subcities`. Amharic names are populated.
- **Grade matrix:** 18 rows seeded from `grades-seed.json` (Ethiopian Banking Grade Matrix),
  shared across all banks — see `grades-seed.json → grades` and Section 4.3. Amharic names and roles are populated.
- **Not covered by seed data (captured at registration instead):** each user's exact branch name
  and neighborhood (free text, Section 6.3).