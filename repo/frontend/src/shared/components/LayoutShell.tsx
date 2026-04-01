import type { PropsWithChildren } from 'react';

export function LayoutShell({ title, links, children }: PropsWithChildren<{ title: string; links: Array<{ to: string; label: string }> }>) {
  return (
    <section aria-label={title} data-links={links.length} className="px-0 py-0">{children}</section>
  );
}
