// ShortlistButton — bookmark toggle for save-for-later (F.8).

import { useState } from 'react';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import { addShortlist, removeShortlist } from '../../lib/api/endpoints';
import { useLang } from '../../lib/i18n';
import { hapticImpact } from '../../lib/telegram';
import { cn } from '../../lib/utils';

interface ShortlistButtonProps {
  candidateId: number;
  isShortlisted: boolean;
  onChange?: (isShortlisted: boolean) => void;
  className?: string;
  // "icon" = just the bookmark icon; "button" = full button with label.
  variant?: 'icon' | 'button';
}

export function ShortlistButton({
  candidateId,
  isShortlisted,
  onChange,
  className,
  variant = 'icon'
}: ShortlistButtonProps) {
  const { t } = useLang();
  const [loading, setLoading] = useState(false);

  const toggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (loading) return;
    hapticImpact('light');
    setLoading(true);
    try {
      if (isShortlisted) {
        await removeShortlist(candidateId);
        onChange?.(false);
      } else {
        await addShortlist(candidateId);
        onChange?.(true);
      }
    } catch {
      // ignore — toast handled by parent
    } finally {
      setLoading(false);
    }
  };

  if (variant === 'icon') {
    return (
      <button
        onClick={toggle}
        disabled={loading}
        className={cn(
          'rounded-full p-1.5 transition-colors',
          isShortlisted ? 'text-brand' : 'text-ink-faint hover:text-ink',
          className
        )}
        aria-label={isShortlisted ? t('marketplace.unshortlist') : t('marketplace.shortlist')}
      >
        {isShortlisted ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
        isShortlisted ? 'bg-brand-tint text-brand' : 'bg-surface-muted text-ink-muted hover:bg-line',
        className
      )}
    >
      {isShortlisted ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
      {isShortlisted ? t('marketplace.shortlisted') : t('marketplace.shortlist')}
    </button>
  );
}
