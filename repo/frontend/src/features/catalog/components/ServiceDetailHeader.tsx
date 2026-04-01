import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import type { ServiceDetail } from '@/features/catalog/api/catalogApi';
import { addFavorite, removeFavorite } from '@/features/booking/api/bookingApi';
import { Button } from '@/shared/components/ui/button';
import { toast } from 'sonner';

export function ServiceDetailHeader({ service }: { service: ServiceDetail }) {
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
    <Card>
      <CardHeader>
        <CardTitle>{service.title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="body-base text-foreground">{service.description}</p>
        <p className="text-sm text-muted-foreground">{service.category}</p>
        <div>
          <Button variant="secondary" onClick={handleFavorite}>Favorite</Button>
        </div>
      </CardContent>
    </Card>
  );
}
