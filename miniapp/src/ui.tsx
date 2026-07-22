// Shared UI primitives.
// One home for buttons, inputs, cards, badges, spinners, empty/error states,
// modals, sheets — extended by every screen so we never duplicate markup.

import {
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useEffect
} from 'react';
import { cn } from './utils';

// ─── Button ────────────────────────────────────────────────────────────────
type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

const buttonBase =
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium ' +
  'transition-[background-color,border-color,color,transform] ' +
  'duration-[var(--duration-fast)] active:scale-[0.98] ' +
  'disabled:opacity-50 disabled:pointer-events-none select-none';

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-dark shadow-sm',
  accent:
    'bg-accent text-white hover:bg-accent-dark shadow-sm ' +
    '[box-shadow:0_4px_14px_-2px_rgba(217,119,6,0.45)]',
  secondary:
    'border border-line-strong bg-surface text-ink hover:bg-surface-muted',
  ghost: 'text-ink-muted hover:bg-surface-muted hover:text-ink',
  danger: 'bg-danger text-white hover:brightness-95 shadow-sm'
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-5 py-3 text-base'
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  className,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
}) {
  return (
    <button
      className={cn(
        buttonBase,
        buttonVariants[variant],
        buttonSizes[size],
        fullWidth && 'w-full',
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Spinner size="sm" /> : children}
    </button>
  );
}

// ─── Input ─────────────────────────────────────────────────────────────────
export function Input({
  label,
  hint,
  error,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
}) {
  return (
    <label className="mb-4 block">
      {label ? (
        <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      ) : null}

      <input
        className={cn(
          'w-full rounded-lg border bg-surface px-3.5 py-2.5 text-sm text-ink',
          'placeholder:text-ink-faint outline-none',
          'transition-[border-color,box-shadow] duration-[var(--duration-fast)]',
          'focus:border-brand focus:ring-2 focus:ring-brand/20',
          error ? 'border-danger' : 'border-line-strong',
          className
        )}
        {...props}
      />

      {error ? (
        <span className="mt-1 block text-xs text-danger">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-ink-faint">{hint}</span>
      ) : null}
    </label>
  );
}

// ─── Textarea ──────────────────────────────────────────────────────────────
export function Textarea({
  label,
  hint,
  error,
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  hint?: string;
  error?: string;
}) {
  return (
    <label className="mb-4 block">
      {label ? (
        <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      ) : null}

      <textarea
        className={cn(
          'w-full rounded-lg border bg-surface px-3.5 py-2.5 text-sm text-ink',
          'placeholder:text-ink-faint outline-none resize-none',
          'transition-[border-color,box-shadow] duration-[var(--duration-fast)]',
          'focus:border-brand focus:ring-2 focus:ring-brand/20',
          error ? 'border-danger' : 'border-line-strong',
          className
        )}
        {...props}
      />

      {error ? (
        <span className="mt-1 block text-xs text-danger">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-ink-faint">{hint}</span>
      ) : null}
    </label>
  );
}

// ─── Select ────────────────────────────────────────────────────────────────
export function Select({
  label,
  hint,
  error,
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  hint?: string;
  error?: string;
}) {
  return (
    <label className="mb-4 block">
      {label ? (
        <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      ) : null}

      <select
        className={cn(
          'w-full rounded-lg border bg-surface px-3.5 py-2.5 text-sm text-ink',
          'outline-none transition-[border-color,box-shadow] duration-[var(--duration-fast)]',
          'focus:border-brand focus:ring-2 focus:ring-brand/20',
          error ? 'border-danger' : 'border-line-strong',
          className
        )}
        {...props}
      >
        {children}
      </select>

      {error ? (
        <span className="mt-1 block text-xs text-danger">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-ink-faint">{hint}</span>
      ) : null}
    </label>
  );
}

// ─── Card ──────────────────────────────────────────────────────────────────
export function Card({
  children,
  className,
  padded = true
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-line bg-surface shadow-[0_1px_2px_rgba(17,24,39,0.04)]',
        padded && 'p-4',
        className
      )}
    >
      {children}
    </div>
  );
}

// ─── Badge ─────────────────────────────────────────────────────────────────
type BadgeTone = 'gray' | 'green' | 'blue' | 'yellow' | 'amber' | 'red';

const badgeTones: Record<BadgeTone, string> = {
  gray: 'bg-surface-muted text-ink-muted',
  green: 'bg-brand-light text-brand-dark',
  blue: 'bg-blue-100 text-blue-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  amber: 'bg-accent-light text-accent-dark',
  red: 'bg-red-100 text-red-700'
};

export function Badge({
  children,
  tone = 'gray',
  className
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-semibold',
        badgeTones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

// ─── Spinner ───────────────────────────────────────────────────────────────
export function Spinner({
  size = 'md',
  full = false
}: {
  size?: 'sm' | 'md' | 'lg';
  full?: boolean;
}) {
  const sizes = {
    sm: 'h-4 w-4 border-2',
    md: 'h-6 w-6 border-[3px]',
    lg: 'h-10 w-10 border-4'
  };

  const spinner = (
    <div
      className={cn(
        'rounded-full border-line-strong border-t-brand animate-spin',
        sizes[size]
      )}
      role="status"
      aria-label="Loading"
    />
  );

  if (full) {
    return (
      <div className="flex min-h-40 flex-1 items-center justify-center py-12">
        {spinner}
      </div>
    );
  }
  return spinner;
}

// ─── Skeleton ──────────────────────────────────────────────────────────────
// Loading placeholder blocks. Compose them per-screen for realistic skeletons.
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />;
}

// ─── Empty state ───────────────────────────────────────────────────────────
export function EmptyState({
  icon,
  title,
  message,
  action
}: {
  icon?: ReactNode;
  title?: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {icon ? <div className="mb-3 text-ink-faint">{icon}</div> : null}
      {title ? (
        <p className="mb-1 text-base font-semibold text-ink">{title}</p>
      ) : null}
      <p className="max-w-xs text-sm text-ink-muted">{message}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

// ─── Error state ───────────────────────────────────────────────────────────
export function ErrorState({
  message,
  onRetry
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="mx-4 my-6 rounded-xl border border-red-200 bg-red-50 p-4 text-center">
      <p className="text-sm font-medium text-red-700">
        {message || 'Something went wrong.'}
      </p>
      {onRetry ? (
        <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}

// ─── Modal (bottom sheet on mobile, centered card on desktop) ──────────────
export function Modal({
  open,
  title,
  children,
  onClose,
  closeOnBackdrop = true
}: {
  open: boolean;
  title?: string;
  children: ReactNode;
  onClose: () => void;
  closeOnBackdrop?: boolean;
}) {
  // Lock body scroll while open + close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="backdrop-enter fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        className="sheet-enter w-full max-w-md rounded-t-2xl bg-surface p-5 shadow-2xl sm:rounded-2xl"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {title ? (
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-ink">{title}</h3>
            <button
              onClick={onClose}
              className="rounded-full p-1 text-ink-faint transition hover:bg-surface-muted hover:text-ink"
              aria-label="Close"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}

// ─── Top sheet (notifications overlay) ─────────────────────────────────────
// Slides down from the top, anchored to the header.
export function TopSheet({
  open,
  title,
  children,
  onClose
}: {
  open: boolean;
  title?: string;
  children: ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="backdrop-enter fixed inset-0 z-40 bg-black/30"
      onClick={onClose}
    >
      <div
        className="sheet-enter absolute inset-x-0 top-0 max-h-[80vh] overflow-y-auto rounded-b-2xl bg-surface shadow-2xl"
        style={{
          paddingTop: 'calc(56px + env(safe-area-inset-top, 0px))'
        }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {title ? (
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface px-4 py-3">
            <h3 className="text-base font-semibold text-ink">{title}</h3>
            <button
              onClick={onClose}
              className="rounded-full p-1 text-ink-faint transition hover:bg-surface-muted hover:text-ink"
              aria-label="Close"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ) : null}
        <div className="p-2">{children}</div>
      </div>
    </div>
  );
}

// ─── Toast (transient confirmation) ────────────────────────────────────────
// Lightweight inline toast — used for save confirmations. Auto-dismisses.
export function Toast({
  message,
  show,
  onDismiss
}: {
  message: string;
  show: boolean;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!show) return;
    const timer = setTimeout(onDismiss, 2500);
    return () => clearTimeout(timer);
  }, [show, onDismiss]);

  if (!show) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4">
      <div className="sheet-enter pointer-events-auto rounded-full bg-ink px-4 py-2 text-sm font-medium text-white shadow-xl">
        {message}
      </div>
    </div>
  );
}
