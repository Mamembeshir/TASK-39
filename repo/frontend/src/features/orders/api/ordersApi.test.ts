import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requestMock } = vi.hoisted(() => ({ requestMock: vi.fn() }));

vi.mock('@/api/client', () => ({
  client: {
    request: requestMock,
    withAuth: () => ({ request: requestMock }),
  },
}));

import {
  completeOrderById,
  createCapacitySlot,
  createOrder,
  deleteCapacitySlot,
  getOrder,
  listCapacitySlots,
  listOrders,
  updateCapacitySlot,
} from '@/features/orders/api/ordersApi';

describe('ordersApi', () => {
  beforeEach(() => {
    requestMock.mockReset();
  });

  it('createOrder maps create response to summary shape', async () => {
    requestMock.mockResolvedValue({ orderId: 'ord-1', state: 'pending' });

    await expect(createOrder({ lineItems: [], slotId: 'slot-1', quoteSignature: 'sig' })).resolves.toEqual({
      id: 'ord-1',
      status: 'pending',
    });
  });

  it('listOrders and listCapacitySlots normalize arrays', async () => {
    requestMock.mockResolvedValueOnce(null).mockResolvedValueOnce([{ id: 'slot-1', startTime: 't', remainingCapacity: 1 }]);

    await expect(listOrders()).resolves.toEqual([]);
    await expect(listCapacitySlots()).resolves.toEqual([{ id: 'slot-1', startTime: 't', remainingCapacity: 1 }]);
  });

  it('getOrder unwraps nested order payload', async () => {
    requestMock.mockResolvedValue({
      order: {
        id: 'ord-1',
        state: 'completed',
        pricingSnapshot: { total: 100 },
        lineItems: [{ type: 'service', serviceId: 'svc-1', durationMinutes: 30, quantity: 1 }],
      },
    });

    await expect(getOrder('ord-1')).resolves.toEqual({
      id: 'ord-1',
      status: 'completed',
      total: 100,
      lineItems: [{ type: 'service', serviceId: 'svc-1', durationMinutes: 30, quantity: 1 }],
      quote: undefined,
    });
  });

  it('slot mutation helpers and completion call expected endpoints', async () => {
    requestMock.mockResolvedValue({});

    await createCapacitySlot({ serviceId: 'svc-1', startTime: '2026-01-01T00:00:00.000Z', remainingCapacity: 2 });
    await updateCapacitySlot('slot-1', { startTime: '2026-01-02T00:00:00.000Z', remainingCapacity: 1 });
    await deleteCapacitySlot('slot-1');
    await completeOrderById('ord-1');

    expect(requestMock).toHaveBeenNthCalledWith(1, {
      method: 'POST',
      path: '/api/staff/orders/slots',
      body: { serviceId: 'svc-1', startTime: '2026-01-01T00:00:00.000Z', remainingCapacity: 2 },
    });
    expect(requestMock).toHaveBeenNthCalledWith(2, {
      method: 'POST',
      path: '/api/staff/orders/slots/slot-1',
      body: { startTime: '2026-01-02T00:00:00.000Z', remainingCapacity: 1 },
    });
    expect(requestMock).toHaveBeenNthCalledWith(3, { method: 'DELETE', path: '/api/staff/orders/slots/slot-1' });
    expect(requestMock).toHaveBeenNthCalledWith(4, { method: 'POST', path: '/api/staff/orders/ord-1/complete' });
  });
});
