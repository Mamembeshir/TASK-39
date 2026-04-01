import type { PropsWithChildren } from 'react';
import { Suspense, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { AppLoader } from '@/shared/components/AppLoader';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';

type NavItem = {
  to: string;
  label: string;
  group: 'core' | 'console';
  roles?: string[];
};

const navItems: NavItem[] = [
  { to: '/catalog', label: 'Catalog', group: 'core' },
  { to: '/favorites', label: 'Favorites', group: 'core' },
  { to: '/search', label: 'Search', group: 'core' },
  { to: '/inbox', label: 'Inbox', group: 'core' },
  { to: '/content', label: 'Content', group: 'core' },
  { to: '/admin', label: 'Admin', group: 'console', roles: ['administrator'] },
  { to: '/ops', label: 'Ops', group: 'console', roles: ['service_manager', 'administrator'] },
  { to: '/mod', label: 'Mod', group: 'console', roles: ['moderator', 'administrator'] },
];

export function AppLayout({ children }: PropsWithChildren) {
  const auth = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    await auth.logout();
    navigate('/login', { replace: true });
  }

  const visibleNavItems = useMemo(
    () => navItems.filter((item) => !item.roles || item.roles.some((role) => auth.roles.includes(role))),
    [auth.roles],
  );
  const coreNavItems = useMemo(() => visibleNavItems.filter((item) => item.group === 'core'), [visibleNavItems]);
  const consoleNavItems = useMemo(() => visibleNavItems.filter((item) => item.group === 'console'), [visibleNavItems]);

  const linkClassName = ({ isActive }: { isActive: boolean }) => cn(
    'inline-flex min-h-11 items-center rounded-lg border border-transparent px-3 text-sm font-medium transition',
    isActive
      ? 'border-border/70 bg-muted text-foreground'
      : 'text-muted-foreground hover:bg-background hover:text-foreground',
  );

  return (
    <div className="min-h-screen bg-background text-foreground lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="hidden border-r border-border bg-card lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <div className="border-b border-border px-6 py-6">
          <Link to="/catalog" className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-soft">H</div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">HomeCareOps</p>
              <p className="text-sm text-muted-foreground">Service workspace</p>
            </div>
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5">
          <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Main</p>
          <nav className="mt-2 grid gap-1">
            {coreNavItems.map((item) => (
              <NavLink key={item.to} to={item.to} className={linkClassName}>{item.label}</NavLink>
            ))}
          </nav>

          {consoleNavItems.length > 0 && (
            <>
              <p className="mt-6 px-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Consoles</p>
              <nav className="mt-2 grid gap-1">
                {consoleNavItems.map((item) => (
                  <NavLink key={item.to} to={item.to} className={linkClassName}>{item.label}</NavLink>
                ))}
              </nav>
            </>
          )}
        </div>

        <div className="border-t border-border px-4 py-4">
          {auth.user ? (
            <div className="grid gap-3">
              <p className="truncate rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted-foreground">{auth.user.username}</p>
              <Button variant="secondary" className="w-full" onClick={handleLogout}>Logout</Button>
            </div>
          ) : (
            <Button variant="secondary" className="w-full" asChild>
              <Link to="/login">Login</Link>
            </Button>
          )}
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:h-20 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2 lg:hidden">
              <Button variant="secondary" className="min-h-11 px-3" onClick={() => setMobileOpen((open) => !open)}>
                Menu
              </Button>
              <Link to="/catalog" className="flex items-center gap-2">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground shadow-soft">H</div>
                <span className="text-sm font-medium text-foreground">HomeCareOps</span>
              </Link>
            </div>

            <div className="hidden lg:grid">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Workspace</p>
              <p className="text-sm text-muted-foreground">Customer and operations dashboard</p>
            </div>

            <div className="lg:hidden">
              {auth.user ? (
                <Button variant="ghost" className="min-h-11" onClick={handleLogout}>Logout</Button>
              ) : (
                <Button variant="ghost" className="min-h-11" asChild>
                  <Link to="/login">Login</Link>
                </Button>
              )}
            </div>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children ?? (
            <Suspense fallback={<AppLoader label="Loading page..." />}>
              <Outlet />
            </Suspense>
          )}
        </main>
      </div>

      {mobileOpen && <button type="button" className="fixed inset-0 z-30 bg-foreground/20 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close menu" />}
      <aside className={cn('fixed inset-y-0 left-0 z-40 w-72 border-r border-border bg-card p-5 shadow-soft transition-transform lg:hidden', mobileOpen ? 'translate-x-0' : '-translate-x-full')}>
        <div className="grid h-full grid-rows-[auto_1fr_auto] gap-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">Navigate</p>
            <Button variant="ghost" className="min-h-11" onClick={() => setMobileOpen(false)}>Close</Button>
          </div>

          <div className="grid content-start gap-5 overflow-y-auto">
            <div>
              <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Main</p>
              <nav className="mt-2 grid gap-1">
                {coreNavItems.map((item) => (
                  <NavLink key={item.to} to={item.to} onClick={() => setMobileOpen(false)} className={linkClassName}>{item.label}</NavLink>
                ))}
              </nav>
            </div>

            {consoleNavItems.length > 0 && (
              <div>
                <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Consoles</p>
                <nav className="mt-2 grid gap-1">
                  {consoleNavItems.map((item) => (
                    <NavLink key={item.to} to={item.to} onClick={() => setMobileOpen(false)} className={linkClassName}>{item.label}</NavLink>
                  ))}
                </nav>
              </div>
            )}
          </div>

          {auth.user ? (
            <div className="grid gap-3 border-t border-border pt-4">
              <p className="truncate rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted-foreground">{auth.user.username}</p>
              <Button
                variant="secondary"
                className="w-full"
                onClick={async () => {
                  await handleLogout();
                  setMobileOpen(false);
                }}
              >
                Logout
              </Button>
            </div>
          ) : (
            <Button variant="secondary" className="w-full" asChild>
              <Link to="/login" onClick={() => setMobileOpen(false)}>Login</Link>
            </Button>
          )}
        </div>
      </aside>
    </div>
  );
}
