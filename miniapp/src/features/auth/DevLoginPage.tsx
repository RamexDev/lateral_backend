// DevLoginPage — development-only login shown outside Telegram.

import { useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { Card, Button, Input } from '../../components/ui';
import { useAuth } from './AuthProvider';
import { useLang } from '../../lib/i18n';
import { env } from '../../lib/env';
import { isValidTelegramId } from '../../lib/validation';
import { ApiError } from '../../lib/api/errors';

export function DevLoginPage() {
  const { loginWithTelegramId, loginWithToken } = useAuth();
  const { t } = useLang();
  const [telegramId, setTelegramId] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!env.devLoginEnabled) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-surface-alt p-4">
        <Card className="max-w-md text-center">
          <p className="text-sm text-ink-muted">{t('auth.devLoginDisabled')}</p>
        </Card>
      </div>
    );
  }

  const handleTelegramId = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!isValidTelegramId(telegramId)) {
      setError(t('validation.invalidTelegramId'));
      return;
    }
    setLoading(true);
    try {
      await loginWithTelegramId(Number(telegramId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!token.trim()) {
      setError(t('auth.enterToken'));
      return;
    }
    setLoading(true);
    try {
      await loginWithToken(token.trim());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-surface-alt p-4">
      <div className="w-full max-w-md space-y-4">
        {/* Brand header */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand shadow-lg">
            <ArrowLeftRight size={28} className="text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-extrabold text-ink">Zwuwur</h1>
            <p className="text-sm text-ink-muted">{t('auth.devLoginSubtitle')}</p>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-danger">
            {error}
          </div>
        )}

        {/* Path A: Telegram ID */}
        <Card>
          <form onSubmit={handleTelegramId} className="space-y-3">
            <Input
              label={t('auth.telegramId')}
              hint={t('auth.telegramIdHint')}
              value={telegramId}
              onChange={(e) => setTelegramId(e.target.value)}
              placeholder="987654321"
              inputMode="numeric"
              pattern="[0-9]*"
            />
            <Button type="submit" variant="primary" fullWidth loading={loading}>
              {t('auth.loginWithTelegramId')}
            </Button>
          </form>
        </Card>

        {/* OR divider */}
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-line" />
          <span className="text-xs text-ink-faint">{t('common.or')}</span>
          <div className="h-px flex-1 bg-line" />
        </div>

        {/* Path B: JWT token */}
        <Card>
          <form onSubmit={handleToken} className="space-y-3">
            <Input
              label={t('auth.token')}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="eyJhbGciOi..."
            />
            <Button type="submit" variant="secondary" fullWidth loading={loading}>
              {t('auth.loginWithToken')}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
