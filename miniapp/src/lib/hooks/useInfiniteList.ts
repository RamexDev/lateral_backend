// Paginated GET hook with infinite scroll support.
// Uses generationRef to ignore stale responses.

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../api/errors';

export interface InfiniteListResponse<T> {
  results?: T[];
  // `notifications` is only used when T is AppNotification. Other types
  // may have it as a different shape — we treat it as unknown[] here and
  // the hook only uses `results` if present.
  notifications?: unknown[];
  page: number;
  page_size: number;
  total_results: number;
  requires_interests?: boolean;
  unread_count?: number;
}

export interface UseInfiniteListResult<T> {
  items: T[];
  loading: boolean;
  loadingMore: boolean;
  error: ApiError | null;
  hasMore: boolean;
  requiresInterests: boolean;
  totalResults: number;
  unreadCount?: number;
  refresh: () => void;
  loadMore: () => void;
}

export function useInfiniteList<T>(
  fetcher: (page: number, pageSize: number) => Promise<InfiniteListResponse<T>>,
  pageSize = 10
): UseInfiniteListResult<T> {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [requiresInterests, setRequiresInterests] = useState(false);
  const [totalResults, setTotalResults] = useState(0);
  const [unreadCount, setUnreadCount] = useState<number | undefined>(undefined);
  const nextPageRef = useRef(2);
  const generationRef = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(async () => {
    const gen = ++generationRef.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fetcherRef.current(1, pageSize);
      if (gen !== generationRef.current) return;
      const list = (result.results ?? (result.notifications as T[] | undefined)) ?? [];
      setItems(list);
      setTotalResults(result.total_results ?? 0);
      setRequiresInterests(Boolean(result.requires_interests));
      setUnreadCount(result.unread_count);
      nextPageRef.current = 2;
      setHasMore(list.length === pageSize && (result.total_results ?? 0) > pageSize);
    } catch (err) {
      if (gen === generationRef.current) {
        setError(err instanceof ApiError ? err : new ApiError(String(err)));
      }
    } finally {
      if (gen === generationRef.current) {
        setLoading(false);
      }
    }
  }, [pageSize]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    const gen = generationRef.current;
    setLoadingMore(true);
    try {
      const result = await fetcherRef.current(nextPageRef.current, pageSize);
      if (gen !== generationRef.current) return;
      const list = (result.results ?? (result.notifications as T[] | undefined)) ?? [];
      setItems((prev) => [...prev, ...list]);
      nextPageRef.current += 1;
      setHasMore(list.length === pageSize && (result.total_results ?? 0) > (nextPageRef.current - 1) * pageSize);
    } catch (err) {
      if (gen === generationRef.current) {
        setError(err instanceof ApiError ? err : new ApiError(String(err)));
      }
    } finally {
      if (gen === generationRef.current) {
        setLoadingMore(false);
      }
    }
  }, [pageSize, loadingMore, hasMore]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    items,
    loading,
    loadingMore,
    error,
    hasMore,
    requiresInterests,
    totalResults,
    unreadCount,
    refresh: load,
    loadMore
  };
}
