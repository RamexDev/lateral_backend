// People tab — candidates located in the viewer's desired areas.
// Backend: GET /api/v1/marketplace/people
//
// The backend returns requires_interests: true when the viewer has no
// transfer interests. We surface that as an empty-state CTA that jumps
// the user to the Profile tab (where InterestsManager lives).

import { useCallback } from 'react';
import { getPeople } from '../../api';
import { useLang } from '../../i18n';
import { MarketplaceList } from '../marketplace/MarketplaceList';
import { ProfileNudge } from '../profile/ProfileNudge';

export function PeoplePage({
  onAddInterests,
  onNavigateToProfile
}: {
  onAddInterests?: () => void;
  onNavigateToProfile?: () => void;
}) {
  const { t } = useLang();

  const fetchPeople = useCallback(
    (page: number, pageSize: number) => getPeople(page, pageSize),
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
        fetcher={fetchPeople}
        emptyTitle={t('tabPeople')}
        emptyMessage={t('noResultsPeople')}
        requiresInterestsMessage={t('requiresInterests')}
        onAddInterests={onAddInterests}
      />
    </>
  );
}
