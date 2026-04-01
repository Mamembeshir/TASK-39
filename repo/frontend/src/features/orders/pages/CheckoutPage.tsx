import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { createOrder } from '@/features/orders/api/ordersApi';
import { listQuoteJurisdictions, listQuoteSlots } from '@/features/booking/api/bookingApi';
import { useDebouncedQuote } from '@/features/booking/hooks/useDebouncedQuote';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Alert } from '@/shared/components/ui/alert';
import { toast } from 'sonner';
import { showApiError } from '@/shared/lib/showApiError';
import { useBooking } from '@/features/booking/store';
import { buildQuotePayload } from '@/features/booking/lib/quoteDraft';
import { navigateTransition } from '@/shared/lib/navigateTransition';
import { PageShell } from '@/shared/components/PageShell';
import { PageHeader } from '@/shared/components/PageHeader';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';

const travelZones = [
  { id: 'local', label: 'Local zone', detail: '0-10 miles from depot', miles: 5 },
  { id: 'extended', label: 'Extended zone', detail: '10-20 miles from depot', miles: 15 },
  { id: 'outside', label: 'Outside service area', detail: 'Beyond 20 miles', miles: 25 },
];

function getTravelZoneId(milesFromDepot: number) {
  if (milesFromDepot <= 10) return 'local';
  if (milesFromDepot <= 20) return 'extended';
  return 'outside';
}

type CheckoutState = {
  lineItems?: Array<{ type: 'service'; serviceId: string; durationMinutes: number; quantity: number } | { type: 'bundle'; bundleId: string; quantity: number; specs: Array<{ serviceId: string; durationMinutes: number }> }>;
  quote?: { total?: number; quoteSignature?: string; notServiceable?: boolean; taxBreakdown?: Array<{ label: string; amount: number }> };
};

type AlternativeSlot = {
  slotId: string;
  startTime: string;
  remainingCapacity: number;
};

export function CheckoutPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { quoteDraft } = useBooking();
  const state = (location.state as CheckoutState | null) ?? {};
  const [error, setError] = useState<string | null>(null);
  const [alternativeSlots, setAlternativeSlots] = useState<AlternativeSlot[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [jurisdictionId, setJurisdictionId] = useState(quoteDraft.jurisdictionId && quoteDraft.jurisdictionId !== 'tax-exempt' ? quoteDraft.jurisdictionId : '');
  const [slotId, setSlotId] = useState(quoteDraft.slotId ?? '');
  const [milesFromDepot, setMilesFromDepot] = useState<number>(quoteDraft.milesFromDepot ?? 10);
  const [sameDayPriority, setSameDayPriority] = useState(Boolean(quoteDraft.sameDayPriority));
  const [taxEnabled, setTaxEnabled] = useState(quoteDraft.taxEnabled ?? true);
  const [slotStartInput, setSlotStartInput] = useState(() => {
    if (!quoteDraft.slotStart) return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
    return new Date(quoteDraft.slotStart).toISOString().slice(0, 16);
  });
  const lineItems = state.lineItems ?? quoteDraft.lineItems ?? (quoteDraft.spec ? [{
    type: 'service' as const,
    serviceId: quoteDraft.spec.serviceId || '',
    durationMinutes: quoteDraft.spec.durationMinutes,
    quantity: 1,
    spec: {
      headcount: quoteDraft.spec.headcount,
      toolsMode: quoteDraft.spec.toolsMode,
      addOnIds: quoteDraft.spec.addOnIds,
    },
  }] : []);
  const primaryServiceId = lineItems[0]?.type === 'bundle' ? lineItems[0].specs[0]?.serviceId ?? '' : lineItems[0]?.serviceId ?? '';
  const slotsQuery = useQuery({
    queryKey: ['checkout-slots', primaryServiceId],
    queryFn: () => listQuoteSlots(primaryServiceId),
    enabled: primaryServiceId.length > 0,
  });
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
  const hasValidSlotId = Boolean(slotId);
  const slotStartDate = new Date(slotStartInput);
  const slotStartIso = Number.isNaN(slotStartDate.getTime()) ? quoteDraft.slotStart || new Date().toISOString() : slotStartDate.toISOString();
  const selectedTravelZone = getTravelZoneId(milesFromDepot);

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
  const quote = state.quote;
  const checkoutPayload = useMemo(() => {
    const fromDraft = buildQuotePayload(quoteDraft);
    if (fromDraft) {
      return {
        ...fromDraft,
        slotId,
        slotStart: slotStartIso,
        milesFromDepot,
        jurisdictionId: effectiveJurisdictionId,
        sameDayPriority,
        taxEnabled: effectiveTaxEnabled,
      };
    }
    return null;
  }, [quoteDraft, slotId, slotStartIso, milesFromDepot, effectiveJurisdictionId, sameDayPriority, effectiveTaxEnabled]);

  const liveQuoteInput = useMemo(
    () => (lineItems.length
      ? {
          lineItems,
          slotStart: slotStartIso,
          bookingRequestedAt: quoteDraft.bookingRequestedAt || new Date().toISOString(),
          milesFromDepot,
          jurisdictionId: effectiveJurisdictionId,
          sameDayPriority,
          taxEnabled: effectiveTaxEnabled,
        }
      : null),
    [lineItems, slotStartIso, quoteDraft.bookingRequestedAt, milesFromDepot, effectiveJurisdictionId, sameDayPriority, effectiveTaxEnabled],
  );
  const liveQuote = useDebouncedQuote(liveQuoteInput);

  async function submit() {
    if (!checkoutPayload) {
      toast.error('Select a service, slot, and finished quote before checkout.');
      setError('Checkout requires a valid quote and slot.');
      return;
    }
    if (!liveQuote.data?.quoteSignature) {
      toast.error('Waiting for latest quote validation.');
      setError('Quote validation is still running.');
      return;
    }
    setSubmitting(true);
    setError(null);
    setAlternativeSlots([]);
    try {
      const order = await createOrder({
        ...checkoutPayload,
        quoteSignature: liveQuote.data.quoteSignature,
      });
      navigateTransition(navigate, `/orders/${order.id}`, { replace: true });
    } catch (cause) {
      const conflict = cause as { code?: string; message?: string; details?: unknown; alternatives?: unknown };
      if (conflict.code === 'SLOT_UNAVAILABLE' && Array.isArray(conflict.alternatives)) {
        setAlternativeSlots(conflict.alternatives.filter((item): item is AlternativeSlot => Boolean(item && typeof item === 'object' && 'slotId' in item && 'startTime' in item)));
      }
      const details = conflict.details ? ` Details: ${JSON.stringify(conflict.details)}` : '';
      const message = showApiError(cause);
      toast.error(message);
      setError(`${message}${details}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageShell width="narrow">
      <div className="grid gap-6">
        <PageHeader title="Checkout" description="Review your quote, confirm the selected slot, and place the order." />
        <Card>
          <CardHeader><CardTitle>Step 1. Selections</CardTitle></CardHeader>
          <CardContent className="grid gap-2">
            {lineItems.length ? lineItems.map((item) => (
              <div key={item.type === 'bundle' ? item.bundleId : item.serviceId} className="text-sm text-muted-foreground">
                {item.type === 'bundle' ? `Bundle ${item.bundleId}` : item.serviceId}
              </div>
            )) : <p className="text-sm text-muted-foreground">No selections yet.</p>}
            <div className="mt-2 grid gap-2 rounded-xl border border-border bg-background p-3 sm:max-w-md">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Slot selection</p>
              <Input type="datetime-local" value={slotStartInput} onChange={(event) => setSlotStartInput(event.target.value)} />
              <p className="text-xs text-muted-foreground">Choose one of the available time slots.</p>
              {slotsQuery.isSuccess && slotsQuery.data.length > 0 && (
                <div className="grid gap-2">
                  <p className="text-xs text-muted-foreground">Available slots</p>
                  <div className="grid gap-2">
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
            <div className="mt-2 grid gap-2 rounded-xl border border-border bg-background p-3 sm:max-w-md">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Priority</p>
              <label className="flex min-h-11 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
                <input
                  type="checkbox"
                  checked={sameDayPriority}
                  onChange={(event) => setSameDayPriority(event.target.checked)}
                />
                <span className="text-sm text-foreground">Same-day priority (adds $25 when booking starts within 4 hours)</span>
              </label>
            </div>
            <div className="mt-2 grid gap-2 rounded-xl border border-border bg-background p-3 sm:max-w-md">
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
                  <Input type="number" min={0} max={100} step={1} value={milesFromDepot} onChange={(event) => setMilesFromDepot(Math.max(0, Number(event.target.value) || 0))} />
                </div>
                <p className="text-xs text-muted-foreground">Travel fees follow the selected zone band. Service is unavailable beyond 20 miles.</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Step 2. Quote summary</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-2 rounded-xl border border-border bg-background p-3">
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

            <p className="body-base">Total: {liveQuote.data?.total ?? quote?.total ?? '--'}</p>
            {liveQuote.isLoading && <p className="text-sm text-muted-foreground">Revalidating quote and capacity...</p>}
            {liveQuote.error && <Alert>{liveQuote.error}</Alert>}
            {jurisdictionsQuery.isSuccess && jurisdictionOptions.length === 0 && <Alert>No jurisdictions are configured yet.</Alert>}
            {(liveQuote.data?.notServiceable || quote?.notServiceable) && <Alert>Not serviceable</Alert>}
            {(liveQuote.data?.taxBreakdown ?? quote?.taxBreakdown)?.map((row) => <p key={row.label} className="text-sm text-muted-foreground">{row.label}: {row.amount}</p>)}
            {alternativeSlots.length > 0 && (
              <div className="grid gap-3 rounded-xl border border-border bg-background p-4">
                <div className="grid gap-1">
                  <p className="text-sm font-semibold text-foreground">Selected slot is no longer available</p>
                  <p className="text-sm text-muted-foreground">Choose one of these replacement slots to continue without restarting checkout.</p>
                </div>
                <div className="grid gap-2">
                  {alternativeSlots.map((slot) => (
                    <button
                      key={slot.slotId}
                      type="button"
                      className="rounded-lg border border-border bg-card px-3 py-3 text-left transition hover:border-primary/30 hover:bg-muted"
                      onClick={() => {
                        setSlotId(slot.slotId);
                        setSlotStartInput(new Date(slot.startTime).toISOString().slice(0, 16));
                        setAlternativeSlots([]);
                        setError(null);
                      }}
                    >
                      <p className="text-sm font-medium text-foreground">{new Date(slot.startTime).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Capacity remaining: {slot.remainingCapacity}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex flex-wrap gap-3">
              <Button disabled={submitting || lineItems.length === 0 || !checkoutPayload || !hasValidSlotId || !effectiveJurisdictionId || liveQuote.isLoading || !liveQuote.data?.quoteSignature || Boolean(liveQuote.data?.notServiceable)} onClick={submit}>{submitting ? 'Submitting...' : 'Place order'}</Button>
              {!hasValidSlotId && <p className="text-sm text-destructive">Select a slot to place order.</p>}
              <Button variant="secondary" disabled={submitting} onClick={() => navigate('/catalog')}>Back to catalog</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
