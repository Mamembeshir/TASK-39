import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { listServices } from '@/features/catalog/api/catalogApi';
import { ServiceCard } from '@/features/catalog/components/ServiceCard';
import { PageShell } from '@/shared/components/PageShell';
import { Input } from '@/shared/components/ui/input';
import { EmptyState } from '@/shared/components/EmptyState';
import { PageHeader } from '@/shared/components/PageHeader';
import { Pagination } from '@/shared/components/ui/pagination';
import { AppLoader } from '@/shared/components/AppLoader';

function formatCategoryLabel(category: string) {
  return category
    .split('_')
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ');
}

export function CatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const category = searchParams.get('category') ?? '';
  const tags = searchParams.get('tags') ?? '';
  const perPage = 9;

  const servicesQuery = useQuery({
    queryKey: ['catalog', category, tags],
    queryFn: () => listServices({ category: category || undefined, tags: tags || undefined }),
  });
  const categoriesQuery = useQuery({
    queryKey: ['catalog-categories'],
    queryFn: () => listServices(),
  });

  const categoryOptions = useMemo(() => {
    const categories = Array.from(
      new Set((categoriesQuery.data ?? []).map((service) => service.category).filter((value): value is string => Boolean(value))),
    ).sort();

    return [
      { value: '', label: 'All categories' },
      ...categories.map((value) => ({ value, label: formatCategoryLabel(value) })),
    ];
  }, [categoriesQuery.data]);

  const tagValue = useMemo(() => tags, [tags]);
  const services = Array.isArray(servicesQuery.data) ? servicesQuery.data : [];
  const totalPages = Math.max(1, Math.ceil(services.length / perPage));
  const currentPage = Math.min(page, totalPages);
  const pagedServices = services.slice((currentPage - 1) * perPage, currentPage * perPage);

  useEffect(() => {
    setPage(1);
  }, [category, tags]);

  return (
    <PageShell>
      <div className="grid gap-6">
        <PageHeader title="Catalog" description="Browse services and refine results by category or tags." />
        <div className="grid gap-4 md:grid-cols-[240px_minmax(0,1fr)]">
          <select
            className="h-11 rounded-xl border border-input bg-background px-3 text-sm shadow-soft outline-none"
            value={category}
            onChange={(e) => setSearchParams((current) => {
              const next = new URLSearchParams(current);
              e.target.value ? next.set('category', e.target.value) : next.delete('category');
              return next;
            })}
          >
            {categoryOptions.map((option) => (
              <option key={option.value || 'all'} value={option.value}>{option.label}</option>
            ))}
          </select>
          <Input
            value={tagValue}
            placeholder="Tags comma separated"
            onChange={(e) => setSearchParams((current) => {
              const next = new URLSearchParams(current);
              e.target.value ? next.set('tags', e.target.value) : next.delete('tags');
              return next;
            })}
          />
        </div>

        {servicesQuery.isLoading && <AppLoader label="Loading catalog..." />}
        {servicesQuery.isError && <EmptyState title="Catalog unavailable" description="We couldn't load the service list just now. Please try again." />}
        {servicesQuery.isSuccess && services.length === 0 && (
          <EmptyState
            compact
            showIcon
            title="No services match filters"
            description="Try clearing tags or choosing another category."
          />
        )}
        {servicesQuery.isSuccess && services.length > 0 && (
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {pagedServices.map((service) => <ServiceCard key={service.id} service={service} />)}
            </div>
            <Pagination page={currentPage} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}
      </div>
    </PageShell>
  );
}
