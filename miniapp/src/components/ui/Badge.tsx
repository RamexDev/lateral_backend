// Badge — inline pill label.

import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

type BadgeTone = 'gray' | 'green' | 'blue' | 'yellow' | 'amber' | 'red';

interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
  icon?: ReactNode;
}

const toneClasses: Record<BadgeTone, string> = {
  gray: 'bg-surface-muted text-ink-muted',
  green: 'bg-brand-tint text-brand',
  blue: 'bg-blue-50 text-info',
  yellow: 'bg-yellow-50 text-yellow-700',
  amber: 'bg-accent-light text-accent-dark',
  red: 'bg-red-50 text-danger'
};

export function Badge({ children, tone = 'gray', className, icon }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-semibold',
        toneClasses[tone],
        className
      )}
    >
      {icon}
      {children}
    </span>
  );
}
