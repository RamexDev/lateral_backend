// TypeScript types for the Zwuwur Mini App.
//
// IMPORTANT: Every interface here was verified against the actual backend
// source under src/modules/** — not copied from miniapp.md or api.html, both
// of which have drifted from the running code. See:
//   - src/modules/user/user.service.js          -> MeUser, Completeness
//   - src/modules/marketplace/cardSerializer.js -> MarketplaceCard
//   - src/modules/purchases/purchases.service.js -> Purchase, PurchaseTarget
//   - src/modules/notifications/notifications.service.js -> AppNotification
//   - src/modules/interests/interests.service.js -> Interest, InterestOptions

// UI languages. Backend stores preferred_language as 'en' | 'am'.
export type Lang = 'en' | 'am';

// The four fixed tabs. No deep-linking, no fifth tab.
export type TabKey = 'feed' | 'people' | 'purchases' | 'profile';

// ─── Reference data ────────────────────────────────────────────────────────
// Note: backend uses `name` (English) + `name_am` on region/zone option
// responses (interests.service.js → getOptions), not `name_en`/`name_am`.

export interface Bank {
  id: number;
  name: string; // English name (bank_name_en aliased as `name` in /me)
  name_am: string;
  nickname: string; // alias_en
}

export interface Region {
  id: number;
  name: string; // English
  name_am: string;
}

export interface Zone {
  id: number;
  name: string; // English
  name_am: string;
  selected?: boolean; // Only present in interest-options responses
}

export interface Grade {
  id: number;
  grade_number: number;
  band_number: number;
  band_label: string; // English
  band_label_am: string;
  tier_classification_en: string;
  tier_classification_am: string;
}

// Row from the public GET /api/v1/grades endpoint.
export interface GradeRow {
  id: number;
  grade_number: number;
  band_number: number;
  band_label_en: string;
  band_label_am: string;
  tier_classification_en: string;
  tier_classification_am: string;
  rank_order: number;
}

// ─── Auth & user ───────────────────────────────────────────────────────────
// Verified against src/modules/user/user.service.js → getMe().
// Note the top-level ID field is `user_id`, not `id`.

export interface MeUser {
  user_id: number;
  telegram_username?: string | null;
  phone_number?: string | null;
  bank: Bank | null;
  region: Region | null;
  zone: Zone | null;
  grade: Grade | null;
  full_name_en?: string | null;
  full_name_am?: string | null;
  branch_name_en?: string | null;
  branch_name_am?: string | null;
  neighborhood_en?: string | null;
  neighborhood_am?: string | null;
  photo_url?: string | null; // Relative path like "/avatars/1-custom-...jpg"
  photo_source?: 'telegram' | 'custom' | 'placeholder' | null;
  preferred_language: Lang;
  profile_complete: boolean;
  is_active: boolean;
  created_at: string;
}

// Auth response from POST /auth/telegram and POST /auth/issue-token.
export interface AuthResponse {
  token: string;
  user_id: number;
  profile_complete: boolean;
}

// Verified against src/modules/user/user.service.js → getCompleteness().
// The shape is quite different from what miniapp.md assumes — there is no
// `score`, no `missing` flat array, and no `nudges` array.
export interface Completeness {
  is_marketplace_unlocked: boolean;
  is_fully_complete: boolean;
  missing_required: string[];
  missing_encouraged: string[];
  nudge: {
    show: boolean;
    message_code: string;
    message: string; // Already localized to user's preferred_language
    message_en: string;
    message_am: string;
  };
}

// ─── Interests ─────────────────────────────────────────────────────────────
// Verified against src/modules/interests/interests.service.js.
// Note the field names: `region_name`/`region_name_am`/`zone_name`/`zone_name_am`
// (NOT `region.name_en`/`region.name_am`/`zone.name_en`/`zone.name_am`).

export interface Interest {
  id?: number;
  region_id: number;
  zone_id: number | null;
  region_name?: string;
  region_name_am?: string;
  zone_name?: string | null;
  zone_name_am?: string | null;
  created_at?: string;
}

// Response from GET /interests/me.
export interface MyInterestsResponse {
  interests: Interest[];
  selected_region_count: number;
}

// Response from GET /interests/options?region_id=...
export interface InterestOptionsResponse {
  region: Region;
  is_user_home_region: boolean;
  has_broad_interest: boolean;
  zones: Zone[]; // Each zone has `selected: boolean`
  current_selection_count: number;
  limits: {
    max_regions: number;
    max_zones_per_region: number;
  };
}

// ─── Marketplace card ──────────────────────────────────────────────────────
// Verified against src/modules/marketplace/cardSerializer.js → serializeCard().
//
// KEY DIFFERENCES from miniapp.md's MarketplaceCard:
//   - `id` (NOT `user_id`) — the candidate user's ID
//   - `purchased` (NOT `is_purchased`)
//   - flat `grade: { band, number }` — NOT nested Grade object
//   - flat string fields: `region`, `region_en`, `region_am`,
//     `zone`, `zone_en`, `zone_am` — NOT nested Region/Zone objects
//   - masked fields come back as the literal string "*" when not purchased
export interface MarketplaceCard {
  id: number;
  bank_id: number;
  grade: {
    band: number;
    number: number;
    band_label_en: string;
    band_label_am: string;
    tier_classification_en: string;
    tier_classification_am: string;
  } | null;
  region: string; // English (same as region_en)
  region_en: string;
  region_am: string;
  zone: string; // English (same as zone_en)
  zone_en: string;
  zone_am: string;
  full_name_en: string; // "*" when masked
  full_name_am: string;
  branch_name_en: string;
  branch_name_am: string;
  neighborhood_en: string;
  neighborhood_am: string;
  phone_number: string; // "*" when masked
  telegram_username: string; // "*" when masked
  photo_url: string | null; // Always real, never masked
  match_type: 'zone' | 'region' | null;
  is_mutual: boolean;
  purchased: boolean;
}

// ─── Purchases ─────────────────────────────────────────────────────────────
// Verified against src/modules/purchases/purchases.service.js.
//
// POST /purchases response.
export interface PurchaseCreateResponse {
  purchase_id: number;
  payment_id?: number;
  checkout_url: string | null;
  status: 'pending' | 'completed' | 'failed';
  amount: number;
  currency: string;
  provider: string;
  already_exists: boolean;
}

// Each row in GET /purchases/me results[].
// `target` is the candidate's full contact — backend only returns completed
// purchases, so all fields are real (not "*").
export interface PurchaseTarget {
  id: number;
  full_name_en: string | null;
  full_name_am: string | null;
  phone_number: string | null;
  telegram_username: string | null;
  branch_name_en: string | null;
  branch_name_am: string | null;
  neighborhood_en: string | null;
  neighborhood_am: string | null;
  photo_url: string | null;
  grade: {
    band: number;
    number: number;
    band_label_en: string;
    band_label_am: string;
    tier_classification_en: string;
    tier_classification_am: string;
  } | null;
  region_en: string;
  region_am: string;
  zone_en: string;
  zone_am: string;
}

export interface Purchase {
  purchase_id: number;
  completed_at: string | null;
  target: PurchaseTarget;
}

// ─── Notifications ─────────────────────────────────────────────────────────
// Verified against src/modules/notifications/notifications.service.js.
//
// KEY DIFFERENCES from miniapp.md's AppNotification:
//   - No `message_en` / `message_am` — those live inside `payload`
//   - No `read_at` — the backend has no read/unread state at all
//   - We track "seen" client-side (see notifications store)

export interface AppNotificationPayload {
  // Common, type-agnostic bilingual fields.
  summary_en?: string;
  summary_am?: string;
  // Payment-confirmation extras:
  purchase_id?: number;
  target_user_id?: number;
  amount_etb?: number;
  // Broadcasts may include arbitrary keys.
  [key: string]: unknown;
}

export interface AppNotification {
  id: number;
  type: 'digest' | 'broadcast' | 'payment_confirmation' | 'profile_nudge' | string;
  payload: AppNotificationPayload | null;
  sent_at: string | null;
  created_at: string;
}

// ─── List envelopes ────────────────────────────────────────────────────────
// Generic shape used by paginated endpoints. Some endpoints (feed/people/
// purchases/notifications) wrap results in `results` or `notifications`;
// `requires_interests` is only present on people.

export interface ListResponse<T> {
  results?: T[];
  notifications?: AppNotification[]; // Only for /notifications/me
  page: number;
  page_size: number;
  total_results: number;
  requires_interests?: boolean; // Only on /marketplace/people
}

// Generic mutation success shapes used inline where needed.
export interface ProfileUpdateResponse {
  updated: boolean;
  profile_complete: boolean;
}

export interface InterestSaveResponse {
  saved: boolean;
  total_active_interests: number;
}

export interface PhotoResponse {
  photo_url: string | null;
  photo_source: 'telegram' | 'custom' | 'placeholder';
}
