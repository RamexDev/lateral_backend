// Button component with variants, loading state, and tap feedback.

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { Spinner } from './Spinner';
import type { ButtonProps } from '../../types/ui';

type NativeButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> & ButtonProps;

const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-brand text-white hover:bg-brand-dark active:bg-brand-dark',
  secondary: 'bg-surface-alt text-ink border border-line-strong hover:bg-surface-muted active:bg-surface-muted',
  accent:
    'bg-accent text-white hover:bg-accent-dark active:bg-accent-dark shadow-[0_4px_14px_-2px_rgba(217,119,6,0.45)]',
  ghost: 'bg-transparent text-ink-muted hover:bg-surface-muted hover:text-ink active:bg-surface-muted',
  danger: 'bg-danger text-white hover:bg-red-700 active:bg-red-700'
};

const sizeClasses: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'h-9 px-3 text-sm rounded-lg gap-1.5',
  md: 'h-11 px-4 text-sm rounded-xl gap-2',
  lg: 'h-12 px-6 text-base rounded-xl gap-2'
};

export const Button = forwardRef<HTMLButtonElement, NativeButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, fullWidth, leftIcon, rightIcon, type = 'button', onClick, disabled, children, className, ...rest },
  ref
) {
  const isDisabled = disabled || loading;
  return (
    <button
      ref={ref}
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      className={cn(
        'inline-flex items-center justify-center font-semibold transition-all duration-[var(--duration-fast)] ease-[var(--ease-out)]',
        'active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none select-none',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:ring-offset-2',
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && 'w-full',
        className
      )}
      {...rest}
    >
      {loading ? (
        <Spinner size="sm" />
      ) : (
        <>
          {leftIcon && <span className="shrink-0">{leftIcon}</span>}
          {children}
          {rightIcon && <span className="shrink-0">{rightIcon}</span>}
        </>
      )}
    </button>
  );
});
