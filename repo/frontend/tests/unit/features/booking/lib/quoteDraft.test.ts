import { describe, it, expect } from 'vitest';
import { buildQuotePayload, createSpec } from '@/features/booking/lib/quoteDraft';
import type { QuoteDraft, QuoteSpec } from '@/features/booking/store';

const baseSpec: QuoteSpec = {
  serviceId: 'svc-1',
  durationMinutes: 90,
  headcount: 2,
  toolsMode: 'provider',
  addOnIds: ['addon-a'],
};

const emptyDraft: QuoteDraft = {
  spec: null,
  lineItems: undefined,
  bookingRequestedAt: null,
  slotId: null,
  slotStart: null,
  quoteSignature: null,
  jurisdictionId: null,
  milesFromDepot: null,
};

describe('buildQuotePayload', () => {
  it('returns null when spec is null and lineItems are absent', () => {
    expect(buildQuotePayload(emptyDraft)).toBeNull();
  });

  it('returns null when spec is null and lineItems is an empty array', () => {
    expect(buildQuotePayload({ ...emptyDraft, lineItems: [] })).toBeNull();
  });

  it('builds a lineItem from spec when no lineItems are provided', () => {
    const draft: QuoteDraft = { ...emptyDraft, spec: baseSpec };
    const payload = buildQuotePayload(draft);
    expect(payload).not.toBeNull();
    expect(payload!.lineItems).toHaveLength(1);
    const item = payload!.lineItems[0];
    expect(item.type).toBe('service');
    expect(item.serviceId).toBe('svc-1');
    expect(item.durationMinutes).toBe(90);
    expect(item.quantity).toBe(1);
    expect(item.spec.headcount).toBe(2);
    expect(item.spec.toolsMode).toBe('provider');
    expect(item.spec.addOnIds).toEqual(['addon-a']);
  });

  it('uses durationMinutes=60 as fallback when spec has no durationMinutes', () => {
    const spec = { ...baseSpec, durationMinutes: 0 };
    const payload = buildQuotePayload({ ...emptyDraft, spec });
    expect(payload!.lineItems[0].durationMinutes).toBe(60);
  });

  it('uses empty string as serviceId fallback when spec has no serviceId', () => {
    const spec: QuoteSpec = { ...baseSpec, serviceId: undefined };
    const payload = buildQuotePayload({ ...emptyDraft, spec });
    expect(payload!.lineItems[0].serviceId).toBe('');
  });

  it('passes through explicit lineItems unchanged and does not derive from spec', () => {
    const explicitLineItems = [
      { type: 'service' as const, serviceId: 'svc-explicit', durationMinutes: 45, quantity: 3, spec: { headcount: 4, toolsMode: 'customer' as const, addOnIds: [] } },
    ];
    const draft: QuoteDraft = { ...emptyDraft, spec: baseSpec, lineItems: explicitLineItems };
    const payload = buildQuotePayload(draft);
    expect(payload!.lineItems).toBe(explicitLineItems);
  });

  it('maps optional draft fields to undefined when falsy', () => {
    const draft: QuoteDraft = { ...emptyDraft, spec: baseSpec };
    const payload = buildQuotePayload(draft);
    expect(payload!.slotId).toBeUndefined();
    expect(payload!.bookingRequestedAt).toBeUndefined();
    expect(payload!.slotStart).toBeUndefined();
    expect(payload!.jurisdictionId).toBeUndefined();
    expect(payload!.quoteSignature).toBeUndefined();
  });

  it('includes slotId and other optional fields when provided', () => {
    const draft: QuoteDraft = {
      ...emptyDraft,
      spec: baseSpec,
      slotId: 'slot-42',
      bookingRequestedAt: '2024-01-01T10:00:00Z',
      slotStart: '2024-01-01T12:00:00Z',
      jurisdictionId: 'jur-1',
      quoteSignature: 'sig-abc',
      milesFromDepot: 5,
    };
    const payload = buildQuotePayload(draft);
    expect(payload!.slotId).toBe('slot-42');
    expect(payload!.bookingRequestedAt).toBe('2024-01-01T10:00:00Z');
    expect(payload!.slotStart).toBe('2024-01-01T12:00:00Z');
    expect(payload!.jurisdictionId).toBe('jur-1');
    expect(payload!.quoteSignature).toBe('sig-abc');
    expect(payload!.milesFromDepot).toBe(5);
  });

  it('sets sameDayPriority to false by default', () => {
    const payload = buildQuotePayload({ ...emptyDraft, spec: baseSpec });
    expect(payload!.sameDayPriority).toBe(false);
  });

  it('sets sameDayPriority to true when draft flag is set', () => {
    const payload = buildQuotePayload({ ...emptyDraft, spec: baseSpec, sameDayPriority: true });
    expect(payload!.sameDayPriority).toBe(true);
  });

  it('preserves taxEnabled on the payload', () => {
    const payload = buildQuotePayload({ ...emptyDraft, spec: baseSpec, taxEnabled: false });
    expect(payload!.taxEnabled).toBe(false);
  });

  it('passes spec through to the payload', () => {
    const payload = buildQuotePayload({ ...emptyDraft, spec: baseSpec });
    expect(payload!.spec).toBe(baseSpec);
  });

  it('maps milesFromDepot=null to undefined', () => {
    const payload = buildQuotePayload({ ...emptyDraft, spec: baseSpec, milesFromDepot: null });
    expect(payload!.milesFromDepot).toBeUndefined();
  });
});

describe('createSpec', () => {
  it('returns a spec with the given serviceId and durationMinutes', () => {
    const spec = createSpec('svc-99', 120);
    expect(spec.serviceId).toBe('svc-99');
    expect(spec.durationMinutes).toBe(120);
  });

  it('defaults headcount to 1', () => {
    const spec = createSpec('svc-1', 60);
    expect(spec.headcount).toBe(1);
  });

  it('defaults toolsMode to "provider"', () => {
    const spec = createSpec('svc-1', 60);
    expect(spec.toolsMode).toBe('provider');
  });

  it('defaults addOnIds to an empty array', () => {
    const spec = createSpec('svc-1', 60);
    expect(spec.addOnIds).toEqual([]);
  });
});
