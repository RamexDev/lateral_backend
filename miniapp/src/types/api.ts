// API response/request types — verified against backend src/modules/**.
// Updated for v2 to include the new F.5/F.6/F.8 fields on cards and
// F.4 read_at on notifications.

import type { Lang } from './domain';

// ── Tab keys (app-level) ──────────────────────────────────────────────────────
export type TabKey = 'feed' | 'people' | 'purchases' | 'profile';

// ── Auth ──────────────────────────────────────────────────────────────────────
export interface AuthResponse {
  token: string;
  user_id: number;
  profile_complete: boolean;
}

// ── User / profile ────────────────────────────────────────────────────────────
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
  photo_url?: string | null;
  photo_source?: 'telegram' | 'custom' | 'placeholder' | null;
  photo_base_url?: string;
  preferred_language: Lang;
  profile_complete: boolean;
  is_active: boolean;
  created_at: string;
}

// Minimal Bank/Region/Zone refs are imported below to avoid circular refs.
import type { Bank, Region, Zone, Grade } from './domain';

export interface Completeness {
  is_marketplace_unlocked: boolean;
  is_fully_complete: boolean;
  missing_required: string[];
  missing_encouraged: string[];
  nudge: {
    show: boolean;
    message_code: string;
    message: string;
    message_en: string;
    message_am: string;
  };
}

export interface ProfileUpdateResponse {
  updated: boolean;
  profile_complete: boolean;
}

export interface PhotoResponse {
  photo_url: string | null;
  photo_source: 'telegram' | 'custom' | 'placeholder';
}

// ── Interests ─────────────────────────────────────────────────────────────────
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

export interface MyInterestsResponse {
  interests: Interest[];
  selected_region_count: number;
}

export interface InterestOptionsResponse {
  region: Region;
  is_user_home_region: boolean;
  has_broad_interest: boolean;
  zones: Zone[];
  current_selection_count: number;
  limits: { max_regions: number; max_zones_per_region: number };
}

export interface InterestSaveResponse {
  saved: boolean;
  total_active_interests: number;
}

// ── Marketplace cards ─────────────────────────────────────────────────────────
// Notable: `id` (NOT `user_id`), `purchased` (NOT `is_purchased`),
// flat `grade` object, flat `region`/`region_en`/`region_am` strings.
// v2 adds: `relevance_score`, `viewed_at`, `is_shortlisted` (all additive, optional).
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
  region: string;
  region_en: string;
  region_am: string;
  zone: string;
  zone_en: string;
  zone_am: string;
  full_name_en: string;
  full_name_am: string;
  branch_name_en: string;
  branch_name_am: string;
  neighborhood_en: string;
  neighborhood_am: string;
  phone_number: string;
  telegram_username: string;
  photo_url: string | null;
  match_type: 'zone' | 'region' | null;
  is_mutual: boolean;
  purchased: boolean;
  // v2 additive fields (F.5, F.6, F.8):
  relevance_score?: number;
  viewed_at?: string | null;
  is_shortlisted?: boolean;
  // Only present in shortlist responses:
  shortlisted_at?: string;
}

// ── Purchases ─────────────────────────────────────────────────────────────────
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
  status?: 'pending' | 'completed';
  created_at?: string;
  completed_at: string | null;
  target: PurchaseTarget;
}

export interface PurchaseStats {
  total_reveals: number;
  total_spent_etb: number;
  total_pending: number;
  this_month_reveals: number;
  this_month_spent_etb: number;
  currency: string;
  reveal_price_etb: number;
}

// ── Notifications ─────────────────────────────────────────────────────────────
export interface AppNotificationPayload {
  summary_en?: string;
  summary_am?: string;
  purchase_id?: number;
  target_user_id?: number;
  amount_etb?: number;
  new_matches?: number;
  [key: string]: unknown;
}

export interface AppNotification {
  id: number;
  type: 'digest' | 'broadcast' | 'payment_confirmation' | 'profile_nudge' | string;
  payload: AppNotificationPayload | null;
  sent_at: string | null;
  read_at: string | null;
  created_at: string;
}

// ── Reference data (F.1) ──────────────────────────────────────────────────────
export interface RegionsResponse {
  regions: Region[];
}

export interface ZonesResponse {
  zones: Zone[];
}

// ── Config (F.2) ──────────────────────────────────────────────────────────────
export interface PublicConfig {
  reveal_price_etb: number;
  currency: string;
  payment_provider: string;
  photo_base_url: string;
}

// ── List envelopes ────────────────────────────────────────────────────────────
export interface ListResponse<T> {
  results?: T[];
  notifications?: AppNotification[];
  page: number;
  page_size: number;
  total_results: number;
  requires_interests?: boolean;
  unread_count?: number;
}

// ── Marketplace filters (F.7) ─────────────────────────────────────────────────
export interface MarketplaceFilters {
  mutual_only?: boolean;
  grade_band?: number;
  region_id?: number;
  zone_id?: number;
}

// ── Shortlist (F.8) ───────────────────────────────────────────────────────────
export interface ShortlistAddResponse {
  shortlisted: boolean;
  target_user_id: number;
}

export interface ShortlistRemoveResponse {
  removed: boolean;
  target_user_id: number;
}

// ── Impressions (F.6) ─────────────────────────────────────────────────────────
export interface ImpressionsResponse {
  recorded: number;
}

// ── Mark-read (F.4) ───────────────────────────────────────────────────────────
export interface MarkReadResponse {
  marked_read: number;
  notification_id?: number;
}
