// Development login screen.
// Shown outside Telegram when no JWT is stored. Two paths:
//   1. Login by Telegram ID — uses POST /api/v1/auth/issue-token (hard-guarded
//      to 404 in production on the backend). The user must already exist.
//   2. Paste a JWT — escape hatch for any environment where issue-token is
//      unavailable (e.g. NODE_ENV=production) but a token was issued out-of-band.

import { useState } from 'react';
import { useAuth } from '../../auth';
import { env } from '../../env';
import { useLang } from '../../i18n';
import { Button, Card, Input } from '../../ui';

export function DevLoginPage() {
  const { loginWithTelegramId, loginWithToken } = useAuth();
  const { t } = useLang();

  const [telegramId, setTelegramId] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Attempt dev login by Telegram ID.
  async function onTelegramLogin(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    // Backend's issueTokenSchema requires z.number().int().positive().
    const trimmed = telegramId.trim();
    if (!/^\d+$/.test(trimmed)) {
      setError(t('invalidTelegramId'));
      return;
    }
    const numericId = Number(trimmed);

    setLoading(true);
    try {
      await loginWithTelegramId(numericId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('error');
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  // Attempt login with a pasted JWT.
  async function onTokenLogin(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const trimmed = token.trim();
    if (!trimmed) {
      setError(t('error'));
      return;
    }

    setLoading(true);
    try {
      await loginWithToken(trimmed);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('error');
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  // If dev login is disabled in env, surface a clean message instead of the form.
  if (!env.devLoginEnabled) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center p-6">
        <Card className="w-full max-w-md text-center">
          <p className="text-sm text-ink-muted">{t('devLoginDisabled')}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Brand header */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-white shadow-lg">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-ink">Zwuwur</h1>
          <p className="mt-1 text-sm text-ink-muted">{t('devLoginSubtitle')}</p>
        </div>

        <Card>
          {error ? (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {/* Path 1: Telegram ID */}
          <form onSubmit={onTelegramLogin}>
            <Input
              label={t('telegramId')}
              hint={t('telegramIdHint')}
              value={telegramId}
              onChange={e => setTelegramId(e.target.value)}
              placeholder="987654321"
              inputMode="numeric"
              autoComplete="off"
            />
            <Button type="submit" fullWidth loading={loading}>
              {loading ? t('signingIn') : t('loginWithTelegramId')}
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-line" />
            <span className="text-2xs uppercase tracking-wider text-ink-faint">
              {t('or')}
            </span>
            <div className="h-px flex-1 bg-line" />
          </div>

          {/* Path 2: Pasted JWT */}
          <form onSubmit={onTokenLogin}>
            <Input
              label={t('token')}
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="eyJhbGciOi..."
              autoComplete="off"
            />
            <Button type="submit" variant="secondary" fullWidth loading={loading}>
              {t('loginWithToken')}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
