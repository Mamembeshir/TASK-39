import type { PropsWithChildren } from 'react';

export function AuthShell({ title, subtitle, children }: PropsWithChildren<{ eyebrow: string; title: string; subtitle: string }>) {
  return (
    <main className="auth-mesh min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="hidden h-full rounded-2xl border border-border bg-card/75 p-8 shadow-soft backdrop-blur md:block lg:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">HomeCareOps</p>
          <h1 className="heading-hero mt-6 max-w-xl">{title}</h1>
          <p className="body-lg mt-6 max-w-lg">{subtitle}</p>
          <div className="mt-10 grid max-w-md gap-3 text-sm text-muted-foreground">
            <div className="rounded-xl border border-border bg-background/80 p-4 shadow-soft">Trusted scheduling, service quotes, and support in one place.</div>
            <div className="rounded-xl border border-border bg-background/80 p-4 shadow-soft">Designed for customer, staff, and operations workflows.</div>
          </div>
        </section>

        <section className="flex justify-center">
          <div className="w-full max-w-md">
            <div className="mb-6 text-center md:hidden">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">HomeCareOps</p>
              <h1 className="heading-hero mt-3">{title}</h1>
              <p className="body-base mt-3">{subtitle}</p>
            </div>
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
