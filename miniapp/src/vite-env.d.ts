/// <reference types="vite/client" />

// Vite env vars surfaced to the client. Anything else is omitted from the bundle.
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_ENABLE_DEV_LOGIN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Telegram user object shape (subset we care about).
interface TelegramWebAppUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

// Subset of the Telegram WebApp SDK we actually use.
// The full SDK is loaded via telegram-web-app.js; this is just for typing.
interface TelegramWebApp {
  initData: string;
  initDataUnsafe: { user?: TelegramWebAppUser };
  ready(): void;
  expand(): void;
  openLink(url: string, options?: { try_instant_view?: boolean }): void;
  colorScheme: 'light' | 'dark';
  themeParams: Record<string, string>;
  setHeaderColor?(color: string): void;
  setBackgroundColor?(color: string): void;
  onEvent(eventType: string, callback: () => void): void;
  offEvent(eventType: string, callback: () => void): void;
}

interface Window {
  Telegram?: {
    WebApp?: TelegramWebApp;
  };
}
