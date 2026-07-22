// Feed tab — candidates who want to move into the viewer's current area.
// Backend: GET /api/v1/marketplace/feed

import { useCallback } from 'react';
import { getFeed } from '../../api';
import { useLang } from '../../i18n';
import { MarketplaceList } from '../marketplace/MarketplaceList';
import { ProfileNudge } from '../profile/ProfileNudge';

export function FeedPage({
  onNavigateToProfile
}: {
  onNavigateToProfile?: () => void;
}) {
  const { t } = useLang();

  const fetchFeed = useCallback(
    (page: number, pageSize: number) => getFeed(page, pageSize),
    []
  );

  return (
    <>
      {onNavigateToProfile ? (
        <div className="px-4 pt-4">
          <ProfileNudge onNavigateToProfile={onNavigateToProfile} />
        </div>
      ) : null}
      <MarketplaceList
        fetcher={fetchFeed}
        emptyTitle={t('tabFeed')}
        emptyMessage={t('noResultsFeed')}
        requiresInterestsMessage={t('requiresInterests')}
      />
    </>
  );
}
