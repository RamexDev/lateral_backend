// App routes — URL paths for wouter.

import type { TabKey } from '../types';

export const ROUTES: Record<TabKey, string> = {
  feed: '/feed',
  people: '/people',
  purchases: '/purchases',
  profile: '/profile'
};

export const TAB_ORDER: TabKey[] = ['feed', 'people', 'purchases', 'profile'];

// Map a URL path to a tab key (or null if no match).
export function pathToTab(path: string): TabKey | null {
  for (const [tab, route] of Object.entries(ROUTES)) {
    if (path === route || path.startsWith(route + '/')) {
      return tab as TabKey;
    }
  }
  return null;
}
