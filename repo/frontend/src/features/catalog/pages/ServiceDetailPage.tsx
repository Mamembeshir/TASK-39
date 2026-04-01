import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { getService, getServiceQuestions, getServiceReviews, type ServiceBundle } from '@/features/catalog/api/catalogApi';
import { addFavorite, removeFavorite } from '@/features/booking/api/bookingApi';
import { QuestionsSection } from '@/features/catalog/components/QuestionsSection';
import { ReviewsSection } from '@/features/catalog/components/ReviewsSection';
import { ServiceDetailHeader } from '@/features/catalog/components/ServiceDetailHeader';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { useBooking } from '@/features/booking/store';
import { createSpec } from '@/features/booking/lib/quoteDraft';
import { navigateTransition } from '@/shared/lib/navigateTransition';
import { PageShell } from '@/shared/components/PageShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Button } from '@/shared/components/ui/button';
import { toast } from 'sonner';

const durationOptions = [30, 60, 90];
const headcountOptions = [1, 2, 3, 4];
function formatAddOnLabel(addOnId: string) {
  return addOnId.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export function ServiceDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { setQuoteDraft } = useBooking();
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [headcount, setHeadcount] = useState(1);
  const [toolsMode, setToolsMode] = useState<'provider' | 'customer'>('provider');
  const [addOnIds, setAddOnIds] = useState<string[]>([]);
  const [selectedBundleId, setSelectedBundleId] = useState<string | null>(null);
  const [bundleSpecs, setBundleSpecs] = useState<Record<string, number>>({});
  const serviceQuery = useQuery({ queryKey: ['service', id], queryFn: () => getService(id) });
  const questionsQuery = useQuery({ queryKey: ['service-questions', id], queryFn: () => getServiceQuestions(id) });
  const reviewsQuery = useQuery({ queryKey: ['service-reviews', id], queryFn: () => getServiceReviews(id) });

  if (serviceQuery.isLoading) return <PageShell width="narrow"><Skeleton className="h-56" /></PageShell>;
  if (serviceQuery.isError) return <PageShell width="narrow"><div className="grid gap-4"><Card><CardHeader><CardTitle>Service unavailable</CardTitle></CardHeader><CardContent><p className="body-base">We couldn't load this service right now.</p></CardContent></Card></div></PageShell>;
  if (!serviceQuery.data) return null;
  const bundles = Array.isArray(serviceQuery.data.bundles) ? serviceQuery.data.bundles : [];
  const selectedBundle = bundles.find((bundle) => bundle.id === selectedBundleId) ?? null;
  const addOnOptions = (serviceQuery.data.addOns ?? []).map((addOnId) => ({ id: addOnId, label: formatAddOnLabel(addOnId) }));

  function handleQuote() {
    const bundleLineItems = selectedBundle && Array.isArray(selectedBundle.services) && selectedBundle.services.length > 0
      ? [{
          type: 'bundle' as const,
          bundleId: selectedBundle.id,
          quantity: 1,
          specs: selectedBundle.services.map((service) => ({
            serviceId: service.id,
            durationMinutes: bundleSpecs[service.id] ?? service.durationMinutes ?? 60,
          })),
        }]
      : undefined;
    const serviceSpec = {
      headcount,
      toolsMode,
      addOnIds,
    };

    setQuoteDraft({
      spec: {
        ...createSpec(id, durationMinutes),
        headcount,
        toolsMode,
        addOnIds,
      },
      lineItems: bundleLineItems ?? [{
        type: 'service',
        serviceId: id,
        durationMinutes,
        quantity: 1,
        spec: serviceSpec,
      }],
      bookingRequestedAt: new Date().toISOString(),
      slotId: null,
      slotStart: null,
      quoteSignature: null,
      jurisdictionId: null,
      milesFromDepot: null,
    });
    navigateTransition(navigate, '/checkout');
  }

  async function handleFavorite() {
    try {
      await addFavorite(id);
      toast.success('Added to favorites');
    } catch {
      await removeFavorite(id);
      toast.success('Removed from favorites');
    }
  }

  function toggleAddOn(addOnId: string) {
    setAddOnIds((current) => (current.includes(addOnId) ? current.filter((id) => id !== addOnId) : [...current, addOnId]));
  }

  function applyBundle(bundle: ServiceBundle) {
    const isActive = selectedBundleId === bundle.id;
    setSelectedBundleId(isActive ? null : bundle.id);

    if (isActive) {
      return;
    }

    const nextBundleSpecs = (bundle.services ?? []).reduce<Record<string, number>>((acc, service) => {
      acc[service.id] = service.durationMinutes ?? 60;
      return acc;
    }, {});
    setBundleSpecs(nextBundleSpecs);
  }

  return (
    <PageShell>
      <div className="grid gap-6">
        <ServiceDetailHeader service={serviceQuery.data} />

        <div className="flex flex-wrap gap-3">
          <Button onClick={handleQuote}>Quote</Button>
          <Button variant="secondary" onClick={() => navigate('/compare')}>Compare</Button>
          <Button variant="ghost" onClick={handleFavorite}>Favorite</Button>
        </div>

        <Tabs>
          <TabsList>
            <TabsTrigger>Specs</TabsTrigger>
            <TabsTrigger>Quote</TabsTrigger>
            <TabsTrigger>Reviews</TabsTrigger>
            <TabsTrigger>Q&amp;A</TabsTrigger>
          </TabsList>

          <TabsContent>
            <Card>
              <CardHeader><CardTitle>Service specs</CardTitle></CardHeader>
              <CardContent className="grid gap-5 text-sm text-muted-foreground">
                <div className="grid gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Bundles</p>
                  {bundles.length === 0 ? (
                    <p>No bundles are available for this service yet.</p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {bundles.map((bundle) => (
                        <button
                          key={bundle.id}
                          type="button"
                          className={selectedBundleId === bundle.id ? 'rounded-lg border border-primary/40 bg-muted px-3 py-3 text-left' : 'rounded-lg border border-border bg-background px-3 py-3 text-left'}
                          onClick={() => applyBundle(bundle)}
                        >
                          <p className="text-sm font-semibold text-foreground">{bundle.title}</p>
                          {bundle.description && <p className="mt-1 text-xs text-muted-foreground">{bundle.description}</p>}
                          {bundle.services?.length ? <p className="mt-2 text-xs text-muted-foreground">Includes {bundle.services.length} services{bundle.pricing?.discountPercent ? ` with ${Math.round(bundle.pricing.discountPercent * 100)}% bundle savings` : ''}.</p> : null}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {selectedBundle?.services?.length ? (
                  <div className="grid gap-3 rounded-xl border border-border bg-background p-4">
                    <div className="grid gap-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Bundle service specs</p>
                      <p>Each included service can keep its own duration before quote.</p>
                    </div>
                    <div className="grid gap-3">
                      {selectedBundle.services.map((bundleService) => (
                        <div key={bundleService.id} className="grid gap-2 rounded-lg border border-border/70 bg-card p-3">
                          <div>
                            <p className="text-sm font-medium text-foreground">{bundleService.title}</p>
                            <p className="text-xs text-muted-foreground">{bundleService.category ?? 'Service component'}</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {durationOptions.map((minutes) => (
                              <Button
                                key={`${bundleService.id}-${minutes}`}
                                variant={(bundleSpecs[bundleService.id] ?? bundleService.durationMinutes ?? 60) === minutes ? 'default' : 'secondary'}
                                onClick={() => setBundleSpecs((current) => ({ ...current, [bundleService.id]: minutes }))}
                              >
                                {minutes} min
                              </Button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Duration</p>
                  <div className="flex flex-wrap gap-2">
                    {durationOptions.map((minutes) => (
                      <Button key={minutes} variant={minutes === durationMinutes ? 'default' : 'secondary'} onClick={() => setDurationMinutes(minutes)}>
                        {minutes} min
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Headcount</p>
                  <div className="flex flex-wrap gap-2">
                    {headcountOptions.map((count) => (
                      <Button key={count} variant={count === headcount ? 'default' : 'secondary'} onClick={() => setHeadcount(count)}>
                        {count} staff
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Tools</p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant={toolsMode === 'provider' ? 'default' : 'secondary'} onClick={() => setToolsMode('provider')}>Provider brings tools</Button>
                    <Button variant={toolsMode === 'customer' ? 'default' : 'secondary'} onClick={() => setToolsMode('customer')}>I provide tools</Button>
                  </div>
                </div>

                <div className="grid gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Add-ons</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {addOnOptions.map((addOn) => (
                      <label key={addOn.id} className="flex min-h-11 items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
                        <input type="checkbox" checked={addOnIds.includes(addOn.id)} onChange={() => toggleAddOn(addOn.id)} />
                        <span className="text-sm text-foreground">{addOn.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent>
            <Card>
              <CardHeader><CardTitle>Quote preview</CardTitle></CardHeader>
              <CardContent className="grid gap-3 text-sm text-muted-foreground">
                <p>Use Quote to calculate capacity, zones, and price before checkout.</p>
                <Button onClick={handleQuote}>Start quote</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent>
            <ReviewsSection reviews={reviewsQuery.data ?? []} />
          </TabsContent>

          <TabsContent>
            <QuestionsSection serviceId={id} questions={questionsQuery.data ?? []} onSubmitted={async () => { await questionsQuery.refetch(); }} />
          </TabsContent>
        </Tabs>
      </div>
    </PageShell>
  );
}
