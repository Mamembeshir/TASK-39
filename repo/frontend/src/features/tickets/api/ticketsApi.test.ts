import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requestMock } = vi.hoisted(() => ({ requestMock: vi.fn() }));

vi.mock('@/api/client', () => ({
  client: {
    request: requestMock,
    withAuth: () => ({ request: requestMock }),
  },
}));

import {
  createTicket,
  getTicket,
  listTickets,
  resolveTicket,
  setTicketLegalHold,
  updateTicketStatus,
  uploadTicketAttachments,
} from '@/features/tickets/api/ticketsApi';

describe('ticketsApi', () => {
  beforeEach(() => {
    requestMock.mockReset();
  });

  it('createTicket, updateTicketStatus, legalHold, and resolveTicket call expected endpoints', async () => {
    requestMock.mockResolvedValue({});

    await createTicket({ orderId: 'ord-1', category: 'billing', description: 'help' });
    await updateTicketStatus('tick-1', 'open');
    await setTicketLegalHold('tick-1', true);
    await resolveTicket('tick-1', { summaryText: 'done', attachmentIds: ['m1'] });

    expect(requestMock).toHaveBeenNthCalledWith(1, {
      method: 'POST',
      path: '/api/tickets',
      body: { orderId: 'ord-1', category: 'billing', description: 'help' },
    });
    expect(requestMock).toHaveBeenNthCalledWith(2, {
      method: 'POST',
      path: '/api/tickets/tick-1/status',
      body: { status: 'open' },
    });
    expect(requestMock).toHaveBeenNthCalledWith(3, {
      method: 'POST',
      path: '/api/tickets/tick-1/legal-hold',
      body: { legalHold: true },
    });
    expect(requestMock).toHaveBeenNthCalledWith(4, {
      method: 'POST',
      path: '/api/tickets/tick-1/resolve',
      body: { summaryText: 'done', attachmentIds: ['m1'] },
    });
  });

  it('listTickets normalizes non-array responses and getTicket unwraps ticket', async () => {
    requestMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ticket: { id: 'tick-1', orderId: 'ord-1' } });

    await expect(listTickets()).resolves.toEqual([]);
    await expect(getTicket('tick-1')).resolves.toEqual({ id: 'tick-1', orderId: 'ord-1' });
  });

  it('uploadTicketAttachments posts ticket form-data and maps media ids', async () => {
    requestMock.mockResolvedValue({ media: [{ mediaId: 'm1' }, { mediaId: 'm2' }] });

    const fileA = new File(['a'], 'a.png', { type: 'image/png' });
    const fileB = new File(['b'], 'b.png', { type: 'image/png' });
    const result = await uploadTicketAttachments([fileA, fileB]);

    expect(result).toEqual({ mediaIds: ['m1', 'm2'] });
    const call = requestMock.mock.calls[0][0];
    expect(call.method).toBe('POST');
    expect(call.path).toBe('/api/media');
    expect(call.formData).toBeInstanceOf(FormData);
    expect(call.formData.get('purpose')).toBe('ticket');
    expect(call.formData.getAll('files')).toHaveLength(2);
  });
});
