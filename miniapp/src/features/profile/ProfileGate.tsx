// ProfileGate — shown in place of Feed/People/Purchases when profile is incomplete.

import { Lock } from 'lucide-react';
import { Card } from '../../components/ui';
import { useAuth } from '../auth/AuthProvider';
import { useLang } from '../../lib/i18n';
import { localizedField } from '../../lib/i18n/localize';
import { ProfileForm } from './ProfileForm';

interface ProfileGateProps {
  onCompleted: () => void;
}

export function ProfileGate({ onCompleted }: ProfileGateProps) {
  const { me } = useAuth();
  const { t, lang } = useLang();

  return (
    <div className="mx-auto max-w-lg space-y-4 pt-4">
      {/* Branded explainer */}
      <Card className="border-brand/20 bg-brand-tint">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-white">
            <Lock size={20} />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-ink">{t('profile.completeProfile')}</h2>
            <p className="text-sm text-ink-muted">{t('profile.completeProfileSubtitle')}</p>
          </div>
        </div>
      </Card>

      {/* Profile form */}
      <ProfileForm onSaved={onCompleted} />

      {/* Bank reminder */}
      {me?.bank && (
        <p className="text-center text-xs text-ink-faint">
          {t('profile.bank')}: {localizedField(me.bank, 'name', lang)}
        </p>
      )}
    </div>
  );
}
