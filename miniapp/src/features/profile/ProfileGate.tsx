// Profile completion gate.
// Shown in place of the main app whenever profile_complete is false.
// Feed, People, and Purchases are inaccessible until the user completes this.

import { useAuth } from '../../auth';
import { useLang } from '../../i18n';
import { Card } from '../../ui';
import { ProfileForm } from './ProfileForm';

export function ProfileGate({ onCompleted }: { onCompleted: () => Promise<unknown> }) {
  const { me } = useAuth();
  const { t } = useLang();

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      {/* Header card explaining the gate */}
      <Card className="mb-4 border-brand/20 bg-brand-tint">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-white">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-ink">{t('completeProfile')}</h1>
            <p className="mt-1 text-sm text-ink-muted">{t('completeProfileSubtitle')}</p>
          </div>
        </div>
      </Card>

      <Card>
        <ProfileForm onSaved={onCompleted} />
      </Card>

      {/* Read-only context: bank reminder */}
      {me?.bank ? (
        <p className="mt-4 text-center text-xs text-ink-faint">
          {t('bank')}: {me.bank.name || me.bank.nickname}
        </p>
      ) : null}
    </div>
  );
}
