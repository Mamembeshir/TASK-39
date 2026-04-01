import { Toaster as SonnerToaster } from 'sonner';

export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      expand
      closeButton
      visibleToasts={4}
      toastOptions={{
        classNames: {
          toast: 'rounded-2xl border border-border/80 bg-card/95 p-4 text-card-foreground shadow-soft backdrop-blur-sm',
          title: 'text-sm font-semibold text-foreground',
          description: 'mt-1 text-sm text-muted-foreground',
          closeButton: 'rounded-full border border-border bg-card text-muted-foreground transition hover:text-foreground',
          actionButton: 'rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:brightness-95',
          cancelButton: 'rounded-lg border border-border bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground transition hover:bg-muted',
          success: 'border-primary/30',
          error: 'border-destructive/35',
          warning: 'border-primary/30',
          info: 'border-accent/55',
        },
      }}
    />
  );
}
