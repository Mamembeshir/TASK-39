import type { PropsWithChildren } from 'react';

export function Dialog({ children }: PropsWithChildren) { return <div>{children}</div>; }
export function DialogContent({ children }: PropsWithChildren) { return <div className="rounded-2xl border bg-card p-6 shadow-soft">{children}</div>; }
export function DialogTitle({ children }: PropsWithChildren) { return <h3 className="text-lg font-semibold">{children}</h3>; }
