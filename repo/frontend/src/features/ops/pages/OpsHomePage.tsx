import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { LayoutShell } from '@/shared/components/LayoutShell';
import { PageHeader } from '@/shared/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { listTickets } from '@/features/tickets/api/ticketsApi';
import { listServices } from '@/features/catalog/api/catalogApi';
import { listArticles } from '@/features/content/api/contentApi';

export function OpsHomePage() {
  const ticketsQuery = useQuery({ queryKey: ['ops-tickets'], queryFn: listTickets });
  const servicesQuery = useQuery({ queryKey: ['ops-services'], queryFn: () => listServices() });
  const contentQuery = useQuery({ queryKey: ['ops-content'], queryFn: listArticles });

  return <LayoutShell title="Ops" links={[]}><div className="grid gap-6"><PageHeader title="Ops Console" description="Catalog setup, publishing handoff, and dispute handling." /><div className="grid gap-4 md:grid-cols-3"><Card><CardHeader><CardTitle>Catalog setup</CardTitle></CardHeader><CardContent className="grid gap-3"><p className="body-base">{servicesQuery.data?.length ?? 0} services are currently visible in the catalog. Use the live catalog to verify published setup.</p><div className="flex flex-wrap gap-2"><Button variant="secondary" asChild><Link to="/catalog">Open catalog</Link></Button><Button variant="ghost" asChild><Link to="/compare">Check compare flow</Link></Button></div></CardContent></Card><Card><CardHeader><CardTitle>Content publishing</CardTitle></CardHeader><CardContent className="grid gap-3"><p className="body-base">{contentQuery.data?.length ?? 0} content entries are available in the customer-facing knowledge hub.</p><div className="flex flex-wrap gap-2"><Button variant="secondary" asChild><Link to="/ops/content">Open content studio</Link></Button><Button variant="ghost" asChild><Link to="/content">Preview published hub</Link></Button></div></CardContent></Card><Card><CardHeader><CardTitle>Dispute handling</CardTitle></CardHeader><CardContent className="grid gap-3"><p className="body-base">{ticketsQuery.data?.length ?? 0} tickets are in the shared queue with SLA visibility.</p><div className="flex flex-wrap gap-2"><Button variant="secondary" asChild><Link to="/tickets">Open dispute queue</Link></Button><Button variant="ghost" asChild><Link to="/tickets/new">Open manual ticket</Link></Button></div></CardContent></Card></div><Card><CardHeader><CardTitle>Capacity slots</CardTitle></CardHeader><CardContent className="grid gap-3"><p className="body-base">Manage upcoming booking capacity and keep the quote flow aligned with real availability.</p><Button variant="secondary" asChild><Link to="/ops/slots">Open slot manager</Link></Button></CardContent></Card></div></LayoutShell>;
}
