# Zwuwur Mini App v2

Telegram Mini App for the Zwuwur lateral transfer marketplace. Built with Vite, React 19, TypeScript, Tailwind CSS v4, and wouter.

## What's new in v2

See [`../CHANGELOG.md`](../CHANGELOG.md) for the full changelog. Highlights:

- **Branded splash screen** — "Two paths converging" animation
- **URL-based routing** — deep-linkable tabs, back button works
- **Marketplace filters** — mutual-only, grade band, region, zone
- **Relevance scores** — visual match strength indicator on every card
- **Shortlist** — save candidates for later
- **Impression tracking** — "Viewed" tag on cards you've already seen
- **Purchase stats** — total spent, reveals, this month, pending count
- **Pending purchases** — see "payment being verified" cards
- **Server-side notification read state** — no more sessionStorage hack
- **Infinite scroll on notifications** — all notifications reachable
- **Lifted completeness** — no more 4× redundant fetches
- **Designed empty/loading/error states** — every state teaches the next action
- **Micro-animations** — every animation tied to a state change
- **Haptic feedback** — tactile response on key actions

## Quick start

```bash
# 1. Backend
cd ../backend
cp .env.example .env
npm install
npm run migrate
npm run seed
npm run dev            # API on http://localhost:3000
npm run dev:worker     # notifications + digests

# 2. Mini App
cd ../miniapp
cp .env.example .env
npm install
npm run dev            # Vite on http://localhost:5173
```

Open `http://localhost:5173` in your browser. You'll see the splash screen, then the dev login screen (outside Telegram).

## Dev login

The Mini App boots into a **dev login screen** outside Telegram with two paths:

### Path A — Log in by Telegram ID

Uses `POST /api/v1/auth/issue-token` (hard-guarded to 404 in production). The user must already exist in the `users` table — the seed does NOT create test users. See `../backend/README.md` for SQL to create a test user.

### Path B — Paste a JWT

Useful when `NODE_ENV=production` (issue-token 404s) or for testing against a deployed backend.

## Build

```bash
npm run build         # outputs to dist/
npm run typecheck     # tsc --noEmit
```

## Tech stack

| Package | Version | Purpose |
|---|---|---|
| vite | ^8.1.0 | Build tool |
| react / react-dom | ^19.2.0 | UI framework |
| typescript | ~5.9.0 | Type safety |
| tailwindcss / @tailwindcss/vite | ^4.3.0 | Styling (CSS-first config) |
| wouter | ^3.3.5 | URL-based routing |
| lucide-react | ^0.460.0 | Icons |
| clsx + tailwind-merge | latest | Class name utilities |

## Folder structure

```
miniapp/src/
├── main.tsx              # React root
├── App.tsx               # Boot: splash → auth → dev login / main app
├── ErrorBoundary.tsx
├── app/                  # App-shell layer (Header, BottomNav, routing, splash)
├── features/             # Domain features (auth, profile, interests, marketplace, purchases)
├── components/           # Cross-feature UI (ui/ primitives, icons, layout)
├── lib/                  # Cross-cutting logic (api, hooks, i18n, utils)
├── styles/               # Tailwind v4 entry + tokens + animations
└── types/                # TypeScript types (api, domain, ui)
```

See [`../CHANGELOG.md`](../CHANGELOG.md) for the complete folder structure and design decisions.
