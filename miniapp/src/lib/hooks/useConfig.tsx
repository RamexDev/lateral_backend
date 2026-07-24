// Public config hook (F.2).
// Loads reveal price + currency + photo_base_url once on app boot and caches.

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getPublicConfig } from '../api/endpoints';
import { DEFAULT_REVEAL_PRICE_ETB, DEFAULT_CURRENCY } from '../env';
import type { PublicConfig } from '../../types';

interface ConfigContextValue {
  config: PublicConfig;
  loading: boolean;
}

const defaultConfig: PublicConfig = {
  reveal_price_etb: DEFAULT_REVEAL_PRICE_ETB,
  currency: DEFAULT_CURRENCY,
  payment_provider: 'chapa',
  photo_base_url: ''
};

const ConfigContext = createContext<ConfigContextValue>({ config: defaultConfig, loading: true });

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<PublicConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await getPublicConfig();
        if (!cancelled) {
          setConfig(result);
        }
      } catch {
        // Fall back to defaults if config endpoint is unreachable.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return <ConfigContext.Provider value={{ config, loading }}>{children}</ConfigContext.Provider>;
}

export function useConfig(): ConfigContextValue {
  return useContext(ConfigContext);
}
