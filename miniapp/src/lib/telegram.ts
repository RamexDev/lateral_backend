// Telegram WebApp SDK wrappers.
// All functions are no-op safe when not running inside Telegram.

interface TelegramWebApp {
  ready: () => void;
  expand: () => void;
  close: () => void;
  initData: string;
  initDataUnsafe?: { user?: { id?: number; username?: string; photo_url?: string } };
  colorScheme?: 'light' | 'dark';
  themeParams?: Record<string, string>;
  onEvent: (event: string, handler: () => void) => void;
  offEvent: (event: string, handler: () => void) => void;
  openLink: (url: string, options?: { try_instant_view?: boolean }) => void;
  openTelegramLink: (url: string) => void;
  HapticFeedback?: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged: () => void;
  };
  BackButton?: {
    show: () => void;
    hide: () => void;
    onClick: (handler: () => void) => void;
    offClick: (handler: () => void) => void;
  };
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export function getTelegramWebApp(): TelegramWebApp | null {
  return window.Telegram?.WebApp ?? null;
}

export function isInsideTelegram(): boolean {
  return Boolean(getTelegramWebApp()?.initData);
}

export function initTelegram(): void {
  const tg = getTelegramWebApp();
  if (!tg) return;
  try {
    tg.ready();
    tg.expand();
  } catch {
    // Fail silent.
  }
}

export function getInitData(): string {
  return getTelegramWebApp()?.initData ?? '';
}

export function openExternalLink(url: string): void {
  const tg = getTelegramWebApp();
  if (tg?.openLink) {
    try {
      tg.openLink(url, { try_instant_view: false });
      return;
    } catch {
      // Fall through to window.open.
    }
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function getTelegramColorScheme(): 'light' | 'dark' {
  const scheme = getTelegramWebApp()?.colorScheme;
  return scheme === 'dark' ? 'dark' : 'light';
}

// Haptic feedback helpers — no-op safe outside Telegram.
export function hapticImpact(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'light'): void {
  try {
    getTelegramWebApp()?.HapticFeedback?.impactOccurred(style);
  } catch {
    // Fail silent.
  }
}

export function hapticSuccess(): void {
  try {
    getTelegramWebApp()?.HapticFeedback?.notificationOccurred('success');
  } catch {
    // Fail silent.
  }
}

export function hapticError(): void {
  try {
    getTelegramWebApp()?.HapticFeedback?.notificationOccurred('error');
  } catch {
    // Fail silent.
  }
}
