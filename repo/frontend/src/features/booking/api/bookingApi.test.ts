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

  it('setCompare persists ids and reloads compare details', async () => {
    requestMock
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ serviceIds: ['svc-1'] });
    getServiceMock.mockResolvedValue({ id: 'svc-1', title: 'One' });

    await expect(setCompare(['svc-1'])).resolves.toEqual([{ id: 'svc-1', title: 'One' }]);
    expect(requestMock).toHaveBeenNthCalledWith(1, {
      method: 'PUT',
      path: '/api/compare',
      body: { serviceIds: ['svc-1'] },
    });
  });
});
