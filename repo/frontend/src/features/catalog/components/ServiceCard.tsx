import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import type { ServiceSummary } from '@/features/catalog/api/catalogApi';
import { useBooking } from '@/features/booking/store';
import { addFavorite, removeFavorite } from '@/features/booking/api/bookingApi';
import { toast } from 'sonner';

export function ServiceCard({ service }: { service: ServiceSummary }) {
  const { compareIds, toggleCompare } = useBooking();
  const isCompared = compareIds.includes(service.id);

  async function handleFavorite() {
    try {
      await addFavorite(service.id);
      toast.success('Added to favorites');
    } catch {
      await removeFavorite(service.id);
      toast.success('Removed from favorites');
    }
  }

  return (
    <Card className="group flex h-full flex-col overflow-hidden transition hover:-translate-y-0.5 hover:border-primary/30">
      <CardHeader className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{service.category ?? 'Service'}</p>
          <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs text-muted-foreground">Custom quote</span>
        </div>
        <CardTitle className="text-xl">{service.title}</CardTitle>
      </CardHeader>
      <CardContent className="grid flex-1 gap-4 pt-0">
        <p className="body-base line-clamp-3">{service.description}</p>
        <div className="rounded-xl border border-border/70 bg-background/70 px-3 py-2.5">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Pricing</p>
          <p className="mt-1 text-sm font-medium text-foreground">Final quote is calculated in checkout based on scope.</p>
        </div>
        <div className="mt-auto flex flex-wrap gap-2">
          <Button variant="secondary" asChild>
            <Link to={`/services/${service.id}`}>View details</Link>
          </Button>
          <Button variant="ghost" onClick={() => toggleCompare(service.id)}>{isCompared ? 'Remove compare' : 'Compare'}</Button>
          <Button variant="ghost" onClick={handleFavorite}>Favorite</Button>
        </div>
      </CardContent>
    </Card>
  );
}
