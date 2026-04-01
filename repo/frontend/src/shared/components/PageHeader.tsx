import type { PropsWithChildren } from 'react';

export function PageHeader({ title, description, children }: PropsWithChildren<{ title: string; description?: string }>) {
  return (
    <header className="grid gap-4 rounded-2xl border border-border/70 bg-card/70 px-5 py-5 shadow-soft sm:px-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="grid gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">Workspace</p>
          <h1 className="heading-section">{title}</h1>
          {description && <p className="body-base max-w-2xl">{description}</p>}
        </div>

        {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
      </div>
    </header>
  );
}
