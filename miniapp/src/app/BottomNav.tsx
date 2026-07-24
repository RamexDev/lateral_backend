// BottomNav — fixed bottom tab bar.

import { Newspaper, Users, ShoppingBag, User } from 'lucide-react';
import { useLang } from '../lib/i18n';
import { cn } from '../lib/utils';
import { ROUTES, TAB_ORDER } from './routes';
import type { TabKey } from '../types';

interface BottomNavProps {
  active: TabKey;
  onChange: (tab: TabKey) => void;
}

const tabIcons: Record<TabKey, typeof Newspaper> = {
  feed: Newspaper,
  people: Users,
  purchases: ShoppingBag,
  profile: User
};

export function BottomNav({ active, onChange }: BottomNavProps) {
  const { t } = useLang();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur-md"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="mx-auto flex h-16 max-w-2xl items-stretch justify-around px-2">
        {TAB_ORDER.map((tab) => {
          const Icon = tabIcons[tab];
          const isActive = active === tab;
          return (
            <button
              key={tab}
              onClick={() => onChange(tab)}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-0.5 rounded-lg transition-colors',
                isActive ? 'text-brand' : 'text-ink-faint hover:text-ink-muted'
              )}
              aria-label={t('tab.' + tab)}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon size={22} strokeWidth={isActive ? 2.4 : 2} />
              <span className={cn('text-2xs font-semibold', isActive && 'font-bold')}>
                {t('tab.' + tab)}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
