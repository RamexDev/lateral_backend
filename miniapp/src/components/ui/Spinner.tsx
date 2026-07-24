// Spinner — circular loading indicator.

import { cn } from '../../lib/utils';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  full?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-10 w-10 border-[3px]'
};

export function Spinner({ size = 'md', full, className }: SpinnerProps) {
  const spinner = (
    <div
      className={cn(
        'rounded-full border-current border-t-transparent animate-spin',
        sizeClasses[size],
        className
      )}
      role="status"
      aria-label="Loading"
    />
  );
  if (full) {
    return <div className="flex min-h-40 items-center justify-center">{spinner}</div>;
  }
  return spinner;
}
