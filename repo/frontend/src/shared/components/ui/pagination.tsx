import type { PropsWithChildren } from 'react';
import { Button } from '@/shared/components/ui/button';

export function Pagination({ page, totalPages, onPageChange }: { page: number; totalPages: number; onPageChange: (page: number) => void }) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-soft">
      <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Previous</Button>
        {pages.map((p) => <Button key={p} variant={p === page ? 'default' : 'ghost'} onClick={() => onPageChange(p)}>{p}</Button>)}
        <Button variant="secondary" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>Next</Button>
      </div>
    </div>
  );
}
