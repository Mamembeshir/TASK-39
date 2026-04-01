import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { LayoutShell } from '@/shared/components/LayoutShell';
import { PageHeader } from '@/shared/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { listPendingQuestions } from '@/features/catalog/api/catalogApi';
import { listModerationQueue } from '@/features/moderation/api/moderationApi';

export function ModHomePage() {
  const reviewsQuery = useQuery({ queryKey: ['mod-home-reviews'], queryFn: listModerationQueue });
  const questionsQuery = useQuery({ queryKey: ['mod-home-questions'], queryFn: listPendingQuestions });

  return <LayoutShell title="Moderation" links={[]}><div className="grid gap-6"><PageHeader title="Moderation Console" description="Review quarantine queues and publish vetted customer content." /><div className="grid gap-4 md:grid-cols-2"><Card><CardHeader><CardTitle>Review queue</CardTitle></CardHeader><CardContent className="grid gap-3"><p className="body-base">{reviewsQuery.data?.length ?? 0} reviews are waiting for moderation decisions.</p><Button variant="secondary" asChild><Link to="/mod/reviews">Open review queue</Link></Button></CardContent></Card><Card><CardHeader><CardTitle>Question queue</CardTitle></CardHeader><CardContent className="grid gap-3"><p className="body-base">{questionsQuery.data?.length ?? 0} customer questions are waiting for an answer or rejection.</p><Button variant="secondary" asChild><Link to="/mod/questions">Open question queue</Link></Button></CardContent></Card></div><Card><CardHeader><CardTitle>Coverage</CardTitle></CardHeader><CardContent><p className="body-base">Moderation now covers both review content and public service questions, so customer-facing trust signals are reviewed before publication.</p></CardContent></Card></div></LayoutShell>;
}
