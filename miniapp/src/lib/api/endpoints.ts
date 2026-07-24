// Typed endpoint helpers — one function per backend route.
// All functions return the unwrapped `data` field from the backend envelope.

import { api, resolveAssetUrl } from './client';
import type {
  AuthResponse,
  MeUser,
  Completeness,
  ProfileUpdateResponse,
  PhotoResponse,
  Interest,
  InterestOptionsResponse,
  MyInterestsResponse,
  InterestSaveResponse,
  MarketplaceCard,
  PurchaseCreateResponse,
  Purchase,
  PurchaseStats,
  AppNotification,
  ListResponse,
  RegionsResponse,
  ZonesResponse,
  PublicConfig,
  GradeRow,
  ShortlistAddResponse,
  ShortlistRemoveResponse,
  ImpressionsResponse,
  MarkReadResponse
} from '../../types';

// ── Auth ──────────────────────────────────────────────────────────────────────
export function authWithTelegram(initData: string): Promise<AuthResponse> {
  return api<AuthResponse>('/api/v1/auth/telegram', {
    method: 'POST',
    body: JSON.stringify({ init_data: initData })
  });
}

export function authWithTelegramId(telegramId: number): Promise<AuthResponse> {
  return api<AuthResponse>('/api/v1/auth/issue-token', {
    method: 'POST',
    body: JSON.stringify({ telegram_id: telegramId })
  });
}

// ── User / profile ────────────────────────────────────────────────────────────
export function getMe(): Promise<MeUser> {
  return api<MeUser>('/api/v1/me');
}

export function updateProfile(payload: Record<string, unknown>): Promise<ProfileUpdateResponse> {
  return api<ProfileUpdateResponse>('/api/v1/me', {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

export function getCompleteness(): Promise<Completeness> {
  return api<Completeness>('/api/v1/me/completeness');
}

export function uploadPhoto(formData: FormData): Promise<PhotoResponse> {
  return api<PhotoResponse>('/api/v1/me/photo', {
    method: 'POST',
    body: formData
    // Note: do NOT set Content-Type — browser sets multipart boundary automatically.
  });
}

export function deletePhoto(): Promise<PhotoResponse> {
  return api<PhotoResponse>('/api/v1/me/photo', {
    method: 'DELETE'
  });
}

// ── Interests ─────────────────────────────────────────────────────────────────
export function getMyInterests(): Promise<MyInterestsResponse> {
  return api<MyInterestsResponse>('/api/v1/interests/me');
}

export function getInterestOptions(regionId?: number): Promise<InterestOptionsResponse> {
  return api<InterestOptionsResponse>('/api/v1/interests/options', {
    query: { region_id: regionId }
  });
}

export function saveInterests(interests: Interest[]): Promise<InterestSaveResponse> {
  return api<InterestSaveResponse>('/api/v1/interests/me', {
    method: 'PUT',
    body: JSON.stringify({ interests })
  });
}

// ── Marketplace ───────────────────────────────────────────────────────────────
// MarketplaceFilters is imported from types below.

import type { MarketplaceFilters } from '../../types';

export function getFeed(
  page = 1,
  pageSize = 10,
  fresh = false,
  filters: MarketplaceFilters = {}
): Promise<ListResponse<MarketplaceCard>> {
  return api<ListResponse<MarketplaceCard>>('/api/v1/marketplace/feed', {
    query: { page, page_size: pageSize, fresh, ...filters }
  });
}

export function getPeople(
  page = 1,
  pageSize = 10,
  fresh = false,
  filters: MarketplaceFilters = {}
): Promise<ListResponse<MarketplaceCard>> {
  return api<ListResponse<MarketplaceCard>>('/api/v1/marketplace/people', {
    query: { page, page_size: pageSize, fresh, ...filters }
  });
}

// ── Impressions (F.6) ─────────────────────────────────────────────────────────
export function recordImpressions(candidateIds: number[]): Promise<ImpressionsResponse> {
  return api<ImpressionsResponse>('/api/v1/marketplace/impressions', {
    method: 'POST',
    body: JSON.stringify({ candidate_ids: candidateIds })
  });
}

// ── Purchases ─────────────────────────────────────────────────────────────────
export function createPurchase(targetUserId: number): Promise<PurchaseCreateResponse> {
  return api<PurchaseCreateResponse>('/api/v1/purchases', {
    method: 'POST',
    body: JSON.stringify({ target_user_id: targetUserId })
  });
}

export function getMyPurchases(
  page = 1,
  pageSize = 20,
  status: 'completed' | 'pending' | 'all' = 'completed'
): Promise<ListResponse<Purchase>> {
  return api<ListResponse<Purchase>>('/api/v1/purchases/me', {
    query: { page, page_size: pageSize, status }
  });
}

export function getPurchaseStats(): Promise<PurchaseStats> {
  return api<PurchaseStats>('/api/v1/purchases/me/stats');
}

// ── Notifications ─────────────────────────────────────────────────────────────
export function getMyNotifications(
  page = 1,
  pageSize = 20,
  unreadOnly = false
): Promise<ListResponse<AppNotification>> {
  return api<ListResponse<AppNotification>>('/api/v1/notifications/me', {
    query: { page, page_size: pageSize, unread_only: unreadOnly }
  });
}

export function markAllNotificationsRead(): Promise<MarkReadResponse> {
  return api<MarkReadResponse>('/api/v1/notifications/me/mark-read', {
    method: 'POST'
  });
}

export function markNotificationRead(id: number): Promise<MarkReadResponse> {
  return api<MarkReadResponse>(`/api/v1/notifications/${id}/read`, {
    method: 'POST'
  });
}

// ── Reference data (F.1) ──────────────────────────────────────────────────────
export function getRegions(): Promise<RegionsResponse> {
  return api<RegionsResponse>('/api/v1/regions', { skipAuth: true });
}

export function getZones(regionId?: number): Promise<ZonesResponse> {
  return api<ZonesResponse>('/api/v1/zones', {
    query: { region_id: regionId },
    skipAuth: true
  });
}

// ── Config (F.2) ──────────────────────────────────────────────────────────────
export function getPublicConfig(): Promise<PublicConfig> {
  return api<PublicConfig>('/api/v1/config', { skipAuth: true });
}

// ── Grades ────────────────────────────────────────────────────────────────────
export function getGrades(): Promise<GradeRow[]> {
  return api<GradeRow[]>('/api/v1/grades', { skipAuth: true });
}

// ── Shortlist (F.8) ───────────────────────────────────────────────────────────
export function addShortlist(targetUserId: number): Promise<ShortlistAddResponse> {
  return api<ShortlistAddResponse>('/api/v1/shortlist', {
    method: 'POST',
    body: JSON.stringify({ target_user_id: targetUserId })
  });
}

export function removeShortlist(targetUserId: number): Promise<ShortlistRemoveResponse> {
  return api<ShortlistRemoveResponse>(`/api/v1/shortlist/${targetUserId}`, {
    method: 'DELETE'
  });
}

export function getShortlist(page = 1, pageSize = 20): Promise<ListResponse<MarketplaceCard>> {
  return api<ListResponse<MarketplaceCard>>('/api/v1/shortlist', {
    query: { page, page_size: pageSize }
  });
}

// Re-export asset URL resolver for convenience.
export { resolveAssetUrl };
