// Central API client.
// Per the brief: every network call lives here. No screen calls fetch directly.
//
// The backend wraps every response in { success, data } or { success, error }.
// This client unwraps `data` on success and throws a normalized ApiError on
// failure.

import { env } from './env';
import { getToken, clearToken } from './token';

// Normalized error thrown by api() on any non-success response.
export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(code: string, message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

// Query parameter values we accept.
type Query = Record<string, string | number | boolean | null | undefined>;

// Options for the api() helper — extends fetch with our extras.
type ApiOptions = RequestInit & {
  query?: Query;
  // Override token (used by the auth bootstrap before a token is stored).
  token?: string | null;
};

// Build a `?k=v&k=v` query string from a Query map, skipping empties.
function buildQuery(query?: Query): string {
  if (!query) return '';

  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  }

  const text = params.toString();
  return text ? `?${text}` : '';
}

// Resolve a relative backend path (like "/avatars/foo.jpg") to a full URL.
// Used for photo URLs returned by /me, /me/photo, and the marketplace cards.
export function resolveAssetUrl(path: string | null | undefined): string | null {
  if (!path) return null;

  // Already absolute? Leave it alone.
  if (/^https?:\/\//i.test(path) || path.startsWith('data:')) return path;

  // Relative paths come back like "/avatars/1-custom-...jpg".
  return `${env.apiBaseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
}

// Main fetch wrapper. Always returns unwrapped `data`, or throws ApiError.
export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);

  // Attach JWT unless explicitly overridden (used by the token-login flow).
  const token = options.token ?? getToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // JSON body content-type for non-FormData requests.
  if (!(options.body instanceof FormData) && options.body != null) {
    headers.set('Content-Type', 'application/json');
  }

  // Build full URL with query string.
  const url = `${env.apiBaseUrl}${path}${buildQuery(options.query)}`;

  // Perform the request.
  const response = await fetch(url, { ...options, headers });

  // Read body once as text — some error responses are not JSON.
  const text = await response.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }

  // Any HTTP error or envelope-level error becomes ApiError.
  if (!response.ok || !body?.success) {
    const code =
      body?.error?.code ?? (response.status === 401 ? 'UNAUTHORIZED' : 'HTTP_ERROR');
    const message = body?.error?.message ?? response.statusText ?? 'Request failed';

    // 401 means the JWT is invalid/expired — drop it and notify the app.
    if (response.status === 401) {
      clearToken();
      window.dispatchEvent(new Event('zwuwur:unauthorized'));
    }

    throw new ApiError(code, message, response.status, body?.error?.details);
  }

  return body.data as T;
}

// ─── Typed endpoint helpers ───────────────────────────────────────────────
// One named function per endpoint. Screens import these instead of calling
// api() directly — keeps the call sites readable and the contract in one place.

import type {
  AppNotification,
  AuthResponse,
  Completeness,
  GradeRow,
  InterestSaveResponse,
  InterestOptionsResponse,
  ListResponse,
  MarketplaceCard,
  MeUser,
  MyInterestsResponse,
  PhotoResponse,
  ProfileUpdateResponse,
  Purchase,
  PurchaseCreateResponse
} from './types';

// POST /api/v1/auth/telegram — real Telegram initData login.
export function authWithTelegram(initData: string) {
  return api<AuthResponse>('/api/v1/auth/telegram', {
    method: 'POST',
    body: JSON.stringify({ init_data: initData })
  });
}

// POST /api/v1/auth/issue-token — dev-only login by Telegram ID.
// Hard-guarded to 404 in production on the backend side, so this is safe to
// call from the dev build. Requires the user to already exist (the seed does
// NOT create users — see README for the SQL snippet to create a test user).
export function authWithTelegramId(telegramId: number) {
  return api<AuthResponse>('/api/v1/auth/issue-token', {
    method: 'POST',
    body: JSON.stringify({ telegram_id: telegramId })
  });
}

// GET /api/v1/me
export function getMe() {
  return api<MeUser>('/api/v1/me');
}

// PUT /api/v1/me — partial update. Backend rejects bank_id changes.
export function updateProfile(payload: Record<string, unknown>) {
  return api<ProfileUpdateResponse>('/api/v1/me', {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

// GET /api/v1/me/completeness
export function getCompleteness() {
  return api<Completeness>('/api/v1/me/completeness');
}

// POST /api/v1/me/photo — multipart form-data, field name "photo".
export function uploadPhoto(formData: FormData) {
  return api<PhotoResponse>('/api/v1/me/photo', {
    method: 'POST',
    body: formData
  });
}

// DELETE /api/v1/me/photo
export function deletePhoto() {
  return api<PhotoResponse>('/api/v1/me/photo', { method: 'DELETE' });
}

// GET /api/v1/interests/me
export function getMyInterests() {
  return api<MyInterestsResponse>('/api/v1/interests/me');
}

// GET /api/v1/interests/options?region_id=...
// If regionId omitted, backend returns options for the user's home region.
export function getInterestOptions(regionId?: number) {
  return api<InterestOptionsResponse>('/api/v1/interests/options', {
    query: regionId ? { region_id: regionId } : undefined
  });
}

// PUT /api/v1/interests/me — bulk replace.
export function saveInterests(interests: Array<{ region_id: number; zone_id: number | null }>) {
  return api<InterestSaveResponse>('/api/v1/interests/me', {
    method: 'PUT',
    body: JSON.stringify({ interests })
  });
}

// DELETE /api/v1/interests/:id
export function deleteInterest(id: number) {
  return api<{ deleted_id: number }>(`/api/v1/interests/${id}`, { method: 'DELETE' });
}

// GET /api/v1/marketplace/feed?page=&page_size=&fresh=
export function getFeed(page = 1, pageSize = 10, fresh = false) {
  return api<ListResponse<MarketplaceCard>>('/api/v1/marketplace/feed', {
    query: { page, page_size: pageSize, fresh: fresh ? 'true' : 'false' }
  });
}

// GET /api/v1/marketplace/people?page=&page_size=
export function getPeople(page = 1, pageSize = 10) {
  return api<ListResponse<MarketplaceCard>>('/api/v1/marketplace/people', {
    query: { page, page_size: pageSize }
  });
}

// POST /api/v1/purchases — initiate a paid reveal.
export function createPurchase(targetUserId: number) {
  return api<PurchaseCreateResponse>('/api/v1/purchases', {
    method: 'POST',
    body: JSON.stringify({ target_user_id: targetUserId })
  });
}

// GET /api/v1/purchases/me?page=&page_size=
export function getMyPurchases(page = 1, pageSize = 20) {
  return api<ListResponse<Purchase>>('/api/v1/purchases/me', {
    query: { page, page_size: pageSize }
  });
}

// GET /api/v1/notifications/me?page=&page_size=
export function getMyNotifications(page = 1, pageSize = 20) {
  return api<ListResponse<AppNotification>>('/api/v1/notifications/me', {
    query: { page, page_size: pageSize }
  });
}

// GET /api/v1/grades — list all active grades.
export function getGrades() {
  return api<GradeRow[]>('/api/v1/grades');
}
