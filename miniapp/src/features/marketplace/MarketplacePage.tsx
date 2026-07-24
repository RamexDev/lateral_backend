// MarketplacePage — unified Feed + People component.
// Renders the infinite-scrolling list of CandidateCards with empty/loading/error states.
// v2: supports filter bar (F.7), impression tracking (F.6), shortlist integration (F.8).

import { useCallback, useEffect, useState } from 'react';
import { Newspaper, Users, RefreshCw, Bookmark } from 'lucide-react';
import { Button, ErrorState, EmptyState } from '../../components/ui';
import { useInfiniteList, useInView, useCompleteness, type InfiniteListResponse } from '../../lib/hooks';
import { getFeed, getPeople, recordImpressions } from '../../lib/api/endpoints';
import { useLang } from '../../lib/i18n';
import { CandidateCard } from './CandidateCard';
import { CandidateCardSkeleton } from './CandidateCardSkeleton';
import { RevealModal } from './RevealModal';
import { FilterBar } from './FilterBar';
import { ProfileNudge } from '../profile/ProfileNudge';
import type { MarketplaceCard, MarketplaceFilters } from '../../types';

interface MarketplacePageProps {
  mode: 'feed' | 'people';
  onNavigateToProfile: () => void;
  onNavigateToShortlist?: () => void;
}

export function MarketplacePage({ mode, onNavigateToProfile, onNavigateToShortlist }: MarketplacePageProps) {
  const { t } = useLang();
  const { completeness } = useCompleteness();
  const [filters, setFilters] = useState<MarketplaceFilters>({});
  const [revealCard, setRevealCard] = useState<MarketplaceCard | null>(null);
  const [resolvedPrices, setResolvedPrices] = useState<Record<number, { amount: number; currency: string }>>({});

  // Build the fetcher — memoized so useInfiniteList doesn't refetch on every render.
  const fetcher = useCallback(
    (page: number, pageSize: number): Promise<InfiniteListResponse<MarketplaceCard>> => {
      // Always fetch page 1 fresh to pick up shortlist/purchase changes.
      const isFresh = page === 1;
      if (mode === 'feed') {
        return getFeed(page, pageSize, isFresh, filters);
      }
      return getPeople(page, pageSize, isFresh, filters);
    },
    [mode, filters]
  );

  const { items, loading, loadingMore, error, hasMore, requiresInterests, totalResults, loadMore, refresh } =
    useInfiniteList<MarketplaceCard>(fetcher, 10);

  // Re-fetch when mode or filters change.
  useEffect(() => {
    refresh();
  }, [mode, filters, refresh]);

  const handleRefresh = useCallback(() => {
    refresh();
  }, [refresh]);

  // Record impressions when new items load (F.6).
  // Debounce via a 2s timer to batch.
  useEffect(() => {
    if (items.length === 0) return;
    const ids = items.map((c) => c.id);
    const timer = setTimeout(() => {
      recordImpressions(ids).catch(() => {
        // Silently fail — impressions are best-effort.
      });
    }, 2000);
    return () => clearTimeout(timer);
  }, [items]);

  // Infinite scroll sentinel.
  const sentinelRef = useInView(() => {
    if (hasMore && !loadingMore) {
      loadMore();
    }
  }, hasMore && !loadingMore);

  const handleUnlock = useCallback((card: MarketplaceCard) => {
    setRevealCard(card);
  }, []);

  const handlePurchased = useCallback((cardId: number, amount: number, currency: string) => {
    setResolvedPrices((prev) => ({ ...prev, [cardId]: { amount, currency } }));
    // Refresh the list after a delay so the purchased state shows up.
    setTimeout(() => {
      refresh();
    }, 1500);
  }, [refresh]);

  const title = mode === 'feed' ? t('feed.title') : t('people.title');
  const subtitle = mode === 'feed' ? t('feed.subtitle') : t('people.subtitle');

  const emptyTitle = mode === 'feed' ? t('empty.noResultsFeed') : t('empty.noResultsPeople');
  const emptyMessage = mode === 'feed' ? t('empty.noResultsFeedHint') : t('empty.noResultsPeopleHint');

  return (
    <div className="space-y-3 pt-4">
      {/* Profile completion nudge */}
      {completeness && completeness.nudge.show && !completeness.is_fully_complete && (
        <ProfileNudge onNavigateToProfile={onNavigateToProfile} />
      )}

      {/* Page header */}
      <div className="flex items-center justify-end gap-2">
        {onNavigateToShortlist && (
          <Button variant="ghost" size="sm" leftIcon={<Bookmark size={14} />} onClick={onNavigateToShortlist}>
            {t('shortlist.title')}
          </Button>
        )}
        <Button variant="ghost" size="sm" leftIcon={<RefreshCw size={14} />} onClick={handleRefresh}>
          {t('common.refresh')}
        </Button>
      </div>
      <p className="text-sm text-ink-muted">{subtitle}</p>

      {/* Filter bar */}
      <FilterBar filters={filters} onChange={setFilters} />

      {/* Results count */}
      {!loading && !error && items.length > 0 && (
        <p className="text-xs text-ink-muted">
          {t('marketplace.resultsCount', { n: totalResults })}
        </p>
      )}

      {/* Error state */}
      {error && (
        <ErrorState message={error.message} onRetry={handleRefresh} />
      )}

      {/* Loading state — initial */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <CandidateCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Requires interests state — only for People mode */}
      {!loading && requiresInterests && mode === 'people' && (
        <EmptyState
          icon={<Users size={28} />}
          title={t('empty.requiresInterests')}
          message={t('empty.requiresInterestsHint')}
          action={
            <Button variant="primary" onClick={onNavigateToProfile}>
              {t('interests.addInterest')}
            </Button>
          }
        />
      )}

      {/* Empty state */}
      {!loading && !error && !requiresInterests && items.length === 0 && (
        <EmptyState
          icon={mode === 'feed' ? <Newspaper size={28} /> : <Users size={28} />}
          title={emptyTitle}
          message={emptyMessage}
          action={
            <Button variant="secondary" size="sm" leftIcon={<RefreshCw size={14} />} onClick={handleRefresh}>
              {t('common.refresh')}
            </Button>
          }
        />
      )}

      {/* Cards list */}
      {!loading && items.length > 0 && (
        <ul className="space-y-3">
          {items.map((card, idx) => (
            <li key={card.id}>
              <CandidateCard
                card={card}
                onUnlock={handleUnlock}
                resolvedPrice={resolvedPrices[card.id]}
                index={idx}
              />
            </li>
          ))}
        </ul>
      )}

      {/* Loading more spinner */}
      {loadingMore && (
        <div className="flex justify-center py-4">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent text-ink-faint" />
        </div>
      )}

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="h-4" />

      {/* Reveal modal */}
      <RevealModal
        card={revealCard}
        onClose={() => setRevealCard(null)}
        onPurchased={handlePurchased}
      />
    </div>
  );
}
