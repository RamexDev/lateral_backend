// Telegram WebApp SDK helpers.
// The SDK is loaded via <script src="telegram-web-app.js"> in index.html.

// Get the Telegram WebApp instance, if we're running inside Telegram.
export function getTelegramWebApp(): TelegramWebApp | null {
  return window.Telegram?.WebApp ?? null;
}

// Are we actually running inside a Telegram client?
export function isInsideTelegram(): boolean {
  // initData is non-empty only when launched by Telegram.
  return Boolean(getTelegramWebApp()?.initData);
}

// Bootstrap the Telegram session: signal ready + expand.
// Safe to call from a browser too — it's a no-op there.
export function initTelegram(): void {
  const tg = getTelegramWebApp();
  if (!tg) return;

  // Tell Telegram the app is ready to display.
  tg.ready();

  // Take the full available height.
  tg.expand();
}

// Raw Telegram initData string for backend verification.
export function getInitData(): string {
  return getTelegramWebApp()?.initData ?? '';
}

// Open an external URL — prefer Telegram's opener so it stays in-app.
export function openExternalLink(url: string): void {
  const tg = getTelegramWebApp();

  if (tg?.openLink) {
    tg.openLink(url, { try_instant_view: false });
    return;
  }

  // Browser fallback — noopener/noreferrer for safety.
  window.open(url, '_blank', 'noopener,noreferrer');
}

// Best-effort read of Telegram's color scheme. Used to nudge a dark tint
// when the user has Telegram in dark mode. Returns 'light' when unknown.
export function getTelegramColorScheme(): 'light' | 'dark' {
  const tg = getTelegramWebApp();
  return tg?.colorScheme ?? 'light';
}
