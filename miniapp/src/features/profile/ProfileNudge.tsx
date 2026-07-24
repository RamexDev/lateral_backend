// ProfileNudge — compact inline banner shown on Feed/People/Purchases when profile is incomplete.

import { AlertCircle } from 'lucide-react';
import { Button, Card } from '../../components/ui';
import { useCompleteness } from '../../lib/hooks';
import { useLang } from '../../lib/i18n';
import { cn } from '../../lib/utils';

interface ProfileNudgeProps {
  onNavigateToProfile: () => void;
  className?: string;
}

export function ProfileNudge({ onNavigateToProfile, className }: ProfileNudgeProps) {
  const { lang, t } = useLang();
  const { completeness } = useCompleteness();

  if (!completeness || !completeness.nudge.show || completeness.is_fully_complete) {
    return null;
  }

  const message = lang === 'am' ? completeness.nudge.message_am : completeness.nudge.message_en;

  return (
    <Card
      className={cn(
        'flex items-center gap-3 border-amber-200 bg-accent-light/50 p-3',
        className
      )}
    >
      <AlertCircle size={20} className="shrink-0 text-accent-dark" />
      <p className="flex-1 text-sm text-ink">{message}</p>
      <Button variant="secondary" size="sm" onClick={onNavigateToProfile}>
        {t('profile.title')}
      </Button>
    </Card>
  );
}
