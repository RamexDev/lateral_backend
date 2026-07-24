// Shared completeness hook.
// Lifts the completeness fetch out of individual components so we don't fire
// 4 redundant requests (ProfilePage + ProfileNudge on Feed/People/Purchases).
// Caches the result and exposes a refresh function.

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { getCompleteness } from '../api/endpoints';
import type { Completeness } from '../../types';

interface CompletenessContextValue {
  completeness: Completeness | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<Completeness | null>;
}

const CompletenessContext = createContext<CompletenessContextValue | null>(null);

interface CompletenessProviderProps {
  enabled: boolean;
  children: ReactNode;
}

export function CompletenessProvider({ enabled, children }: CompletenessProviderProps) {
  const [completeness, setCompleteness] = useState<Completeness | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return null;
    setLoading(true);
    setError(null);
    try {
      const result = await getCompleteness();
      setCompleteness(result);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      return null;
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (enabled) {
      void refresh();
    }
  }, [enabled, refresh]);

  const value: CompletenessContextValue = { completeness, loading, error, refresh };

  return <CompletenessContext.Provider value={value}>{children}</CompletenessContext.Provider>;
}

export function useCompleteness(): CompletenessContextValue {
  const ctx = useContext(CompletenessContext);
  if (!ctx) {
    throw new Error('useCompleteness must be used inside a CompletenessProvider');
  }
  return ctx;
}
