// Central fetch client.
// Always returns unwrapped `data` or throws ApiError.

import { env } from '../env';
import { getToken, clearToken } from '../token';
import { ApiError } from './errors';

export interface ApiOptions extends RequestInit {
  token?: string | null;
  query?: Record<string, string | number | boolean | null | undefined>;
  // Skip JSON parsing — return raw Response (e.g. for streaming).
  raw?: boolean;
  // Skip auth header.
  skipAuth?: boolean;
}

// Build a query string from a record, skipping null/undefined/empty values.
export function buildQuery(query?: Record<string, string | number | boolean | null | undefined>): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === null || v === undefined || v === '') continue;
    params.append(k, String(v));
  }
  const str = params.toString();
  return str ? '?' + str : '';
}

// Resolve a relative backend path (e.g. /avatars/foo.jpg) to a full URL.
export function resolveAssetUrl(path: string | null | undefined, baseUrl?: string): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }
  const base = (baseUrl || env.apiBaseUrl).replace(/\/$/, '');
  const suffix = path.startsWith('/') ? path : '/' + path;
  return base + suffix;
}

// Main fetch wrapper.
export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { token, query, raw, skipAuth, headers: customHeaders, ...rest } = options;

  const url = env.apiBaseUrl + path + buildQuery(query);

  const headers = new Headers(customHeaders);
  if (!skipAuth) {
    const t = token ?? getToken();
    if (t) {
      headers.set('Authorization', 'Bearer ' + t);
    }
  }

  // Set Content-Type for non-FormData bodies.
  if (rest.body && typeof rest.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(url, { ...rest, headers });
  } catch (err) {
    throw new ApiError(
      err instanceof Error ? err.message : 'Network error',
      'NETWORK_ERROR',
      0
    );
  }

  if (response.status === 401) {
    clearToken();
    window.dispatchEvent(new Event('zwuwur:unauthorized'));
    throw new ApiError('Unauthorized', 'INVALID_TOKEN', 401);
  }

  if (raw) {
    if (!response.ok) {
      throw new ApiError('Request failed', 'HTTP_ERROR', response.status);
    }
    return response as unknown as T;
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ApiError('Invalid JSON response', 'PARSE_ERROR', response.status);
  }

  // Backend envelope: { success: boolean, data?: T, error?: { code, message }, message?: string }
  const envelope = body as { success?: boolean; data?: T; error?: { code: string; message: string }; message?: string };

  if (!response.ok || envelope.success === false) {
    const errMsg = envelope.error?.message || envelope.message || 'Request failed';
    const errCode = envelope.error?.code || 'HTTP_ERROR';
    throw new ApiError(errMsg, errCode, response.status, envelope.error);
  }

  return envelope.data as T;
}
