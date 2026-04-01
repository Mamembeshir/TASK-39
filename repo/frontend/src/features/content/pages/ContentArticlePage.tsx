import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { getArticle } from '@/features/content/api/contentApi';
import { PageHeader } from '@/shared/components/PageHeader';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { PageShell } from '@/shared/components/PageShell';
import { EmptyState } from '@/shared/components/EmptyState';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';

export function ContentArticlePage() {
  const { id = '' } = useParams();
  const articleQuery = useQuery({ queryKey: ['content', id], queryFn: () => getArticle(id) });
  if (articleQuery.isLoading) return <PageShell width="narrow"><Skeleton className="h-56" /></PageShell>;
  if (articleQuery.isError || !articleQuery.data) return <PageShell width="narrow"><EmptyState title="Article unavailable" description="We couldn't load this article right now." /></PageShell>;
  return <PageShell width="narrow"><div className="grid gap-6"><PageHeader title={articleQuery.data.title} description={articleQuery.data.summary} /><Card><CardHeader><CardTitle>Article</CardTitle></CardHeader><CardContent><article className="whitespace-pre-wrap text-base leading-7 text-muted-foreground">{articleQuery.data.body}</article></CardContent></Card></div></PageShell>;
}
