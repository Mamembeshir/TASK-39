import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  createStaffBundle,
  createStaffService,
  listServices,
  publishStaffBundle,
  publishStaffService,
  type StaffBundlePayload,
  type StaffServicePayload,
  unpublishStaffBundle,
  unpublishStaffService,
  updateStaffBundle,
  updateStaffService,
} from '@/features/catalog/api/catalogApi';
import { LayoutShell } from '@/shared/components/LayoutShell';
import { PageHeader } from '@/shared/components/PageHeader';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { showApiError } from '@/shared/lib/showApiError';

function parseCsv(value: string) {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

export function OpsCatalogPage() {
  const servicesQuery = useQuery({ queryKey: ['ops-catalog-services'], queryFn: () => listServices() });

  const [serviceForm, setServiceForm] = useState<StaffServicePayload>({
    title: '',
    description: '',
    category: 'general_support',
    basePrice: 100,
    durationMinutes: 60,
    tags: [],
    addOns: [],
  });
  const [serviceIdForUpdate, setServiceIdForUpdate] = useState('');
  const [serviceIdForPublish, setServiceIdForPublish] = useState('');

  const [bundleForm, setBundleForm] = useState<StaffBundlePayload>({
    title: '',
    description: '',
    serviceIds: [],
    discountPercent: 10,
  });
  const [bundleIdForUpdate, setBundleIdForUpdate] = useState('');
  const [bundleIdForPublish, setBundleIdForPublish] = useState('');

  const servicesById = useMemo(() => {
    const map = new Map<string, string>();
    for (const service of servicesQuery.data ?? []) {
      map.set(service.id, service.title);
    }
    return map;
  }, [servicesQuery.data]);

  async function handleCreateService() {
    try {
      const result = await createStaffService(serviceForm);
      toast.success(`Service created: ${result.id}`);
      await servicesQuery.refetch();
    } catch (error) {
      toast.error(showApiError(error));
    }
  }

  async function handleUpdateService() {
    if (!serviceIdForUpdate.trim()) {
      toast.error('Service id is required for update');
      return;
    }
    try {
      await updateStaffService(serviceIdForUpdate.trim(), serviceForm);
      toast.success('Service updated');
      await servicesQuery.refetch();
    } catch (error) {
      toast.error(showApiError(error));
    }
  }

  async function handlePublishService(published: boolean) {
    if (!serviceIdForPublish.trim()) {
      toast.error('Service id is required');
      return;
    }
    try {
      if (published) {
        await publishStaffService(serviceIdForPublish.trim());
        toast.success('Service published');
      } else {
        await unpublishStaffService(serviceIdForPublish.trim());
        toast.success('Service unpublished');
      }
      await servicesQuery.refetch();
    } catch (error) {
      toast.error(showApiError(error));
    }
  }

  async function handleCreateBundle() {
    try {
      const result = await createStaffBundle(bundleForm);
      toast.success(`Bundle created: ${result.id}`);
    } catch (error) {
      toast.error(showApiError(error));
    }
  }

  async function handleUpdateBundle() {
    if (!bundleIdForUpdate.trim()) {
      toast.error('Bundle id is required for update');
      return;
    }
    try {
      await updateStaffBundle(bundleIdForUpdate.trim(), bundleForm);
      toast.success('Bundle updated');
    } catch (error) {
      toast.error(showApiError(error));
    }
  }

  async function handlePublishBundle(published: boolean) {
    if (!bundleIdForPublish.trim()) {
      toast.error('Bundle id is required');
      return;
    }
    try {
      if (published) {
        await publishStaffBundle(bundleIdForPublish.trim());
        toast.success('Bundle published');
      } else {
        await unpublishStaffBundle(bundleIdForPublish.trim());
        toast.success('Bundle unpublished');
      }
    } catch (error) {
      toast.error(showApiError(error));
    }
  }

  return (
    <LayoutShell title="Ops" links={[]}>
      <div className="grid gap-6">
        <PageHeader
          title="Catalog Setup Console"
          description="Create, update, publish, and unpublish services/bundles through staff catalog endpoints."
        />

        <Card>
          <CardHeader>
            <CardTitle>Service management</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2 md:grid-cols-2">
              <label className="grid gap-1">
                <Label>Title</Label>
                <Input value={serviceForm.title} onChange={(e) => setServiceForm((cur) => ({ ...cur, title: e.target.value }))} />
              </label>
              <label className="grid gap-1">
                <Label>Category</Label>
                <Input value={serviceForm.category} onChange={(e) => setServiceForm((cur) => ({ ...cur, category: e.target.value }))} />
              </label>
              <label className="grid gap-1 md:col-span-2">
                <Label>Description</Label>
                <textarea className="min-h-24 rounded-xl border border-border bg-background p-3 text-sm" value={serviceForm.description} onChange={(e) => setServiceForm((cur) => ({ ...cur, description: e.target.value }))} />
              </label>
              <label className="grid gap-1">
                <Label>Base price</Label>
                <Input type="number" value={serviceForm.basePrice} onChange={(e) => setServiceForm((cur) => ({ ...cur, basePrice: Number(e.target.value) || 0 }))} />
              </label>
              <label className="grid gap-1">
                <Label>Duration (minutes)</Label>
                <Input type="number" value={serviceForm.durationMinutes} onChange={(e) => setServiceForm((cur) => ({ ...cur, durationMinutes: Number(e.target.value) || 0 }))} />
              </label>
              <label className="grid gap-1">
                <Label>Tags (csv)</Label>
                <Input value={serviceForm.tags.join(', ')} onChange={(e) => setServiceForm((cur) => ({ ...cur, tags: parseCsv(e.target.value) }))} />
              </label>
              <label className="grid gap-1">
                <Label>Add-ons (csv)</Label>
                <Input value={serviceForm.addOns.join(', ')} onChange={(e) => setServiceForm((cur) => ({ ...cur, addOns: parseCsv(e.target.value) }))} />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleCreateService}>Create service</Button>
              <Input className="max-w-56" placeholder="Service id for update" value={serviceIdForUpdate} onChange={(e) => setServiceIdForUpdate(e.target.value)} />
              <Button variant="secondary" onClick={handleUpdateService}>Update service</Button>
              <Input className="max-w-56" placeholder="Service id for publish" value={serviceIdForPublish} onChange={(e) => setServiceIdForPublish(e.target.value)} />
              <Button variant="secondary" onClick={() => handlePublishService(true)}>Publish</Button>
              <Button variant="ghost" onClick={() => handlePublishService(false)}>Unpublish</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bundle management</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2 md:grid-cols-2">
              <label className="grid gap-1">
                <Label>Title</Label>
                <Input value={bundleForm.title} onChange={(e) => setBundleForm((cur) => ({ ...cur, title: e.target.value }))} />
              </label>
              <label className="grid gap-1">
                <Label>Discount percent</Label>
                <Input type="number" value={bundleForm.discountPercent} onChange={(e) => setBundleForm((cur) => ({ ...cur, discountPercent: Number(e.target.value) || 0 }))} />
              </label>
              <label className="grid gap-1 md:col-span-2">
                <Label>Description</Label>
                <textarea className="min-h-24 rounded-xl border border-border bg-background p-3 text-sm" value={bundleForm.description} onChange={(e) => setBundleForm((cur) => ({ ...cur, description: e.target.value }))} />
              </label>
              <label className="grid gap-1 md:col-span-2">
                <Label>Service IDs (csv)</Label>
                <Input
                  value={bundleForm.serviceIds.join(', ')}
                  onChange={(e) => setBundleForm((cur) => ({ ...cur, serviceIds: parseCsv(e.target.value) }))}
                  placeholder="svc-1, svc-2"
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleCreateBundle}>Create bundle</Button>
              <Input className="max-w-56" placeholder="Bundle id for update" value={bundleIdForUpdate} onChange={(e) => setBundleIdForUpdate(e.target.value)} />
              <Button variant="secondary" onClick={handleUpdateBundle}>Update bundle</Button>
              <Input className="max-w-56" placeholder="Bundle id for publish" value={bundleIdForPublish} onChange={(e) => setBundleIdForPublish(e.target.value)} />
              <Button variant="secondary" onClick={() => handlePublishBundle(true)}>Publish</Button>
              <Button variant="ghost" onClick={() => handlePublishBundle(false)}>Unpublish</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Catalog quick reference</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {(servicesQuery.data ?? []).slice(0, 12).map((service) => (
              <p key={service.id} className="text-sm text-muted-foreground">
                {service.id} - {service.title}
              </p>
            ))}
            {(servicesQuery.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">No services available yet.</p>}
            {servicesById.size > 0 && <p className="text-xs text-muted-foreground">Use IDs above for update/publish actions.</p>}
          </CardContent>
        </Card>
      </div>
    </LayoutShell>
  );
}
