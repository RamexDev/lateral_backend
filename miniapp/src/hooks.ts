// React data hooks for the Zwuwur Mini App.
//
// These wrap the typed api() helpers in hooks with loading/error/data state.
// No screen calls api() directly — they go through these hooks (or through
// the typed endpoint helpers when they need an imperative call).

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from './api';

// ─── useApi: one-shot GET ──────────────────────────────────────────────────
// Fetches `path` whenever it (or any dep) changes. Pass null to disable.

export interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
  refetch: () => Promise<void>;
  setData: (data: T | null) => void;
}

export function useApi<T>(path: string | null, deps: unknown[] = []): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(path));
  const [error, setError] = useState<ApiError | null>(null);

  const load = useCallback(async () => {
    if (!path) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await api<T>(path);
      setData(result);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, refetch: load, setData };
}

// ─── useMutation: imperative POST/PUT/DELETE ───────────────────────────────
// Returns a `mutate` function plus loading/error state.

export interface UseMutationResult<TBody, TData> {
  mutate: (
    body?: TBody,
    options?: RequestInit & { query?: Record<string, string | number | boolean | null | undefined> }
  ) => Promise<TData>;
  loading: boolean;
  error: ApiError | null;
}

export function useMutation<TBody = unknown, TData = unknown>(
  method: string,
  path: string | ((body: TBody) => string)
): UseMutationResult<TBody, TData> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const mutate = useCallback(
    async (
      body?: TBody,
      options: RequestInit & { query?: Record<string, string | number | boolean | null | undefined> } = {}
    ): Promise<TData> => {
      setLoading(true);
      setError(null);

      try {
        const finalPath = typeof path === 'function' ? path(body as TBody) : path;

        // FormData passes through as-is; everything else is JSON-encoded.
        const requestBody =
          body instanceof FormData
            ? body
            : body === undefined
              ? undefined
              : JSON.stringify(body);

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

// ─── useInfiniteList: paginated GET with infinite scroll ───────────────────
// Designed for /marketplace/feed, /marketplace/people, /purchases/me,
// /notifications/me. All of those return { results, page, page_size,
// total_results, requires_interests? }.

export interface UseInfiniteListResult<T> {
  items: T[];
  loading: boolean;
  loadingMore: boolean;
  error: ApiError | null;
  hasMore: boolean;
  requiresInterests: boolean;
  totalResults: number;
  refresh: () => void;
  loadMore: () => void;
}

export function useInfiniteList<T>(
  fetcher: ((page: number, pageSize: number) => Promise<{ results?: T[]; total_results?: number; requires_interests?: boolean }>) | null,
  pageSize = 10
): UseInfiniteListResult<T> {
  const [items, setItems] = useState<T[]>([]);
  const [page, setPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [requiresInterests, setRequiresInterests] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const generationRef = useRef(0);

  const load = useCallback(
    async (nextPage: number, replace: boolean) => {
      const f = fetcherRef.current;
      if (!f) return;

      const gen = ++generationRef.current;

      if (replace) setLoading(true);
      else setLoadingMore(true);

      setError(null);

      try {
        const data = await f(nextPage, pageSize);
        if (gen !== generationRef.current) return;
        const results = data.results ?? [];

        setItems(prev => (replace ? results : [...prev, ...results]));
        setPage(nextPage);
        setTotalResults(data.total_results ?? 0);
        setRequiresInterests(Boolean(data.requires_interests));

        // More pages exist if we filled a full page and total exceeds what we have.
        const nextHasMore =
          results.length === pageSize &&
          (data.total_results == null || nextPage * pageSize < data.total_results);
        setHasMore(nextHasMore);
      } catch (err) {
        if (gen !== generationRef.current) return;
        setError(err as ApiError);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [pageSize]
  );

  // Reload from page 1 when refreshKey changes.
  // `load` uses fetcherRef.current, so the actual fetcher reference
  // doesn't need to be a dependency — stable across re-renders.
  useEffect(() => {
    if (fetcher) {
      void load(1, true);
    } else {
      setItems([]);
      setHasMore(false);
      setTotalResults(0);
    }
  }, [refreshKey, load]);

  const refresh = useCallback(() => {
    setItems([]);
    setPage(1);
    setHasMore(true);
    setRefreshKey(k => k + 1);
  }, []);

  const loadMore = useCallback(() => {
    if (!loading && !loadingMore && hasMore) {
      void load(page + 1, false);
    }
  }, [loading, loadingMore, hasMore, page, load]);

  return {
    items,
    loading,
    loadingMore,
    error,
    hasMore,
    requiresInterests,
    totalResults,
    refresh,
    loadMore
  };
}

// ─── useInView: IntersectionObserver hook for infinite scroll ──────────────
// Returns a ref to attach to a sentinel element near the bottom of the list.
export function useInView(onInView: () => void, enabled: boolean) {
  const ref = useRef<HTMLDivElement | null>(null);
  const callbackRef = useRef(onInView);
  callbackRef.current = onInView;

  useEffect(() => {
    const node = ref.current;
    if (!node || !enabled) return;

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) {
          callbackRef.current();
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled]);

  return ref;
}
