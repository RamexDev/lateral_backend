// Main authenticated app shell.
// Layout:
//   - Fixed header at the top (current tab title + lang toggle + bell)
//   - Scrollable content area between header and tab bar
//   - Fixed bottom tab bar with 4 items, safe-area padding
//
// Profile-complete gate: Feed, People, and Purchases show the gate until
// profile_complete is true. Profile tab is always accessible.

import { useEffect, useState, type ReactElement } from 'react';
import { useAuth } from './auth';
import { getMyNotifications } from './api';
import { useApi } from './hooks';
import { useLang, type TranslationKey } from './i18n';
import { cn } from './utils';
import { Spinner } from './ui';
import { ProfileGate } from './features/profile/ProfileGate';
import { ProfilePage } from './features/profile/ProfilePage';
import { FeedPage } from './features/feed/FeedPage';
import { PeoplePage } from './features/people/PeoplePage';
import { PurchasesPage } from './features/purchases/PurchasesPage';
import {
  NotificationsSheet,
  countUnseen
} from './features/notifications/NotificationsSheet';
import type { AppNotification, ListResponse, TabKey } from './types';

export function MainApp() {
  const { me, refreshMe } = useAuth();
  const { t, lang, setLang } = useLang();

  // Active tab. Defaults to 'feed' (which is gated — see below).
  const [tab, setTab] = useState<TabKey>('feed');

  // Notification bell sheet open state.
  const [notifOpen, setNotifOpen] = useState(false);

  // Wait for me — auth provider sets status=authenticated only after me loads,
  // but a refresh during a token expiry can leave me null briefly.
  if (!me) {
    return <Spinner full />;
  }

  return (
    <div className="app-shell">
      {/* Fixed header — title left, lang toggle + bell right */}
      <Header
        title={tabTitle(tab, t)}
        lang={lang}
        onToggleLang={() => setLang(lang === 'en' ? 'am' : 'en')}
        notifOpen={notifOpen}
        onToggleNotif={() => setNotifOpen(o => !o)}
      />

      {/* Scrollable content area between header and tab bar */}
      <main className="scroll-area">
        {/* Re-mount on tab change so the .tab-enter animation runs fresh. */}
        <div key={tab}>
          {tab === 'feed' ? (
            me.profile_complete ? (
              <FeedPage onNavigateToProfile={() => setTab('profile')} />
            ) : (
              <ProfileGate onCompleted={refreshMe} />
            )
          ) : null}
          {tab === 'people' ? (
            me.profile_complete ? (
              <PeoplePage
                onAddInterests={() => setTab('profile')}
                onNavigateToProfile={() => setTab('profile')}
              />
            ) : (
              <ProfileGate onCompleted={refreshMe} />
            )
          ) : null}
          {tab === 'purchases' ? (
            me.profile_complete ? (
              <PurchasesPage onNavigateToProfile={() => setTab('profile')} />
            ) : (
              <ProfileGate onCompleted={refreshMe} />
            )
          ) : null}
          {tab === 'profile' ? <ProfilePage /> : null}
        </div>
      </main>

      {/* Bottom tab bar */}
      <BottomTabBar active={tab} onChange={setTab} />

      {/* Notifications sheet overlay */}
      <NotificationsSheet open={notifOpen} onClose={() => setNotifOpen(false)} />
    </div>
  );
}

// ─── Header ────────────────────────────────────────────────────────────────
// Fixed to top of viewport. Shows the current tab's title on the left, and
// a language toggle + notification bell grouped on the right.

function Header({
  title,
  lang,
  onToggleLang,
  notifOpen,
  onToggleNotif
}: {
  title: string;
  lang: 'en' | 'am';
  onToggleLang: () => void;
  notifOpen: boolean;
  onToggleNotif: () => void;
}) {
  // Fetch notifications on a slow interval so the bell dot stays fresh.
  // The brief says "track the timestamp of the newest notification the user
  // has opened" — we fetch the list to know what's newer than that timestamp.
  const notifications = useApi<ListResponse<AppNotification>>(
    '/api/v1/notifications/me?page=1&page_size=20'
  );

  // Poll every 60s while the sheet is closed — fetching on open already
  // refreshes the list, so polling during open is wasteful.
  useEffect(() => {
    if (notifOpen) return;
    const id = setInterval(() => {
      void notifications.refetch();
    }, 60_000);
    return () => clearInterval(id);
  }, [notifOpen, notifications.refetch]);

  const items = notifications.data?.notifications ?? [];
  const unseen = countUnseen(items);

  return (
    <header
      className="fixed inset-x-0 top-0 z-30 border-b border-line bg-surface/95 backdrop-blur"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
        {/* Title */}
        <h1 className="truncate text-base font-semibold text-ink">{title}</h1>

        {/* Right group: lang toggle + bell */}
        <div className="flex items-center gap-1.5">
          {/* Language toggle — pill with EN | AM */}
          <button
            onClick={onToggleLang}
            className="flex items-center rounded-full border border-line-strong bg-surface p-0.5 text-2xs font-bold transition hover:bg-surface-muted"
            aria-label="Toggle language"
          >
            <span
              className={cn(
                'rounded-full px-2 py-1 transition',
                lang === 'en'
                  ? 'bg-brand text-white'
                  : 'text-ink-muted'
              )}
            >
              EN
            </span>
            <span
              className={cn(
                'rounded-full px-2 py-1 transition',
                lang === 'am'
                  ? 'bg-brand text-white'
                  : 'text-ink-muted'
              )}
            >
              አማ
            </span>
          </button>

          {/* Notification bell */}
          <button
            onClick={onToggleNotif}
            className={cn(
              'relative rounded-full p-2 transition',
              notifOpen
                ? 'bg-brand text-white'
                : 'text-ink-muted hover:bg-surface-muted hover:text-ink'
            )}
            aria-label="Notifications"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {/* Unseen indicator */}
            {unseen > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-2xs font-bold text-white">
                {unseen > 9 ? '9+' : unseen}
              </span>
            ) : null}
          </button>
        </div>
      </div>
    </header>
  );
}

// ─── Bottom tab bar ────────────────────────────────────────────────────────
// Fixed to bottom of viewport. Four items: icon + label. Active state shows
// brand color + filled icon. iOS home indicator safe-area padding.

function BottomTabBar({
  active,
  onChange
}: {
  active: TabKey;
  onChange: (tab: TabKey) => void;
}) {
  const { t } = useLang();

  const tabs: Array<{
    key: TabKey;
    label: string;
    icon: (active: boolean) => ReactElement;
  }> = [
    {
      key: 'feed',
      label: t('tabFeed'),
      icon: active => <FeedIcon active={active} />
    },
    {
      key: 'people',
      label: t('tabPeople'),
      icon: active => <PeopleIcon active={active} />
    },
    {
      key: 'purchases',
      label: t('tabPurchases'),
      icon: active => <PurchasesIcon active={active} />
    },
    {
      key: 'profile',
      label: t('tabProfile'),
      icon: active => <ProfileIcon active={active} />
    }
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="mx-auto flex h-16 max-w-2xl items-stretch justify-around px-2">
        {tabs.map(tab => {
          const isActive = active === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onChange(tab.key)}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-1 transition',
                isActive ? 'text-brand' : 'text-ink-faint hover:text-ink-muted'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              {tab.icon(isActive)}
              <span
                className={cn(
                  'text-2xs font-medium',
                  isActive && 'font-semibold'
                )}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// ─── Tab icons ─────────────────────────────────────────────────────────────
// Each takes an `active` flag to control fill vs outline.

function FeedIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill={active ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function PeopleIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill={active ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function PurchasesIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill={active ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

function ProfileIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill={active ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

// Tab title in the current language.
function tabTitle(tab: TabKey, t: (key: TranslationKey) => string): string {
  switch (tab) {
    case 'feed': return t('tabFeed');
    case 'people': return t('tabPeople');
    case 'purchases': return t('tabPurchases');
    case 'profile': return t('tabProfile');
  }
}
