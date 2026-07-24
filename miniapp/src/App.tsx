// App root — boot sequence.
// Splash → auth check → dev login or main app.

import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './features/auth/AuthProvider';
import { LanguageProvider } from './lib/i18n';
import { ConfigProvider } from './lib/hooks';
import { CompletenessProvider } from './lib/hooks';
import { DevLoginPage } from './features/auth/DevLoginPage';
import { MainApp } from './app/MainApp';
import { SplashScreen } from './app/SplashScreen';
import { Spinner } from './components/ui';
import { initTelegram, getTelegramColorScheme, getTelegramWebApp } from './lib/telegram';
import type { Lang } from './types';

const SPLASH_SESSION_KEY = 'zwuwur.splashShown';

function Root() {
  const { status, me } = useAuth();
  const [lang, setLang] = useState<Lang>(() => {
    try {
      const stored = sessionStorage.getItem('zwuwur.lang');
      if (stored === 'en' || stored === 'am') return stored;
    } catch {
      // ignore
    }
    return me?.preferred_language ?? 'en';
  });

  // Sync language from /me once loaded.
  useEffect(() => {
    if (me?.preferred_language && me.preferred_language !== lang) {
      setLang(me.preferred_language);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.preferred_language]);

  // Persist language to sessionStorage.
  const persistLang = (next: Lang) => {
    setLang(next);
    try {
      sessionStorage.setItem('zwuwur.lang', next);
    } catch {
      // ignore
    }
  };

  // Show splash once per session.
  const [showSplash, setShowSplash] = useState(false);
  useEffect(() => {
    try {
      const seen = sessionStorage.getItem(SPLASH_SESSION_KEY);
      if (!seen) {
        setShowSplash(true);
        sessionStorage.setItem(SPLASH_SESSION_KEY, '1');
      }
    } catch {
      // ignore
    }
  }, []);

  if (showSplash) {
    return <SplashScreen onDone={() => setShowSplash(false)} />;
  }

  if (status === 'loading') {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <LanguageProvider lang={lang} setLang={persistLang}>
        <DevLoginPage />
      </LanguageProvider>
    );
  }

  return (
    <LanguageProvider lang={lang} setLang={persistLang}>
      <ConfigProvider>
        <CompletenessProvider enabled={Boolean(me)}>
          <MainApp />
        </CompletenessProvider>
      </ConfigProvider>
    </LanguageProvider>
  );
}

export default function App() {
  // Init Telegram SDK + dark mode listener.
  useEffect(() => {
    initTelegram();
    document.documentElement.classList.toggle('dark', getTelegramColorScheme() === 'dark');
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
