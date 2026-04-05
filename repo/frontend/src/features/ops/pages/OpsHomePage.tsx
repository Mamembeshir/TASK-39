import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { listServices } from '@/features/catalog/api/catalogApi';
import { listArticles } from '@/features/content/api/contentApi';
import { listTickets } from '@/features/tickets/api/ticketsApi';
import { LayoutShell } from '@/shared/components/LayoutShell';
import { PageHeader } from '@/shared/components/PageHeader';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';

type OpsCardProps = {
  title: string;
  summary: string;
  actions: Array<{ to: string; label: string; variant?: 'secondary' | 'ghost' }>;
};

function OpsCard({ title, summary, actions }: OpsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <p className="body-base">{summary}</p>
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <Button key={`${title}-${action.to}`} variant={action.variant ?? 'secondary'} asChild>
              <Link to={action.to}>{action.label}</Link>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function OpsHomePage() {
  const ticketsQuery = useQuery({ queryKey: ['ops-tickets'], queryFn: listTickets });
  const servicesQuery = useQuery({ queryKey: ['ops-services'], queryFn: () => listServices() });
  const contentQuery = useQuery({ queryKey: ['ops-content'], queryFn: listArticles });

  return (
    <LayoutShell title="Ops" links={[]}>
      <div className="grid gap-6">
        <PageHeader title="Ops Console" description="Catalog setup, publishing handoff, and dispute handling." />

        <div className="grid gap-4 md:grid-cols-3">
          <OpsCard
            title="Catalog setup"
            summary={`${servicesQuery.data?.length ?? 0} services are currently visible in the catalog. Use the live catalog to verify published setup.`}
            actions={[
              { to: '/ops/catalog', label: 'Open catalog console', variant: 'secondary' },
              { to: '/catalog', label: 'Preview catalog', variant: 'ghost' },
            ]}
          />
          <OpsCard
            title="Content publishing"
            summary={`${contentQuery.data?.length ?? 0} content entries are available in the customer-facing knowledge hub.`}
            actions={[
              { to: '/ops/content', label: 'Open content studio', variant: 'secondary' },
              { to: '/content', label: 'Preview published hub', variant: 'ghost' },
              { to: '/ops/messages', label: 'Compose staff message', variant: 'ghost' },
            ]}
          />
          <OpsCard
            title="Dispute handling"
            summary={`${ticketsQuery.data?.length ?? 0} tickets are in the shared queue with SLA visibility.`}
            actions={[
              { to: '/tickets', label: 'Open dispute queue', variant: 'secondary' },
              { to: '/tickets/new', label: 'Open manual ticket', variant: 'ghost' },
            ]}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Capacity slots</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <p className="body-base">
              Manage upcoming booking capacity and keep the quote flow aligned with real availability.
            </p>
            <Button variant="secondary" asChild>
              <Link to="/ops/slots">Open slot manager</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </LayoutShell>
  );
}
