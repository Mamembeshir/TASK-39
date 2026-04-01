import type { PropsWithChildren } from 'react';

export function EmptyState({
  title,
  description,
  compact = false,
  showIcon = false,
}: PropsWithChildren<{ title: string; description?: string; compact?: boolean; showIcon?: boolean }>) {
  return (
    <div className={compact ? 'mx-auto grid w-full max-w-md place-items-center rounded-2xl border border-dashed border-border bg-card px-5 py-8 text-center shadow-soft' : 'grid place-items-center rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center shadow-soft'}>
      <div className="grid max-w-md gap-2">
        {showIcon && (
          <div className="mx-auto mb-2 grid h-9 w-9 place-items-center rounded-full border border-border bg-muted">
            <div className="h-2.5 w-2.5 rounded-full bg-primary/60" />
          </div>
        )}
        <h3 className="heading-section text-xl">{title}</h3>
        {description && <p className="body-base">{description}</p>}
      </div>
    </div>
  );
}
