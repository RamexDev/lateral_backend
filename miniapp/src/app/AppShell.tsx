import { useCallback, useEffect, useState } from 'react';
import { Header } from './Header';
import { BottomNav } from './BottomNav';
import { NotificationsSheet } from './NotificationsSheet';
import { ScrollToTop } from '../components/ui/ScrollToTop';
import { useLang } from '../lib/i18n';
import type { TabKey } from '../types';

interface AppShellProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  children: React.ReactNode;
  headerTitle?: string;
  onBack?: () => void;
  backLabel?: string;
}

export function AppShell({ activeTab, onTabChange, children, headerTitle, onBack, backLabel }: AppShellProps) {
  const { t } = useLang();
  const [notifOpen, setNotifOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 300);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleTabChange = useCallback(
    (tab: TabKey) => {
      if (tab !== activeTab) {
        onTabChange(tab);
      }
    },
    [activeTab, onTabChange]
  );

  return (
    <div className="app-shell">
      <Header
        title={headerTitle || t('tab.' + activeTab)}
        onOpenNotifications={() => setNotifOpen(true)}
        onBack={onBack}
        backLabel={backLabel}
      />
      <main className="scroll-area">
        <div key={activeTab} className="tab-enter mx-auto max-w-2xl px-4 pb-4">
          {children}
        </div>
      </main>
      <BottomNav active={activeTab} onChange={handleTabChange} />
      <ScrollToTop visible={scrolled} />
      <NotificationsSheet open={notifOpen} onClose={() => setNotifOpen(false)} />
    </div>
  );
}
