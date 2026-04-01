import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { search } from '@/features/search/api/searchApi';
import { PageHeader } from '@/shared/components/PageHeader';
import { EmptyState } from '@/shared/components/EmptyState';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { PageShell } from '@/shared/components/PageShell';
import { Input } from '@/shared/components/ui/input';
import { Pagination } from '@/shared/components/ui/pagination';
import { AppLoader } from '@/shared/components/AppLoader';

export function SearchPage() {
  const [term, setTerm] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 6;
  const query = useQuery({ queryKey: ['search', term], queryFn: () => search(term), enabled: term.length > 0 });
  const results = Array.isArray(query.data) ? query.data : [];
  const totalPages = Math.max(1, Math.ceil(results.length / perPage));
  const currentPage = Math.min(page, totalPages);
  const pagedResults = results.slice((currentPage - 1) * perPage, currentPage * perPage);

  useEffect(() => {
    setPage(1);
  }, [term]);

  return (
    <PageShell width="narrow">
      <div className="grid gap-6">
        <PageHeader title="Search" description="Find services and content." />
        <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search services, guides, and more" />

        {term.length === 0 && <EmptyState compact showIcon title="Start typing to search" description="Use keywords to search published services and content." />}
        {query.isLoading && <AppLoader label="Loading search results..." />}
        {query.isError && <EmptyState title="Search unavailable" description="We couldn't load search results right now." />}
        {query.isSuccess && results.length === 0 && <EmptyState compact showIcon title="No results" description="Try a broader search term." />}

        {query.isSuccess && results.length > 0 && (
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {pagedResults.map((result) => (
                <Card key={`${result.type}-${result.id}`} className="h-full">
                  <CardHeader>
                    <CardTitle>{result.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <span className="inline-flex rounded-full bg-muted px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{result.type}</span>
                    <p className="body-base mt-3">{result.summary}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Pagination page={currentPage} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}
      </div>
    </PageShell>
  );
}
