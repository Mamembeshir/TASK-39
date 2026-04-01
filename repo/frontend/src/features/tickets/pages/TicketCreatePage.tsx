import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createTicket, uploadTicketAttachments } from '@/features/tickets/api/ticketsApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { toast } from 'sonner';
import { showApiError } from '@/shared/lib/showApiError';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Separator } from '@/shared/components/ui/separator';
import { PageShell } from '@/shared/components/PageShell';
import { PageHeader } from '@/shared/components/PageHeader';
import { Button } from '@/shared/components/ui/button';

const ticketCategories = [
  { id: 'billing', label: 'Billing', description: 'Charges, invoices, refunds, or payment questions.' },
  { id: 'scheduling', label: 'Scheduling', description: 'Changes to time, date, availability, or assigned slot.' },
  { id: 'service_quality', label: 'Service quality', description: 'Concerns about the completed visit or service outcome.' },
  { id: 'access_issue', label: 'Access issue', description: 'Arrival, entry, address, or on-site access problems.' },
  { id: 'general_support', label: 'General support', description: 'Anything else that needs support follow-up.' },
];

export function TicketCreatePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [orderId, setOrderId] = useState(searchParams.get('orderId') ?? '');
  const [category, setCategory] = useState(ticketCategories[4].id);
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [error, setError] = useState('');
  const [slaHint] = useState<string | null>(null);

  async function submit() {
    if (!orderId) return setError('Order context is required to create a ticket.');
    let attachmentIds: string[] | undefined;
    if (attachments.length) {
      try {
        const uploaded = await uploadTicketAttachments(attachments);
        attachmentIds = uploaded.mediaIds;
      } catch (error) {
        const message = showApiError(error);
        toast.error(message);
        setError(message);
        return;
      }
    }
    try {
      const ticket = await createTicket({ orderId, category, description, attachmentIds });
      navigate(`/tickets/${ticket.id}`);
    } catch (error) {
      const message = showApiError(error);
      toast.error(message);
      setError(message);
    }
  }

  return (
    <PageShell width="narrow">
      <div className="grid gap-6">
        <PageHeader title="Open ticket" description="Start a support ticket for a completed order." />
        <Card>
          <CardHeader><CardTitle>Ticket form</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Tickets must be tied to an order. Attachments are optional and limited by upload rules.</p>
            <Separator />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="ticket-order">Order ID</Label>
              <Input id="ticket-order" value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder="Open from an order" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ticket-category">Category</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {ticketCategories.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={category === option.id ? 'rounded-xl border border-primary/40 bg-muted p-3 text-left' : 'rounded-xl border border-border bg-background p-3 text-left transition hover:border-primary/20 hover:bg-muted/60'}
                    onClick={() => setCategory(option.id)}
                  >
                    <p className="text-sm font-medium text-foreground">{option.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{option.description}</p>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ticket-description">Description</Label>
              <textarea id="ticket-description" className="min-h-32 rounded-xl border border-border bg-background p-3" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the issue" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ticket-files">Attachments</Label>
              <input id="ticket-files" type="file" multiple onChange={(e) => setAttachments(Array.from(e.target.files ?? []))} />
              <p className="text-xs text-muted-foreground">Up to 6 images, max 10MB each.</p>
            </div>
            {slaHint && <p className="text-sm text-muted-foreground">{slaHint}</p>}
            <div className="flex flex-wrap gap-3">
              <Button onClick={submit}>Create ticket</Button>
            </div>
          </div>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
