// EmptyState — designed empty state with icon, title, message, action.

import type { ReactNode } from 'react';
import type { EmptyStateProps } from '../../types/ui';

export function EmptyState({ icon, title, message, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      {icon && (
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-muted text-ink-faint">
          {icon}
        </div>
      )}
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-ink">{title}</h3>
        {message && <p className="mx-auto max-w-xs text-sm text-ink-muted">{message}</p>}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
