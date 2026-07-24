// CompletenessCard — shows profile completeness state + missing fields.

import { CheckCircle2, AlertCircle } from 'lucide-react';
import { Card, Skeleton } from '../../components/ui';
import { useCompleteness } from '../../lib/hooks';
import { useLang } from '../../lib/i18n';
import { cn } from '../../lib/utils';
import type { Completeness } from '../../types';

// Map backend field codes to translation keys.
function missingFieldLabel(field: string, t: (key: string) => string): string {
  const key = `completeness.missingField.${field}`;
  const translated = t(key);
  return translated === key ? field : translated;
}

export function CompletenessCard() {
  const { completeness, loading } = useCompleteness();
  const { t } = useLang();

  if (loading || !completeness) {
    return (
      <Card>
        <Skeleton className="h-16 w-full" />
      </Card>
    );
  }

  const isComplete = completeness.is_fully_complete;
  const isUnlocked = completeness.is_marketplace_unlocked;

  // Compute a percentage score from missing_required + missing_encouraged.
  const totalFields = 7; // name, branch, neighborhood, grade, transfer_interest, custom_photo + language completeness
  const missingCount = completeness.missing_required.length + completeness.missing_encouraged.length;
  const score = Math.max(0, Math.round(((totalFields - missingCount) / totalFields) * 100));

  return (
    <Card
      className={cn(
        isComplete
          ? 'border-brand/30 bg-brand-tint'
          : isUnlocked
          ? 'border-amber-200 bg-accent-light/40'
          : 'border-amber-200 bg-accent-light/50'
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
            isComplete ? 'bg-brand text-white' : 'bg-accent text-white'
          )}
        >
          {isComplete ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
        </div>

        <div className="flex-1 space-y-1">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">{t('completeness.title')}</h3>
            <span className="text-sm font-bold text-ink tabular-nums">
              {t('completeness.score', { score })}
            </span>
          </div>
          <p className="text-xs text-ink-muted">
            {isComplete ? t('completeness.complete') : t('completeness.incomplete')}
          </p>

          {!isComplete && completeness.missing_required.length > 0 && (
            <ul className="mt-2 space-y-0.5">
              {completeness.missing_required.map((field) => (
                <li key={field} className="flex items-center gap-1.5 text-xs text-ink-muted">
                  <span className="h-1 w-1 rounded-full bg-accent" />
                  {missingFieldLabel(field, t)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}
