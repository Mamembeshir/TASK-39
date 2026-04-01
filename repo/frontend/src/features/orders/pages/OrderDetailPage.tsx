import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { getOrder } from '@/features/orders/api/ordersApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { PageShell } from '@/shared/components/PageShell';
import { PageHeader } from '@/shared/components/PageHeader';
import { Button } from '@/shared/components/ui/button';

export function OrderDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const orderQuery = useQuery({ queryKey: ['order', id], queryFn: () => getOrder(id) });

  if (orderQuery.isLoading) return <PageShell width="narrow"><Skeleton className="h-56" /></PageShell>;
  if (orderQuery.isError) return <PageShell width="narrow"><Card><CardHeader><CardTitle>Unable to load order</CardTitle></CardHeader><CardContent><p className="body-base">Please try again in a moment.</p></CardContent></Card></PageShell>;
  if (!orderQuery.data) return null;

  return (
    <PageShell width="narrow">
      <div className="grid gap-6">
        <PageHeader title={`Order ${orderQuery.data.id}`} description="Review the placed order and continue to support if needed." />
        <Card>
          <CardHeader><CardTitle>Order summary</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            <p className="body-base">Status: {orderQuery.data.status}</p>
            <p className="body-base">Total: {orderQuery.data.total}</p>
            <Button onClick={() => navigate(`/tickets/new?orderId=${orderQuery.data.id}`)}>Open ticket</Button>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
