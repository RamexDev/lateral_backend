// NotificationsSheet — top-anchored sheet listing all notifications.
// v2 features (F.4):
//   - Infinite scroll pagination (was capped at 20 in v1).
//   - Server-side read_at tracking (no more sessionStorage hack).
//   - Mark-all-read and mark-one-read buttons.
//   - unread_count from backend drives the bell badge.

import { useEffect, useState } from 'react';
import { Bell, CheckCheck, CreditCard, Megaphone, FileText, Lightbulb } from 'lucide-react';
import { TopSheet, Spinner, EmptyState, Button, Skeleton } from '../components/ui';
import { useInfiniteList, useInView } from '../lib/hooks';
import { getMyNotifications, markAllNotificationsRead, markNotificationRead } from '../lib/api/endpoints';
import { useLang } from '../lib/i18n';
import { formatRelativeTime, cn } from '../lib/utils';
import type { AppNotification } from '../types';

interface NotificationsSheetProps {
  open: boolean;
  onClose: () => void;
}

// Icon for each notification type.
const typeIcons: Record<string, typeof Bell> = {
  payment_confirmation: CreditCard,
  profile_nudge: Lightbulb,
  broadcast: Megaphone,
  digest: FileText
};

export function NotificationsSheet({ open, onClose }: NotificationsSheetProps) {
  const { lang, t } = useLang();
  const [markingAll, setMarkingAll] = useState(false);

  const { items, loading, loadingMore, hasMore, loadMore, refresh, unreadCount } = useInfiniteList<AppNotification>(
    (page, pageSize) => getMyNotifications(page, pageSize, false),
    20
  );

  // Reload when sheet opens.
  useEffect(() => {
    if (open) {
      refresh();
    }
  }, [open, refresh]);

  const sentinelRef = useInView(() => {
    if (hasMore && !loadingMore) {
      loadMore();
    }
  }, open && hasMore && !loadingMore);

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      await markAllNotificationsRead();
      refresh();
    } catch {
      // ignore
    } finally {
      setMarkingAll(false);
    }
  };

  const handleMarkOneRead = async (id: number) => {
    try {
      await markNotificationRead(id);
      refresh();
    } catch {
      // ignore
    }
  };

  return (
    <TopSheet open={open} title={t('notifications.title')} onClose={onClose}>
      <div className="flex justify-end">
        {unreadCount && unreadCount > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<CheckCheck size={14} />}
            onClick={handleMarkAllRead}
            loading={markingAll}
          >
            {t('notifications.markAllRead')}
          </Button>
        ) : null}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Bell size={28} />}
          title={t('empty.noResultsNotifications')}
          message={t('empty.noResultsNotificationsHint')}
        />
      ) : (
        <ul className="space-y-2">
          {items.map((notif) => {
            const Icon = typeIcons[notif.type] || Bell;
            const body = String(notif.payload?.['summary_' + lang] || notif.payload?.summary_en || '');
            const isUnread = !notif.read_at;
            return (
              <li
                key={notif.id}
                className={cn(
                  'flex gap-3 rounded-xl border p-3 transition-colors',
                  isUnread ? 'border-brand/30 bg-brand-tint' : 'border-line bg-surface'
                )}
              >
                <div
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                    isUnread ? 'bg-brand text-white' : 'bg-surface-muted text-ink-faint'
                  )}
                >
                  <Icon size={16} />
                </div>
                <div className="flex-1 space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-2xs font-semibold uppercase tracking-wide text-ink-faint">
                      {t('notifications.type.' + notif.type)}
                    </span>
                    <span className="text-2xs text-ink-faint">
                      {formatRelativeTime(notif.created_at, lang)}
                    </span>
                  </div>
                  {body && <p className="text-sm text-ink">{body}</p>}
                  {isUnread && (
                    <button
                      onClick={() => handleMarkOneRead(notif.id)}
                      className="text-2xs font-semibold text-brand hover:underline"
                    >
                      Mark as read
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {loadingMore && (
        <div className="py-4">
          <Spinner full size="sm" />
        </div>
      )}

      {/* Sentinel for infinite scroll */}
      <div ref={sentinelRef} className="h-4" />
    </TopSheet>
  );
}
