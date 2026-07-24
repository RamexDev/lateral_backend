// PurchasesPage — buyer's unlocked + pending contacts.
// v2 features:
//   - Stats summary card (F.12): total spent, total reveals, this month, pending.
//   - Pending purchases tab (F.3): show "payment being verified" cards.
//   - Reuses CandidateCard for purchased cards (visual consistency).

import { useState, useEffect } from 'react';
import { ShoppingBag, Clock, CheckCircle2, TrendingUp, Sparkles } from 'lucide-react';
import { Card, Button, ErrorState, EmptyState, Skeleton, Badge } from '../../components/ui';
import { useApi, useInfiniteList, useInView } from '../../lib/hooks';
import { getMyPurchases, getPurchaseStats } from '../../lib/api/endpoints';
import { useAuth } from '../auth/AuthProvider';
import { useConfig } from '../../lib/hooks';
import { useLang } from '../../lib/i18n';
import { resolveAssetUrl } from '../../lib/api/endpoints';
import { localizedField, maskedOrLocalized, isMaskedValue } from '../../lib/i18n/localize';
import { formatEtb, formatDate, getInitials, cn } from '../../lib/utils';
import { ProfileNudge } from '../profile/ProfileNudge';
import type { Purchase, PurchaseStats, ListResponse, MarketplaceCard } from '../../types';

interface PurchasesPageProps {
  onNavigateToProfile: () => void;
}

type Tab = 'completed' | 'pending';

export function PurchasesPage({ onNavigateToProfile }: PurchasesPageProps) {
  const { me } = useAuth();
  const { config } = useConfig();
  const { t, lang } = useLang();
  const [tab, setTab] = useState<Tab>('completed');

  // Stats (F.12).
  const { data: stats, loading: statsLoading } = useApi<PurchaseStats>('/api/v1/purchases/me/stats');

  // Purchases list — switch status filter based on tab.
  const fetcher = (page: number, pageSize: number) =>
    getMyPurchases(page, pageSize, tab === 'pending' ? 'pending' : 'completed');
  const { items, loading, loadingMore, error, hasMore, totalResults, loadMore, refresh } =
    useInfiniteList<Purchase>(fetcher, 20);
  const sentinelRef = useInView(() => {
    if (hasMore && !loadingMore) loadMore();
  }, hasMore && !loadingMore);

  // Re-fetch when tab changes (the hook doesn't detect fetcher changes).
  useEffect(() => {
    refresh();
  }, [tab, refresh]);

  return (
    <div className="space-y-4 pt-4">
      {/* Profile nudge */}
      {me && <ProfileNudge onNavigateToProfile={onNavigateToProfile} />}

      {/* Page header */}
      <div>
        <h2 className="text-xl font-bold text-ink">{t('purchases.title')}</h2>
        <p className="text-sm text-ink-muted">{t('purchases.subtitle')}</p>
      </div>

      {/* Stats summary (F.12) */}
      {statsLoading ? (
        <Skeleton className="h-28 w-full rounded-2xl" />
      ) : stats ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            icon={<TrendingUp size={16} />}
            label={t('purchases.statsTotal')}
            value={`${formatEtb(stats.total_spent_etb)} ${stats.currency}`}
            tone="brand"
          />
          <StatCard
            icon={<CheckCircle2 size={16} />}
            label={t('purchases.statsReveals')}
            value={String(stats.total_reveals)}
            tone="green"
          />
          <StatCard
            icon={<Sparkles size={16} />}
            label={t('purchases.statsThisMonth')}
            value={`${formatEtb(stats.this_month_spent_etb)}`}
            tone="amber"
          />
          <StatCard
            icon={<Clock size={16} />}
            label={t('purchases.statsPending')}
            value={String(stats.total_pending)}
            tone={stats.total_pending > 0 ? 'amber' : 'gray'}
          />
        </div>
      ) : null}

      {/* Tab toggle (completed / pending) */}
      <div className="flex gap-1 rounded-xl bg-surface-muted p-1">
        <button
          onClick={() => setTab('completed')}
          className={cn(
            'flex-1 rounded-lg py-2 text-sm font-semibold transition-colors',
            tab === 'completed' ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted'
          )}
        >
          {t('purchases.viewCompleted')}
        </button>
        <button
          onClick={() => setTab('pending')}
          className={cn(
            'flex-1 rounded-lg py-2 text-sm font-semibold transition-colors',
            tab === 'pending' ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted'
          )}
        >
          {t('purchases.viewPending')}
          {stats?.total_pending ? (
            <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-2xs font-bold text-white">
              {stats.total_pending}
            </span>
          ) : null}
        </button>
      </div>

      {/* Error state */}
      {error && <ErrorState message={error.message} onRetry={refresh} />}

      {/* Loading state */}
      {loading && (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && items.length === 0 && (
        <EmptyState
          icon={<ShoppingBag size={28} />}
          title={
            tab === 'pending'
              ? t('purchases.pending')
              : t('empty.noResultsPurchases')
          }
          message={
            tab === 'pending'
              ? t('purchases.pendingHint')
              : t('empty.noResultsPurchasesHint')
          }
        />
      )}

      {/* Pending hint banner */}
      {tab === 'pending' && items.length > 0 && (
        <Card className="border-amber-200 bg-accent-light/40 p-3">
          <p className="text-xs text-ink-muted">{t('purchases.pendingHint')}</p>
        </Card>
      )}

      {/* Purchases list */}
      {!loading && items.length > 0 && (
        <ul className="space-y-3">
          {items.map((purchase) => (
            <PurchaseCard
              key={purchase.purchase_id}
              purchase={purchase}
              lang={lang}
              photoBaseUrl={config.photo_base_url}
              t={t}
            />
          ))}
        </ul>
      )}

      {/* Loading more */}
      {loadingMore && (
        <div className="flex justify-center py-4">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent text-ink-faint" />
        </div>
      )}

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="h-4" />
    </div>
  );
}

// ── StatCard ──────────────────────────────────────────────────────────────────
interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: 'brand' | 'green' | 'amber' | 'gray';
}

function StatCard({ icon, label, value, tone }: StatCardProps) {
  const toneClasses = {
    brand: 'bg-brand-tint text-brand',
    green: 'bg-emerald-50 text-success',
    amber: 'bg-accent-light text-accent-dark',
    gray: 'bg-surface-muted text-ink-muted'
  };
  return (
    <Card className="p-3" padded={false}>
      <div className={cn('mb-2 inline-flex rounded-lg p-1.5', toneClasses[tone])}>
        {icon}
      </div>
      <p className="text-2xs font-semibold uppercase tracking-wide text-ink-faint">{label}</p>
      <p className="mt-0.5 text-lg font-bold text-ink tabular-nums">{value}</p>
    </Card>
  );
}

// ── PurchaseCard ──────────────────────────────────────────────────────────────
interface PurchaseCardProps {
  purchase: Purchase;
  lang: 'en' | 'am';
  photoBaseUrl: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

function PurchaseCard({ purchase, lang, photoBaseUrl, t }: PurchaseCardProps) {
  const { target, completed_at, status, created_at } = purchase;
  const isCompleted = status !== 'pending';

  const name = isCompleted
    ? (lang === 'am' ? target.full_name_am : target.full_name_en) || target.full_name_en || ''
    : '*';
  const phone = target.phone_number;
  const telegram = target.telegram_username;
  const branch = isCompleted ? (lang === 'am' ? target.branch_name_am : target.branch_name_en) : '';
  const neighborhood = isCompleted ? (lang === 'am' ? target.neighborhood_am : target.neighborhood_en) : '';
  const gradeLabel = target.grade
    ? `${lang === 'am' ? target.grade.band_label_am : target.grade.band_label_en} · ${t('card.gradeLabel')} ${target.grade.number}`
    : '';
  const locationStr = `${lang === 'am' ? target.zone_am : target.zone_en}, ${lang === 'am' ? target.region_am : target.region_en}`;
  const photoSrc = target.photo_url ? resolveAssetUrl(target.photo_url, photoBaseUrl) : null;

  const dateStr = completed_at || created_at || '';
  const dateLabel = isCompleted
    ? t('purchases.purchasedOn', { date: formatDate(completed_at, lang) })
    : formatDate(created_at, lang);

  return (
    <Card
      padded={false}
      className={cn(
        'overflow-hidden',
        isCompleted ? 'border-brand/30' : 'border-accent/30'
      )}
    >
      {/* Header ribbon */}
      <div
        className={cn(
          'flex items-center justify-between gap-2 px-4 py-2',
          isCompleted ? 'bg-brand-tint' : 'bg-accent-light/60'
        )}
      >
        <div className="flex items-center gap-1.5">
          {isCompleted ? (
            <CheckCircle2 size={14} className="text-brand" />
          ) : (
            <Clock size={14} className="text-accent-dark" />
          )}
          <span
            className={cn(
              'text-2xs font-bold uppercase tracking-wide',
              isCompleted ? 'text-brand' : 'text-accent-dark'
            )}
          >
            {isCompleted ? t('marketplace.purchased') : t('marketplace.purchasePending')}
          </span>
        </div>
        <span className="text-2xs text-ink-muted">{dateLabel}</span>
      </div>

      {/* Body */}
      <div className="flex gap-3 p-4">
        {photoSrc ? (
          <img
            src={photoSrc}
            alt={isCompleted ? name : t('card.maskedName')}
            className={cn(
              'h-14 w-14 rounded-full object-cover',
              !isCompleted && 'ring-1 ring-line grayscale-[20%]'
            )}
            loading="lazy"
          />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-muted text-sm font-semibold text-ink-muted">
            {isCompleted ? getInitials(name) : '?'}
          </div>
        )}

        <div className="flex-1 space-y-1">
          <div className="space-y-0.5">
            {isCompleted ? (
              <h3 className="text-base font-semibold text-ink">{name}</h3>
            ) : (
              <span className="text-sm font-medium text-ink-faint">{t('card.maskedName')}</span>
            )}
            {gradeLabel && <p className="text-xs text-ink-muted">{gradeLabel}</p>}
            <p className="text-xs text-ink-muted">{locationStr}</p>
          </div>

          {/* Contact details — only when completed */}
          {isCompleted && (branch || neighborhood) && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1 text-sm">
              {branch && (
                <div>
                  <dt className="text-2xs font-semibold uppercase text-ink-faint">{t('card.branch')}</dt>
                  <dd className="truncate text-ink">{branch}</dd>
                </div>
              )}
              {neighborhood && (
                <div>
                  <dt className="text-2xs font-semibold uppercase text-ink-faint">{t('card.neighborhood')}</dt>
                  <dd className="truncate text-ink">{neighborhood}</dd>
                </div>
              )}
            </dl>
          )}

          {/* Contact block — phone + telegram */}
          {isCompleted && (!isMaskedValue(phone) || !isMaskedValue(telegram)) && (
            <div className="space-y-1 pt-1">
              {!isMaskedValue(phone) && phone && (
                <a
                  href={`tel:${phone}`}
                  className="flex items-center gap-1.5 text-sm font-medium text-brand-dark hover:underline"
                >
                  <span className="tabular-nums">{phone}</span>
                </a>
              )}
              {!isMaskedValue(telegram) && telegram && (
                <a
                  href={`https://t.me/${telegram.replace(/^@/, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm font-medium text-brand-dark hover:underline"
                >
                  @{telegram.replace(/^@/, '')}
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
