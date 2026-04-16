import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requestMock } = vi.hoisted(() => ({ requestMock: vi.fn() }));

vi.mock('@/api/client', () => ({
  client: {
    request: requestMock,
    withAuth: () => ({ request: requestMock }),
  },
}));

import { submitReview, uploadReviewMedia } from '@/features/reviews/api/reviewsApi';

describe('reviewsApi', () => {
  beforeEach(() => {
    requestMock.mockReset();
  });

  it('submitReview sends normalized review payload', async () => {
    requestMock.mockResolvedValue({});

    await submitReview({
      orderId: 'ord-1',
      rating: 5,
      text: 'Great',
      tags: ['kind'],
      mediaIds: ['m1'],
    });

    expect(requestMock).toHaveBeenCalledWith({
      method: 'POST',
      path: '/api/reviews',
      body: { orderId: 'ord-1', rating: 5, text: 'Great', tags: ['kind'], mediaIds: ['m1'] },
    });
  });

  it('uploadReviewMedia sends review purpose form-data', async () => {
    requestMock.mockResolvedValue({ media: [{ mediaId: 'm1' }] });
    const file = new File(['a'], 'a.png', { type: 'image/png' });

    await uploadReviewMedia([file]);

    const call = requestMock.mock.calls[0][0];
    expect(call.method).toBe('POST');
    expect(call.path).toBe('/api/media');
    expect(call.formData.get('purpose')).toBe('review');
    expect(call.formData.getAll('files')).toHaveLength(1);
  });
});
