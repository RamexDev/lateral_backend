// Modal — bottom sheet on mobile, centered card on desktop.

import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ModalProps {
  open: boolean;
  title?: string;
  onClose: () => void;
  closeOnBackdrop?: boolean;
  children: ReactNode;
  className?: string;
  // Force bottom-sheet or centered regardless of viewport.
  variant?: 'auto' | 'sheet' | 'center';
}

export function Modal({
  open,
  title,
  onClose,
  closeOnBackdrop = true,
  children,
  className,
  variant = 'auto'
}: ModalProps) {
  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Escape key closes.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);

    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  // On mobile: bottom sheet. On desktop: centered card. variant='sheet'/'center' forces one.
  const isSheet = variant === 'sheet' || (variant === 'auto' && window.innerWidth < 640);

  return (
    <div
      className="fixed inset-0 z-50 flex bg-black/40 backdrop-blur-sm backdrop-enter"
      style={isSheet ? { alignItems: 'flex-end' } : { alignItems: 'center', justifyContent: 'center' }}
      onClick={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={cn(
          'bg-surface shadow-xl',
          isSheet
            ? 'w-full rounded-t-2xl sheet-enter max-h-[90dvh] overflow-y-auto'
            : 'rounded-2xl w-full max-w-md mx-4 pop-enter',
          className
        )}
        role="dialog"
        aria-modal="true"
      >
        {title && (
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="text-base font-semibold text-ink">{title}</h2>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-ink-faint transition-colors hover:bg-surface-muted hover:text-ink"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
