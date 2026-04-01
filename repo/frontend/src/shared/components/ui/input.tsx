import type { InputHTMLAttributes } from 'react';
import { cn } from '@/shared/lib/utils';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn('flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring', className)} {...props} />;
}
