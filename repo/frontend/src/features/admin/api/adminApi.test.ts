import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requestMock } = vi.hoisted(() => ({ requestMock: vi.fn() }));

vi.mock('@/api/client', () => ({
  client: {
    request: requestMock,
    withAuth: () => ({ request: requestMock }),
  },
}));

import { listAuditLogs, listBlacklist, upsertBlacklist } from '@/features/admin/api/adminApi';

describe('adminApi', () => {
  beforeEach(() => {
    requestMock.mockReset();
  });

  it('listAuditLogs and listBlacklist normalize non-array responses', async () => {
    requestMock.mockResolvedValueOnce(null).mockResolvedValueOnce([{ id: 'b1', type: 'ip', value: '1.1.1.1', active: true }]);

    await expect(listAuditLogs()).resolves.toEqual([]);
    await expect(listBlacklist()).resolves.toEqual([{ id: 'b1', type: 'ip', value: '1.1.1.1', active: true }]);
  });

  it('upsertBlacklist posts expected payload', async () => {
    requestMock.mockResolvedValue({ status: 'ok' });

    await upsertBlacklist({ type: 'ip', value: '1.1.1.1', active: true });
    expect(requestMock).toHaveBeenCalledWith({
      method: 'POST',
      path: '/api/admin/blacklist',
      body: { type: 'ip', value: '1.1.1.1', active: true },
    });
  });
});
