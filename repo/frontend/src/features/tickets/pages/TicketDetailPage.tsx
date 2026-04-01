import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { getTicket, resolveTicket, setTicketLegalHold, updateTicketStatus } from '@/features/tickets/api/ticketsApi';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { PageHeader } from '@/shared/components/PageHeader';
import { PageShell } from '@/shared/components/PageShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { cn } from '@/shared/lib/utils';
import { toast } from 'sonner';

function formatDateTime(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

function getCountdownMeta(iso?: string, now = Date.now()) {
  if (!iso) {
    return { label: '—', tone: 'muted' as const, detail: 'No deadline set' };
  }

  const diff = new Date(iso).getTime() - now;
  const absMinutes = Math.ceil(Math.abs(diff) / 60000);
  const days = Math.floor(absMinutes / 1440);
  const hours = Math.floor((absMinutes % 1440) / 60);
  const minutes = absMinutes % 60;
  const parts = [days ? `${days}d` : null, hours ? `${hours}h` : null, `${minutes}m`].filter(Boolean);
  const relative = parts.slice(0, 2).join(' ');

  if (diff <= 0) {
    return { label: `Overdue by ${relative}`, tone: 'danger' as const, detail: `Due ${formatDateTime(iso)}` };
  }
  if (diff <= 60 * 60 * 1000) {
    return { label: relative, tone: 'warning' as const, detail: `Due ${formatDateTime(iso)}` };
  }
  return { label: relative, tone: 'healthy' as const, detail: `Due ${formatDateTime(iso)}` };
}

export function TicketDetailPage() {
  const { id = '' } = useParams();
  const auth = useAuth();
  const ticketQuery = useQuery({ queryKey: ['ticket', id], queryFn: () => getTicket(id) });
  const ticket = ticketQuery.data;
  const attachments = useMemo(() => ticket?.attachmentIds ?? [], [ticket?.attachmentIds]);
  const [now, setNow] = useState(Date.now());
  const [resolutionSummary, setResolutionSummary] = useState('');
  const isStaff = auth.roles.includes('administrator') || auth.roles.includes('service_manager');

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  if (ticketQuery.isLoading) return <PageShell width="narrow"><Skeleton className="h-56" /></PageShell>;
  if (ticketQuery.isError) return <PageShell width="narrow"><p className="body-base">Unable to load ticket.</p></PageShell>;
  if (!ticket) return null;
  const ticketId = ticket.id;
  const legalHoldEnabled = Boolean(ticket.legalHold);

  async function handleStatus(status: string) {
    await updateTicketStatus(ticketId, status);
    toast.success('Ticket status updated');
    await ticketQuery.refetch();
  }

  async function handleLegalHold() {
    await setTicketLegalHold(ticketId, !legalHoldEnabled);
    toast.success(legalHoldEnabled ? 'Legal hold removed' : 'Legal hold enabled');
    await ticketQuery.refetch();
  }

  async function handleResolve() {
    if (!resolutionSummary.trim()) return;
    await resolveTicket(ticketId, { summaryText: resolutionSummary.trim() });
    toast.success('Ticket resolved');
    setResolutionSummary('');
    await ticketQuery.refetch();
  }

  return (
    <PageShell width="narrow">
      <div className="grid gap-6">
        <PageHeader title={`Ticket ${ticket.id}`} description="Review ticket status, SLA timing, and stored attachments." />

        <Card>
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm text-muted-foreground">
            <p>Status: {ticket.status}</p>
            <p>Order: {ticket.orderId}</p>
            <p>Legal hold: {ticket.legalHold ? 'On' : 'Off'}</p>
          </CardContent>
        </Card>

        {isStaff && (
          <Card>
            <CardHeader>
              <CardTitle>Staff actions</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => handleStatus('waiting_on_customer')}>Waiting on customer</Button>
                <Button variant="secondary" onClick={() => handleStatus('open')}>Reopen</Button>
                <Button variant="ghost" onClick={handleLegalHold}>{ticket.legalHold ? 'Remove legal hold' : 'Place legal hold'}</Button>
              </div>
              {!ticket.immutableOutcome && (
                <div className="grid gap-2 sm:max-w-lg">
                  <Input value={resolutionSummary} onChange={(event) => setResolutionSummary(event.target.value)} placeholder="Resolution summary" />
                  <Button onClick={handleResolve} disabled={!resolutionSummary.trim()}>Resolve ticket</Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>SLA</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {[{
              title: 'First response',
              meta: getCountdownMeta(ticket.sla?.firstResponseDueAt, now),
            }, {
              title: 'Resolution',
              meta: getCountdownMeta(ticket.sla?.resolutionDueAt, now),
            }].map((item) => (
              <div key={item.title} className="rounded-xl border border-border/70 bg-background/80 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="grid gap-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{item.title}</p>
                    <p className="text-2xl font-semibold text-foreground">{item.meta.label}</p>
                    <p className="text-sm text-muted-foreground">{item.meta.detail}</p>
                  </div>
                  <span className={cn('rounded-full px-3 py-1 text-xs font-medium', item.meta.tone === 'danger' && 'bg-destructive/10 text-destructive', item.meta.tone === 'warning' && 'bg-primary/10 text-primary', item.meta.tone === 'healthy' && 'bg-accent/70 text-foreground', item.meta.tone === 'muted' && 'bg-muted text-muted-foreground')}>
                    {item.meta.tone === 'danger' ? 'Overdue' : item.meta.tone === 'warning' ? 'Due soon' : item.meta.tone === 'healthy' ? 'On track' : 'Unknown'}
                  </span>
                </div>
              </div>
            ))}

            <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
              <p>Paused: {ticket.sla?.isPaused ? 'Yes' : 'No'}</p>
              <p>Paused at: {formatDateTime(ticket.sla?.pausedAt)}</p>
            </div>
          </CardContent>
        </Card>

        {ticket.immutableOutcome && (
          <Card>
            <CardHeader>
              <CardTitle>Resolved outcome</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm text-muted-foreground">
              <p>{ticket.immutableOutcome.summaryText ?? '—'}</p>
              <p>Resolved at: {ticket.immutableOutcome.resolvedAt ?? '—'}</p>
              <div className="flex flex-wrap gap-2">
                {(ticket.immutableOutcome.attachmentIds ?? []).map((attachmentId) => (
                  <span key={attachmentId} className="rounded-full border border-border bg-muted px-3 py-1 text-xs text-muted-foreground">{attachmentId}</span>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Attachments</CardTitle>
          </CardHeader>
          <CardContent>
            {attachments.length ? (
              <div className="flex flex-wrap gap-2">
                {attachments.map((attachmentId) => (
                  <span key={attachmentId} className="rounded-full border border-border bg-muted px-3 py-1 text-xs text-muted-foreground">{attachmentId}</span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
