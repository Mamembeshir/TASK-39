import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getCompare, listQuoteJurisdictions, listQuoteSlots } from '@/features/booking/api/bookingApi';
import { useBooking } from '@/features/booking/store';
import { useDebouncedQuote } from '@/features/booking/hooks/useDebouncedQuote';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Alert } from '@/shared/components/ui/alert';
import { toast } from 'sonner';
import { createSpec } from '@/features/booking/lib/quoteDraft';
import { PageShell } from '@/shared/components/PageShell';
import { PageHeader } from '@/shared/components/PageHeader';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Table, TableCell, TableHead, TableRow } from '@/shared/components/ui/table';

const durationOptions = [30, 60, 90];
const headcountOptions = [1, 2, 3, 4];
const travelZones = [
  { id: 'local', label: 'Local zone', detail: '0-10 miles from depot', miles: 5 },
  { id: 'extended', label: 'Extended zone', detail: '10-20 miles from depot', miles: 15 },
  { id: 'outside', label: 'Outside service area', detail: 'Beyond 20 miles', miles: 25 },
];
type ServiceConfig = {
  durationMinutes: number;
  headcount: number;
  toolsMode: 'provider' | 'customer';
  addOnIds: string[];
};
const compareRows = [
  { label: 'Category', getValue: (service: { category?: string }) => service.category ?? 'General service' },
  { label: 'Default duration', getValue: (service: { durationMinutes?: number }) => service.durationMinutes ? `${service.durationMinutes} min` : 'Quote-based' },
  { label: 'Typical price', getValue: (service: { price?: number }) => service.price ? `$${service.price}` : 'Custom quote' },
  { label: 'Tags', getValue: (service: { tags?: string[] }) => service.tags?.length ? service.tags.join(', ') : 'None listed' },
  { label: 'Bundles', getValue: (service: { bundles?: Array<{ title: string }> }) => service.bundles?.length ? service.bundles.map((bundle) => bundle.title).join(', ') : 'No bundles' },
  { label: 'Rating', getValue: (service: { rating?: number; reviewCount?: number }) => service.rating ? `${service.rating.toFixed(1)} (${service.reviewCount ?? 0} reviews)` : 'No reviews yet' },
];

function getServiceDuration(service: unknown) {
  if (service && typeof service === 'object' && 'durationMinutes' in service && typeof service.durationMinutes === 'number') {
    return service.durationMinutes;
  }
  return 60;
}

function getServiceAddOns(service: unknown) {
  if (service && typeof service === 'object' && 'addOns' in service && Array.isArray(service.addOns)) {
    return service.addOns.filter((item): item is string => typeof item === 'string');
  }
  return [];
}

function formatAddOnLabel(addOnId: string) {
  return addOnId.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function getTravelZoneId(milesFromDepot: number) {
  if (milesFromDepot <= 10) return 'local';
  if (milesFromDepot <= 20) return 'extended';
  return 'outside';
}

export function ComparePage() {
  const navigate = useNavigate();
  const { compareIds, setQuoteDraft } = useBooking();
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [serviceConfigs, setServiceConfigs] = useState<Record<string, ServiceConfig>>({});
  const [milesFromDepot, setMilesFromDepot] = useState<number>(10);
  const [jurisdictionId, setJurisdictionId] = useState('');
  const [sameDayPriority, setSameDayPriority] = useState(false);
  const [taxEnabled, setTaxEnabled] = useState(true);
  const [slotId, setSlotId] = useState('');
  const [slotStartInput, setSlotStartInput] = useState(() => {
    const value = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return value.toISOString().slice(0, 16);
  });
  const compareQuery = useQuery({ queryKey: ['compare'], queryFn: getCompare });
  const comparedServices = compareQuery.data ?? [];
  const jurisdictionsQuery = useQuery({
    queryKey: ['quote-jurisdictions'],
    queryFn: listQuoteJurisdictions,
  });
  const jurisdictionOptions = jurisdictionsQuery.data ?? [];
  const fallbackJurisdictionId = jurisdictionOptions[0]?.id ?? '';
  const effectiveJurisdictionId = jurisdictionId || fallbackJurisdictionId;
  const selectedJurisdiction = jurisdictionOptions.find((item) => item.id === effectiveJurisdictionId) ?? null;
  const taxLockedByJurisdiction = Boolean(selectedJurisdiction?.taxRequired);
  const effectiveTaxEnabled = taxLockedByJurisdiction ? true : taxEnabled;
  const slotStartDate = new Date(slotStartInput);
  const slotStartIso = Number.isNaN(slotStartDate.getTime()) ? new Date().toISOString() : slotStartDate.toISOString();
  const hasValidSlotId = Boolean(slotId);
  const primaryServiceId = selectedServiceId;
  const activeConfig = primaryServiceId ? serviceConfigs[primaryServiceId] : undefined;
  const selectedService = comparedServices.find((service) => service.id === primaryServiceId) ?? null;
  const addOnOptions = getServiceAddOns(selectedService).map((addOnId) => ({ id: addOnId, label: formatAddOnLabel(addOnId) }));
  const slotsQuery = useQuery({
    queryKey: ['quote-slots', primaryServiceId],
    queryFn: () => listQuoteSlots(primaryServiceId),
    enabled: primaryServiceId.length > 0,
  });
  const quoteInput = useMemo(() => primaryServiceId ? {
    lineItems: [{
      type: 'service' as const,
      serviceId: primaryServiceId,
      durationMinutes: activeConfig?.durationMinutes ?? 60,
      quantity: 1,
      spec: {
        headcount: activeConfig?.headcount ?? 1,
        toolsMode: activeConfig?.toolsMode ?? 'provider',
        addOnIds: activeConfig?.addOnIds ?? [],
      },
    }],
    milesFromDepot,
    jurisdictionId: effectiveJurisdictionId || fallbackJurisdictionId,
    sameDayPriority,
    taxEnabled: effectiveTaxEnabled,
    slotStart: slotStartIso,
  } : null, [primaryServiceId, activeConfig?.durationMinutes, activeConfig?.headcount, activeConfig?.toolsMode, activeConfig?.addOnIds, milesFromDepot, effectiveJurisdictionId, fallbackJurisdictionId, sameDayPriority, effectiveTaxEnabled, slotStartIso]);
  const quoteQuery = useDebouncedQuote(quoteInput);
  const exceedsServiceZone = milesFromDepot > 20;
  const selectedTravelZone = getTravelZoneId(milesFromDepot);

  useEffect(() => {
    if (!comparedServices.length) {
      setSelectedServiceId('');
      return;
    }
    if (!selectedServiceId || !comparedServices.some((service) => service.id === selectedServiceId)) {
      setSelectedServiceId(comparedServices[0].id);
    }
  }, [comparedServices, selectedServiceId]);

  useEffect(() => {
    if (!comparedServices.length) {
      setServiceConfigs({});
      return;
    }

    setServiceConfigs((current) => {
      const next = comparedServices.reduce<Record<string, ServiceConfig>>((acc, service) => {
        acc[service.id] = current[service.id] ?? {
          durationMinutes: getServiceDuration(service),
          headcount: 1,
          toolsMode: 'provider',
          addOnIds: [],
        };
        return acc;
      }, {});

      return next;
    });
  }, [comparedServices]);

  useEffect(() => {
    if (!jurisdictionId && fallbackJurisdictionId) {
      setJurisdictionId(fallbackJurisdictionId);
    }
  }, [jurisdictionId, fallbackJurisdictionId]);

  useEffect(() => {
    if (!slotId && slotsQuery.data?.length) {
      const first = slotsQuery.data[0];
      setSlotId(first.slotId);
      setSlotStartInput(new Date(first.startTime).toISOString().slice(0, 16));
    }
  }, [slotId, slotsQuery.data]);

  function updateServiceConfig(serviceId: string, updates: Partial<ServiceConfig>) {
    setServiceConfigs((current) => ({
      ...current,
      [serviceId]: {
        ...(current[serviceId] ?? { durationMinutes: 60, headcount: 1, toolsMode: 'provider', addOnIds: [] }),
        ...updates,
      },
    }));
  }

  function toggleAddOn(serviceId: string, addOnId: string) {
    const currentAddOns = serviceConfigs[serviceId]?.addOnIds ?? [];
    updateServiceConfig(serviceId, {
      addOnIds: currentAddOns.includes(addOnId) ? currentAddOns.filter((id) => id !== addOnId) : [...currentAddOns, addOnId],
    });
  }

  return (
    <PageShell>
      <div className="grid gap-6">
        <PageHeader title="Compare" description="Review services side by side, then proceed to quote." />
        {compareIds.length >= 5 && <Alert>Compare is capped at 5 services.</Alert>}
        {comparedServices.length > 0 && (
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Side-by-side comparison</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <thead>
                  <TableRow>
                    <TableHead>Criteria</TableHead>
                    {comparedServices.map((service) => (
                      <TableHead key={service.id}>
                        <div className="grid gap-3">
                          <div>
                            <p className="text-base font-semibold text-foreground">{service.title}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{service.description ?? 'No description available.'}</p>
                          </div>
                          <Button variant={selectedServiceId === service.id ? 'default' : 'secondary'} onClick={() => setSelectedServiceId(service.id)}>
                            {selectedServiceId === service.id ? 'Selected for quote' : 'Use for quote'}
                          </Button>
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </thead>
                <tbody>
                  {compareRows.map((row) => (
                    <TableRow key={row.label}>
                      <TableCell>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{row.label}</p>
                      </TableCell>
                      {comparedServices.map((service) => (
                        <TableCell key={`${service.id}-${row.label}`}>
                          <p className="text-sm text-foreground">{row.getValue(service)}</p>
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell><p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Configured duration</p></TableCell>
                    {comparedServices.map((service) => (
                      <TableCell key={`${service.id}-duration`}><p className="text-sm text-foreground">{serviceConfigs[service.id]?.durationMinutes ?? getServiceDuration(service)} min</p></TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell><p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Headcount</p></TableCell>
                    {comparedServices.map((service) => (
                      <TableCell key={`${service.id}-headcount`}><p className="text-sm text-foreground">{serviceConfigs[service.id]?.headcount ?? 1} staff</p></TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell><p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Tools</p></TableCell>
                    {comparedServices.map((service) => (
                      <TableCell key={`${service.id}-tools`}><p className="text-sm text-foreground">{serviceConfigs[service.id]?.toolsMode === 'customer' ? 'Customer provides tools' : 'Provider brings tools'}</p></TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell><p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Selected add-ons</p></TableCell>
                    {comparedServices.map((service) => (
                      <TableCell key={`${service.id}-addons`}><p className="text-sm text-foreground">{(serviceConfigs[service.id]?.addOnIds ?? []).length ? (serviceConfigs[service.id]?.addOnIds ?? []).map((id) => addOnOptions.find((option) => option.id === id)?.label ?? id).join(', ') : 'None selected'}</p></TableCell>
                    ))}
                  </TableRow>
                </tbody>
              </Table>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader><CardTitle>Quote</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-4 rounded-xl border border-border bg-background p-3">
              <div className="grid gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Booking slot</p>
                <div className="grid gap-2 sm:max-w-sm">
                  <Input
                    type="datetime-local"
                    value={slotStartInput}
                    onChange={(event) => setSlotStartInput(event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Showing availability for {comparedServices.find((service) => service.id === primaryServiceId)?.title ?? 'the selected service'}.</p>
                </div>
                {slotsQuery.isSuccess && slotsQuery.data.length > 0 && (
                  <div className="grid gap-2">
                    <p className="text-xs text-muted-foreground">Available slots</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {slotsQuery.data.map((slot) => (
                        <button
                          key={slot.slotId}
                          type="button"
                          className={slotId === slot.slotId ? 'rounded-lg border border-primary/40 bg-muted px-3 py-2 text-left' : 'rounded-lg border border-border bg-card px-3 py-2 text-left'}
                          onClick={() => {
                            setSlotId(slot.slotId);
                            setSlotStartInput(new Date(slot.startTime).toISOString().slice(0, 16));
                          }}
                        >
                          <p className="text-sm font-medium text-foreground">{new Date(slot.startTime).toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">Capacity: {slot.remainingCapacity}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {slotsQuery.isSuccess && slotsQuery.data.length === 0 && <Alert>No upcoming slots available for this service.</Alert>}
              </div>

              <div className="grid gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Priority</p>
                <label className="flex min-h-11 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
                  <input
                    type="checkbox"
                    checked={sameDayPriority}
                    onChange={(event) => setSameDayPriority(event.target.checked)}
                  />
                  <span className="text-sm text-foreground">Same-day priority (adds $25 when booking starts within 4 hours)</span>
                </label>
                <p className="text-xs text-muted-foreground">Priority surcharge applies only when this option is selected and the slot starts in less than 4 hours.</p>
              </div>

              <div className="grid gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Sales tax</p>
                <select
                  className="h-11 max-w-xs rounded-xl border border-input bg-background px-3 text-sm outline-none"
                  value={jurisdictionId || fallbackJurisdictionId}
                  onChange={(event) => setJurisdictionId(event.target.value)}
                >
                  {jurisdictionOptions.map((jurisdiction) => (
                    <option key={jurisdiction.id} value={jurisdiction.id}>
                      {jurisdiction.name} {jurisdiction.taxRequired ? `(${Math.round(jurisdiction.taxRate * 100)}%)` : '(No tax)'}
                    </option>
                  ))}
                </select>
                <label className="flex min-h-11 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
                  <input
                    type="checkbox"
                    checked={effectiveTaxEnabled}
                    disabled={taxLockedByJurisdiction}
                    onChange={(event) => setTaxEnabled(event.target.checked)}
                  />
                  <span className="text-sm text-foreground">Apply sales tax</span>
                </label>
                <p className="text-xs text-muted-foreground">
                  {taxLockedByJurisdiction
                    ? 'Tax is required for the selected jurisdiction and cannot be disabled.'
                    : 'Tax toggle is available because this jurisdiction is tax-exempt by policy.'}
                </p>
              </div>

              <div className="grid gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Travel zone</p>
                <div className="grid gap-2">
                  <div className="grid gap-2 sm:grid-cols-3">
                    {travelZones.map((zone) => (
                      <button
                        key={zone.id}
                        type="button"
                        className={selectedTravelZone === zone.id ? 'rounded-xl border border-primary/40 bg-muted p-3 text-left' : 'rounded-xl border border-border bg-card p-3 text-left'}
                        onClick={() => setMilesFromDepot(zone.miles)}
                      >
                        <p className="text-sm font-medium text-foreground">{zone.label}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{zone.detail}</p>
                      </button>
                    ))}
                  </div>
                  <div className="grid gap-2 sm:max-w-xs">
                    <p className="text-xs text-muted-foreground">Exact mileage override</p>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={milesFromDepot}
                      onChange={(event) => setMilesFromDepot(Math.max(0, Number(event.target.value) || 0))}
                      placeholder="Miles from depot"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Travel fees follow the selected zone band. Service is unavailable beyond 20 miles.</p>
                </div>
              </div>

              <div className="grid gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Duration</p>
                <div className="flex flex-wrap gap-2">
                  {durationOptions.map((minutes) => (
                    <Button key={minutes} variant={minutes === (activeConfig?.durationMinutes ?? 60) ? 'default' : 'secondary'} onClick={() => primaryServiceId && updateServiceConfig(primaryServiceId, { durationMinutes: minutes })}>
                      {minutes} min
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Headcount</p>
                <div className="flex flex-wrap gap-2">
                  {headcountOptions.map((count) => (
                    <Button key={count} variant={count === (activeConfig?.headcount ?? 1) ? 'default' : 'secondary'} onClick={() => primaryServiceId && updateServiceConfig(primaryServiceId, { headcount: count })}>
                      {count} staff
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Tools</p>
                <div className="flex flex-wrap gap-2">
                  <Button variant={(activeConfig?.toolsMode ?? 'provider') === 'provider' ? 'default' : 'secondary'} onClick={() => primaryServiceId && updateServiceConfig(primaryServiceId, { toolsMode: 'provider' })}>Provider brings tools</Button>
                  <Button variant={(activeConfig?.toolsMode ?? 'provider') === 'customer' ? 'default' : 'secondary'} onClick={() => primaryServiceId && updateServiceConfig(primaryServiceId, { toolsMode: 'customer' })}>I provide tools</Button>
                </div>
              </div>

              <div className="grid gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Add-ons</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {addOnOptions.map((addOn) => (
                    <label key={addOn.id} className="flex min-h-11 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
                      <input type="checkbox" checked={(activeConfig?.addOnIds ?? []).includes(addOn.id)} onChange={() => primaryServiceId && toggleAddOn(primaryServiceId, addOn.id)} />
                      <span className="text-sm text-foreground">{addOn.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {exceedsServiceZone && <Alert>Not serviceable beyond 20 miles. Reduce distance to continue checkout.</Alert>}
            {jurisdictionsQuery.isSuccess && jurisdictionOptions.length === 0 && <Alert>No jurisdictions are configured yet. Contact support.</Alert>}
            <p className="body-base">Total: {quoteQuery.data?.total ?? '--'}</p>
            {quoteQuery.data?.notServiceable && <p className="text-sm text-destructive">Not serviceable</p>}
            {quoteQuery.data?.taxBreakdown?.map((row) => <p key={row.label} className="text-sm text-muted-foreground">{row.label}: {row.amount}</p>)}
            {quoteQuery.isLoading && <p className="text-sm text-muted-foreground">Updating quote...</p>}
            <Button onClick={() => {
            if (!primaryServiceId || !quoteQuery.data) {
              toast.error('Choose a service to quote and wait for pricing to finish.');
              return;
            }
            if (exceedsServiceZone || quoteQuery.data.notServiceable) {
              toast.error('This location is outside the serviceable zone.');
              return;
            }
            if (!fallbackJurisdictionId) {
              toast.error('No tax jurisdiction available for quoting.');
              return;
            }
            if (!hasValidSlotId) {
              toast.error('Select an available slot before checkout.');
              return;
            }
            setQuoteDraft({
              spec: {
                ...createSpec(primaryServiceId, activeConfig?.durationMinutes ?? 60),
                headcount: activeConfig?.headcount ?? 1,
                toolsMode: activeConfig?.toolsMode ?? 'provider',
                addOnIds: activeConfig?.addOnIds ?? [],
              },
              lineItems: [{
                type: 'service',
                serviceId: primaryServiceId,
                durationMinutes: activeConfig?.durationMinutes ?? 60,
                quantity: 1,
                spec: {
                  headcount: activeConfig?.headcount ?? 1,
                  toolsMode: activeConfig?.toolsMode ?? 'provider',
                  addOnIds: activeConfig?.addOnIds ?? [],
                },
              }],
              bookingRequestedAt: new Date().toISOString(),
              slotId,
              slotStart: slotStartIso,
              quoteSignature: quoteQuery.data.quoteSignature ?? null,
              jurisdictionId: effectiveJurisdictionId || fallbackJurisdictionId,
              milesFromDepot,
              sameDayPriority,
              taxEnabled: effectiveTaxEnabled,
            });
            navigate('/checkout');
            }} disabled={!hasValidSlotId}>Checkout</Button>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
