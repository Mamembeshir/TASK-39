import type { QuoteDraft, QuoteSpec } from '@/features/booking/store';

export function buildQuotePayload(draft: QuoteDraft) {
  if (!draft.spec && !draft.lineItems?.length) {
    return null;
  }

  const lineItems = draft.lineItems?.length
    ? draft.lineItems
    : [{
        type: 'service' as const,
        serviceId: draft.spec?.serviceId || '',
        durationMinutes: draft.spec?.durationMinutes || 60,
        quantity: 1,
        spec: {
          headcount: draft.spec?.headcount,
          toolsMode: draft.spec?.toolsMode,
          addOnIds: draft.spec?.addOnIds,
        },
      }];

  return {
    lineItems,
    slotId: draft.slotId || undefined,
    bookingRequestedAt: draft.bookingRequestedAt || undefined,
    slotStart: draft.slotStart || undefined,
    milesFromDepot: draft.milesFromDepot ?? undefined,
    jurisdictionId: draft.jurisdictionId || undefined,
    sameDayPriority: Boolean(draft.sameDayPriority),
    taxEnabled: draft.taxEnabled,
    quoteSignature: draft.quoteSignature || undefined,
    spec: draft.spec,
  };
}

export function createSpec(serviceId: string, durationMinutes: number): QuoteSpec {
  return { serviceId, durationMinutes, headcount: 1, toolsMode: 'provider', addOnIds: [] };
}

// Source of truth: the booking store holds the active quote draft (spec, slot selection,
// and quote signature) so checkout never invents IDs locally.
