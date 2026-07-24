// RelevanceIndicator — visual signal for match strength (F.5).
// Shows a small bar/dot representation of the relevance_score 0-100.

import { cn } from '../../lib/utils';
import { useLang } from '../../lib/i18n';

interface RelevanceIndicatorProps {
  score?: number;
  className?: string;
}

export function RelevanceIndicator({ score, className }: RelevanceIndicatorProps) {
  const { t } = useLang();
  if (score === undefined || score === null) return null;

  // Map score to label + color.
  let label: string;
  let tone: 'high' | 'medium' | 'low';
  if (score >= 70) {
    label = t('marketplace.relevanceHigh');
    tone = 'high';
  } else if (score >= 40) {
    label = t('marketplace.relevanceMedium');
    tone = 'medium';
  } else {
    label = t('marketplace.relevanceLow');
    tone = 'low';
  }

  const barColor = tone === 'high' ? 'bg-brand' : tone === 'medium' ? 'bg-info' : 'bg-ink-faint';

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <div className="flex h-1 w-12 overflow-hidden rounded-full bg-surface-muted">
        <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${score}%` }} />
      </div>
      <span className="text-2xs font-semibold text-ink-muted">{label}</span>
    </div>
  );
}
