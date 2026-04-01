import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { approveReview, listModerationQueue, rejectReview } from '@/features/moderation/api/moderationApi';
import { Table, TableCell, TableHead, TableRow } from '@/shared/components/ui/table';
import { Dialog, DialogContent, DialogTitle } from '@/shared/components/ui/dialog';
import { LayoutShell } from '@/shared/components/LayoutShell';
import { PageHeader } from '@/shared/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Pagination } from '@/shared/components/ui/pagination';

export function ModerationQueuePage() {
  const queue = useQuery({ queryKey: ['moderation-queue'], queryFn: listModerationQueue });
  const [selected, setSelected] = useState<string | null>(null);
  const items = Array.isArray(queue.data) ? queue.data : [];
  const [page, setPage] = useState(1);
  const perPage = 10;
  const totalPages = Math.max(1, Math.ceil(items.length / perPage));
  const currentPage = Math.min(page, totalPages);
  const pagedItems = items.slice((currentPage - 1) * perPage, currentPage * perPage);
  const selectedItem = items.find((item) => item.id === selected) ?? null;

  async function handleApprove(id: string) {
    await approveReview(id);
    setSelected(null);
    await queue.refetch();
  }

  async function handleReject(id: string) {
    await rejectReview(id);
    setSelected(null);
    await queue.refetch();
  }

  return <LayoutShell title="Moderation" links={[]}><div className="grid gap-6"><PageHeader title="Moderation queue" description="Review quarantined items and take action." />{queue.isError && <Card><CardHeader><CardTitle>Queue unavailable</CardTitle></CardHeader><CardContent><p className="body-base">We couldn't load the queue right now.</p></CardContent></Card>}{queue.isSuccess && items.length === 0 && <Card><CardHeader><CardTitle>No items to review</CardTitle></CardHeader><CardContent><p className="body-base">The moderation queue is empty right now.</p></CardContent></Card>}{items.length > 0 && <div className="grid gap-4"><Table><thead><TableRow><TableHead>ID</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></thead><tbody>{pagedItems.map((item) => <TableRow key={item.id}><TableCell>{item.id}</TableCell><TableCell>{item.status}</TableCell><TableCell><Button variant="ghost" onClick={() => setSelected(item.id)}>View</Button></TableCell></TableRow>)}</tbody></Table><Pagination page={currentPage} totalPages={totalPages} onPageChange={setPage} /></div>}{selectedItem && <Dialog><DialogContent><DialogTitle>Review Detail</DialogTitle><div className="grid gap-4 text-sm text-muted-foreground"><div className="grid gap-2 rounded-xl border border-border bg-background p-4"><p><span className="font-medium text-foreground">Review ID:</span> {selectedItem.id}</p><p><span className="font-medium text-foreground">Order:</span> {selectedItem.orderId ?? '—'}</p><p><span className="font-medium text-foreground">Rating:</span> {selectedItem.rating}/5</p><p><span className="font-medium text-foreground">Created:</span> {selectedItem.createdAt ? new Date(selectedItem.createdAt).toLocaleString() : '—'}</p></div><div className="rounded-xl border border-border bg-background p-4"><p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Review text</p><p className="body-base text-foreground">{selectedItem.text || 'No review text provided.'}</p></div><div className="flex flex-wrap gap-3"><Button onClick={() => handleApprove(selectedItem.id)}>Approve</Button><Button variant="secondary" onClick={() => handleReject(selectedItem.id)}>Reject</Button><Button variant="ghost" onClick={() => setSelected(null)}>Close</Button></div></div></DialogContent></Dialog>}</div></LayoutShell>;
}
