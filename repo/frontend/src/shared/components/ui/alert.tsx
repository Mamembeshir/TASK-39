import type { HTMLAttributes, PropsWithChildren } from 'react';
import { cn } from '@/shared/lib/utils';

export function Alert({ className, ...props }: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return <div className={cn('rounded-2xl border border-border bg-card p-4 text-sm', className)} {...props} />;
}
