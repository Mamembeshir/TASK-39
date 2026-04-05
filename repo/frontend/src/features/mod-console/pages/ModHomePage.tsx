import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { listPendingQuestions } from '@/features/catalog/api/catalogApi';
import { listModerationQueue } from '@/features/moderation/api/moderationApi';
import { listTickets } from '@/features/tickets/api/ticketsApi';
import { LayoutShell } from '@/shared/components/LayoutShell';
import { PageHeader } from '@/shared/components/PageHeader';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';

function QueueCard({
  title,
  summary,
  action,
}: {
  title: string;
  summary: string;
  action: { to: string; label: string };
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <p className="body-base">{summary}</p>
        <Button variant="secondary" asChild>
          <Link to={action.to}>{action.label}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export function ModHomePage() {
  const reviewsQuery = useQuery({ queryKey: ['mod-home-reviews'], queryFn: listModerationQueue });
  const questionsQuery = useQuery({ queryKey: ['mod-home-questions'], queryFn: listPendingQuestions });
  const ticketsQuery = useQuery({ queryKey: ['mod-home-tickets'], queryFn: listTickets });

  return (
    <LayoutShell title="Moderation" links={[]}>
      <div className="grid gap-6">
        <PageHeader
          title="Moderation Console"
          description="Review quarantine queues, handle dispute outcomes, and publish vetted customer content."
        />

        <div className="grid gap-4 md:grid-cols-3">
          <QueueCard
            title="Review queue"
            summary={`${reviewsQuery.data?.length ?? 0} reviews are waiting for moderation decisions.`}
            action={{ to: '/mod/reviews', label: 'Open review queue' }}
          />
          <QueueCard
            title="Question queue"
            summary={`${questionsQuery.data?.length ?? 0} customer questions are waiting for an answer or rejection.`}
            action={{ to: '/mod/questions', label: 'Open question queue' }}
          />
          <QueueCard
            title="Dispute queue"
            summary={`${ticketsQuery.data?.length ?? 0} tickets are available for legal hold and final resolution actions.`}
            action={{ to: '/tickets', label: 'Open dispute queue' }}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Coverage</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="body-base">
              Moderation now covers reviews, public Q&amp;A, and ticket dispute handling to keep trust and outcomes aligned.
            </p>
          </CardContent>
        </Card>
      </div>
    </LayoutShell>
  );
}
