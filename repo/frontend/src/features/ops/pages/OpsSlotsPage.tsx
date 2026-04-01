import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listServices } from '@/features/catalog/api/catalogApi';
import { createCapacitySlot, deleteCapacitySlot, listCapacitySlots, updateCapacitySlot } from '@/features/orders/api/ordersApi';
import { PageShell } from '@/shared/components/PageShell';
import { PageHeader } from '@/shared/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { toast } from 'sonner';

export function OpsSlotsPage() {
  const servicesQuery = useQuery({ queryKey: ['ops-slot-services'], queryFn: () => listServices() });
  const slotsQuery = useQuery({ queryKey: ['ops-slots'], queryFn: listCapacitySlots });
  const services = servicesQuery.data ?? [];
  const [serviceId, setServiceId] = useState('');
  const [startTime, setStartTime] = useState('');
  const [remainingCapacity, setRemainingCapacity] = useState(1);
  const [saving, setSaving] = useState(false);
  const [editingSlotId, setEditingSlotId] = useState('');
  const serviceTitles = new Map(services.map((service) => [service.id, service.title]));

  async function handleCreate() {
    if (!serviceId || !startTime) return;
    setSaving(true);
    try {
      await createCapacitySlot({ serviceId, startTime: new Date(startTime).toISOString(), remainingCapacity });
      toast.success('Slot created');
      await slotsQuery.refetch();
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate() {
    if (!editingSlotId || !startTime) return;
    setSaving(true);
    try {
      await updateCapacitySlot(editingSlotId, { startTime: new Date(startTime).toISOString(), remainingCapacity });
      toast.success('Slot updated');
      setEditingSlotId('');
      setStartTime('');
      setRemainingCapacity(1);
      await slotsQuery.refetch();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await deleteCapacitySlot(id);
    toast.success('Slot deleted');
    if (editingSlotId === id) {
      setEditingSlotId('');
      setStartTime('');
      setRemainingCapacity(1);
    }
    await slotsQuery.refetch();
  }

  return (
    <PageShell>
      <div className="grid gap-6">
        <PageHeader title="Slot Management" description="Create and review capacity slots for published services." />
        <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <Card>
            <CardHeader><CardTitle>{editingSlotId ? 'Edit slot' : 'Create slot'}</CardTitle></CardHeader>
            <CardContent className="grid gap-3">
              <select className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none" value={serviceId} onChange={(event) => setServiceId(event.target.value)} disabled={Boolean(editingSlotId)}>
                <option value="">Select service</option>
                {services.map((service) => <option key={service.id} value={service.id}>{service.title}</option>)}
              </select>
              <Input type="datetime-local" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
              <Input type="number" min={1} step={1} value={remainingCapacity} onChange={(event) => setRemainingCapacity(Math.max(1, Number(event.target.value) || 1))} />
              <div className="flex flex-wrap gap-2">
                <Button onClick={editingSlotId ? handleUpdate : handleCreate} disabled={saving || !serviceId || !startTime}>{saving ? (editingSlotId ? 'Saving...' : 'Creating...') : (editingSlotId ? 'Save changes' : 'Create slot')}</Button>
                {editingSlotId && <Button variant="ghost" onClick={() => { setEditingSlotId(''); setStartTime(''); setRemainingCapacity(1); }}>Cancel edit</Button>}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Upcoming slots</CardTitle></CardHeader>
            <CardContent className="grid gap-3">
              {(slotsQuery.data ?? []).map((slot) => (
                <div key={slot.id} className="rounded-xl border border-border bg-background p-3">
                  <p className="text-sm font-medium text-foreground">{new Date(slot.startTime).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{serviceTitles.get(slot.serviceId ?? '') ?? slot.serviceId ?? 'Unknown service'} · Remaining capacity {slot.remainingCapacity}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="ghost" onClick={() => { setEditingSlotId(slot.id); setServiceId(slot.serviceId ?? ''); setStartTime(new Date(slot.startTime).toISOString().slice(0, 16)); setRemainingCapacity(slot.remainingCapacity); }}>Edit</Button>
                    <Button variant="ghost" onClick={() => handleDelete(slot.id)}>Delete</Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
