import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requestMock } = vi.hoisted(() => ({ requestMock: vi.fn() }));

vi.mock('@/api/client', () => ({
  client: {
    request: requestMock,
    withAuth: () => ({ request: requestMock }),
  },
}));

import { listInbox, markInboxRead } from '@/features/inbox/api/inboxApi';

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
});
