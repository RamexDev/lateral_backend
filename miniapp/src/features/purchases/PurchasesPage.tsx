// Purchases tab — the buyer's unlocked contacts.
// Backend: GET /api/v1/purchases/me
//
// Note: the backend only returns *completed* purchases, so every row's
// target has full (unmasked) contact details. Pending purchases don't show
// up here — they live transiently in the PurchaseModal during the checkout
// flow. If the user wants to revisit a pending purchase, they can re-tap
// Unlock on the same card; the backend returns `already_exists: true` with
// the existing checkout_url.

import { useCallback } from 'react';
import { getMyPurchases, resolveAssetUrl } from '../../api';
import { useInfiniteList, useInView } from '../../hooks';
import { localizedField, useLang } from '../../i18n';
import { Button, EmptyState, ErrorState, Skeleton, Spinner } from '../../ui';
import { formatDate, formatGrade, initials } from '../../utils';
import type { Purchase } from '../../types';
import { ProfileNudge } from '../profile/ProfileNudge';

export function PurchasesPage({
  onNavigateToProfile
}: {
  onNavigateToProfile?: () => void;
}) {
  const { t, lang } = useLang();

  const fetchPurchases = useCallback(
    (page: number, pageSize: number) => getMyPurchases(page, pageSize),
    []
  );

  const list = useInfiniteList<Purchase>(fetchPurchases, 20);

  const sentinelRef = useInView(
    list.loadMore,
    list.hasMore && !list.loading && !list.loadingMore
  );

  if (list.error) {
    return (
      <div className="px-4">
        <ErrorState message={list.error.message} onRetry={list.refresh} />
      </div>
    );
  }

  if (list.loading && list.items.length === 0) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (!list.loading && list.items.length === 0) {
    return (
      <div className="px-4">
        {onNavigateToProfile ? (
          <div className="py-4">
            <ProfileNudge onNavigateToProfile={onNavigateToProfile} />
          </div>
        ) : null}
        <EmptyState
          title={t('tabPurchases')}
          message={t('noResultsPurchases')}
          action={<Button variant="secondary" onClick={list.refresh}>{t('refresh')}</Button>}
        />
      </div>
    );
  }

  return (
    <div className="tab-enter px-4">
      {onNavigateToProfile ? (
        <div className="pt-4">
          <ProfileNudge onNavigateToProfile={onNavigateToProfile} />
        </div>
      ) : null}
      <div className="mb-3 flex items-center justify-between pt-2">
        <h2 className="text-base font-semibold text-ink">{t('purchasesTitle')}</h2>
        <Button variant="ghost" size="sm" onClick={list.refresh} disabled={list.loading}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          {t('refresh')}
        </Button>
      </div>

      <ul className="space-y-3">
        {list.items.map(purchase => {
          const target = purchase.target;
          const name = localizedField(target, 'full_name', lang);
          const branch = localizedField(target, 'branch_name', lang);
          const neighborhood = localizedField(target, 'neighborhood', lang);
          const location = localizedField(
            { name_en: target.zone_en, name_am: target.zone_am },
            'name',
            lang
          ) || localizedField(
            { name_en: target.region_en, name_am: target.region_am },
            'name',
            lang
          );
          const photoUrl = resolveAssetUrl(target.photo_url);

          return (
            <li
              key={purchase.purchase_id}
              className="overflow-hidden rounded-2xl border border-brand/20 bg-surface shadow-[0_1px_3px_rgba(17,24,39,0.06)]"
            >
              {/* Purchased ribbon */}
              <div className="flex items-center justify-between bg-brand-tint px-4 py-1.5">
                <span className="inline-flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-brand-dark">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {t('purchased')}
                </span>
                {purchase.completed_at ? (
                  <span className="text-2xs text-ink-muted">
                    {t('purchasedOn')} {formatDate(purchase.completed_at, lang)}
                  </span>
                ) : null}
              </div>

              <div className="p-4">
                <div className="flex items-start gap-3">
                  {photoUrl ? (
                    <img
                      src={photoUrl}
                      alt=""
                      loading="lazy"
                      className="h-14 w-14 rounded-2xl object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-light text-base font-semibold text-brand-dark">
                      {initials(name)}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-base font-semibold text-ink">
                      {name || '—'}
                    </h3>
                    {formatGrade(target.grade, lang) ? (
                      <p className="truncate text-xs text-ink-muted">
                        {formatGrade(target.grade, lang)}
                      </p>
                    ) : null}
                    {location ? (
                      <p className="truncate text-xs text-ink-muted">{location}</p>
                    ) : null}
                  </div>
                </div>

                {/* Contact details — full, since this is a completed purchase */}
                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                  <div>
                    <dt className="text-ink-faint">{t('phone')}</dt>
                    <dd className="truncate font-semibold text-ink">
                      {target.phone_number || '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-faint">{t('telegram')}</dt>
                    <dd className="truncate font-semibold text-ink">
                      {target.telegram_username ? `@${target.telegram_username}` : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-faint">{t('branch')}</dt>
                    <dd className="truncate font-medium text-ink">
                      {branch || '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-faint">{t('neighborhood')}</dt>
                    <dd className="truncate font-medium text-ink">
                      {neighborhood || '—'}
                    </dd>
                  </div>
                </dl>
              </div>
            </li>
          );
        })}
      </ul>

      {list.loadingMore ? (
        <div className="flex justify-center py-4">
          <Spinner />
        </div>
      ) : null}

      <div ref={sentinelRef} className="h-4" />
    </div>
  );
}
