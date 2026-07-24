// ResponsiveContainer — wraps content with the standard max-width + padding.
// On mobile: full width with 16px horizontal padding.
// On tablet/desktop: max-w-2xl (640px) centered.

import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface ResponsiveContainerProps {
  children: ReactNode;
  className?: string;
  wide?: boolean;
}

export function ResponsiveContainer({ children, className, wide }: ResponsiveContainerProps) {
  return (
    <div className={cn(wide ? 'content-container-wide' : 'content-container', className)}>
      {children}
    </div>
  );
}
