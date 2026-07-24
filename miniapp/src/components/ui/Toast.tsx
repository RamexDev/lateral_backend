// Toast — auto-dismissing notification popup.

import { useEffect, type ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface ToastProps {
  message: ReactNode;
  show: boolean;
  onDismiss: () => void;
  duration?: number;
  className?: string;
}

export function Toast({ message, show, onDismiss, duration = 2500, className }: ToastProps) {
  useEffect(() => {
    if (!show) return;
    const t = setTimeout(onDismiss, duration);
    return () => clearTimeout(t);
  }, [show, duration, onDismiss]);

  if (!show) return null;

  return (
    <div
      className={cn(
        'fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-white shadow-lg',
        'pop-enter max-w-[90vw] truncate',
        className
      )}
      role="status"
    >
      {message}
    </div>
  );
}
