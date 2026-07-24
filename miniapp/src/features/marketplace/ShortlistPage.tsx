// ShortlistPage — saved candidates (F.8).
// Reuses CandidateCard for visual consistency with Feed/People.

import { useCallback, useState } from 'react';
import { Bookmark, RefreshCw } from 'lucide-react';
import { Button, ErrorState, EmptyState } from '../../components/ui';
import { useInfiniteList, useInView } from '../../lib/hooks';
import { getShortlist } from '../../lib/api/endpoints';
import { useLang } from '../../lib/i18n';
import { CandidateCard } from '../marketplace/CandidateCard';
import { CandidateCardSkeleton } from '../marketplace/CandidateCardSkeleton';
import { RevealModal } from '../marketplace/RevealModal';
import type { MarketplaceCard } from '../../types';

export function ShortlistPage() {
  const { t } = useLang();
  const [revealCard, setRevealCard] = useState<MarketplaceCard | null>(null);

  const { items, loading, loadingMore, error, hasMore, totalResults, loadMore, refresh } =
    useInfiniteList<MarketplaceCard>(
      (page, pageSize) => getShortlist(page, pageSize),
      10
    );

  const sentinelRef = useInView(() => {
    if (hasMore && !loadingMore) loadMore();
  }, hasMore && !loadingMore);

  const handleShortlistChange = useCallback((_candidateId: number, isShortlisted: boolean) => {
    if (!isShortlisted) refresh();
  }, [refresh]);

  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-ink">{t('shortlist.title')}</h2>
          <p className="text-sm text-ink-muted">{t('shortlist.subtitle')}</p>
        </div>
        <Button variant="ghost" size="sm" leftIcon={<RefreshCw size={14} />} onClick={refresh}>
          {t('common.refresh')}
        </Button>
      </div>

      {error && <ErrorState message={error.message} onRetry={refresh} />}

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <CandidateCardSkeleton key={i} />
          ))}
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <EmptyState
          icon={<Bookmark size={28} />}
          title={t('empty.noResultsShortlist')}
          message={t('empty.noResultsShortlistHint')}
        />
      )}

      {!loading && items.length > 0 && (
        <ul className="space-y-3">
          {items.map((card, idx) => (
            <li key={card.id}>
              <CandidateCard card={card} onUnlock={setRevealCard} index={idx} onShortlistChange={handleShortlistChange} />
            </li>
          ))}
        </ul>
      )}

      {loadingMore && (
        <div className="flex justify-center py-4">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent text-ink-faint" />
        </div>
      )}

      <div ref={sentinelRef} className="h-4" />

      <RevealModal card={revealCard} onClose={() => setRevealCard(null)} onPurchased={() => refresh()} />
    </div>
  );
}
