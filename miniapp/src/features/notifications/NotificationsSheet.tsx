// Notifications sheet — opens as a top-anchored overlay when the user taps
// the bell in the header.
//
// Backend has NO read/unread state (verified in
// src/modules/notifications/notifications.service.js — only id/type/payload/
// sent_at/created_at are returned, no read_at). We track "seen" client-side:
//   - sessionStorage holds the timestamp of the newest notification the user
//     has seen (i.e. opened the bell after).
//   - The bell shows a dot/count for anything newer than that.
//   - Opening the sheet bumps the seen-timestamp to "now", clearing the dot.
//
// Notification bodies live in payload.summary_en / payload.summary_am (with
// type-specific extras like purchase_id, amount_etb). We render whichever
// language the user is currently viewing, with fallback to the other.

import { useEffect } from 'react';
import { getMyNotifications } from '../../api';
import { useApi } from '../../hooks';
import { useLang } from '../../i18n';
import { TopSheet, EmptyState, Spinner } from '../../ui';
import { formatDateTime, toEpochMs } from '../../utils';
import type { AppNotification, AppNotificationPayload, ListResponse } from '../../types';

const SEEN_KEY = 'zwuwur.notifications.seenAt';

// Read the client-side seen-timestamp (epoch ms).
export function getSeenAt(): number {
  try {
    return Number(sessionStorage.getItem(SEEN_KEY) ?? '0') || 0;
  } catch {
    return 0;
  }
}

// Update the seen-timestamp to "now".
export function markAllSeen(): void {
  try {
    sessionStorage.setItem(SEEN_KEY, String(Date.now()));
  } catch {
    // Ignore.
  }
}

// Count how many notifications are newer than the seen-timestamp.
export function countUnseen(notifications: AppNotification[] | null | undefined): number {
  if (!notifications || notifications.length === 0) return 0;
  const seenAt = getSeenAt();
  return notifications.filter(n => toEpochMs(n.created_at) > seenAt).length;
}

// Pick the body text for a notification in the active language, with fallback.
function notificationBody(
  payload: AppNotificationPayload | null,
  lang: 'en' | 'am'
): string {
  if (!payload) return '';
  const primary = lang === 'am' ? payload.summary_am : payload.summary_en;
  if (typeof primary === 'string' && primary.trim()) return primary;
  const fallback = lang === 'am' ? payload.summary_en : payload.summary_am;
  if (typeof fallback === 'string' && fallback.trim()) return fallback;
  return '';
}

// Per-type icon — small visual variety.
function TypeIcon({ type }: { type: string }) {
  const common = {
    width: 14,
    height: 14,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const
  };
  switch (type) {
    case 'payment_confirmation':
      return (
        <svg {...common}>
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      );
    case 'profile_nudge':
      return (
        <svg {...common}>
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      );
    case 'broadcast':
      return (
        <svg {...common}>
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
        </svg>
      );
    case 'digest':
      return (
        <svg {...common}>
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      );
  }
}

// Human-readable type label in the active language, with fallback.
// Pure function — takes lang, returns the localized label.
function notificationTypeLabel(type: string, lang: 'en' | 'am'): string {
  const labels: Record<string, { en: string; am: string }> = {
    payment_confirmation: {
      en: 'Payment confirmed',
      am: 'ክፍያ ተረጋግጧል'
    },
    profile_nudge: {
      en: 'Profile reminder',
      am: 'የመገለጫ አሳስታ'
    },
    broadcast: {
      en: 'Announcement',
      am: 'ማስታወቂያ'
    },
    digest: {
      en: 'Digest',
      am: 'ሪፖርት'
    }
  };
  const entry = labels[type];
  if (!entry) return type.replace(/_/g, ' ');
  return lang === 'am' ? (entry.am || entry.en) : (entry.en || entry.am);
}

export function NotificationsSheet({
  open,
  onClose
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t, lang } = useLang();

  // Fetch notifications whenever the sheet opens. Re-fetches on each open —
  // fine for a lightweight list, and keeps the unseen count fresh.
  const notifications = useApi<ListResponse<AppNotification>>(
    open ? '/api/v1/notifications/me?page=1&page_size=20' : null
  );

  // When the sheet opens, mark everything currently loaded as seen.
  // This matches the brief: "track the timestamp of the newest notification
  // the user has opened" — opening the sheet counts as "seeing" them all.
  useEffect(() => {
    if (!open) return;
    markAllSeen();
  }, [open]);

  // Normalize items — backend returns { notifications: [...] }, not results.
  const items: AppNotification[] = notifications.data?.notifications ?? [];

  return (
    <TopSheet open={open} title={t('notificationsTitle')} onClose={onClose}>
      <div className="p-2">
        {notifications.loading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            }
            message={t('noResultsNotifications')}
          />
        ) : (
          <ul className="space-y-1">
            {items.map(n => {
              const body = notificationBody(n.payload, lang);
              const typeLabel = notificationTypeLabel(n.type, lang);

              return (
                <li
                  key={n.id}
                  className="rounded-lg p-3 transition hover:bg-surface-muted"
                >
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 text-brand-dark">
                      <TypeIcon type={n.type} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-2xs font-semibold uppercase tracking-wide text-ink-faint">
                        {typeLabel}
                      </p>
                      {body ? (
                        <p className="mt-0.5 text-sm text-ink">{body}</p>
                      ) : null}
                      <p className="mt-1 text-2xs text-ink-faint">
                        {formatDateTime(n.created_at, lang)}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </TopSheet>
  );
}
