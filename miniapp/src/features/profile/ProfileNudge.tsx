import { useApi } from '../../hooks';
import { useLang } from '../../i18n';
import { Button } from '../../ui';
import type { Completeness } from '../../types';

export function ProfileNudge({
  onNavigateToProfile
}: {
  onNavigateToProfile: () => void;
}) {
  const { t, lang } = useLang();
  const completeness = useApi<Completeness>('/api/v1/me/completeness');

  if (!completeness.data || completeness.data.is_fully_complete) return null;
  if (!completeness.data.nudge.show) return null;

  const nudgeMessage =
    lang === 'am'
      ? (completeness.data.nudge.message_am || completeness.data.nudge.message_en)
      : (completeness.data.nudge.message_en || completeness.data.nudge.message_am);

  return (
    <div className="mb-3 flex items-center gap-3 rounded-xl border border-amber-200 bg-accent-light/50 px-4 py-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-white">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <p className="flex-1 text-sm text-ink">{nudgeMessage}</p>
      <Button variant="secondary" size="sm" onClick={onNavigateToProfile}>
        {t('profile')}
      </Button>
    </div>
  );
}
