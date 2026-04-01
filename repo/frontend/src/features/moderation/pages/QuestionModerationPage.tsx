import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listPendingQuestions, publishQuestion, rejectQuestion } from '@/features/catalog/api/catalogApi';
import { LayoutShell } from '@/shared/components/LayoutShell';
import { PageHeader } from '@/shared/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';

export function QuestionModerationPage() {
  const questionsQuery = useQuery({ queryKey: ['moderation-questions'], queryFn: listPendingQuestions });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const questions = questionsQuery.data ?? [];

  async function handlePublish(id: string) {
    const answer = answers[id]?.trim();
    if (!answer) return;
    await publishQuestion(id, answer);
    await questionsQuery.refetch();
  }

  async function handleReject(id: string) {
    await rejectQuestion(id);
    await questionsQuery.refetch();
  }

  return (
    <LayoutShell title="Question Moderation" links={[]}>
      <div className="grid gap-6">
        <PageHeader title="Question moderation" description="Review customer questions and publish a vetted answer when ready." />
        {questions.length === 0 ? (
          <Card>
            <CardHeader><CardTitle>No pending questions</CardTitle></CardHeader>
            <CardContent><p className="body-base">New customer questions will appear here for review.</p></CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {questions.map((question) => (
              <Card key={question.id}>
                <CardHeader>
                  <CardTitle>{question.question}</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <p className="text-sm text-muted-foreground">Service: {question.serviceId ?? '—'} · Submitted {question.createdAt ? new Date(question.createdAt).toLocaleString() : 'recently'}</p>
                  <Input value={answers[question.id] ?? ''} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))} placeholder="Write the published answer" />
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => handlePublish(question.id)} disabled={!answers[question.id]?.trim()}>Publish answer</Button>
                    <Button variant="secondary" onClick={() => handleReject(question.id)}>Reject</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </LayoutShell>
  );
}
