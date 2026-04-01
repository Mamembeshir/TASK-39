import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listInbox, markInboxRead } from '@/features/inbox/api/inboxApi';
import { PageHeader } from '@/shared/components/PageHeader';
import { EmptyState } from '@/shared/components/EmptyState';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { PageShell } from '@/shared/components/PageShell';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import { toast } from 'sonner';
import { Pagination } from '@/shared/components/ui/pagination';
import { AppLoader } from '@/shared/components/AppLoader';

export function InboxPage() {
  const inboxQuery = useQuery({ queryKey: ['inbox'], queryFn: listInbox });
  const messages = Array.isArray(inboxQuery.data) ? inboxQuery.data : [];
  const [page, setPage] = useState(1);
  const perPage = 6;
  const totalPages = Math.max(1, Math.ceil(messages.length / perPage));
  const currentPage = Math.min(page, totalPages);
  const pagedMessages = messages.slice((currentPage - 1) * perPage, currentPage * perPage);

  return (
    <PageShell width="narrow">
      <div className="grid gap-6">
        <PageHeader title="Inbox" description="Unread items are highlighted." />

        {inboxQuery.isLoading && <AppLoader label="Loading inbox..." />}
        {inboxQuery.isError && <EmptyState title="Inbox unavailable" description="We couldn't load your inbox right now." />}
        {inboxQuery.isSuccess && messages.length === 0 && <EmptyState compact showIcon title="Inbox is empty" description="Announcements and direct messages will show up here." />}

        {inboxQuery.isSuccess && messages.length > 0 && (
          <div className="grid gap-4">
            {pagedMessages.map((item) => (
              <Card key={item.id} className={cn('overflow-hidden transition', item.isRead ? 'opacity-80' : 'border-primary/20')}>
                <CardHeader className="grid gap-2 sm:flex sm:flex-row sm:items-start sm:justify-between">
                  <div className="grid gap-1">
                    <div className="flex items-center gap-2">
                      {!item.isRead && <span className="h-2.5 w-2.5 rounded-full bg-primary/65" aria-hidden="true" />}
                      <CardTitle>{item.title}</CardTitle>
                    </div>
                    <p className="text-sm text-muted-foreground">{item.publishAt ? new Date(item.publishAt).toLocaleString() : 'Just now'}</p>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4 border-t border-border/60 pt-4 sm:grid-cols-[1fr_auto] sm:items-end">
                  <p className="body-base">{item.body}</p>
                  {!item.isRead && (
                    <Button
                      variant="secondary"
                      className="w-fit"
                      onClick={async () => {
                        await markInboxRead(item.id);
                        toast.success('Marked as read');
                        await inboxQuery.refetch();
                      }}
                    >
                      Mark read
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}

            <Pagination page={currentPage} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}
      </div>
    </PageShell>
  );
}
