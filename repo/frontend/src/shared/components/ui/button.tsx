import type { ButtonHTMLAttributes } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '@/shared/lib/utils';

export function Button({ className, variant = 'default', asChild, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'secondary' | 'ghost'; asChild?: boolean }) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      className={cn(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring/70 disabled:pointer-events-none disabled:opacity-50',
        variant === 'secondary' && 'bg-secondary text-secondary-foreground hover:bg-muted',
        variant === 'ghost' && 'bg-transparent text-foreground hover:bg-muted',
        variant === 'default' && 'bg-primary text-primary-foreground shadow-soft hover:brightness-95',
        className,
      )}
      {...props}
    />
  );
}
