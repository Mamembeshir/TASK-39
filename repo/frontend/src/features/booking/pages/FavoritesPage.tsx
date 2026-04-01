import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { listFavorites, removeFavorite } from '@/features/booking/api/bookingApi';
import { useBooking } from '@/features/booking/store';
import { EmptyState } from '@/shared/components/EmptyState';
import { PageHeader } from '@/shared/components/PageHeader';
import { PageShell } from '@/shared/components/PageShell';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { AppLoader } from '@/shared/components/AppLoader';
import { toast } from 'sonner';

export function FavoritesPage() {
  const favoritesQuery = useQuery({ queryKey: ['favorites'], queryFn: listFavorites });
  const { compareIds, toggleCompare } = useBooking();
  const favorites = favoritesQuery.data ?? [];

  async function handleRemove(serviceId: string) {
    await removeFavorite(serviceId);
    toast.success('Removed from favorites');
    await favoritesQuery.refetch();
  }

  return (
    <PageShell>
      <div className="grid gap-6">
        <PageHeader title="Favorites" description="Keep your shortlisted services in one place, then compare or book when you are ready.">
          <Button variant="secondary" asChild>
            <Link to="/compare">Open compare</Link>
          </Button>
        </PageHeader>

        {favoritesQuery.isLoading && <AppLoader label="Loading favorites..." />}
        {favoritesQuery.isError && <EmptyState compact showIcon title="Favorites unavailable" description="We couldn't load your saved services right now." />}
        {favoritesQuery.isSuccess && favorites.length === 0 && <EmptyState compact showIcon title="No favorites yet" description="Save services from catalog or service detail pages to build your shortlist." />}

        {favorites.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {favorites.map((service) => {
              const isCompared = compareIds.includes(service.id);
              return (
                <Card key={service.id} className="flex h-full flex-col overflow-hidden">
                  <CardHeader className="grid gap-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{service.category ?? 'Service'}</p>
                      <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs text-muted-foreground">Saved</span>
                    </div>
                    <CardTitle className="text-xl">{service.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="grid flex-1 gap-4">
                    <p className="body-base line-clamp-3">{service.description ?? 'No description available.'}</p>
                    <div className="flex flex-wrap gap-2">
                      {(service.tags ?? []).slice(0, 3).map((tag) => (
                        <span key={tag} className="rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground">{tag}</span>
                      ))}
                    </div>
                    <div className="mt-auto flex flex-wrap gap-2">
                      <Button variant="secondary" asChild>
                        <Link to={`/services/${service.id}`}>View details</Link>
                      </Button>
                      <Button variant="ghost" onClick={() => toggleCompare(service.id)}>{isCompared ? 'Remove compare' : 'Add compare'}</Button>
                      <Button variant="ghost" onClick={() => handleRemove(service.id)}>Remove</Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </PageShell>
  );
}
