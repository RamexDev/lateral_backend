// Card — surface container.

import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface CardProps {
  children: ReactNode;
  className?: string;
  padded?: boolean;
  onClick?: () => void;
}

export function Card({ children, className, padded = true, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(17,24,39,0.04)]',
        padded && 'p-4',
        onClick && 'cursor-pointer transition-colors hover:border-line-strong',
        className
      )}
    >
      {children}
    </div>
  );
}
