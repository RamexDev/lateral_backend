// MainApp — the authenticated app router.
// Uses URL-based routing via wouter for deep-linkable tabs.

import { useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { AppShell } from './AppShell';
import { MarketplacePage } from '../features/marketplace/MarketplacePage';
import { PurchasesPage } from '../features/purchases/PurchasesPage';
import { ProfilePage } from '../features/profile/ProfilePage';
import { ProfileGate } from '../features/profile/ProfileGate';
import { ShortlistPage } from '../features/marketplace/ShortlistPage';
import { useAuth } from '../features/auth/AuthProvider';
import { ROUTES, pathToTab } from './routes';
import { useCompleteness } from '../lib/hooks';
import { useLang } from '../lib/i18n';
import type { TabKey } from '../types';

export function MainApp() {
  const { me, refreshMe } = useAuth();
  const { t } = useLang();
  const [location, navigate] = useLocation();
  const { refresh: refreshCompleteness } = useCompleteness();

  // Determine current tab from URL.
  const activeTab: TabKey = pathToTab(location) || 'feed';

  // Determine if we should show the profile gate.
  const isProfileComplete = me?.profile_complete ?? false;

  // Handle tab changes by navigating to the URL.
  const handleTabChange = (tab: TabKey) => {
    navigate(ROUTES[tab]);
  };

  // Track the last non-shortlist tab for back navigation.
  const previousTabRef = useRef<TabKey>('feed');
  useEffect(() => {
    if (location !== '/shortlist') {
      const tab = pathToTab(location);
      if (tab) previousTabRef.current = tab;
    }
  }, [location]);

  // Refresh completeness when profile changes.
  useEffect(() => {
    refreshCompleteness();
  }, [me?.profile_complete, refreshCompleteness]);

  // If we're on /shortlist, show the shortlist page with a back button.
  if (location === '/shortlist') {
    return (
      <AppShell
        activeTab={previousTabRef.current}
        onTabChange={handleTabChange}
        headerTitle={t('shortlist.title')}
        onBack={() => navigate(ROUTES[previousTabRef.current])}
      >
        <ShortlistPage />
      </AppShell>
    );
  }

  return (
    <AppShell activeTab={activeTab} onTabChange={handleTabChange}>
      {/* Profile gate — shown for incomplete users on all tabs except profile. */}
      {!isProfileComplete && activeTab !== 'profile' ? (
        <ProfileGate onCompleted={async () => { await refreshMe(); }} />
      ) : activeTab === 'feed' ? (
        <MarketplacePage
          mode="feed"
          onNavigateToProfile={() => handleTabChange('profile')}
          onNavigateToShortlist={() => navigate('/shortlist')}
        />
      ) : activeTab === 'people' ? (
        <MarketplacePage
          mode="people"
          onNavigateToProfile={() => handleTabChange('profile')}
          onNavigateToShortlist={() => navigate('/shortlist')}
        />
      ) : activeTab === 'purchases' ? (
        <PurchasesPage onNavigateToProfile={() => handleTabChange('profile')} />
      ) : activeTab === 'profile' ? (
        <ProfilePage />
      ) : null}
    </AppShell>
  );
}
