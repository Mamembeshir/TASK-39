import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { getService, getServiceQuestions, getServiceReviews, type ServiceBundle } from '@/features/catalog/api/catalogApi';
import { addFavorite, listQuoteJurisdictions, listQuoteSlots, removeFavorite } from '@/features/booking/api/bookingApi';
import { QuestionsSection } from '@/features/catalog/components/QuestionsSection';
import { ReviewsSection } from '@/features/catalog/components/ReviewsSection';
import { ServiceDetailHeader } from '@/features/catalog/components/ServiceDetailHeader';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { useBooking } from '@/features/booking/store';
import { createSpec } from '@/features/booking/lib/quoteDraft';
import { useDebouncedQuote } from '@/features/booking/hooks/useDebouncedQuote';
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
  const [milesFromDepot, setMilesFromDepot] = useState(10);
  const [jurisdictionId, setJurisdictionId] = useState('');
  const [sameDayPriority, setSameDayPriority] = useState(false);
  const [taxEnabled, setTaxEnabled] = useState(true);
  const serviceQuery = useQuery({ queryKey: ['service', id], queryFn: () => getService(id) });
  const questionsQuery = useQuery({ queryKey: ['service-questions', id], queryFn: () => getServiceQuestions(id) });
  const reviewsQuery = useQuery({ queryKey: ['service-reviews', id], queryFn: () => getServiceReviews(id) });
  const jurisdictionsQuery = useQuery({ queryKey: ['service-detail-jurisdictions'], queryFn: listQuoteJurisdictions });
  const bundles = Array.isArray(serviceQuery.data?.bundles) ? serviceQuery.data.bundles : [];
  const selectedBundle = bundles.find((bundle) => bundle.id === selectedBundleId) ?? null;
  const quoteLineItems = selectedBundle && Array.isArray(selectedBundle.services) && selectedBundle.services.length > 0
    ? [{
        type: 'bundle' as const,
        bundleId: selectedBundle.id,
        quantity: 1,
        specs: selectedBundle.services.map((service) => ({
          serviceId: service.id,
          durationMinutes: bundleSpecs[service.id] ?? service.durationMinutes ?? 60,
        })),
      }]
    : [{
        type: 'service' as const,
        serviceId: id,
        durationMinutes,
        quantity: 1,
        spec: {
          headcount,
          toolsMode,
          addOnIds,
        },
      }];
  const primaryServiceId = quoteLineItems[0]?.type === 'bundle'
    ? quoteLineItems[0].specs[0]?.serviceId ?? ''
    : quoteLineItems[0]?.serviceId ?? '';
  const slotsQuery = useQuery({
    queryKey: ['service-detail-slots', primaryServiceId],
    queryFn: () => listQuoteSlots(primaryServiceId),
    enabled: primaryServiceId.length > 0,
  });
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [selectedSlotStart, setSelectedSlotStart] = useState('');

  useEffect(() => {
    const firstSlot = slotsQuery.data?.[0];
    if (!firstSlot) {
      setSelectedSlotId('');
      setSelectedSlotStart('');
      return;
    }
    setSelectedSlotId(firstSlot.slotId);
    setSelectedSlotStart(firstSlot.startTime);
  }, [slotsQuery.data]);

  useEffect(() => {
    if (!jurisdictionId && jurisdictionsQuery.data && jurisdictionsQuery.data.length > 0) {
      setJurisdictionId(jurisdictionsQuery.data[0].id);
    }
  }, [jurisdictionId, jurisdictionsQuery.data]);

  const liveQuote = useDebouncedQuote(selectedSlotStart
    ? {
        lineItems: quoteLineItems,
        slotStart: selectedSlotStart,
        bookingRequestedAt: new Date().toISOString(),
        milesFromDepot,
        jurisdictionId,
        sameDayPriority,
        taxEnabled,
      }
    : null);

  if (serviceQuery.isLoading) return <PageShell width="narrow"><Skeleton className="h-56" /></PageShell>;
  if (serviceQuery.isError) return <PageShell width="narrow"><div className="grid gap-4"><Card><CardHeader><CardTitle>Service unavailable</CardTitle></CardHeader><CardContent><p className="body-base">We couldn't load this service right now.</p></CardContent></Card></div></PageShell>;
  if (!serviceQuery.data) return null;
  const addOnOptions = (serviceQuery.data.addOns ?? []).map((addOnId) => ({ id: addOnId, label: formatAddOnLabel(addOnId) }));

  function handleQuote() {
    if (!selectedSlotId || !selectedSlotStart) {
      toast.error('Select an available slot first.');
      return;
    }
    if (!liveQuote.data?.quoteSignature || liveQuote.data?.notServiceable) {
      toast.error('Wait for a valid real-time quote before continuing.');
      return;
    }

    setQuoteDraft({
      spec: {
        ...createSpec(id, durationMinutes),
        headcount,
        toolsMode,
        addOnIds,
      },
      lineItems: quoteLineItems,
      bookingRequestedAt: new Date().toISOString(),
      slotId: selectedSlotId,
      slotStart: selectedSlotStart,
      quoteSignature: liveQuote.data.quoteSignature,
      jurisdictionId,
      milesFromDepot,
      sameDayPriority,
      taxEnabled,
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
                {slotsQuery.isLoading && <p>Loading available slots...</p>}
                {slotsQuery.isSuccess && slotsQuery.data.length === 0 && (
                  <p className="text-destructive">No available slots found for the selected service configuration.</p>
                )}
                {slotsQuery.isSuccess && slotsQuery.data.length > 0 && (
                  <div className="grid gap-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Available slots</p>
                    <div className="grid gap-2">
                      {slotsQuery.data.map((slot) => (
                        <button
                          key={slot.slotId}
                          type="button"
                          className={selectedSlotId === slot.slotId ? 'rounded-lg border border-primary/40 bg-muted px-3 py-2 text-left' : 'rounded-lg border border-border bg-card px-3 py-2 text-left'}
                          onClick={() => {
                            setSelectedSlotId(slot.slotId);
                            setSelectedSlotStart(slot.startTime);
                          }}
                        >
                          <p className="text-sm font-medium text-foreground">{new Date(slot.startTime).toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">Capacity: {slot.remainingCapacity}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="grid gap-2 rounded-xl border border-border bg-background p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Travel & tax</p>
                  <label className="grid gap-1 text-xs text-muted-foreground">
                    Miles from depot
                    <input
                      type="number"
                      min={0}
                      max={20}
                      className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
                      value={milesFromDepot}
                      onChange={(event) => setMilesFromDepot(Math.max(0, Math.min(20, Number(event.target.value) || 0)))}
                    />
                  </label>
                  <label className="grid gap-1 text-xs text-muted-foreground">
                    Jurisdiction
                    <select
                      className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
                      value={jurisdictionId}
                      onChange={(event) => setJurisdictionId(event.target.value)}
                    >
                      {(jurisdictionsQuery.data ?? []).map((jurisdiction) => (
                        <option key={jurisdiction.id} value={jurisdiction.id}>
                          {jurisdiction.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input type="checkbox" checked={sameDayPriority} onChange={(event) => setSameDayPriority(event.target.checked)} />
                    Same-day priority
                  </label>
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input type="checkbox" checked={taxEnabled} onChange={(event) => setTaxEnabled(event.target.checked)} />
                    Apply tax
                  </label>
                </div>
                {liveQuote.isLoading && <p>Validating live quote...</p>}
                {liveQuote.error && <p className="text-destructive">{liveQuote.error}</p>}
                {liveQuote.data && (
                  <div className="grid gap-1">
                    <p>Total: {liveQuote.data.total}</p>
                    {liveQuote.data.notServiceable && <p className="text-destructive">Not serviceable for selected travel defaults.</p>}
                  </div>
                )}
                <Button
                  onClick={handleQuote}
                  disabled={!selectedSlotId || !liveQuote.data?.quoteSignature || Boolean(liveQuote.data?.notServiceable) || liveQuote.isLoading}
                >
                  Continue to checkout
                </Button>
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
