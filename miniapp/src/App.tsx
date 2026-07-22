// Root App component.
// Wires up auth provider, language provider, Telegram SDK init, and routes
// between dev-login / profile-gate / main-app based on auth status.

import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './auth';
import { LanguageProvider } from './i18n';
import { getTelegramColorScheme, getTelegramWebApp, initTelegram } from './telegram';
import { Spinner } from './ui';
import { DevLoginPage } from './features/auth/DevLoginPage';
import { ProfileGate } from './features/profile/ProfileGate';
import { MainApp } from './MainApp';
import type { Lang } from './types';

export default function App() {
  // Tell Telegram we're ready and take the full viewport.
  useEffect(() => {
    initTelegram();
  }, []);

  // Apply dark mode class based on Telegram or OS preference.
  useEffect(() => {
    const scheme = getTelegramColorScheme();
    document.documentElement.classList.toggle('dark', scheme === 'dark');

    // Listen for Telegram theme changes (e.g. user switches Telegram dark mode).
    const tg = getTelegramWebApp();
    if (tg) {
      tg.onEvent('themeChanged', () => {
        document.documentElement.classList.toggle('dark', getTelegramColorScheme() === 'dark');
      });
    }
  }, []);

  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  );
}

function Root() {
  const { status, me } = useAuth();

  // UI language. Synced with the user's preferred_language once me is loaded.
  // Persisted in sessionStorage so a refresh keeps the same language even
  // before me loads.
  const [lang, setLang] = useState<Lang>(() => {
    try {
      const stored = sessionStorage.getItem('zwuwur.lang');
      if (stored === 'en' || stored === 'am') return stored;
    } catch {
      // ignore
    }
    return 'en';
  });

  // Persist language choice.
  const persistLang = (next: Lang) => {
    setLang(next);
    try {
      sessionStorage.setItem('zwuwur.lang', next);
    } catch {
      // ignore
    }
  };

  // Sync UI language with the user's preferred_language when me loads.
  useEffect(() => {
    if (me?.preferred_language) {
      setLang(me.preferred_language);
      try {
        sessionStorage.setItem('zwuwur.lang', me.preferred_language);
      } catch {
        // ignore
      }
    }
  }, [me?.preferred_language]);

  // Loading state during auth bootstrap.
  if (status === 'loading') {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  // Unauthenticated → dev login (or disabled-dev-login message).
  if (status === 'unauthenticated') {
    return (
      <LanguageProvider lang={lang} setLang={persistLang}>
        <DevLoginPage />
      </LanguageProvider>
    );
  }

  // Authenticated → main app.
  return (
    <LanguageProvider lang={lang} setLang={persistLang}>
      <MainApp />
    </LanguageProvider>
  );
}
