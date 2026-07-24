// Textarea — labeled multiline input.

import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, className, id, ...rest },
  ref
) {
  const textareaId = id || rest.name;
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={textareaId} className="text-xs font-semibold text-ink-muted">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={textareaId}
        className={cn(
          'w-full rounded-xl border bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-ink-faint',
          'resize-none transition-colors duration-[var(--duration-fast)]',
          'focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand',
          'disabled:opacity-50 disabled:bg-surface-alt',
          error ? 'border-danger' : 'border-line-strong',
          className
        )}
        {...rest}
      />
      {error ? (
        <span className="text-xs text-danger">{error}</span>
      ) : hint ? (
        <span className="text-xs text-ink-faint">{hint}</span>
      ) : null}
    </div>
  );
});
