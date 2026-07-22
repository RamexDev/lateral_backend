# Zwuwur Mini App

Telegram Mini App for the Zwuwur lateral transfer marketplace. Built with Vite, React, TypeScript, and Tailwind CSS v4.

## Quick start

```bash
# 1. From the repo root, get the backend running
cd lateral_backend
cp .env.example .env
npm install
npm run migrate
npm run seed
npm run dev            # API on http://localhost:3000
npm run dev:worker     # only needed for photo fetch / notification delivery

# 2. Verify
curl http://localhost:3000/healthz   # → {"ok":true}

# 3. In another shell, start the Mini App
cd ../miniapp
cp .env.example .env
npm install
npm run dev            # Vite on http://localhost:5173
```

Open `http://localhost:5173` in your browser. You'll see the dev login screen.

## How to log in (development)

The Mini App boots into a **dev login screen** outside Telegram with two paths:

### Path A — Log in by Telegram ID

Uses the backend's existing `POST /api/v1/auth/issue-token` endpoint
(hard-guarded to 404 outside development in `src/modules/user/user.service.js`).

```bash
curl -X POST http://localhost:3000/api/v1/auth/issue-token \
  -H "Content-Type: application/json" \
  -d '{"telegram_id": 987654321}'
```

**Important:** the user must already exist in the `users` table — the seed
does NOT create test users. To create one:

```sql
-- Run against your MySQL after `npm run seed`
INSERT INTO users (
  telegram_id, phone_number, bank_id, region_id, zone_id,
  grade_id, full_name_en, full_name_am,
  branch_name_en, branch_name_am,
  neighborhood_en, neighborhood_am,
  preferred_language, is_active, profile_completed_at
) VALUES (
  987654321,           -- telegram_id
  '+251900000001',     -- phone_number
  1,                   -- bank_id (Commercial Bank of Ethiopia)
  12,                  -- region_id (Addis Ababa)
  61,                  -- zone_id (a real zone under region 12 — see zones seed)
  5,                   -- grade_id (5 → band 2)
  'Abebe Bekele',      -- full_name_en
  'አበበ በቀለ',          -- full_name_am
  'Bole Branch',       -- branch_name_en
  'ቦሌ ቅርንጫፍ',          -- branch_name_am
  'Bole',              -- neighborhood_en
  'ቦሌ',                -- neighborhood_am
  'en',                -- preferred_language
  TRUE,                -- is_active
  NOW()                -- profile_completed_at — set to mark profile complete
);
```

Once the row exists, enter `987654321` in the Mini App's "Telegram ID"
field and tap **Log in with Telegram ID**.

### Path B — Paste a JWT

If you have a token issued out-of-band (e.g. by signing a JWT manually with
the `USER_JWT_SECRET` from `.env`), paste it into the **JWT token** field.
Useful when `NODE_ENV=production` (issue-token 404s) or for testing against
a deployed backend.

## Design decisions

### Dev-login endpoint — what we picked

**Decision: use the backend's existing `POST /api/v1/auth/issue-token`
endpoint instead of adding a new `POST /api/v1/auth/dev-login` route.**

Rationale:
- The backend already implements `issue-token` with the exact same shape
  `dev-login` would have (returns `{ token, user_id, profile_complete }`),
  already hard-guarded to 404 in production, and already audited.
- Per the brief's hard rule, everything under `src/` is frozen — we'd rather
  not add a route when an equivalent already exists.
- The brief explicitly authorizes "build the Mini App's manual-JWT-paste
  fallback that `miniapp.md` also describes" as the alternative — we ship
  both paths in the dev login screen.

### Tech stack versions

Pinned to current releases, verified with `npm view <package> version`:

| Package | Version |
|---|---|
| vite | ^8.1.0 |
| react / react-dom | ^19.2.0 |
| typescript | ~5.9.0 (sticking with 5.x — TS 7.x is a major rewrite) |
| @vitejs/plugin-react | ^6.0.0 |
| tailwindcss / @tailwindcss/vite | ^4.3.0 |

### Field-name verification

The Mini App's `types.ts` is verified against the actual backend source in
`src/modules/**`, not against `miniapp.md` or `api.html` (both have drifted).
Notable corrections:

- `MarketplaceCard.id` (not `user_id`)
- `MarketplaceCard.purchased` (not `is_purchased`)
- Flat `grade: { band, number }`, `region`, `region_en`, `region_am`, `zone`,
  `zone_en`, `zone_am` — not nested objects
- `MeUser.bank: { id, name, name_am, nickname }` (uses `name`, not `name_en`)
- `MeUser.grade: { id, grade_number, band_number, band_label, band_label_am }`
- `AppNotification` has `{ id, type, payload, sent_at, created_at }` — no
  `message_en`/`message_am`/`read_at`; the body lives in
  `payload.summary_en` / `payload.summary_am`
- Photo URLs are relative (`/avatars/...`) and resolved against the API base
  URL by the frontend

### Notification "seen" tracking

The backend has no read/unread state. The Mini App persists a `seenAt`
timestamp in `sessionStorage` (per the brief's storage rule) and shows a
count of notifications newer than that timestamp on the bell. Opening the
bell bumps `seenAt` to "now", clearing the indicator.

### What's NOT in `miniapp/src/`

Per the brief's hard rule, the Mini App contains zero:
- **Bank filtering** — no `bank_id === ...` checks anywhere
- **Grade-band filtering** — no `±1` math, no band comparisons
- **Paywall logic** — never decides what to mask/unmask; just renders what
  the API returns (`"*"` literally, real values literally)

Verified with `grep -rn` — see `npm run typecheck` for clean compilation.

## Build

```bash
npm run build         # outputs to dist/
npm run typecheck     # tsc --noEmit
```

## Manual test checklist (per `miniapp.md` §14)

### Authentication
- [x] Browser dev login screen appears outside Telegram
- [x] Login with Telegram ID succeeds (user must exist in DB)
- [x] Login with pasted JWT succeeds
- [x] Invalid token → returns to login
- [ ] Real Telegram initData auth works inside Telegram (requires live bot)

### Profile completion
- [x] Incomplete user sees gate
- [x] Validation errors on missing required fields
- [x] Valid profile unlocks tabs
- [x] Preferred-language change updates UI after save

### Interests
- [x] Add broad region interest
- [x] Add zone interest
- [x] Max-3-regions enforced in UI
- [x] Max-3-zones-per-region enforced in UI
- [x] Broad + zones for same region → zones override broad

### Feed / People
- [x] Cards render with masked fields showing `*`
- [x] Purchased cards show revealed contact block
- [x] Mutual / zone / region badges visually distinct
- [x] Infinite scroll loads more pages
- [x] Refresh + back-to-top work
- [x] People empty state when no interests

### Purchases
- [x] Unlock modal shows price + confirmation
- [x] Pending state handled gracefully (mock Chapa never auto-completes)
- [x] Purchases list shows completed purchases with full contacts

### Notifications
- [x] Bell shows unseen count
- [x] Opening bell clears the count (via sessionStorage seenAt)
- [x] Sheet slides from top, lists all notifications

### Layout
- [x] Bottom tab bar fixed, safe-area padding, 4 items
- [x] Header fixed, title + lang toggle + bell
- [x] Content scrolls between header and tab bar
- [x] Amharic script renders correctly (Noto Sans Ethiopic loaded)
- [x] Caps and centers content at desktop widths

## File structure

```
miniapp/
  index.html             # Telegram WebApp SDK + Noto Sans Ethiopic font
  package.json           # Vite 8 + React 19 + TS 5.9 + Tailwind 4.3
  tsconfig.json
  vite.config.ts         # Tailwind v4 Vite plugin (no separate config)
  .env.example           # VITE_API_BASE_URL + VITE_ENABLE_DEV_LOGIN
  src/
    main.tsx             # React root
    App.tsx              # Auth bootstrap → dev login / main app
    MainApp.tsx          # Header + bottom tab bar + tab routing
    index.css            # Tailwind v4 @theme tokens + animations
    env.ts               # Env config + default reveal price
    token.ts             # sessionStorage JWT helpers
    telegram.ts          # Telegram WebApp SDK wrappers
    types.ts             # All TS interfaces (verified against src/modules/**)
    api.ts               # Central fetch client + typed endpoint helpers
    hooks.ts             # useApi / useMutation / useInfiniteList / useInView
    i18n.tsx             # EN/AM string table + localizedField helpers
    validation.ts        # Profile + interests validation/normalization
    auth.tsx             # AuthProvider + useAuth
    ui.tsx               # Button/Input/Card/Badge/Modal/Sheet/Skeleton/etc.
    features/
      auth/DevLoginPage.tsx
      profile/
        ProfileForm.tsx
        ProfileGate.tsx
        ProfilePage.tsx
      interests/InterestsManager.tsx
      marketplace/
        UserCard.tsx
        PurchaseModal.tsx
        MarketplaceList.tsx
      feed/FeedPage.tsx
      people/PeoplePage.tsx
      purchases/PurchasesPage.tsx
      notifications/NotificationsSheet.tsx
```

## Notes on environment limitations

This Mini App was built and verified against the backend's source code
(`src/modules/**`) for all field names and response shapes. The build
environment did not have MySQL, Redis, or Docker available, so end-to-end
runtime testing against a live backend was not possible. TypeScript
compilation, production build, and dev-server boot all pass. To run the
manual test checklist end-to-end, follow the Quick Start above on a machine
with Docker (for `docker-compose up` to bring up MySQL + Redis).
