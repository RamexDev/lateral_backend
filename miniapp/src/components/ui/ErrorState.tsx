// ErrorState — red-tinted error block with optional Retry button.

import { AlertCircle, RotateCw } from 'lucide-react';
import { Button } from './Button';
import type { ErrorStateProps } from '../../types/ui';

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-6 py-10 text-center">
      <AlertCircle size={36} className="text-danger" />
      <p className="text-sm text-ink-muted">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" leftIcon={<RotateCw size={14} />} onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}
