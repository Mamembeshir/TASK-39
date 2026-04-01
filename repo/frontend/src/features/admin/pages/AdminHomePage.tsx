import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { LayoutShell } from '@/shared/components/LayoutShell';
import { PageHeader } from '@/shared/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { listModerationQueue } from '@/features/moderation/api/moderationApi';
import { listPendingQuestions } from '@/features/catalog/api/catalogApi';
import { listTickets } from '@/features/tickets/api/ticketsApi';
import { listAuditLogs, listBlacklist, upsertBlacklist } from '@/features/admin/api/adminApi';
import { Input } from '@/shared/components/ui/input';
import { useState } from 'react';
import { toast } from 'sonner';

export function AdminHomePage() {
  const reviewsQuery = useQuery({ queryKey: ['admin-review-queue'], queryFn: listModerationQueue });
  const questionsQuery = useQuery({ queryKey: ['admin-question-queue'], queryFn: listPendingQuestions });
  const ticketsQuery = useQuery({ queryKey: ['admin-tickets'], queryFn: listTickets });
  const auditQuery = useQuery({ queryKey: ['admin-audit'], queryFn: listAuditLogs });
  const blacklistQuery = useQuery({ queryKey: ['admin-blacklist'], queryFn: listBlacklist });
  const [blacklistType, setBlacklistType] = useState<'ip' | 'user'>('ip');
  const [blacklistValue, setBlacklistValue] = useState('');

  async function handleBlacklist(active: boolean) {
    if (!blacklistValue.trim()) return;
    await upsertBlacklist({ type: blacklistType, value: blacklistValue.trim(), active });
    toast.success(active ? 'Blacklist entry saved' : 'Blacklist entry deactivated');
    setBlacklistValue('');
    await blacklistQuery.refetch();
  }

  return <LayoutShell title="Admin" links={[]}><div className="grid gap-6"><PageHeader title="Admin Console" description="Policy, safety, and cross-team oversight." /><div className="grid gap-4 md:grid-cols-3"><Card><CardHeader><CardTitle>Operations</CardTitle></CardHeader><CardContent className="grid gap-3"><p className="body-base">Catalog, content, and dispute workflows live in the ops console.</p><div className="flex flex-wrap gap-2"><Button variant="secondary" asChild><Link to="/ops">Open ops console</Link></Button><Button variant="ghost" asChild><Link to="/ops/content">Content studio</Link></Button></div></CardContent></Card><Card><CardHeader><CardTitle>Moderation</CardTitle></CardHeader><CardContent className="grid gap-3"><p className="body-base">{reviewsQuery.data?.length ?? 0} reviews and {questionsQuery.data?.length ?? 0} customer questions are waiting for moderation.</p><Button variant="secondary" asChild><Link to="/mod">Open moderation console</Link></Button></CardContent></Card><Card><CardHeader><CardTitle>Disputes</CardTitle></CardHeader><CardContent className="grid gap-3"><p className="body-base">{ticketsQuery.data?.length ?? 0} tickets are visible in the shared dispute queue.</p><Button variant="secondary" asChild><Link to="/tickets">Open dispute queue</Link></Button></CardContent></Card></div><div className="grid gap-4 md:grid-cols-2"><Card><CardHeader><CardTitle>Blacklist controls</CardTitle></CardHeader><CardContent className="grid gap-3"><div className="grid gap-2 sm:grid-cols-[120px_minmax(0,1fr)]"><select className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none" value={blacklistType} onChange={(event) => setBlacklistType(event.target.value as 'ip' | 'user')}><option value="ip">IP</option><option value="user">User</option></select><Input value={blacklistValue} onChange={(event) => setBlacklistValue(event.target.value)} placeholder="Value to block or unblock" /></div><div className="flex flex-wrap gap-2"><Button onClick={() => handleBlacklist(true)}>Block</Button><Button variant="secondary" onClick={() => handleBlacklist(false)}>Unblock</Button></div><div className="grid gap-2">{(blacklistQuery.data ?? []).slice(0, 5).map((entry) => <div key={entry.id} className="rounded-xl border border-border bg-background p-3 text-sm text-muted-foreground">{entry.type}: {entry.value} · {entry.active ? 'active' : 'inactive'}</div>)}</div></CardContent></Card><Card><CardHeader><CardTitle>Audit activity</CardTitle></CardHeader><CardContent className="grid gap-2">{(auditQuery.data ?? []).slice(0, 6).map((log) => <div key={log.id} className="rounded-xl border border-border bg-background p-3 text-sm text-muted-foreground"><p className="font-medium text-foreground">{log.action}</p><p>{log.metadata?.username ?? 'system'} · {log.metadata?.ip ?? 'unknown ip'}</p><p>{log.when ? new Date(log.when).toLocaleString() : '—'}</p></div>)}</CardContent></Card></div><div className="grid gap-4 md:grid-cols-2"><Card><CardHeader><CardTitle>Publishing</CardTitle></CardHeader><CardContent className="grid gap-3"><p className="body-base">Review live content, article readiness, and customer-facing catalog presentation.</p><div className="flex flex-wrap gap-2"><Button variant="secondary" asChild><Link to="/ops/content">Open content studio</Link></Button><Button variant="ghost" asChild><Link to="/content">Preview published hub</Link></Button></div></CardContent></Card><Card><CardHeader><CardTitle>System health</CardTitle></CardHeader><CardContent className="grid gap-3"><p className="body-base">Use health checks and console handoffs to validate the platform end to end.</p><Button variant="secondary" asChild><Link to="/health">Open health view</Link></Button></CardContent></Card></div></div></LayoutShell>;
}
