import type { PropsWithChildren } from 'react';
import { cn } from '@/shared/lib/utils';

export function PageShell({ children, className, width = 'wide' }: PropsWithChildren<{ className?: string; width?: 'narrow' | 'wide' }>) {
  return <main className={cn('mx-auto w-full py-1 sm:py-2', width === 'wide' ? 'max-w-6xl' : 'max-w-5xl', className)}>{children}</main>;
}
