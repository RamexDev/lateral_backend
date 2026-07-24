// One-shot GET hook. Re-fetches when path or deps change. Pass null to disable.

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type ApiOptions } from '../api/client';
import { ApiError } from '../api/errors';

export interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
  refetch: () => Promise<void>;
  setData: (data: T | null) => void;
}

export function useApi<T>(
  path: string | null,
  deps: unknown[] = [],
  options: Omit<ApiOptions, 'method' | 'body'> = {}
): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(path));
  const [error, setError] = useState<ApiError | null>(null);
  const generationRef = useRef(0);

  const load = useCallback(async () => {
    if (!path) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }
    const gen = ++generationRef.current;
    setLoading(true);
    try {
      const result = await api<T>(path, options);
      if (gen === generationRef.current) {
        setData(result);
        setError(null);
      }
    } catch (err) {
      if (gen === generationRef.current) {
        setError(err instanceof ApiError ? err : new ApiError(String(err)));
      }
    } finally {
      if (gen === generationRef.current) {
        setLoading(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, refetch: load, setData };
}
