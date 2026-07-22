// Generic marketplace list — used by both Feed and People tabs.
//
// Infinite scroll, loading skeletons, real empty/error states, back-to-top.
// The two endpoints (/marketplace/feed, /marketplace/people) have the same
// response shape — only the fetcher differs.

import { useRef, useState } from 'react';
import { useInfiniteList, useInView } from '../../hooks';
import { useLang } from '../../i18n';
import { Button, EmptyState, ErrorState, Spinner } from '../../ui';
import type { MarketplaceCard } from '../../types';
import { UserCard, UserCardSkeleton } from './UserCard';
import { PurchaseModal } from './PurchaseModal';

export function MarketplaceList({
  fetcher,
  emptyTitle,
  emptyMessage,
  requiresInterestsMessage,
  onAddInterests
}: {
  // Paged fetcher. Returns a ListResponse<MarketplaceCard>-shaped object.
  fetcher: (page: number, pageSize: number) => Promise<{
    results?: MarketplaceCard[];
    total_results?: number;
    requires_interests?: boolean;
  }>;
  emptyTitle?: string;
  emptyMessage: string;
  requiresInterestsMessage: string;
  onAddInterests?: () => void;
}) {
  const { t } = useLang();

  const list = useInfiniteList<MarketplaceCard>(fetcher, 10);

  // Track which card the purchase modal is open for.
  const [purchaseCard, setPurchaseCard] = useState<MarketplaceCard | null>(null);
  // Once a purchase succeeds, store the backend's real price keyed by card ID.
  // Other cards from the same backend run share the same price.
  const [resolvedPrices, setResolvedPrices] =
    useState<Record<number, { amount: number; currency: string }>>({});

  // Back-to-top: ref to the scroll container we mount inside.
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Infinite scroll sentinel.
  const sentinelRef = useInView(
    list.loadMore,
    list.hasMore && !list.loading && !list.loadingMore
  );

  // Error state.
  if (list.error) {
    return (
      <div className="px-4">
        <ErrorState message={list.error.message} onRetry={list.refresh} />
      </div>
    );
  }

  // Loading state — show skeleton cards.
  if (list.loading && list.items.length === 0) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <UserCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  // Empty state — distinguish "needs interests" from "no results".
  if (!list.loading && list.items.length === 0) {
    if (list.requiresInterests && onAddInterests) {
      return (
        <div className="px-4">
          <EmptyState
            title={t('interests')}
            message={requiresInterestsMessage}
            action={<Button onClick={onAddInterests}>{t('addInterest')}</Button>}
          />
        </div>
      );
    }
    return (
      <div className="px-4">
        <EmptyState
          title={emptyTitle}
          message={emptyMessage}
          action={<Button variant="secondary" onClick={list.refresh}>{t('refresh')}</Button>}
        />
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="tab-enter px-4">
      {/* Toolbar: refresh + back-to-top + count */}
      <div className="sticky top-0 z-10 -mx-4 mb-3 flex items-center justify-between bg-surface-alt/95 px-4 py-2 backdrop-blur">
        <span className="text-xs text-ink-faint">
          {list.totalResults > 0
            ? `${list.totalResults} ${list.totalResults === 1 ? 'result' : 'results'}`
            : ''}
        </span>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={list.refresh}
            disabled={list.loading}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            {t('refresh')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const sc = scrollRef.current?.closest('.scroll-area');
              if (sc) sc.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="5 12 12 5 19 12" />
            </svg>
            {t('backToTop')}
          </Button>
        </div>
      </div>

      {/* Card list */}
      <ul className="space-y-3">
        {list.items.map(card => (
          <li key={card.id}>
            <UserCard
              card={card}
              revealPrice={resolvedPrices[card.id] ?? null}
              onUnlock={setPurchaseCard}
            />
          </li>
        ))}
      </ul>

      {/* Loading-more indicator */}
      {list.loadingMore ? (
        <div className="flex justify-center py-4">
          <Spinner />
        </div>
      ) : null}

      {/* End sentinel for infinite scroll */}
      <div ref={sentinelRef} className="h-4" />

      {/* Purchase modal */}
      {purchaseCard ? (
        <PurchaseModal
          card={purchaseCard}
          onClose={() => setPurchaseCard(null)}
          onPurchased={() => {
            // Refresh the list — the backend may have updated purchased flags.
            list.refresh();
          }}
          onPriceResolved={(cardId, amount, currency) => {
            setResolvedPrices(prev => ({ ...prev, [cardId]: { amount, currency } }));
          }}
        />
      ) : null}
    </div>
  );
}
