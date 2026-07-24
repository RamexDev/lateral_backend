// sessionStorage-backed JWT helpers.
// sessionStorage (not localStorage) per the brief's security rule.

const TOKEN_KEY = 'zwuwur.user.token';

export function getToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
  } catch {
    // sessionStorage can throw in private mode or sandboxed iframes — fail silent.
  }
}

export function clearToken(): void {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // Fail silent.
  }
}
