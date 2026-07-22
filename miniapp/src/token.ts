// JWT storage helpers.
// miniapp.md §16 says: never use localStorage for sensitive data; use sessionStorage.
// The JWT lives only for the duration of the browser/Telegram session.

const TOKEN_KEY = 'zwuwur.user.token';

// Read the stored JWT, if any.
export function getToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    // sessionStorage can throw in private-mode or sandboxed iframes — fail closed.
    return null;
  }
}

// Persist the JWT.
export function setToken(token: string): void {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Ignore write failures (e.g. storage quota / private mode).
  }
}

// Forget the JWT.
export function clearToken(): void {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // Ignore.
  }
}
