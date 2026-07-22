import { Card, Spinner } from '../../ui';
import { useLang } from '../../i18n';
import type { Completeness } from '../../types';

export function CompletenessCard({ completeness }: { completeness: Completeness }) {
  const { t, lang } = useLang();

  const nudgeMessage =
    lang === 'am'
      ? (completeness.nudge.message_am || completeness.nudge.message_en)
      : (completeness.nudge.message_en || completeness.nudge.message_am);

  const isComplete = completeness.is_fully_complete;

  return (
    <Card
      className={
        isComplete
          ? 'border-brand/30 bg-brand-tint'
          : 'border-amber-200 bg-accent-light/50'
      }
    >
      <div className="flex items-start gap-3">
        <div
          className={
            'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ' +
            (isComplete ? 'bg-brand text-white' : 'bg-accent text-white')
          }
        >
          {isComplete ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-ink">{t('completeness')}</h3>
          <p className="mt-0.5 text-sm text-ink-muted">
            {isComplete ? t('completenessComplete') : t('completenessIncomplete')}
          </p>
          {nudgeMessage && !isComplete ? (
            <p className="mt-1 text-sm text-ink">{nudgeMessage}</p>
          ) : null}

          {completeness.missing_required.length > 0 ? (
            <ul className="mt-2 space-y-0.5">
              {completeness.missing_required.map(field => (
                <li key={field} className="text-xs text-ink-muted">
                  · {missingFieldLabel(field, lang)}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

export function CompletenessCardSkeleton() {
  return (
    <Card>
      <Spinner />
    </Card>
  );
}

export function missingFieldLabel(field: string, lang: 'en' | 'am'): string {
  const labels: Record<string, { en: string; am: string }> = {
    full_name: { en: 'Full name', am: 'ሙሉ ስም' },
    branch_name: { en: 'Branch name', am: 'የቅርንጫፍ ስም' },
    neighborhood: { en: 'Neighborhood', am: 'ሰፈር/አካባቢ' },
    grade: { en: 'Grade', am: 'ደረጃ' },
    transfer_interest: { en: 'A transfer interest', am: 'የዝውውር ፍላጎት' },
    custom_photo: { en: 'A custom photo', am: 'የራስ ፎቶ' }
  };
  const entry = labels[field];
  if (!entry) return field;
  return lang === 'am' ? (entry.am || entry.en) : (entry.en || entry.am);
}
