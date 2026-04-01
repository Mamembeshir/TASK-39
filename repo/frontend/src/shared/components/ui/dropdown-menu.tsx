import type { PropsWithChildren } from 'react';

export function DropdownMenu({ children }: PropsWithChildren) { return <div>{children}</div>; }
export function DropdownMenuTrigger({ children }: PropsWithChildren) { return <div>{children}</div>; }
export function DropdownMenuContent({ children }: PropsWithChildren) { return <div className="rounded-xl border bg-card p-2 shadow-soft">{children}</div>; }
export function DropdownMenuItem({ children }: PropsWithChildren) { return <button className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted">{children}</button>; }
