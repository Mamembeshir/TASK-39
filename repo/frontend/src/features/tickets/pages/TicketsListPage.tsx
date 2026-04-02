import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { listTickets } from '@/features/tickets/api/ticketsApi';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { canManageTicketDisputes } from '@/features/tickets/utils/ticketRoles';
import { EmptyState } from '@/shared/components/EmptyState';
import { PageHeader } from '@/shared/components/PageHeader';
import { PageShell } from '@/shared/components/PageShell';
import { AppLoader } from '@/shared/components/AppLoader';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';

export function TicketsListPage() {
  const auth = useAuth();
  const ticketsQuery = useQuery({ queryKey: ['tickets'], queryFn: listTickets });
  const tickets = ticketsQuery.data ?? [];
  const isStaff = canManageTicketDisputes(auth.roles);

  return (
    <PageShell>
      <div className="grid gap-6">
        <PageHeader
          title={isStaff ? 'Dispute queue' : 'Your tickets'}
          description={isStaff ? 'Review active customer issues, SLA risk, and resolution status.' : 'Track support issues tied to your orders.'}
        >
          {!isStaff && <Button asChild><Link to="/catalog">Browse services</Link></Button>}
        </PageHeader>

        {ticketsQuery.isLoading && <AppLoader label="Loading tickets..." />}
        {ticketsQuery.isError && <EmptyState compact showIcon title="Tickets unavailable" description="We couldn't load tickets right now." />}
        {ticketsQuery.isSuccess && tickets.length === 0 && <EmptyState compact showIcon title="No tickets yet" description="Open a support issue from an order when you need help." />}

        {tickets.length > 0 && (
          <div className="grid gap-4">
            {tickets.map((ticket) => (
              <Card key={ticket.id}>
                <CardHeader className="grid gap-3 sm:flex sm:flex-row sm:items-start sm:justify-between">
                  <div className="grid gap-1">
                    <CardTitle>{ticket.category ?? 'Support issue'}</CardTitle>
                    <p className="text-sm text-muted-foreground">Order {ticket.orderId}{isStaff && ticket.customerId ? ` · Customer ${ticket.customerId}` : ''}</p>
                  </div>
                  <span className="rounded-full border border-border bg-muted px-3 py-1 text-xs text-muted-foreground">{ticket.status ?? 'open'}</span>
                </CardHeader>
                <CardContent className="grid gap-3 sm:flex sm:flex-row sm:items-end sm:justify-between">
                  <div className="grid gap-1 text-sm text-muted-foreground">
                    <p>First response due: {ticket.sla?.firstResponseDueAt ? new Date(ticket.sla.firstResponseDueAt).toLocaleString() : '—'}</p>
                    <p>Resolution due: {ticket.sla?.resolutionDueAt ? new Date(ticket.sla.resolutionDueAt).toLocaleString() : '—'}</p>
                  </div>
                  <Button variant="secondary" asChild>
                    <Link to={`/tickets/${ticket.id}`}>Open ticket</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}
