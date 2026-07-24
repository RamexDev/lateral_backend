// Auth provider and useAuth hook.
// Boot sequence:
//   1. Stored JWT in sessionStorage? → load /me → authenticated.
//   2. Inside Telegram with initData? → POST /auth/telegram → store token → load /me.
//   3. Fall back to dev login screen.

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { authWithTelegram, authWithTelegramId, getMe } from '../../lib/api/endpoints';
import { getToken, setToken, clearToken } from '../../lib/token';
import { isInsideTelegram, getInitData } from '../../lib/telegram';
import { ApiError } from '../../lib/api/errors';
import type { MeUser } from '../../types';

type AuthStatus = 'loading' | 'unauthenticated' | 'authenticated';

interface AuthContextValue {
  status: AuthStatus;
  me: MeUser | null;
  loginWithTelegramId: (telegramId: number) => Promise<void>;
  loginWithToken: (token: string) => Promise<void>;
  refreshMe: () => Promise<MeUser>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [me, setMe] = useState<MeUser | null>(null);

  const loadMe = useCallback(async () => {
    const user = await getMe();
    setMe(user);
    return user;
  }, []);

  // Boot sequence.
  useEffect(() => {
    const boot = async () => {
      try {
        if (getToken()) {
          await loadMe();
          setStatus('authenticated');
          return;
        }
        if (isInsideTelegram()) {
          const initData = getInitData();
          if (initData) {
            const data = await authWithTelegram(initData);
            setToken(data.token);
            await loadMe();
            setStatus('authenticated');
            return;
          }
        }
        setStatus('unauthenticated');
      } catch {
        clearToken();
        setStatus('unauthenticated');
      }
    };
    void boot();

    // Listen for 401 events dispatched by api() on unauthorized responses.
    const onUnauthorized = () => {
      clearToken();
      setMe(null);
      setStatus('unauthenticated');
    };
    window.addEventListener('zwuwur:unauthorized', onUnauthorized);
    return () => window.removeEventListener('zwuwur:unauthorized', onUnauthorized);
  }, [loadMe]);

  const loginWithTelegramId = useCallback(
    async (telegramId: number) => {
      const data = await authWithTelegramId(telegramId);
      setToken(data.token);
      await loadMe();
      setStatus('authenticated');
    },
    [loadMe]
  );

  const loginWithToken = useCallback(
    async (token: string) => {
      setToken(token);
      await loadMe();
      setStatus('authenticated');
    },
    [loadMe]
  );

  const refreshMe = useCallback(async () => {
    return loadMe();
  }, [loadMe]);

  const signOut = useCallback(() => {
    clearToken();
    setMe(null);
    setStatus('unauthenticated');
  }, []);

  return (
    <AuthContext.Provider value={{ status, me, loginWithTelegramId, loginWithToken, refreshMe, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return ctx;
}

// Re-export ApiError for convenience.
export { ApiError };
