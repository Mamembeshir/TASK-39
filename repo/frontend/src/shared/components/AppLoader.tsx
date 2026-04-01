export function AppLoader({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="grid place-items-center rounded-2xl border border-border bg-card/80 px-6 py-14 text-center shadow-soft">
      <div className="grid place-items-center gap-3">
        <span className="h-10 w-10 animate-spin rounded-full border-2 border-secondary border-t-primary" aria-hidden="true" />
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
