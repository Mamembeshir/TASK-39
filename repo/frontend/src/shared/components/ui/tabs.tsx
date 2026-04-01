import type { PropsWithChildren } from 'react';

export function Tabs({ children }: PropsWithChildren) { return <div>{children}</div>; }
export function TabsList({ children }: PropsWithChildren) { return <div className="inline-flex rounded-xl bg-muted p-1">{children}</div>; }
export function TabsTrigger({ children }: PropsWithChildren) { return <button className="rounded-lg px-3 py-1 text-sm">{children}</button>; }
export function TabsContent({ children }: PropsWithChildren) { return <div className="pt-4">{children}</div>; }
