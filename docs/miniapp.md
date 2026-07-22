# Zwuwur Telegram Mini App Implementation Guide

Version: 1.0  
Scope: Telegram Mini App only  
Backend reference: `backend.md`  
API reference: `api.html`  
Product reference: `Zwuwur_Lateral_Transfer_Marketplace_SRS_v1_0.pdf`  
Seed reference: `seeds.md`

This document is written so that a developer can implement the Mini App by using:

1. This document
2. The backend implementation in `backend.md`
3. The API documentation in `api.html`
4. The product rules in the SRS
5. The seed documentation in `seeds.md`

The implementation uses:

- Vite latest
- TypeScript
- React
- Tailwind CSS v4
- Native `fetch`
- No Axios
- No Redux
- No router library
- Minimal dependencies

---

## 1. Implementation Goal

Build the Telegram Mini App with these tabs:

| Tab | Purpose |
|---|---|
| Feed | Shows candidates who want the viewer's current area |
| People | Shows candidates located in the viewer's desired areas |
| Purchases | Shows purchased contacts |
| Profile | Edits profile, interests, photo, language, notifications |

The Mini App must:

- Authenticate using Telegram `initData` in production
- Support a development login mode for local implementation without the bot
- Block marketplace access until profile is complete
- Render masked fields exactly as returned by backend
- Never calculate paywall rules on the frontend
- Never calculate same-bank, grade-band, or matching rules on the frontend
- Use backend as the single source of truth

---

## 2. Core Product Rules

These rules are enforced by the backend. The Mini App only renders the result.

| Rule | Frontend Responsibility |
|---|---|
| Same bank only | Do not filter locally. Render backend results only |
| Grade within ±1 band | Do not filter locally. Render backend results only |
| Profile completion gate | Block Feed/People/Purchases if `profile_complete` is false |
| Paywall masking | Render `"*"` exactly as returned |
| Purchase permanence | Show purchased state from backend |
| Max 3 regions | Enforce in UI, but backend is final authority |
| Max 3 zones per selected region | Enforce in UI, but backend is final authority |
| Broad region interest cannot coexist with zones for same region | Normalize in UI, but backend is final authority |
| Bank cannot be edited after registration | Disable or hide bank editing |
| Bilingual EN/AM | Show selected language with fallback to the other language |

---

## 3. Recommended Local Development Flow

Because Telegram bot hosting can be complicated, implement the Mini App first in standalone development mode.

```text
Mini App browser mode
  → dev login or pasted JWT
  → local backend
  → seeded reference data
  → test users
  → full Mini App UI
```

Later:

```text
Mini App inside Telegram
  → real initData
  → hosted backend
  → real bot onboarding
```

---

## 4. Backend Prerequisites

The backend must be running locally or in a reachable environment.

Expected backend base URL:

```text
http://localhost:3000
```

Required backend state:

```text
MySQL running
Redis running
Migrations applied
Seed data loaded
API process running
Worker process running, if testing notifications/photos
Scheduler process running, if testing digests
```

Typical backend commands:

```bash
npm install
npm run migrate
npm run seed
npm run dev
```

Verify backend health:

```bash
curl http://localhost:3000/healthz
curl http://localhost:3000/health
curl http://localhost:3000/livez
```

---

## 5. Mini App Environment Variables

Create:

```text
.env
```

Contents:

```env
VITE_API_BASE_URL=http://localhost:3000
VITE_ENABLE_DEV_LOGIN=true
```

Production example:

```env
VITE_API_BASE_URL=https://api.yourdomain.com
VITE_ENABLE_DEV_LOGIN=false
```

| Variable | Meaning |
|---|---|
| `VITE_API_BASE_URL` | Backend API base URL without trailing slash |
| `VITE_ENABLE_DEV_LOGIN` | Enables dev login screen outside Telegram |

---

## 6. Optional Backend Dev Login Endpoint

To implement the Mini App without the Telegram bot, the backend should expose a development-only login endpoint.

This endpoint must never be enabled in production.

Recommended route:

```text
POST /api/v1/auth/dev-login
```

Request:

```json
{
  "telegram_id": "987654321"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOi...",
    "user_id": 42,
    "profile_complete": false
  }
}
```

Example backend guard:

```js
// backend/src/routes/auth.js
// Development-only login route.
// This route must be disabled in production.
router.post('/auth/dev-login', async (req, res, next) => {
  // Block production usage completely.
  if (env.NODE_ENV === 'production' || !env.DEV_AUTH_ENABLED) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Not found'
      }
    });
  }

  // Read requested Telegram ID.
  const telegramId = String(req.body.telegram_id ?? '').trim();

  // Require a Telegram ID.
  if (!telegramId) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'telegram_id is required'
      }
    });
  }

  try {
    // Find existing user by Telegram ID.
    let user = await UserService.findByTelegramId(telegramId);

    // If no user exists, create a basic test user.
    if (!user) {
      user = await UserService.createTestUser({
        telegram_id: telegramId,
        preferred_language: 'en'
      });
    }

    // Sign the same JWT used by real Telegram auth.
    const token = TokenService.signUserToken(user);

    // Return auth payload.
    return res.json({
      success: true,
      data: {
        token,
        user_id: user.id,
        profile_complete: Boolean(user.profile_complete)
      }
    });
  } catch (error) {
    // Forward unexpected errors.
    return next(error);
  }
});
```

If the backend does not implement this endpoint yet, the Mini App dev screen also supports pasting a JWT manually.

---

## 7. Project Setup

Create the app:

```bash
npm create vite@latest zwuwur-mini-app -- --template react-ts
cd zwuwur-mini-app
npm install
```

Install Tailwind CSS v4:

```bash
npm install tailwindcss @tailwindcss/vite
```

Run:

```bash
npm run dev
```

Expected local URL:

```text
http://localhost:5173
```

---

## 8. Target Folder Structure

```text
zwuwur-mini-app/
  index.html
  package.json
  tsconfig.json
  vite.config.ts
  .env
  src/
    main.tsx
    App.tsx
    index.css
    vite-env.d.ts
    env.ts
    token.ts
    telegram.ts
    types.ts
    api.ts
    utils.ts
    i18n.tsx
    hooks.ts
    ui.tsx
    auth.tsx
    validation.ts
    features/
      auth/
        DevLoginPage.tsx
      profile/
        ProfileForm.tsx
        ProfileGate.tsx
        ProfilePage.tsx
      interests/
        InterestsManager.tsx
      marketplace/
        UserCard.tsx
        PurchaseModal.tsx
        MarketplaceList.tsx
      feed/
        FeedPage.tsx
      people/
        PeoplePage.tsx
      purchases/
        PurchasesPage.tsx
      notifications/
        NotificationsList.tsx
```

---

## 9. API Endpoint Matrix

All endpoints are under:

```text
/api/v1
```

The Mini App uses these endpoints.

| Screen / Feature | Method | Endpoint | Purpose |
|---|---:|---|---|
| Telegram auth | POST | `/auth/telegram` | Real Telegram Mini App login |
| Dev auth | POST | `/auth/dev-login` | Development login only |
| Current user | GET | `/me` | Load current user |
| Update profile | PUT | `/me` | Save profile fields |
| Completeness | GET | `/me/completeness` | Profile completeness nudge |
| Upload photo | POST | `/me/photo` | Upload profile photo |
| Delete photo | DELETE | `/me/photo` | Delete profile photo |
| Grades | GET | `/grades` | Grade dropdown |
| Regions | GET | `/regions` | Region dropdown |
| Zones | GET | `/zones?region_id=:id` | Zone dropdown |
| My interests | GET | `/interests/me` | List current interests |
| Interest options | GET | `/interests/options` | Region/zone options |
| Save interests | PUT | `/interests/me` | Replace interest list |
| Feed | GET | `/marketplace/feed` | Feed marketplace |
| People | GET | `/marketplace/people` | People marketplace |
| Create purchase | POST | `/purchases` | Start payment |
| My purchases | GET | `/purchases/me` | Purchase history |
| Notifications | GET | `/notifications/me` | Notification list |

If `api.html` has a slightly different field name, prefer `api.html`.

---

## 10. Backend Response Envelope

The backend uses a success envelope.

Success:

```json
{
  "success": true,
  "data": {}
}
```

Error:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human readable message"
  }
}
```

The Mini App API client must unwrap `data` automatically.

---

## 11. Masking Rule

Paywalled fields can be returned as:

```json
{
  "full_name_en": "*",
  "full_name_am": "*",
  "branch_name_en": "*",
  "branch_name_am": "*",
  "neighborhood_en": "*",
  "neighborhood_am": "*",
  "phone_number": "*",
  "telegram_username": "*"
}
```

The Mini App must render:

```text
*
```

Do not replace `*` with hidden text, blurred text, or fake values.

---

## 12. Full File Implementation

Copy the following files into the project.

---

### 12.1 `package.json`

```json
{
  "name": "zwuwur-mini-app",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^5.0.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0"
  }
}
```

---

### 12.2 `vite.config.ts`

```ts
// Import Vite configuration helper.
import { defineConfig } from 'vite';

// Import React plugin for JSX and Fast Refresh.
import react from '@vitejs/plugin-react';

// Import Tailwind CSS v4 Vite plugin.
import tailwindcss from '@tailwindcss/vite';

// Export Vite configuration.
export default defineConfig({
  // Enable React and Tailwind.
  plugins: [react(), tailwindcss()],

  // Configure local dev server.
  server: {
    // Use a stable local port.
    port: 5173,

    // Allow network access for mobile testing if needed.
    host: true
  }
});
```

---

### 12.3 `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true,
    "types": ["vite/client"]
  },
  "include": ["src"]
}
```

---

### 12.4 `index.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />

    <!-- Required for mobile sizing inside Telegram -->
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0, viewport-fit=cover"
    />

    <!-- Telegram WebApp SDK -->
    <script src="https://telegram.org/js/telegram-web-app.js"></script>

    <!-- App title -->
    <title>Zwuwur</title>
  </head>

  <body>
    <!-- React root node -->
    <div id="root"></div>

    <!-- Application entrypoint -->
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

---

### 12.5 `.env`

```env
# Backend API base URL.
VITE_API_BASE_URL=http://localhost:3000

# Enable development login outside Telegram.
VITE_ENABLE_DEV_LOGIN=true
```

---

### 12.6 `src/index.css`

```css
/* Import Tailwind CSS v4 */
@import "tailwindcss";

/* Optional theme tokens */
@theme {
  --color-brand: #2563eb;
  --color-brand-dark: #1d4ed8;
}

/* Make root elements fill the viewport */
html,
body,
#root {
  height: 100%;
}

/* Base body styling */
body {
  margin: 0;
  background-color: #f9fafb;
  color: #111827;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  -webkit-font-smoothing: antialiased;
}
```

---

### 12.7 `src/vite-env.d.ts`

```ts
/// <reference types="vite/client" />

// Vite environment variables.
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_ENABLE_DEV_LOGIN: string;
}

// Extend import.meta.
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Telegram user object.
interface TelegramWebAppUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

// Telegram WebApp object.
interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: TelegramWebAppUser;
  };
  ready(): void;
  expand(): void;
  openLink(url: string, options?: { try_instant_view?: boolean }): void;
  colorScheme: 'light' | 'dark';
  themeParams: Record<string, string>;
}

// Attach Telegram to window.
interface Window {
  Telegram?: {
    WebApp?: TelegramWebApp;
  };
}
```

---

### 12.8 `src/env.ts`

```ts
// Central environment configuration.
export const env = {
  // Backend base URL.
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',

  // Development login toggle.
  devLoginEnabled: import.meta.env.VITE_ENABLE_DEV_LOGIN === 'true'
};
```

---

### 12.9 `src/token.ts`

```ts
// Session storage key for user JWT.
const TOKEN_KEY = 'zwuwur.user.token';

// Read stored JWT.
export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

// Store JWT.
export function setToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token);
}

// Remove JWT.
export function clearToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
}
```

---

### 12.10 `src/telegram.ts`

```ts
// Get Telegram WebApp instance if available.
export function getTelegramWebApp(): TelegramWebApp | null {
  return window.Telegram?.WebApp ?? null;
}

// Initialize Telegram Mini App.
export function initTelegram(): void {
  const tg = getTelegramWebApp();

  // Tell Telegram the app is ready.
  tg?.ready();

  // Expand the Mini App to full height.
  tg?.expand();
}

// Get raw Telegram initData for backend validation.
export function getInitData(): string {
  return getTelegramWebApp()?.initData ?? '';
}

// Open external link using Telegram if available.
export function openExternalLink(url: string): void {
  const tg = getTelegramWebApp();

  // Prefer Telegram link opening.
  if (tg?.openLink) {
    tg.openLink(url, { try_instant_view: false });
    return;
  }

  // Browser fallback.
  window.open(url, '_blank', 'noopener,noreferrer');
}
```

---

### 12.11 `src/types.ts`

```ts
// Supported UI languages.
export type Lang = 'en' | 'am';

// Main Mini App tabs.
export type TabKey = 'feed' | 'people' | 'purchases' | 'profile';

// Bank reference row.
export interface Bank {
  id: number;
  name_en: string;
  name_am: string;
}

// Region reference row.
export interface Region {
  id: number;
  name_en: string;
  name_am: string;
}

// Zone reference row.
export interface Zone {
  id: number;
  region_id: number;
  name_en: string;
  name_am: string;
}

// Grade reference row.
export interface Grade {
  id: number;
  name_en: string;
  name_am: string;
  band?: number | null;
}

// Current authenticated user.
export interface MeUser {
  id: number;
  telegram_id: string;
  telegram_username?: string | null;
  phone_number?: string | null;
  bank_id: number;
  bank?: Bank | null;
  region_id: number;
  region?: Region | null;
  zone_id: number;
  zone?: Zone | null;
  grade_id?: number | null;
  grade?: Grade | null;
  full_name_en?: string | null;
  full_name_am?: string | null;
  branch_name_en?: string | null;
  branch_name_am?: string | null;
  neighborhood_en?: string | null;
  neighborhood_am?: string | null;
  preferred_language: Lang;
  photo_url?: string | null;
  profile_complete: boolean;
  created_at: string;
  updated_at: string;
}

// Auth response from backend.
export interface AuthResponse {
  token: string;
  user_id: number;
  profile_complete: boolean;
}

// Completeness response.
export interface Completeness {
  score: number;
  profile_complete: boolean;
  missing: string[];
  nudges?: string[];
}

// Transfer interest row.
export interface Interest {
  id?: number;
  region_id: number;
  zone_id: number | null;
  region?: Region | null;
  zone?: Zone | null;
}

// Interest options response.
export interface InterestOptionsResponse {
  regions: Array<
    Region & {
      zones: Zone[];
    }
  >;
}

// Marketplace candidate card.
export interface MarketplaceCard {
  user_id: number;
  photo_url: string | null;
  grade?: Grade | null;
  region?: Region | null;
  zone?: Zone | null;
  match_type: 'zone' | 'region';
  is_mutual: boolean;
  is_purchased: boolean;
  full_name_en: string;
  full_name_am: string;
  branch_name_en: string;
  branch_name_am: string;
  neighborhood_en: string;
  neighborhood_am: string;
  phone_number: string;
  telegram_username: string;
}

// Purchase row.
export interface Purchase {
  id: number;
  target_user_id: number;
  status: 'pending' | 'completed' | 'failed';
  amount: number;
  currency: string;
  provider: string;
  checkout_url?: string | null;
  target?: MarketplaceCard | null;
  created_at: string;
}

// Notification row.
export interface AppNotification {
  id: number;
  type: string;
  message_en?: string | null;
  message_am?: string | null;
  created_at: string;
  read_at?: string | null;
}

// Generic list response.
export interface ListResponse<T> {
  results: T[];
  page?: number;
  page_size?: number;
  total?: number;
  has_more?: boolean;
  requires_interests?: boolean;
  message?: string;
}
```

---

### 12.12 `src/api.ts`

```ts
// Import environment configuration.
import { env } from './env';

// Import token helpers.
import { getToken, clearToken } from './token';

// API error class.
export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(code: string, message: string, status: number, details?: unknown) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

// Query parameter type.
type Query = Record<string, string | number | boolean | null | undefined>;

// API options.
type ApiOptions = RequestInit & {
  query?: Query;
  token?: string | null;
};

// Build query string safely.
function buildQuery(query?: Query): string {
  // Return empty string if no query.
  if (!query) return '';

  // Create URLSearchParams.
  const params = new URLSearchParams();

  // Add each defined query value.
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  }

  // Serialize query.
  const text = params.toString();

  // Return prefixed query or empty string.
  return text ? `?${text}` : '';
}

// Main fetch wrapper.
export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  // Copy headers.
  const headers = new Headers(options.headers);

  // Use explicit token or stored token.
  const token = options.token ?? getToken();

  // Attach JWT if present.
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Set JSON header only for non-FormData bodies.
  if (!(options.body instanceof FormData) && options.body != null) {
    headers.set('Content-Type', 'application/json');
  }

  // Build full URL.
  const url = `${env.apiBaseUrl}${path}${buildQuery(options.query)}`;

  // Perform network request.
  const response = await fetch(url, {
    ...options,
    headers
  });

  // Read response text once.
  const text = await response.text();

  // Parse JSON body if present.
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }

  // Handle HTTP or envelope errors.
  if (!response.ok || !body?.success) {
    // Extract error code.
    const code =
      body?.error?.code ??
      (response.status === 401 ? 'UNAUTHORIZED' : 'HTTP_ERROR');

    // Extract error message.
    const message = body?.error?.message ?? response.statusText ?? 'Request failed';

    // Clear session on unauthorized.
    if (response.status === 401) {
      clearToken();
      window.dispatchEvent(new Event('zwuwur:unauthorized'));
    }

    // Throw normalized API error.
    throw new ApiError(code, message, response.status, body?.error?.details);
  }

  // Return unwrapped data.
  return body.data as T;
}
```

---

### 12.13 `src/utils.ts`

```ts
// Import language type.
import type { Lang } from './types';

// Format date according to language.
export function formatDate(value: string, lang: Lang): string {
  const locale = lang === 'am' ? 'am-ET' : 'en-ET';
  return new Date(value).toLocaleDateString(locale);
}

// Create initials from name.
export function initials(name: string): string {
  // Masked names get placeholder.
  if (!name || name === '*') return '?';

  // Split name into parts.
  const parts = name.trim().split(/\s+/);

  // Use first two initials.
  return parts
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('');
}

// Validate profile photo file.
export function isValidPhoto(file: File): string | null {
  // Allowed MIME types.
  const validTypes = ['image/jpeg', 'image/png', 'image/webp'];

  // Check type.
  if (!validTypes.includes(file.type)) {
    return 'invalidPhotoType';
  }

  // Check max 5 MB.
  if (file.size > 5 * 1024 * 1024) {
    return 'invalidPhotoSize';
  }

  // File is valid.
  return null;
}
```

---

### 12.14 `src/i18n.tsx`

```tsx
// Import React context helpers.
import {
  createContext,
  useContext,
  useMemo,
  type ReactNode
} from 'react';

// Import language type.
import type { Lang } from './types';

// English dictionary.
const en = {
  loading: 'Loading...',
  error: 'Something went wrong.',
  retry: 'Retry',
  save: 'Save',
  cancel: 'Cancel',
  close: 'Close',
  confirm: 'Confirm',
  unlock: 'Unlock Contact',
  purchaseConfirm: 'Unlock this contact for 500 ETB?',
  purchasePending: 'Payment is being confirmed.',
  paymentOpened: 'Complete payment, then check status.',
  checkStatus: 'Check Payment Status',
  feed: 'Feed',
  people: 'People',
  purchases: 'Purchases',
  profile: 'Profile',
  completeProfile: 'Complete Your Profile',
  fullNameEn: 'Full Name (English)',
  fullNameAm: 'Full Name (Amharic)',
  branchNameEn: 'Branch Name (English)',
  branchNameAm: 'Branch Name (Amharic)',
  neighborhoodEn: 'Neighborhood (English)',
  neighborhoodAm: 'Neighborhood (Amharic)',
  grade: 'Grade',
  region: 'Region',
  zone: 'Zone',
  language: 'Language',
  photo: 'Photo',
  uploadPhoto: 'Upload Photo',
  deletePhoto: 'Delete Photo',
  interests: 'Transfer Interests',
  addInterest: 'Add Interest',
  noInterests: 'No transfer interests yet.',
  noResults: 'No results found.',
  requiresInterests: 'Add transfer interests to see people in your desired areas.',
  mutual: 'Mutual',
  matchZone: 'Zone Match',
  matchRegion: 'Region Match',
  purchased: 'Purchased',
  signOut: 'Sign Out',
  devLogin: 'Developer Login',
  telegramId: 'Telegram ID',
  token: 'JWT Token',
  login: 'Login',
  loginWithTelegramId: 'Login with Telegram ID',
  loginWithToken: 'Login with Token',
  or: 'or',
  notifications: 'Notifications',
  completeness: 'Profile Completeness',
  refresh: 'Refresh',
  backToTop: 'Back to Top',
  requiredOneLanguage: 'At least one language is required.',
  branchMin: 'Branch name must be at least 3 characters.',
  neighborhoodMin: 'Neighborhood must be at least 2 characters.',
  gradeRequired: 'Grade is required.',
  regionRequired: 'Region is required.',
  zoneRequired: 'Zone is required.',
  selectOption: 'Select option',
  devLoginDisabled: 'Development login is disabled.',
  invalidPhotoType: 'Photo must be JPEG, PNG, or WEBP.',
  invalidPhotoSize: 'Photo must be 5 MB or smaller.',
  name: 'Name',
  branch: 'Branch',
  neighborhood: 'Neighborhood',
  phone: 'Phone',
  telegram: 'Telegram',
  profileUpdated: 'Profile updated.',
  photoUpdated: 'Photo updated.',
  photoDeleted: 'Photo deleted.',
  interestSaved: 'Interests saved.',
  purchaseCreated: 'Purchase created.',
  loadMore: 'Load More',
  optional: 'Optional',
  broadRegion: 'Broad region interest',
  selectedInterests: 'Selected Interests',
  maxRegions: 'Maximum 3 regions allowed.',
  maxZones: 'Maximum 3 zones per region allowed.',
  remove: 'Remove'
};

// Amharic dictionary.
const am: typeof en = {
  loading: 'በመጫን ላይ...',
  error: 'ችግር ተፈጥሯል።',
  retry: 'እንደገና ሞክር',
  save: 'አስቀምጥ',
  cancel: 'ሰርዝ',
  close: 'ዝጋ',
  confirm: 'አረጋግጥ',
  unlock: 'እውቂያ ክፈት',
  purchaseConfirm: 'ይህን እውቂያ በ500 ብር መክፈት ይፈልጋሉ?',
  purchasePending: 'ክፍያ በመረጋገጥ ላይ ነው።',
  paymentOpened: 'ክፍያውን ጨርሰው ሁኔታውን ያረጋግጡ።',
  checkStatus: 'ሁኔታ አረጋግጥ',
  feed: 'ፍድ',
  people: 'ሰዎች',
  purchases: 'ግዢዎች',
  profile: 'መገለጫ',
  completeProfile: 'መገለጫዎን ያሟሉ',
  fullNameEn: 'ሙሉ ስም (እንግሊዝኛ)',
  fullNameAm: 'ሙሉ ስም (አማርኛ)',
  branchNameEn: 'ቅርንጫፍ ስም (እንግሊዝኛ)',
  branchNameAm: 'ቅርንጫፍ ስም (አማርኛ)',
  neighborhoodEn: 'አካባቢ (እንግሊዝኛ)',
  neighborhoodAm: 'አካባቢ (አማርኛ)',
  grade: 'ደረጃ',
  region: 'ክልል',
  zone: 'ዞን',
  language: 'ቋንቋ',
  photo: 'ፎቶ',
  uploadPhoto: 'ፎቶ ጫን',
  deletePhoto: 'ፎቶ ሰርዝ',
  interests: 'የዝውውር ፍላጎቶች',
  addInterest: 'ፍላጎት ጨምር',
  noInterests: 'እስካሁን የዝውውር ፍላጎት የለም።',
  noResults: 'ምንም ውጤት አልተገኘም።',
  requiresInterests: 'በሚፈልጉት አካባቢ ሰዎችን ለማየት የዝውውር ፍላጎት ይጨምሩ።',
  mutual: 'የጋራ',
  matchZone: 'የዞን ተዛማጅ',
  matchRegion: 'የክልል ተዛማጅ',
  purchased: 'የተገዛ',
  signOut: 'ውጣ',
  devLogin: 'የገንቢ መግቢያ',
  telegramId: 'ቴሌግራም መለያ',
  token: 'JWT ቶከን',
  login: 'ግባ',
  loginWithTelegramId: 'በቴሌግራም መለያ ግባ',
  loginWithToken: 'በቶከን ግባ',
  or: 'ወይም',
  notifications: 'ማሳወቂያዎች',
  completeness: 'የመገለጫ ሙሌት',
  refresh: 'አድስ',
  backToTop: 'ወደ ላይ ተመለስ',
  requiredOneLanguage: 'ቢያንስ አንድ ቋንቋ ያስፈልጋል።',
  branchMin: 'የቅርንጫፍ ስም ቢያንስ 3 ፊደል መሆን አለበት።',
  neighborhoodMin: 'አካባቢ ቢያንስ 2 ፊደል መሆን አለበት።',
  gradeRequired: 'ደረጃ ያስፈልጋል።',
  regionRequired: 'ክልል ያስፈልጋል።',
  zoneRequired: 'ዞን ያስፈልጋል።',
  selectOption: 'ይምረጡ',
  devLoginDisabled: 'የገንቢ መግቢያ ተዘግቷል።',
  invalidPhotoType: 'ፎቶ JPEG፣ PNG ወይም WEBP መሆን አለበት።',
  invalidPhotoSize: 'ፎቶ ከ5 MB መብለጥ የለበትም።',
  name: 'ስም',
  branch: 'ቅርንጫፍ',
  neighborhood: 'አካባቢ',
  phone: 'ስልክ',
  telegram: 'ቴሌግራም',
  profileUpdated: 'መገለጫ ተቀምጧል።',
  photoUpdated: 'ፎቶ ተቀምጧል።',
  photoDeleted: 'ፎቶ ተሰርዟል።',
  interestSaved: 'ፍላጎቶች ተቀምጠዋል።',
  purchaseCreated: 'ግዢ ተፈጥሯል።',
  loadMore: 'ተጨማሪ ጫን',
  optional: 'አማራጭ',
  broadRegion: 'ሰፊ የክልል ፍላጎት',
  selectedInterests: 'የተመረጡ ፍላጎቶች',
  maxRegions: 'ከ3 ክልል በላይ አይፈቀድም።',
  maxZones: 'በእያንዳንዱ ክልል ከ3 ዞን በላይ አይፈቀድም።',
  remove: 'አስወግድ'
};

// Translation key type.
export type TranslationKey = keyof typeof en;

// Language context value.
interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey) => string;
}

// Create language context.
const LanguageContext = createContext<LanguageContextValue | null>(null);

// Language provider props.
interface LanguageProviderProps {
  lang: Lang;
  setLang: (lang: Lang) => void;
  children: ReactNode;
}

// Provide language context.
export function LanguageProvider({ lang, setLang, children }: LanguageProviderProps) {
  // Memoize context value.
  const value = useMemo<LanguageContextValue>(() => {
    return {
      lang,
      setLang,
      t: key => am[lang]?.[key] ?? en[key] ?? key
    };
  }, [lang, setLang]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

// Consume language context.
export function useLang(): LanguageContextValue {
  const ctx = useContext(LanguageContext);

  // Throw if provider missing.
  if (!ctx) {
    throw new Error('useLang must be used inside LanguageProvider');
  }

  return ctx;
}

// Pick localized field from object.
export function localizedField(
  item: Record<string, any> | null | undefined,
  base: string,
  lang: Lang
): string {
  // Return empty if no item.
  if (!item) return '';

  // Primary language key.
  const primary = item[`${base}_${lang}`];

  // Return primary if valid.
  if (typeof primary === 'string' && primary.trim() !== '' && primary !== '*') {
    return primary;
  }

  // Fallback language.
  const fallbackLang: Lang = lang === 'en' ? 'am' : 'en';

  // Fallback language key.
  const fallback = item[`${base}_${fallbackLang}`];

  // Return fallback if valid.
  if (typeof fallback === 'string' && fallback.trim() !== '' && fallback !== '*') {
    return fallback;
  }

  // If primary is masked, show mask.
  if (primary === '*') return '*';

  // Otherwise empty.
  return '';
}

// Return masked value if either language is masked.
export function maskedOrLocalized(
  item: Record<string, any> | null | undefined,
  base: string,
  lang: Lang
): string {
  // Return empty if no item.
  if (!item) return '';

  // Read both language values.
  const enValue = item[`${base}_en`];
  const amValue = item[`${base}_am`];

  // If backend masked either language, render mask.
  if (enValue === '*' || amValue === '*') {
    return '*';
  }

  // Otherwise localize normally.
  return localizedField(item, base, lang);
}
```

---

### 12.15 `src/hooks.ts`

```ts
// Import React hooks.
import {
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react';

// Import API client.
import { api, ApiError } from './api';

// Import list type.
import type { ListResponse } from './types';

// Simple query hook.
export function useApi<T>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(path));
  const [error, setError] = useState<ApiError | null>(null);

  // Load data from API.
  const load = useCallback(async () => {
    // Skip disabled query.
    if (!path) return;

    // Start loading.
    setLoading(true);
    setError(null);

    try {
      // Fetch and unwrap data.
      const result = await api<T>(path);
      setData(result);
    } catch (err) {
      // Store normalized error.
      setError(err as ApiError);
    } finally {
      // Finish loading.
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);

  // Load on mount and dependency change.
  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, refetch: load, setData };
}

// Mutation hook.
export function useMutation<TBody = unknown, TData = unknown>(
  method: string,
  path: string | ((body: TBody) => string)
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  // Execute mutation.
  const mutate = useCallback(
    async (
      body?: TBody,
      options: RequestInit & { query?: Record<string, any> } = {}
    ): Promise<TData> => {
      setLoading(true);
      setError(null);

      try {
        // Resolve dynamic or static path.
        const finalPath = typeof path === 'function' ? path(body as TBody) : path;

        // Prepare request body.
        const requestBody =
          body instanceof FormData
            ? body
            : body === undefined
              ? undefined
              : JSON.stringify(body);

        // Call API.
        const result = await api<TData>(finalPath, {
          method,
          body: requestBody,
          ...options
        });

        return result;
      } catch (err) {
        setError(err as ApiError);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [method, path]
  );

  return { mutate, loading, error };
}

// Infinite list hook.
export function useInfiniteList<T>(path: string | null, pageSize = 10) {
  const [items, setItems] = useState<T[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [requiresInterests, setRequiresInterests] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Load a specific page.
  const load = useCallback(
    async (nextPage: number, replace = false) => {
      // Skip disabled path.
      if (!path) return;

      setLoading(true);
      setError(null);

      try {
        // Append pagination query.
        const separator = path.includes('?') ? '&' : '?';
        const url = `${path}${separator}page=${nextPage}&page_size=${pageSize}`;

        // Fetch list data.
        const data = await api<ListResponse<T> | T[]>(url);

        // Normalize results.
        const results = Array.isArray(data)
          ? data
          : data.results ?? [];

        // Replace or append items.
        setItems(prev => (replace ? results : [...prev, ...results]));

        // Store current page.
        setPage(nextPage);

        // Store interest requirement flag.
        setRequiresInterests(
          Array.isArray(data) ? false : Boolean(data.requires_interests)
        );

        // Determine if more pages exist.
        const more = Array.isArray(data)
          ? results.length === pageSize
          : data.has_more ?? results.length === pageSize;

        setHasMore(more);
      } catch (err) {
        setError(err as ApiError);
      } finally {
        setLoading(false);
      }
    },
    [path, pageSize]
  );

  // Reload when path or refresh key changes.
  useEffect(() => {
    if (path) {
      void load(1, true);
    } else {
      setItems([]);
      setHasMore(false);
    }
  }, [path, refreshKey, load]);

  // Refresh list.
  const refresh = useCallback(() => {
    setItems([]);
    setPage(1);
    setHasMore(true);
    setRefreshKey(key => key + 1);
  }, []);

  // Load next page.
  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      void load(page + 1);
    }
  }, [loading, hasMore, page, load]);

  return {
    items,
    loading,
    error,
    hasMore,
    requiresInterests,
    refresh,
    loadMore
  };
}

// Intersection observer hook.
export function useInView(onInView: () => void, enabled: boolean) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = ref.current;

    // Skip if disabled or missing node.
    if (!node || !enabled) return;

    // Create observer.
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) {
          onInView();
        }
      },
      { rootMargin: '200px' }
    );

    // Observe node.
    observer.observe(node);

    // Cleanup observer.
    return () => observer.disconnect();
  }, [onInView, enabled]);

  return ref;
}
```

---

### 12.16 `src/ui.tsx`

```tsx
// Import React types.
import {
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes
} from 'react';

// Button component.
export function Button({
  variant = 'primary',
  loading = false,
  className = '',
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
}) {
  // Base classes.
  const base =
    'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50';

  // Variant classes.
  const variants = {
    primary: 'bg-brand text-white hover:bg-brand-dark',
    secondary: 'border border-gray-300 bg-white text-gray-800 hover:bg-gray-50',
    danger: 'bg-red-600 text-white hover:bg-red-700'
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? '...' : children}
    </button>
  );
}

// Input component.
export function Input({
  label,
  error,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
}) {
  return (
    <label className="mb-3 block">
      {label ? <span className="mb-1 block text-sm font-medium">{label}</span> : null}

      <input
        className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand ${className}`}
        {...props}
      />

      {error ? <span className="mt-1 block text-xs text-red-600">{error}</span> : null}
    </label>
  );
}

// Select component.
export function Select({
  label,
  error,
  className = '',
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
}) {
  return (
    <label className="mb-3 block">
      {label ? <span className="mb-1 block text-sm font-medium">{label}</span> : null}

      <select
        className={`w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand ${className}`}
        {...props}
      >
        {children}
      </select>

      {error ? <span className="mt-1 block text-xs text-red-600">{error}</span> : null}
    </label>
  );
}

// Card component.
export function Card({
  children,
  className = ''
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-gray-200 bg-white p-4 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

// Badge component.
export function Badge({
  children,
  tone = 'gray'
}: {
  children: ReactNode;
  tone?: 'gray' | 'green' | 'blue' | 'yellow';
}) {
  const tones = {
    gray: 'bg-gray-100 text-gray-700',
    green: 'bg-green-100 text-green-700',
    blue: 'bg-blue-100 text-blue-700',
    yellow: 'bg-yellow-100 text-yellow-800'
  };

  return (
    <span className={`rounded-full px-2 py-1 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

// Spinner component.
export function Spinner({ full = false }: { full?: boolean }) {
  if (full) {
    return (
      <div className="flex h-full min-h-40 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-brand" />
      </div>
    );
  }

  return (
    <div className="flex justify-center py-4">
      <div className="h-6 w-6 animate-spin rounded-full border-4 border-gray-300 border-t-brand" />
    </div>
  );
}

// Error state component.
export function ErrorState({
  message,
  onRetry
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      <p>{message || 'Error'}</p>

      {onRetry ? (
        <Button variant="secondary" className="mt-3" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}

// Empty state component.
export function EmptyState({
  message,
  action
}: {
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-600">
      <p>{message}</p>

      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

// Modal component.
export function Modal({
  open,
  title,
  children,
  onClose
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold">{title}</h3>

          <button onClick={onClose} className="text-gray-500">
            ✕
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}

// Tabs component.
export function Tabs({
  items,
  active,
  onChange
}: {
  items: Array<{ key: string; label: string }>;
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="sticky top-0 z-10 grid grid-cols-4 border-b border-gray-200 bg-white">
      {items.map(item => (
        <button
          key={item.key}
          onClick={() => onChange(item.key)}
          className={`px-2 py-3 text-xs font-medium ${
            active === item.key
              ? 'border-b-2 border-brand text-brand'
              : 'text-gray-500'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
```

---

### 12.17 `src/auth.tsx`

```tsx
// Import React helpers.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode
} from 'react';

// Import API client.
import { api } from './api';

// Import token helpers.
import { getToken, setToken, clearToken } from './token';

// Import Telegram helper.
import { getInitData } from './telegram';

// Import types.
import type { AuthResponse, MeUser } from './types';

// Auth status.
type AuthStatus = 'loading' | 'unauthenticated' | 'authenticated';

// Auth context value.
interface AuthContextValue {
  status: AuthStatus;
  me: MeUser | null;
  loginWithTelegramId: (telegramId: string) => Promise<void>;
  loginWithToken: (token: string) => Promise<void>;
  refreshMe: () => Promise<void>;
  signOut: () => void;
}

// Create auth context.
const AuthContext = createContext<AuthContextValue | null>(null);

// Auth provider.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [me, setMe] = useState<MeUser | null>(null);

  // Load current user.
  const loadMe = useCallback(async () => {
    const data = await api<MeUser>('/api/v1/me');
    setMe(data);
  }, []);

  // Development login by Telegram ID.
  const loginWithTelegramId = useCallback(
    async (telegramId: string) => {
      const data = await api<AuthResponse>('/api/v1/auth/dev-login', {
        method: 'POST',
        body: JSON.stringify({ telegram_id: telegramId })
      });

      setToken(data.token);
      await loadMe();
      setStatus('authenticated');
    },
    [loadMe]
  );

  // Manual token login for development.
  const loginWithToken = useCallback(
    async (token: string) => {
      setToken(token);
      await loadMe();
      setStatus('authenticated');
    },
    [loadMe]
  );

  // Sign out.
  const signOut = useCallback(() => {
    clearToken();
    setMe(null);
    setStatus('unauthenticated');
  }, []);

  // Boot authentication.
  useEffect(() => {
    const boot = async () => {
      try {
        // Try existing stored token.
        if (getToken()) {
          await loadMe();
          setStatus('authenticated');
          return;
        }

        // Try real Telegram initData.
        const initData = getInitData();

        if (initData) {
          const data = await api<AuthResponse>('/api/v1/auth/telegram', {
            method: 'POST',
            body: JSON.stringify({ init_data: initData })
          });

          setToken(data.token);
          await loadMe();
          setStatus('authenticated');
          return;
        }

        // No auth source available.
        setStatus('unauthenticated');
      } catch {
        // Invalid token or auth failure.
        clearToken();
        setStatus('unauthenticated');
      }
    };

    void boot();

    // Handle unauthorized API events.
    const onUnauthorized = () => {
      clearToken();
      setMe(null);
      setStatus('unauthenticated');
    };

    window.addEventListener('zwuwur:unauthorized', onUnauthorized);

    return () => {
      window.removeEventListener('zwuwur:unauthorized', onUnauthorized);
    };
  }, [loadMe]);

  return (
    <AuthContext.Provider
      value={{
        status,
        me,
        loginWithTelegramId,
        loginWithToken,
        refreshMe: loadMe,
        signOut
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Consume auth context.
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return ctx;
}
```

---

### 12.18 `src/validation.ts`

```ts
// Import types.
import type { Interest, Lang, MeUser } from './types';

// Profile form state.
export interface ProfileFormState {
  full_name_en: string;
  full_name_am: string;
  branch_name_en: string;
  branch_name_am: string;
  neighborhood_en: string;
  neighborhood_am: string;
  grade_id: string;
  region_id: string;
  zone_id: string;
  preferred_language: Lang;
}

// Create profile form state from user.
export function createProfileFormState(me?: MeUser | null): ProfileFormState {
  return {
    full_name_en: me?.full_name_en ?? '',
    full_name_am: me?.full_name_am ?? '',
    branch_name_en: me?.branch_name_en ?? '',
    branch_name_am: me?.branch_name_am ?? '',
    neighborhood_en: me?.neighborhood_en ?? '',
    neighborhood_am: me?.neighborhood_am ?? '',
    grade_id: me?.grade_id ? String(me.grade_id) : '',
    region_id: me?.region_id ? String(me.region_id) : '',
    zone_id: me?.zone_id ? String(me.zone_id) : '',
    preferred_language: me?.preferred_language ?? 'en'
  };
}

// Validate profile form.
export function validateProfileForm(
  form: ProfileFormState
): Record<string, string> {
  const errors: Record<string, string> = {};

  // Full name requires at least one language.
  if (!form.full_name_en.trim() && !form.full_name_am.trim()) {
    errors.full_name = 'requiredOneLanguage';
  }

  // Branch requires at least one language.
  if (!form.branch_name_en.trim() && !form.branch_name_am.trim()) {
    errors.branch_name = 'requiredOneLanguage';
  }

  // English branch minimum length.
  if (form.branch_name_en.trim() && form.branch_name_en.trim().length < 3) {
    errors.branch_name_en = 'branchMin';
  }

  // Amharic branch minimum length.
  if (form.branch_name_am.trim() && form.branch_name_am.trim().length < 3) {
    errors.branch_name_am = 'branchMin';
  }

  // Neighborhood requires at least one language.
  if (!form.neighborhood_en.trim() && !form.neighborhood_am.trim()) {
    errors.neighborhood = 'requiredOneLanguage';
  }

  // English neighborhood minimum length.
  if (form.neighborhood_en.trim() && form.neighborhood_en.trim().length < 2) {
    errors.neighborhood_en = 'neighborhoodMin';
  }

  // Amharic neighborhood minimum length.
  if (form.neighborhood_am.trim() && form.neighborhood_am.trim().length < 2) {
    errors.neighborhood_am = 'neighborhoodMin';
  }

  // Grade is required.
  if (!form.grade_id) {
    errors.grade_id = 'gradeRequired';
  }

  // Region is required.
  if (!form.region_id) {
    errors.region_id = 'regionRequired';
  }

  // Zone is required.
  if (!form.zone_id) {
    errors.zone_id = 'zoneRequired';
  }

  return errors;
}

// Normalize transfer interests.
export function normalizeInterests(input: Interest[]): Interest[] {
  const seen = new Set<string>();
  const output: Interest[] = [];

  // Remove duplicates.
  for (const item of input) {
    const key = `${item.region_id}:${item.zone_id ?? 'broad'}`;

    if (seen.has(key)) continue;

    seen.add(key);

    output.push({
      region_id: Number(item.region_id),
      zone_id: item.zone_id ? Number(item.zone_id) : null
    });
  }

  // Limit to first 3 unique regions.
  const regionIds = [...new Set(output.map(item => item.region_id))].slice(0, 3);

  // Keep only allowed regions.
  const limited = output.filter(item => regionIds.includes(item.region_id));

  const final: Interest[] = [];

  // Apply zone limits and broad-region rule per region.
  for (const regionId of regionIds) {
    const regionItems = limited.filter(item => item.region_id === regionId);
    const zoneItems = regionItems.filter(item => item.zone_id != null).slice(0, 3);
    const hasBroad = regionItems.some(item => item.zone_id == null);

    if (zoneItems.length > 0) {
      // Zones override broad region interest.
      final.push(...zoneItems);
    } else if (hasBroad) {
      // Keep broad region only if no zones.
      final.push({ region_id: regionId, zone_id: null });
    }
  }

  return final;
}
```

---

### 12.19 `src/features/auth/DevLoginPage.tsx`

```tsx
// Import React state.
import { useState } from 'react';

// Import auth hook.
import { useAuth } from '../../auth';

// Import environment config.
import { env } from '../../env';

// Import language hook.
import { useLang } from '../../i18n';

// Import UI components.
import { Button, Card, Input } from '../../ui';

// Development login page.
export function DevLoginPage() {
  const { loginWithTelegramId, loginWithToken } = useAuth();
  const { t } = useLang();

  const [telegramId, setTelegramId] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Login using dev Telegram ID.
  async function onTelegramLogin() {
    setLoading(true);
    setError(null);

    try {
      await loginWithTelegramId(telegramId.trim());
    } catch (err: any) {
      setError(err?.message ?? t('error'));
    } finally {
      setLoading(false);
    }
  }

  // Login using pasted JWT.
  async function onTokenLogin() {
    setLoading(true);
    setError(null);

    try {
      await loginWithToken(token.trim());
    } catch (err: any) {
      setError(err?.message ?? t('error'));
    } finally {
      setLoading(false);
    }
  }

  // If dev login disabled, show message.
  if (!env.devLoginEnabled) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Card className="w-full max-w-md text-center">
          <p>{t('devLoginDisabled')}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-full items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <h1 className="mb-4 text-xl font-semibold">{t('devLogin')}</h1>

        {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

        <Input
          label={t('telegramId')}
          value={telegramId}
          onChange={event => setTelegramId(event.target.value)}
          placeholder="987654321"
        />

        <Button
          className="w-full"
          loading={loading}
          onClick={onTelegramLogin}
        >
          {t('loginWithTelegramId')}
        </Button>

        <div className="my-4 text-center text-xs text-gray-400">{t('or')}</div>

        <Input
          label={t('token')}
          value={token}
          onChange={event => setToken(event.target.value)}
          placeholder="eyJhbGciOi..."
        />

        <Button
          variant="secondary"
          className="w-full"
          loading={loading}
          onClick={onTokenLogin}
        >
          {t('loginWithToken')}
        </Button>
      </Card>
    </div>
  );
}
```

---

### 12.20 `src/features/profile/ProfileForm.tsx`

```tsx
// Import React hooks.
import { useEffect, useState } from 'react';

// Import auth hook.
import { useAuth } from '../../auth';

// Import data hooks.
import { useApi, useMutation } from '../../hooks';

// Import language hook.
import { useLang, type TranslationKey } from '../../i18n';

// Import UI components.
import { Button, Input, Select } from '../../ui';

// Import validation helpers.
import {
  createProfileFormState,
  validateProfileForm,
  type ProfileFormState
} from '../../validation';

// Import types.
import type { Grade, MeUser, Region, Zone } from '../../types';

// Profile form component.
export function ProfileForm({ onSaved }: { onSaved: () => Promise<void> }) {
  const { me } = useAuth();
  const { t } = useLang();

  const [form, setForm] = useState<ProfileFormState>(() =>
    createProfileFormState(me)
  );

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  // Fetch dropdown data.
  const grades = useApi<Grade[]>('/api/v1/grades');
  const regions = useApi<Region[]>('/api/v1/regions');
  const zones = useApi<Zone[]>(
    form.region_id ? `/api/v1/zones?region_id=${form.region_id}` : null,
    [form.region_id]
  );

  // Save mutation.
  const save = useMutation<ProfileFormState, MeUser>('PUT', '/api/v1/me');

  // Sync form when user loads.
  useEffect(() => {
    setForm(createProfileFormState(me));
  }, [me]);

  // Update one field.
  function update<K extends keyof ProfileFormState>(
    key: K,
    value: ProfileFormState[K]
  ) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  // Submit form.
  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();

    setSaveError(null);

    // Validate form.
    const nextErrors = validateProfileForm(form);
    setErrors(nextErrors);

    // Stop if invalid.
    if (Object.keys(nextErrors).length > 0) return;

    try {
      // Normalize payload.
      const payload = {
        ...form,
        grade_id: form.grade_id ? Number(form.grade_id) : null,
        region_id: Number(form.region_id),
        zone_id: Number(form.zone_id)
      };

      // Save profile.
      await save.mutate(payload);

      // Refresh current user.
      await onSaved();
    } catch (err: any) {
      setSaveError(err?.message ?? t('error'));
    }
  }

  return (
    <form onSubmit={onSubmit}>
      {saveError ? <p className="mb-3 text-sm text-red-600">{saveError}</p> : null}

      <Input
        label={t('fullNameEn')}
        value={form.full_name_en}
        onChange={event => update('full_name_en', event.target.value)}
        error={errors.full_name ? t(errors.full_name as TranslationKey) : undefined}
      />

      <Input
        label={t('fullNameAm')}
        value={form.full_name_am}
        onChange={event => update('full_name_am', event.target.value)}
      />

      <Input
        label={t('branchNameEn')}
        value={form.branch_name_en}
        onChange={event => update('branch_name_en', event.target.value)}
        error={
          errors.branch_name
            ? t(errors.branch_name as TranslationKey)
            : errors.branch_name_en
              ? t(errors.branch_name_en as TranslationKey)
              : undefined
        }
      />

      <Input
        label={t('branchNameAm')}
        value={form.branch_name_am}
        onChange={event => update('branch_name_am', event.target.value)}
        error={
          errors.branch_name_am
            ? t(errors.branch_name_am as TranslationKey)
            : undefined
        }
      />

      <Input
        label={t('neighborhoodEn')}
        value={form.neighborhood_en}
        onChange={event => update('neighborhood_en', event.target.value)}
        error={
          errors.neighborhood
            ? t(errors.neighborhood as TranslationKey)
            : errors.neighborhood_en
              ? t(errors.neighborhood_en as TranslationKey)
              : undefined
        }
      />

      <Input
        label={t('neighborhoodAm')}
        value={form.neighborhood_am}
        onChange={event => update('neighborhood_am', event.target.value)}
        error={
          errors.neighborhood_am
            ? t(errors.neighborhood_am as TranslationKey)
            : undefined
        }
      />

      <Select
        label={t('grade')}
        value={form.grade_id}
        onChange={event => update('grade_id', event.target.value)}
        error={errors.grade_id ? t(errors.grade_id as TranslationKey) : undefined}
      >
        <option value="">{t('selectOption')}</option>

        {grades.data?.map(grade => (
          <option key={grade.id} value={grade.id}>
            {grade.name_en} / {grade.name_am}
          </option>
        ))}
      </Select>

      <Select
        label={t('region')}
        value={form.region_id}
        onChange={event => {
          update('region_id', event.target.value);
          update('zone_id', '');
        }}
        error={errors.region_id ? t(errors.region_id as TranslationKey) : undefined}
      >
        <option value="">{t('selectOption')}</option>

        {regions.data?.map(region => (
          <option key={region.id} value={region.id}>
            {region.name_en} / {region.name_am}
          </option>
        ))}
      </Select>

      <Select
        label={t('zone')}
        value={form.zone_id}
        onChange={event => update('zone_id', event.target.value)}
        error={errors.zone_id ? t(errors.zone_id as TranslationKey) : undefined}
      >
        <option value="">{t('selectOption')}</option>

        {zones.data?.map(zone => (
          <option key={zone.id} value={zone.id}>
            {zone.name_en} / {zone.name_am}
          </option>
        ))}
      </Select>

      <Select
        label={t('language')}
        value={form.preferred_language}
        onChange={event => update('preferred_language', event.target.value as any)}
      >
        <option value="en">English</option>
        <option value="am">አማርኛ</option>
      </Select>

      <Button type="submit" className="w-full" loading={save.loading}>
        {t('save')}
      </Button>
    </form>
  );
}
```

---

### 12.21 `src/features/profile/ProfileGate.tsx`

```tsx
// Import language hook.
import { useLang } from '../../i18n';

// Import UI component.
import { Card } from '../../ui';

// Import profile form.
import { ProfileForm } from './ProfileForm';

// Profile completion gate.
export function ProfileGate({ onCompleted }: { onCompleted: () => Promise<void> }) {
  const { t } = useLang();

  return (
    <div className="mx-auto max-w-lg p-4">
      <Card>
        <h1 className="mb-4 text-xl font-semibold">{t('completeProfile')}</h1>

        <ProfileForm onSaved={onCompleted} />
      </Card>
    </div>
  );
}
```

---

### 12.22 `src/features/interests/InterestsManager.tsx`

```tsx
// Import React hooks.
import { useEffect, useMemo, useState } from 'react';

// Import data hooks.
import { useApi, useMutation } from '../../hooks';

// Import language helpers.
import { localizedField, useLang } from '../../i18n';

// Import UI components.
import { Badge, Button, Card, Select, Spinner } from '../../ui';

// Import validation helper.
import { normalizeInterests } from '../../validation';

// Import types.
import type { Interest, InterestOptionsResponse } from '../../types';

// Interests manager component.
export function InterestsManager() {
  const { t, lang } = useLang();

  // Fetch current interests.
  const current = useApi<Interest[]>('/api/v1/interests/me');

  // Fetch region/zone options.
  const options = useApi<InterestOptionsResponse>('/api/v1/interests/options');

  // Local editable interests.
  const [interests, setInterests] = useState<Interest[]>([]);

  // Selected form values.
  const [regionId, setRegionId] = useState('');
  const [zoneId, setZoneId] = useState('');

  // Save mutation.
  const save = useMutation<{ interests: Interest[] }, Interest[]>(
    'PUT',
    '/api/v1/interests/me'
  );

  // Sync local state when API loads.
  useEffect(() => {
    if (current.data) {
      setInterests(current.data);
    }
  }, [current.data]);

  // Available zones for selected region.
  const zoneOptions = useMemo(() => {
    if (!options.data?.regions || !regionId) return [];

    const region = options.data.regions.find(
      item => String(item.id) === String(regionId)
    );

    return region?.zones ?? [];
  }, [options.data, regionId]);

  // Add interest locally.
  function addInterest() {
    if (!regionId) return;

    const next: Interest[] = [
      ...interests,
      {
        region_id: Number(regionId),
        zone_id: zoneId ? Number(zoneId) : null
      }
    ];

    setInterests(normalizeInterests(next));
    setZoneId('');
  }

  // Remove interest locally.
  function removeInterest(index: number) {
    setInterests(prev => prev.filter((_, i) => i !== index));
  }

  // Save interests to backend.
  async function saveInterests() {
    const normalized = normalizeInterests(interests);

    await save.mutate({ interests: normalized });

    setInterests(normalized);
    await current.refetch();
  }

  if (current.loading || options.loading) {
    return <Spinner />;
  }

  return (
    <Card>
      <h2 className="mb-3 text-base font-semibold">{t('interests')}</h2>

      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Select
          label={t('region')}
          value={regionId}
          onChange={event => {
            setRegionId(event.target.value);
            setZoneId('');
          }}
        >
          <option value="">{t('selectOption')}</option>

          {options.data?.regions.map(region => (
            <option key={region.id} value={region.id}>
              {localizedField(region, 'name', lang)}
            </option>
          ))}
        </Select>

        <Select
          label={`${t('zone')} (${t('optional')})`}
          value={zoneId}
          onChange={event => setZoneId(event.target.value)}
        >
          <option value="">{t('broadRegion')}</option>

          {zoneOptions.map(zone => (
            <option key={zone.id} value={zone.id}>
              {localizedField(zone, 'name', lang)}
            </option>
          ))}
        </Select>

        <div className="flex items-end">
          <Button variant="secondary" className="w-full" onClick={addInterest}>
            {t('addInterest')}
          </Button>
        </div>
      </div>

      <div className="mb-4 space-y-2">
        <p className="text-sm font-medium">{t('selectedInterests')}</p>

        {interests.length === 0 ? (
          <p className="text-sm text-gray-500">{t('noInterests')}</p>
        ) : (
          interests.map((interest, index) => {
            const region = options.data?.regions.find(
              item => item.id === interest.region_id
            );

            const zone = region?.zones.find(
              item => item.id === interest.zone_id
            );

            return (
              <div
                key={`${interest.region_id}-${interest.zone_id ?? 'broad'}-${index}`}
                className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm"
              >
                <span>
                  {region ? localizedField(region, 'name', lang) : interest.region_id}
                  {' / '}
                  {zone ? localizedField(zone, 'name', lang) : t('broadRegion')}
                </span>

                <button
                  className="text-xs text-red-600"
                  onClick={() => removeInterest(index)}
                >
                  {t('remove')}
                </button>
              </div>
            );
          })
        )}
      </div>

      <Button className="w-full" loading={save.loading} onClick={saveInterests}>
        {t('save')}
      </Button>
    </Card>
  );
}
```

---

### 12.23 `src/features/notifications/NotificationsList.tsx`

```tsx
// Import data hook.
import { useApi } from '../../hooks';

// Import language helpers.
import { localizedField, useLang } from '../../i18n';

// Import UI components.
import { Card, Spinner } from '../../ui';

// Import utility.
import { formatDate } from '../../utils';

// Import types.
import type { AppNotification, ListResponse } from '../../types';

// Notifications list component.
export function NotificationsList() {
  const { lang, t } = useLang();

  // Fetch notifications.
  const notifications = useApi<AppNotification[] | ListResponse<AppNotification>>(
    '/api/v1/notifications/me'
  );

  // Normalize list.
  const items = Array.isArray(notifications.data)
    ? notifications.data
    : notifications.data?.results ?? [];

  return (
    <Card>
      <h2 className="mb-3 text-base font-semibold">{t('notifications')}</h2>

      {notifications.loading ? <Spinner /> : null}

      {!notifications.loading && items.length === 0 ? (
        <p className="text-sm text-gray-500">{t('noResults')}</p>
      ) : null}

      <div className="space-y-2">
        {items.map(notification => (
          <div
            key={notification.id}
            className="rounded-lg border border-gray-200 p-3 text-sm"
          >
            <p>{localizedField(notification, 'message', lang)}</p>

            <p className="mt-1 text-xs text-gray-400">
              {formatDate(notification.created_at, lang)}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}
```

---

### 12.24 `src/features/profile/ProfilePage.tsx`

```tsx
// Import auth hook.
import { useAuth } from '../../auth';

// Import data hooks.
import { useApi, useMutation } from '../../hooks';

// Import language hook.
import { useLang, type TranslationKey } from '../../i18n';

// Import UI components.
import { Button, Card, Spinner } from '../../ui';

// Import utility.
import { isValidPhoto } from '../../utils';

// Import types.
import type { Completeness, MeUser } from '../../types';

// Import feature components.
import { ProfileForm } from './ProfileForm';
import { InterestsManager } from '../interests/InterestsManager';
import { NotificationsList } from '../notifications/NotificationsList';

// Profile page.
export function ProfilePage() {
  const { me, refreshMe, signOut } = useAuth();
  const { t } = useLang();

  // Fetch completeness.
  const completeness = useApi<Completeness>('/api/v1/me/completeness');

  // Photo mutations.
  const uploadPhoto = useMutation<FormData, MeUser>('POST', '/api/v1/me/photo');
  const deletePhoto = useMutation<undefined, MeUser>('DELETE', '/api/v1/me/photo');

  // Upload photo handler.
  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    // Validate file.
    const validationError = isValidPhoto(file);

    if (validationError) {
      alert(t(validationError as TranslationKey));
      return;
    }

    // Build FormData.
    const formData = new FormData();
    formData.append('photo', file);

    // Upload and refresh user.
    await uploadPhoto.mutate(formData);
    await refreshMe();
  }

  // Delete photo handler.
  async function onDeletePhoto() {
    await deletePhoto.mutate(undefined);
    await refreshMe();
  }

  if (!me) {
    return <Spinner full />;
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 p-4">
      {completeness.data ? (
        <Card>
          <h2 className="mb-2 text-base font-semibold">{t('completeness')}</h2>

          <p className="text-sm text-gray-700">
            {completeness.data.score}%
          </p>
        </Card>
      ) : null}

      <Card>
        <h2 className="mb-3 text-base font-semibold">{t('photo')}</h2>

        <div className="mb-3 flex items-center gap-4">
          {me.photo_url ? (
            <img
              src={me.photo_url}
              alt="profile"
              className="h-16 w-16 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-200 text-sm">
              No Photo
            </div>
          )}

          <div className="space-y-2">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={onFileChange}
            />

            {me.photo_url ? (
              <Button
                variant="danger"
                loading={deletePhoto.loading}
                onClick={onDeletePhoto}
              >
                {t('deletePhoto')}
              </Button>
            ) : null}
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-base font-semibold">{t('profile')}</h2>

        <ProfileForm onSaved={refreshMe} />
      </Card>

      <InterestsManager />

      <NotificationsList />

      <Button variant="secondary" className="w-full" onClick={signOut}>
        {t('signOut')}
      </Button>
    </div>
  );
}
```

---

### 12.25 `src/features/marketplace/UserCard.tsx`

```tsx
// Import language helpers.
import { localizedField, maskedOrLocalized, useLang } from '../../i18n';

// Import UI components.
import { Badge, Button, Card } from '../../ui';

// Import utility.
import { initials } from '../../utils';

// Import type.
import type { MarketplaceCard } from '../../types';

// Marketplace user card.
export function UserCard({
  card,
  onUnlock
}: {
  card: MarketplaceCard;
  onUnlock: (card: MarketplaceCard) => void;
}) {
  const { lang, t } = useLang();

  // Localized or masked fields.
  const name = maskedOrLocalized(card, 'full_name', lang);
  const branch = maskedOrLocalized(card, 'branch_name', lang);
  const neighborhood = maskedOrLocalized(card, 'neighborhood', lang);

  // Contact visibility.
  const isMasked = card.phone_number === '*';

  return (
    <Card className="mb-3">
      <div className="flex gap-3">
        {card.photo_url ? (
          <img
            src={card.photo_url}
            alt="candidate"
            className="h-14 w-14 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-200 text-sm font-medium">
            {initials(name)}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <p className="truncate font-medium">{name}</p>

            {card.is_mutual ? <Badge tone="green">{t('mutual')}</Badge> : null}

            {card.match_type === 'zone' ? (
              <Badge tone="blue">{t('matchZone')}</Badge>
            ) : (
              <Badge tone="yellow">{t('matchRegion')}</Badge>
            )}

            {card.is_purchased ? <Badge tone="gray">{t('purchased')}</Badge> : null}
          </div>

          <p className="text-sm text-gray-700">
            {card.grade ? localizedField(card.grade, 'name', lang) : ''}
          </p>

          <p className="text-sm text-gray-700">
            {card.zone
              ? localizedField(card.zone, 'name', lang)
              : card.region
                ? localizedField(card.region, 'name', lang)
                : ''}
          </p>

          <p className="text-sm text-gray-700">
            {t('branch')}: {branch}
          </p>

          <p className="text-sm text-gray-700">
            {t('neighborhood')}: {neighborhood}
          </p>

          <p className="text-sm text-gray-700">
            {t('phone')}: {card.phone_number}
          </p>

          <p className="text-sm text-gray-700">
            {t('telegram')}: {card.telegram_username}
          </p>

          {isMasked ? (
            <Button className="mt-3 w-full" onClick={() => onUnlock(card)}>
              {t('unlock')}
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
```

---

### 12.26 `src/features/marketplace/PurchaseModal.tsx`

```tsx
// Import React state.
import { useState } from 'react';

// Import mutation hook.
import { useMutation } from '../../hooks';

// Import language hook.
import { useLang } from '../../i18n';

// Import Telegram helper.
import { openExternalLink } from '../../telegram';

// Import UI components.
import { Button, Modal } from '../../ui';

// Import type.
import type { MarketplaceCard, Purchase } from '../../types';

// Purchase modal.
export function PurchaseModal({
  card,
  onClose,
  onPurchased
}: {
  card: MarketplaceCard;
  onClose: () => void;
  onPurchased: () => void;
}) {
  const { t } = useLang();

  // Create purchase mutation.
  const createPurchase = useMutation<{ target_user_id: number }, Purchase>(
    'POST',
    '/api/v1/purchases'
  );

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Confirm purchase.
  async function onConfirm() {
    setError(null);

    try {
      const purchase = await createPurchase.mutate({
        target_user_id: card.user_id
      });

      // Open payment link if provided.
      if (purchase.checkout_url) {
        openExternalLink(purchase.checkout_url);
      }

      setPending(true);
    } catch (err: any) {
      setError(err?.message ?? t('error'));
    }
  }

  return (
    <Modal open title={t('unlock')} onClose={onClose}>
      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

      {!pending ? (
        <>
          <p className="mb-4 text-sm text-gray-700">{t('purchaseConfirm')}</p>

          <div className="flex gap-2">
            <Button variant="secondary" className="w-full" onClick={onClose}>
              {t('cancel')}
            </Button>

            <Button
              className="w-full"
              loading={createPurchase.loading}
              onClick={onConfirm}
            >
              {t('confirm')}
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="mb-4 text-sm text-gray-700">{t('paymentOpened')}</p>

          <Button
            className="w-full"
            onClick={() => {
              onPurchased();
              onClose();
            }}
          >
            {t('checkStatus')}
          </Button>
        </>
      )}
    </Modal>
  );
}
```

---

### 12.27 `src/features/marketplace/MarketplaceList.tsx`

```tsx
// Import React state.
import { useState } from 'react';

// Import hooks.
import { useInView, useInfiniteList } from '../../hooks';

// Import language hook.
import { useLang } from '../../i18n';

// Import UI components.
import { Button, EmptyState, ErrorState, Spinner } from '../../ui';

// Import types.
import type { MarketplaceCard } from '../../types';

// Import marketplace components.
import { UserCard } from './UserCard';
import { PurchaseModal } from './PurchaseModal';

// Generic marketplace list.
export function MarketplaceList({
  endpoint,
  onAddInterests
}: {
  endpoint: string;
  onAddInterests?: () => void;
}) {
  const { t } = useLang();

  // Load infinite list.
  const list = useInfiniteList<MarketplaceCard>(endpoint);

  // Purchase modal target.
  const [purchaseCard, setPurchaseCard] = useState<MarketplaceCard | null>(null);

  // Infinite scroll sentinel.
  const sentinelRef = useInView(list.loadMore, list.hasMore && !list.loading);

  // Error state.
  if (list.error) {
    return <ErrorState message={list.error.message} onRetry={list.refresh} />;
  }

  // Empty state.
  if (!list.loading && list.items.length === 0) {
    if (list.requiresInterests && onAddInterests) {
      return (
        <EmptyState
          message={t('requiresInterests')}
          action={<Button onClick={onAddInterests}>{t('addInterest')}</Button>}
        />
      );
    }

    return (
      <EmptyState
        message={t('noResults')}
        action={<Button onClick={list.refresh}>{t('refresh')}</Button>}
      />
    );
  }

  return (
    <div className="mx-auto max-w-lg p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Button variant="secondary" onClick={list.refresh}>
          {t('refresh')}
        </Button>

        <Button
          variant="secondary"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          {t('backToTop')}
        </Button>
      </div>

      {list.items.map(card => (
        <UserCard
          key={card.user_id}
          card={card}
          onUnlock={setPurchaseCard}
        />
      ))}

      {list.loading ? <Spinner /> : null}

      <div ref={sentinelRef} className="h-4" />

      {purchaseCard ? (
        <PurchaseModal
          card={purchaseCard}
          onClose={() => setPurchaseCard(null)}
          onPurchased={list.refresh}
        />
      ) : null}
    </div>
  );
}
```

---

### 12.28 `src/features/feed/FeedPage.tsx`

```tsx
// Import marketplace list.
import { MarketplaceList } from '../marketplace/MarketplaceList';

// Feed page.
export function FeedPage() {
  return <MarketplaceList endpoint="/api/v1/marketplace/feed" />;
}
```

---

### 12.29 `src/features/people/PeoplePage.tsx`

```tsx
// Import marketplace list.
import { MarketplaceList } from '../marketplace/MarketplaceList';

// People page.
export function PeoplePage({
  onAddInterests
}: {
  onAddInterests?: () => void;
}) {
  return (
    <MarketplaceList
      endpoint="/api/v1/marketplace/people"
      onAddInterests={onAddInterests}
    />
  );
}
```

---

### 12.30 `src/features/purchases/PurchasesPage.tsx`

```tsx
// Import data hook.
import { useApi } from '../../hooks';

// Import language hook.
import { useLang } from '../../i18n';

// Import UI components.
import { Button, Card, EmptyState, Spinner } from '../../ui';

// Import utility.
import { formatDate } from '../../utils';

// Import types.
import type { ListResponse, Purchase } from '../../types';

// Purchases page.
export function PurchasesPage() {
  const { t, lang } = useLang();

  // Fetch purchases.
  const purchases = useApi<Purchase[] | ListResponse<Purchase>>(
    '/api/v1/purchases/me'
  );

  // Normalize list.
  const items = Array.isArray(purchases.data)
    ? purchases.data
    : purchases.data?.results ?? [];

  if (purchases.loading) {
    return <Spinner full />;
  }

  if (items.length === 0) {
    return (
      <div className="p-4">
        <EmptyState
          message={t('noResults')}
          action={<Button onClick={purchases.refetch}>{t('refresh')}</Button>}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-3 p-4">
      <div className="flex justify-end">
        <Button variant="secondary" onClick={purchases.refetch}>
          {t('refresh')}
        </Button>
      </div>

      {items.map(purchase => (
        <Card key={purchase.id}>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium">
              {purchase.status === 'completed'
                ? t('purchased')
                : t('purchasePending')}
            </p>

            <p className="text-xs text-gray-400">
              {formatDate(purchase.created_at, lang)}
            </p>
          </div>

          {purchase.target ? (
            <>
              <p className="text-sm text-gray-700">
                {t('name')}: {purchase.target.full_name_en}
              </p>

              <p className="text-sm text-gray-700">
                {t('phone')}: {purchase.target.phone_number}
              </p>

              <p className="text-sm text-gray-700">
                {t('telegram')}: {purchase.target.telegram_username}
              </p>

              <p className="text-sm text-gray-700">
                {t('branch')}: {purchase.target.branch_name_en}
              </p>

              <p className="text-sm text-gray-700">
                {t('neighborhood')}: {purchase.target.neighborhood_en}
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-500">
              #{purchase.id} — {purchase.status}
            </p>
          )}
        </Card>
      ))}
    </div>
  );
}
```

---

### 12.31 `src/App.tsx`

```tsx
// Import React hooks.
import { useEffect, useState } from 'react';

// Import auth provider.
import { AuthProvider, useAuth } from './auth';

// Import language provider.
import { LanguageProvider } from './i18n';

// Import Telegram initializer.
import { initTelegram } from './telegram';

// Import UI components.
import { Spinner, Tabs } from './ui';

// Import pages.
import { DevLoginPage } from './features/auth/DevLoginPage';
import { ProfileGate } from './features/profile/ProfileGate';
import { ProfilePage } from './features/profile/ProfilePage';
import { FeedPage } from './features/feed/FeedPage';
import { PeoplePage } from './features/people/PeoplePage';
import { PurchasesPage } from './features/purchases/PurchasesPage';

// Import types.
import type { Lang, TabKey } from './types';

// Root app component.
export default function App() {
  // Initialize Telegram Mini App once.
  useEffect(() => {
    initTelegram();
  }, []);

  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  );
}

// Root state router.
function Root() {
  const { status, me } = useAuth();

  // UI language state.
  const [lang, setLang] = useState<Lang>('en');

  // Sync language with user preference.
  useEffect(() => {
    if (me?.preferred_language) {
      setLang(me.preferred_language);
    }
  }, [me?.preferred_language]);

  // Loading state.
  if (status === 'loading') {
    return <Spinner full />;
  }

  // Unauthenticated state.
  if (status === 'unauthenticated') {
    return (
      <LanguageProvider lang={lang} setLang={setLang}>
        <DevLoginPage />
      </LanguageProvider>
    );
  }

  // Authenticated state.
  return (
    <LanguageProvider lang={lang} setLang={setLang}>
      <MainApp />
    </LanguageProvider>
  );
}

// Main authenticated app.
function MainApp() {
  const { me, refreshMe } = useAuth();

  // Active tab.
  const [tab, setTab] = useState<TabKey>('feed');

  // Wait for user.
  if (!me) {
    return <Spinner full />;
  }

  // Block marketplace until profile complete.
  if (!me.profile_complete) {
    return <ProfileGate onCompleted={refreshMe} />;
  }

  // Tab definitions.
  const tabs = [
    { key: 'feed', label: 'Feed' },
    { key: 'people', label: 'People' },
    { key: 'purchases', label: 'Purchases' },
    { key: 'profile', label: 'Profile' }
  ];

  return (
    <div className="min-h-full">
      <Tabs
        items={tabs}
        active={tab}
        onChange={key => setTab(key as TabKey)}
      />

      {tab === 'feed' ? <FeedPage /> : null}

      {tab === 'people' ? (
        <PeoplePage onAddInterests={() => setTab('profile')} />
      ) : null}

      {tab === 'purchases' ? <PurchasesPage /> : null}

      {tab === 'profile' ? <ProfilePage /> : null}
    </div>
  );
}
```

---

### 12.32 `src/main.tsx`

```tsx
// Import React StrictMode.
import { StrictMode } from 'react';

// Import React DOM renderer.
import { createRoot } from 'react-dom/client';

// Import global styles.
import './index.css';

// Import root component.
import App from './App';

// Render application.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

---

## 13. Implementation Order

Use this order to avoid confusion.

### Step 1 — Project bootstrap

```bash
npm install
npm run dev
```

Confirm the app loads.

---

### Step 2 — Backend connection

Confirm:

```text
VITE_API_BASE_URL=http://localhost:3000
```

Confirm backend health endpoints respond.

---

### Step 3 — Dev login

Implement:

```text
DevLoginPage
auth.tsx
api.ts
token.ts
```

Test:

```text
Login with Telegram ID
or
Login with pasted JWT
```

Expected:

```text
GET /api/v1/me succeeds
```

---

### Step 4 — Profile gate

Implement:

```text
ProfileGate
ProfileForm
validation.ts
```

Test:

```text
Incomplete user sees gate
Complete profile unlocks tabs
```

---

### Step 5 — Profile page

Implement:

```text
ProfilePage
Photo upload
Photo delete
Completeness
Notifications
```

---

### Step 6 — Interests

Implement:

```text
InterestsManager
normalizeInterests
```

Test:

```text
Add region
Add zone
Save interests
Remove interest
Max region rule
Max zone rule
```

---

### Step 7 — Marketplace

Implement:

```text
MarketplaceList
UserCard
FeedPage
PeoplePage
```

Test:

```text
Feed renders
People renders
Masked fields show *
Purchased fields show real values
Infinite scroll works
Refresh works
```

---

### Step 8 — Purchases

Implement:

```text
PurchaseModal
PurchasesPage
```

Test:

```text
Create purchase
Open checkout URL
Check status
Purchased card reveals contact
Purchases list shows completed purchases
```

---

## 14. Manual Testing Checklist

### Authentication

| Test | Expected |
|---|---|
| Open Mini App in browser with dev login enabled | Dev login screen appears |
| Login with Telegram ID | `GET /me` succeeds |
| Login with pasted JWT | `GET /me` succeeds |
| Invalid token | Returns to login |
| Open inside Telegram with real initData | Authenticates automatically |

---

### Profile Completion

| Test | Expected |
|---|---|
| Incomplete user opens app | Profile gate appears |
| Submit without full name | Validation error |
| Submit without branch | Validation error |
| Submit without neighborhood | Validation error |
| Submit without grade | Validation error |
| Submit valid profile | Tabs unlock |
| Change preferred language | UI language updates after save |

---

### Interests

| Test | Expected |
|---|---|
| Add broad region interest | Saved as zone_id null |
| Add zone interest | Saved with zone_id |
| Add 4 regions | Normalized to max 3 |
| Add 4 zones for one region | Normalized to max 3 |
| Add broad region and zones for same region | Zones override broad region |
| Remove interest | Removed after save |

---

### Feed

| Test | Expected |
|---|---|
| Feed loads | Cards appear |
| Masked card | Fields show `*` |
| Purchased card | Fields show real values |
| Mutual candidate | Mutual badge appears |
| Zone match | Zone match badge appears |
| Region match | Region match badge appears |
| Scroll to bottom | Next page loads |
| Refresh | List reloads |

---

### People

| Test | Expected |
|---|---|
| No interests | Requires interests empty state appears |
| Add interests | People results appear |
| Add interest button | Navigates to Profile tab |

---

### Purchases

| Test | Expected |
|---|---|
| Tap Unlock Contact | Confirmation modal appears |
| Confirm purchase | Backend creates purchase |
| Checkout URL returned | Link opens |
| Check payment status | List refreshes |
| Completed purchase | Contact revealed |
| Purchases tab | Shows purchase history |

---

### Photo

| Test | Expected |
|---|---|
| Upload JPEG | Photo saved |
| Upload PNG | Photo saved |
| Upload WEBP | Photo saved |
| Upload PDF | Client validation error |
| Upload over 5 MB | Client validation error |
| Delete photo | Photo removed |

---

## 15. Production Checklist

Before production:

| Item | Required |
|---|---|
| `VITE_ENABLE_DEV_LOGIN=false` | Yes |
| Backend hosted over HTTPS | Yes |
| Telegram Mini App URL configured in BotFather | Yes |
| Real Telegram initData auth tested | Yes |
| Chapa webhook tested | Yes |
| Paywall masking tested | Yes |
| Amharic translation reviewed | Yes |
| Profile completion gate tested | Yes |
| Feed and People rules tested | Yes |
| Purchase permanence tested | Yes |
| Error states tested | Yes |
| Empty states tested | Yes |
| Rate limit errors handled gracefully | Yes |
| Photo upload and backup tested | Yes |

---

## 16. Important Implementation Rules

1. Do not implement same-bank filtering in the Mini App.
2. Do not implement grade-band filtering in the Mini App.
3. Do not implement paywall logic in the Mini App.
4. Render masked values exactly as `"*"`.
5. Use backend response as the source of truth.
6. Keep all API calls in `api.ts`.
7. Keep all validation messages bilingual.
8. Keep all business-rule normalization defensive, but rely on backend final validation.
9. Do not store sensitive data in localStorage.
10. Use sessionStorage for the JWT.
11. Disable dev login in production.
12. Use Telegram `initData` for real authentication.

---

## 17. Done Criteria

The Mini App is complete when:

```text
A user can authenticate.
A user can complete profile.
A user can manage transfer interests.
A user can browse Feed.
A user can browse People.
A user can unlock a contact.
A user can view purchases.
A user can manage photo.
A user can receive/view notifications.
Masked fields render correctly.
Purchased fields render correctly.
English and Amharic both work.
Development login works locally.
Production Telegram auth works inside Telegram.
```