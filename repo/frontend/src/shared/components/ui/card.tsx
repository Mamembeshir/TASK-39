import type { HTMLAttributes, PropsWithChildren } from 'react';
import { cn } from '@/shared/lib/utils';

export function Card({ className, ...props }: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return <div className={cn('rounded-2xl border border-border/70 bg-card/95 text-card-foreground shadow-soft backdrop-blur-[2px] transition', className)} {...props} />;
}
export function CardHeader({ className, ...props }: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return <div className={cn('flex flex-col gap-2 p-5 pb-3 sm:p-6 sm:pb-3', className)} {...props} />;
}
export function CardTitle({ className, ...props }: PropsWithChildren<HTMLAttributes<HTMLHeadingElement>>) {
  return <h3 className={cn('text-lg font-semibold leading-tight tracking-tight', className)} {...props} />;
}
export function CardContent({ className, ...props }: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return <div className={cn('p-5 pt-0 sm:p-6 sm:pt-0', className)} {...props} />;
}
