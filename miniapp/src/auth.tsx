// Auth context.
//
// Boot sequence:
//   1. If we have a stored JWT, try GET /me with it. If valid → authenticated.
//   2. Else, if running inside Telegram, POST /auth/telegram with initData.
//   3. Else, fall back to the dev login screen.
//
// On any 401, the api() helper clears the token and dispatches
// 'zwuwur:unauthorized' — we listen for that and reset to unauthenticated.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode
} from 'react';

import { authWithTelegram, authWithTelegramId, getMe } from './api';
import { getToken, setToken, clearToken } from './token';
import { getInitData, isInsideTelegram } from './telegram';
import type { MeUser } from './types';

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

  // Re-fetch the current user. Used after profile updates and photo uploads.
  const loadMe = useCallback(async () => {
    const data = await getMe();
    setMe(data);
    return data;
  }, []);

  // Dev login by Telegram ID. Goes through the existing
  // POST /api/v1/auth/issue-token endpoint (hard-guarded to 404 in production).
  const loginWithTelegramId = useCallback(
    async (telegramId: number) => {
      const data = await authWithTelegramId(telegramId);
      setToken(data.token);
      await loadMe();
      setStatus('authenticated');
    },
    [loadMe]
  );

  // Manual JWT paste — escape hatch for environments where issue-token 404s
  // (e.g. a backend started with NODE_ENV=production, or one where the user
  // was created out-of-band and only a token is available).
  const loginWithToken = useCallback(
    async (token: string) => {
      setToken(token);
      await loadMe();
      setStatus('authenticated');
    },
    [loadMe]
  );

  const signOut = useCallback(() => {
    clearToken();
    setMe(null);
    setStatus('unauthenticated');
  }, []);

  // Boot: try stored token → Telegram initData → unauthenticated.
  useEffect(() => {
    const boot = async () => {
      try {
        if (getToken()) {
          await loadMe();
          setStatus('authenticated');
          return;
        }

        // Only attempt Telegram initData auth when actually inside Telegram.
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

    // api() dispatches this on 401 — reset state and let the user re-auth.
    const onUnauthorized = () => {
      clearToken();
      setMe(null);
      setStatus('unauthenticated');
    };
    window.addEventListener('zwuwur:unauthorized', onUnauthorized);
    return () => window.removeEventListener('zwuwur:unauthorized', onUnauthorized);
  }, [loadMe]);

  return (
    <AuthContext.Provider
      value={{
        status,
        me,
        loginWithTelegramId,
        loginWithToken,
        refreshMe: loadMe,
        signOut
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
