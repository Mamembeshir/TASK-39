import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requestMock } = vi.hoisted(() => ({ requestMock: vi.fn() }));

vi.mock('@/api/client', () => ({
  client: {
    request: requestMock,
    withAuth: () => ({ request: requestMock }),
  },
}));

import { approveReview, listModerationQueue, rejectReview } from '@/features/moderation/api/moderationApi';

describe('moderationApi', () => {
  beforeEach(() => {
    requestMock.mockReset();
  });

  it('listModerationQueue normalizes non-array responses', async () => {
    requestMock.mockResolvedValue(null);
    await expect(listModerationQueue()).resolves.toEqual([]);
  });

  it('approveReview and rejectReview call expected endpoints', async () => {
    requestMock.mockResolvedValue({});

    await approveReview('rev-1');
    await rejectReview('rev-1');

    expect(requestMock).toHaveBeenNthCalledWith(1, { method: 'POST', path: '/api/moderation/reviews/rev-1/approve' });
    expect(requestMock).toHaveBeenNthCalledWith(2, { method: 'POST', path: '/api/moderation/reviews/rev-1/reject' });
  });
});
