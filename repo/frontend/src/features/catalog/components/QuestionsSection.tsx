import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { submitServiceQuestion, type ServiceQuestion } from '@/features/catalog/api/catalogApi';
import { Button } from '@/shared/components/ui/button';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { toast } from 'sonner';

export function QuestionsSection({ questions, serviceId, onSubmitted }: { questions: ServiceQuestion[]; serviceId: string; onSubmitted?: () => Promise<void> | void }) {
  const auth = useAuth();
  const [question, setQuestion] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!question.trim()) return;
    try {
      setSubmitting(true);
      await submitServiceQuestion(serviceId, question.trim());
      setQuestion('');
      toast.success('Question submitted for moderation');
      await onSubmitted?.();
    } catch (error) {
      toast.error((error as { message?: string })?.message ?? 'Unable to submit question');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Q&A</CardTitle></CardHeader>
      <CardContent className="grid gap-4">
        {auth.user && (
          <div className="grid gap-2 rounded-xl border border-border bg-background p-4">
            <p className="text-sm font-medium text-foreground">Ask a question</p>
            <textarea className="min-h-24 rounded-xl border border-border bg-card p-3 text-sm" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about materials, prep steps, or service expectations" />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">Questions are reviewed before they appear publicly.</p>
              <Button disabled={submitting || !question.trim()} onClick={handleSubmit}>{submitting ? 'Submitting...' : 'Submit question'}</Button>
            </div>
          </div>
        )}
        {questions.length ? questions.map((q) => <div key={q.id}><strong>{q.question}</strong><p>{q.answer ?? 'No answer provided yet.'}</p></div>) : <p>No questions yet.</p>}
      </CardContent>
    </Card>
  );
}
