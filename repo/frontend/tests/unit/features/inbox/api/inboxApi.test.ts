import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requestMock } = vi.hoisted(() => ({ requestMock: vi.fn() }));

vi.mock('@/api/client', () => ({
  client: {
    request: requestMock,
    withAuth: () => ({ request: requestMock }),
  },
}));

import { createStaffMessage, listInbox, markInboxRead } from '@/features/inbox/api/inboxApi';

describe('inboxApi', () => {
  beforeEach(() => {
    requestMock.mockReset();
  });

  it('listInbox returns messages array from response', async () => {
    requestMock.mockResolvedValue({ messages: [{ id: 'm1', title: 'Hello', body: 'World' }] });
    await expect(listInbox()).resolves.toEqual([{ id: 'm1', title: 'Hello', body: 'World' }]);
  });

  it('markInboxRead posts expected endpoint', async () => {
    requestMock.mockResolvedValue({});
    await markInboxRead('m1');
    expect(requestMock).toHaveBeenCalledWith({ method: 'POST', path: '/api/inbox/m1/read' });
  });

  it('createStaffMessage posts the payload to /api/staff/messages', async () => {
    requestMock.mockResolvedValue({ id: 'msg-1' });
    await createStaffMessage({ title: 'Heads up', body: 'Maintenance window', visibility: 'all' } as any);
    expect(requestMock).toHaveBeenCalledWith({
      method: 'POST',
      path: '/api/staff/messages',
      body: { title: 'Heads up', body: 'Maintenance window', visibility: 'all' },
    });
  });

  it('listInbox forwards messages field as-is (no normalization)', async () => {
    requestMock.mockResolvedValue({ messages: [] });
    await expect(listInbox()).resolves.toEqual([]);
    expect(requestMock).toHaveBeenCalledWith({ method: 'GET', path: '/api/inbox' });
  });
});
