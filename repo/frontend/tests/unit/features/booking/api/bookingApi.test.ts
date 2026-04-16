import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requestMock, getServiceMock } = vi.hoisted(() => ({
  requestMock: vi.fn(),
  getServiceMock: vi.fn(),
}));

vi.mock('@/api/client', () => ({
  client: {
    request: requestMock,
    withAuth: () => ({ request: requestMock }),
  },
}));

vi.mock('@/features/catalog/api/catalogApi', () => ({
  getService: getServiceMock,
}));

import {
  addFavorite,
  getCompare,
  getCompareIds,
  listFavorites,
  listQuoteJurisdictions,
  listQuoteSlots,
  quote,
  removeFavorite,
  setCompare,
} from '@/features/booking/api/bookingApi';

describe('bookingApi', () => {
  beforeEach(() => {
    requestMock.mockReset();
    getServiceMock.mockReset();
  });

  it('listFavorites returns normalized empty list', async () => {
    requestMock.mockResolvedValue({ favorites: null });
    await expect(listFavorites()).resolves.toEqual([]);
  });

  it('addFavorite and removeFavorite call expected endpoints', async () => {
    requestMock.mockResolvedValue({});

    await addFavorite('svc-1');
    await removeFavorite('svc-1');

    expect(requestMock).toHaveBeenNthCalledWith(1, { method: 'POST', path: '/api/favorites/svc-1' });
    expect(requestMock).toHaveBeenNthCalledWith(2, { method: 'DELETE', path: '/api/favorites/svc-1' });
  });

  it('quote strips signal from body and forwards it separately', async () => {
    requestMock.mockResolvedValue({});
    const signal = new AbortController().signal;

    await quote({
      lineItems: [{ type: 'service', serviceId: 'svc-1', durationMinutes: 30, quantity: 1 }],
      milesFromDepot: 5,
      signal,
    });

    expect(requestMock).toHaveBeenCalledWith({
      method: 'POST',
      path: '/api/quote',
      body: {
        lineItems: [{ type: 'service', serviceId: 'svc-1', durationMinutes: 30, quantity: 1 }],
        milesFromDepot: 5,
      },
      signal,
    });
  });

  it('quote normalizes backend totals contract to frontend shape', async () => {
    requestMock.mockResolvedValue({
      totals: {
        total: 145,
        subtotalBeforeTax: 133.33,
        tax: 11.67,
        travelFee: 10,
        sameDaySurcharge: 25,
      },
      itemizedLines: [
        { serviceId: 'svc-1', lineTotal: 120 },
      ],
      quoteSignature: 'sig-1',
      notServiceable: false,
    });

    await expect(quote({
      lineItems: [{ type: 'service', serviceId: 'svc-1', durationMinutes: 60, quantity: 1 }],
    })).resolves.toEqual({
      totals: {
        total: 145,
        subtotalBeforeTax: 133.33,
        tax: 11.67,
        travelFee: 10,
        sameDaySurcharge: 25,
      },
      itemizedLines: [
        { serviceId: 'svc-1', lineTotal: 120 },
      ],
      quoteSignature: 'sig-1',
      notServiceable: false,
      total: 145,
      subtotal: 133.33,
      tax: 11.67,
      travelFee: 10,
      sameDaySurcharge: 25,
      taxBreakdown: [
        { label: 'Subtotal', amount: 133.33 },
        { label: 'Tax', amount: 11.67 },
      ],
      lineItems: [{ serviceId: 'svc-1', bundleId: undefined, amount: 120 }],
    });
  });

  it('listQuoteSlots and listQuoteJurisdictions normalize arrays', async () => {
    requestMock
      .mockResolvedValueOnce({ slots: [{ slotId: 'slot-1', startTime: 't', remainingCapacity: 1 }] })
      .mockResolvedValueOnce({ jurisdictions: [{ id: 'US-OR-PDX', name: 'Portland', taxRequired: false, taxRate: 0 }] });

    await expect(listQuoteSlots('svc-1', '2026-01-01T00:00:00.000Z')).resolves.toEqual([
      { slotId: 'slot-1', startTime: 't', remainingCapacity: 1 },
    ]);
    await expect(listQuoteJurisdictions()).resolves.toEqual([
      { id: 'US-OR-PDX', name: 'Portland', taxRequired: false, taxRate: 0 },
    ]);

    expect(requestMock).toHaveBeenNthCalledWith(1, {
      method: 'GET',
      path: '/api/quote/slots',
      query: { serviceId: 'svc-1', startAfter: '2026-01-01T00:00:00.000Z', limit: 12 },
    });
    expect(requestMock).toHaveBeenNthCalledWith(2, {
      method: 'GET',
      path: '/api/quote/jurisdictions',
    });
  });

  it('getCompare resolves service details and filters failures', async () => {
    requestMock.mockResolvedValue({ serviceIds: ['svc-1', 'svc-2'] });
    getServiceMock
      .mockResolvedValueOnce({ id: 'svc-1', title: 'One' })
      .mockRejectedValueOnce(new Error('missing'));

    await expect(getCompare()).resolves.toEqual([{ id: 'svc-1', title: 'One' }]);
  });

  it('getCompareIds returns normalized ids', async () => {
    requestMock.mockResolvedValue({ serviceIds: ['svc-1', 'svc-2', 'svc-3', 'svc-4', 'svc-5', 'svc-6'] });
    await expect(getCompareIds()).resolves.toEqual(['svc-1', 'svc-2', 'svc-3', 'svc-4', 'svc-5']);
  });

  it('setCompare persists ids and returns canonical id list', async () => {
    requestMock.mockResolvedValueOnce({ serviceIds: ['svc-1'] });

    await expect(setCompare(['svc-1'])).resolves.toEqual(['svc-1']);
    expect(requestMock).toHaveBeenNthCalledWith(1, {
      method: 'PUT',
      path: '/api/compare',
      body: { serviceIds: ['svc-1'] },
    });
  });

  it('quote builds tax breakdown from flat subtotal/tax fields when taxBreakdown absent', async () => {
    requestMock.mockResolvedValueOnce({ total: 120, subtotal: 100, tax: 20 });
    const result = await quote({ lineItems: [], sameDayPriority: false, taxEnabled: true } as any);
    expect(result.taxBreakdown).toEqual([
      { label: 'Subtotal', amount: 100 },
      { label: 'Tax', amount: 20 },
    ]);
  });

  it('quote returns undefined taxBreakdown when no totals available', async () => {
    requestMock.mockResolvedValueOnce({ total: 50 });
    const result = await quote({ lineItems: [], sameDayPriority: false, taxEnabled: false } as any);
    expect(result.taxBreakdown).toBeUndefined();
  });

  it('listQuoteJurisdictions returns empty array when response has no jurisdictions', async () => {
    requestMock.mockResolvedValueOnce({});
    const result = await listQuoteJurisdictions();
    expect(result).toEqual([]);
  });
});
