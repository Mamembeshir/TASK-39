import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { listPendingQuestions } from '@/features/catalog/api/catalogApi';
import { listModerationQueue } from '@/features/moderation/api/moderationApi';
import { listTickets } from '@/features/tickets/api/ticketsApi';
import { listAuditLogs, listBlacklist, upsertBlacklist } from '@/features/admin/api/adminApi';
import { LayoutShell } from '@/shared/components/LayoutShell';
import { PageHeader } from '@/shared/components/PageHeader';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';

type ConsoleCardProps = {
  title: string;
  description: string;
  actions: Array<{ to: string; label: string; variant?: 'secondary' | 'ghost' }>;
};

function ConsoleCard({ title, description, actions }: ConsoleCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <p className="body-base">{description}</p>
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <Button key={`${title}-${action.to}`} variant={action.variant ?? 'secondary'} asChild>
              <Link to={action.to}>{action.label}</Link>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function AdminHomePage() {
  const reviewsQuery = useQuery({ queryKey: ['admin-review-queue'], queryFn: listModerationQueue });
  const questionsQuery = useQuery({ queryKey: ['admin-question-queue'], queryFn: listPendingQuestions });
  const ticketsQuery = useQuery({ queryKey: ['admin-tickets'], queryFn: listTickets });
  const auditQuery = useQuery({ queryKey: ['admin-audit'], queryFn: listAuditLogs });
  const blacklistQuery = useQuery({ queryKey: ['admin-blacklist'], queryFn: listBlacklist });

  const [blacklistType, setBlacklistType] = useState<'ip' | 'user'>('ip');
  const [blacklistValue, setBlacklistValue] = useState('');

  async function handleBlacklist(active: boolean) {
    if (!blacklistValue.trim()) {
      return;
    }

    await upsertBlacklist({
      type: blacklistType,
      value: blacklistValue.trim(),
      active,
    });
    toast.success(active ? 'Blacklist entry saved' : 'Blacklist entry deactivated');
    setBlacklistValue('');
    await blacklistQuery.refetch();
  }

  const blacklistEntries = blacklistQuery.data ?? [];
  const auditEntries = auditQuery.data ?? [];

  return (
    <LayoutShell title="Admin" links={[]}>
      <div className="grid gap-6">
        <PageHeader title="Admin Console" description="Policy, safety, and cross-team oversight." />

        <div className="grid gap-4 md:grid-cols-3">
          <ConsoleCard
            title="Operations"
            description="Catalog, content, and dispute workflows live in the ops console."
            actions={[
              { to: '/ops', label: 'Open ops console', variant: 'secondary' },
              { to: '/ops/content', label: 'Content studio', variant: 'ghost' },
            ]}
          />
          <ConsoleCard
            title="Moderation"
            description={`${reviewsQuery.data?.length ?? 0} reviews and ${questionsQuery.data?.length ?? 0} customer questions are waiting for moderation.`}
            actions={[{ to: '/mod', label: 'Open moderation console', variant: 'secondary' }]}
          />
          <ConsoleCard
            title="Disputes"
            description={`${ticketsQuery.data?.length ?? 0} tickets are visible in the shared dispute queue.`}
            actions={[{ to: '/tickets', label: 'Open dispute queue', variant: 'secondary' }]}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Blacklist controls</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid gap-2 sm:grid-cols-[120px_minmax(0,1fr)]">
                <select
                  className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none"
                  value={blacklistType}
                  onChange={(event) => setBlacklistType(event.target.value as 'ip' | 'user')}
                >
                  <option value="ip">IP</option>
                  <option value="user">User</option>
                </select>
                <Input
                  value={blacklistValue}
                  onChange={(event) => setBlacklistValue(event.target.value)}
                  placeholder="Value to block or unblock"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => handleBlacklist(true)}>Activate</Button>
                <Button variant="secondary" onClick={() => handleBlacklist(false)}>
                  Deactivate
                </Button>
              </div>
              <div className="grid gap-2">
                {blacklistEntries.slice(0, 8).map((entry) => (
                  <div key={entry.id} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
                    <span className="font-medium">{entry.type}</span>: {entry.value} - {entry.active ? 'active' : 'inactive'}
                  </div>
                ))}
                {blacklistEntries.length === 0 && <p className="text-sm text-muted-foreground">No blacklist entries yet.</p>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent audit activity</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {auditEntries.slice(0, 8).map((entry) => (
                <div key={entry.id} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  <p className="font-medium text-foreground">{entry.action}</p>
                  <p className="text-xs text-muted-foreground">{new Date(entry.when).toLocaleString()}</p>
                </div>
              ))}
              {auditEntries.length === 0 && <p className="text-sm text-muted-foreground">No audit records available.</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </LayoutShell>
  );
}
