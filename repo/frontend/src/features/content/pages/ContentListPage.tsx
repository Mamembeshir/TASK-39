import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { listArticles } from '@/features/content/api/contentApi';
import { PageHeader } from '@/shared/components/PageHeader';
import { EmptyState } from '@/shared/components/EmptyState';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { PageShell } from '@/shared/components/PageShell';
import { Pagination } from '@/shared/components/ui/pagination';
import { AppLoader } from '@/shared/components/AppLoader';

export function ContentListPage() {
  const articlesQuery = useQuery({ queryKey: ['content'], queryFn: listArticles });
  const articles = Array.isArray(articlesQuery.data) ? articlesQuery.data : [];
  const [page, setPage] = useState(1);
  const perPage = 6;
  const totalPages = Math.max(1, Math.ceil(articles.length / perPage));
  const currentPage = Math.min(page, totalPages);
  const pagedArticles = articles.slice((currentPage - 1) * perPage, currentPage * perPage);

  return (
    <PageShell>
      <div className="grid gap-6">
        <PageHeader title="Content" description="Knowledge hub articles." />

        {articlesQuery.isLoading && <AppLoader label="Loading content..." />}
        {articlesQuery.isError && <EmptyState title="Content unavailable" description="We couldn't load articles right now." />}
        {articlesQuery.isSuccess && articles.length === 0 && <EmptyState compact showIcon title="No articles yet" description="Published guides and announcements will appear here." />}

        {articlesQuery.isSuccess && articles.length > 0 && (
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {pagedArticles.map((article) => (
                <Card key={article.id} className="h-full">
                  <CardHeader>
                    <CardTitle>{article.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3">
                    <p className="body-base">{article.summary}</p>
                    <Link className="inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline" to={`/content/${article.id}`}>
                      Read article
                    </Link>
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
