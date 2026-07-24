// Imperative POST/PUT/DELETE hook.

import { useCallback, useState } from 'react';
import { api, type ApiOptions } from '../api/client';
import { ApiError } from '../api/errors';

export interface UseMutationResult<TBody, TData> {
  mutate: (body?: TBody, options?: ApiOptions) => Promise<TData>;
  loading: boolean;
  error: ApiError | null;
}

export function useMutation<TBody, TData>(
  method: 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  path: string | ((body: TBody) => string)
): UseMutationResult<TBody, TData> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const mutate = useCallback(
    async (body?: TBody, options: ApiOptions = {}): Promise<TData> => {
      setLoading(true);
      setError(null);
      try {
        const resolvedPath = typeof path === 'function' ? path(body as TBody) : path;
        const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
        const result = await api<TData>(resolvedPath, {
          method,
          body: body === undefined ? undefined : isFormData ? (body as unknown as BodyInit) : JSON.stringify(body),
          ...options
        });
        return result;
      } catch (err) {
        const apiErr = err instanceof ApiError ? err : new ApiError(String(err));
        setError(apiErr);
        throw apiErr;
      } finally {
        setLoading(false);
      }
    },
    [method, path]
  );

  return { mutate, loading, error };
}
