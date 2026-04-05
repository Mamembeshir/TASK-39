import { useState } from 'react';
import { LayoutShell } from '@/shared/components/LayoutShell';
import { PageHeader } from '@/shared/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { createStaffMessage } from '@/features/inbox/api/inboxApi';
import { showApiError } from '@/shared/lib/showApiError';
import { toast } from 'sonner';

function csvToArray(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function OpsMessagesPage() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [publishAt, setPublishAt] = useState('');
  const [rolesCsv, setRolesCsv] = useState('customer, moderator');
  const [recipientUserId, setRecipientUserId] = useState('');
  const [sending, setSending] = useState(false);

  async function submit() {
    if (!title.trim() || !body.trim()) {
      toast.error('Title and body are required');
      return;
    }

    setSending(true);
    try {
      const result = await createStaffMessage({
        title,
        body,
        publishAt: publishAt || undefined,
        roles: csvToArray(rolesCsv),
        recipientUserId: recipientUserId.trim() || undefined,
      });
      toast.success(`Message scheduled/created: ${result.id}`);
      setTitle('');
      setBody('');
      setPublishAt('');
      setRecipientUserId('');
    } catch (error) {
      toast.error(showApiError(error));
    } finally {
      setSending(false);
    }
  }

  return (
    <LayoutShell title="Ops" links={[]}>
      <div className="grid gap-6">
        <PageHeader
          title="Staff Message Composer"
          description="Schedule announcements or send role-targeted/direct inbox messages to customers and staff."
        />

        <Card>
          <CardHeader>
            <CardTitle>Create staff message</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2 md:grid-cols-2">
              <label className="grid gap-1 md:col-span-2">
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Announcement title" />
              </label>
              <label className="grid gap-1 md:col-span-2">
                <Label>Body</Label>
                <textarea
                  className="min-h-32 rounded-xl border border-border bg-background p-3 text-sm"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Message body"
                />
              </label>
              <label className="grid gap-1">
                <Label>Publish at (optional)</Label>
                <Input type="datetime-local" value={publishAt} onChange={(e) => setPublishAt(e.target.value)} />
              </label>
              <label className="grid gap-1">
                <Label>Roles (csv)</Label>
                <Input value={rolesCsv} onChange={(e) => setRolesCsv(e.target.value)} placeholder="customer, moderator" />
              </label>
              <label className="grid gap-1 md:col-span-2">
                <Label>Recipient user id (optional)</Label>
                <Input value={recipientUserId} onChange={(e) => setRecipientUserId(e.target.value)} placeholder="Direct message to a user id" />
              </label>
            </div>

            <p className="text-sm text-muted-foreground">
              Use roles for broad announcements, or specify a recipient user id for a direct inbox message. The backend will validate the target.
            </p>

            <div className="flex flex-wrap gap-2">
              <Button onClick={submit} disabled={sending}>{sending ? 'Sending…' : 'Create message'}</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </LayoutShell>
  );
}
