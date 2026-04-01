import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requestMock } = vi.hoisted(() => ({ requestMock: vi.fn() }));

vi.mock('@/api/client', () => ({
  client: {
    request: requestMock,
    withAuth: () => ({ request: requestMock }),
  },
}));

import {
  getService,
  getServiceQuestions,
  getServiceReviews,
  listPendingQuestions,
  listServices,
  publishQuestion,
  rejectQuestion,
  submitServiceQuestion,
} from '@/features/catalog/api/catalogApi';

describe('catalogApi', () => {
  beforeEach(() => {
    requestMock.mockReset();
  });

  it('listServices normalizes array response and passes filters', async () => {
    requestMock.mockResolvedValue({ services: [{ id: 'svc-1', title: 'One' }] });
    await expect(listServices({ category: 'care', tags: 'priority' })).resolves.toEqual([{ id: 'svc-1', title: 'One' }]);
    expect(requestMock).toHaveBeenCalledWith({
      method: 'GET',
      path: '/api/services',
      query: { category: 'care', tags: 'priority' },
    });
  });

  it('getService unwraps service and question/review endpoints normalize arrays', async () => {
    requestMock
      .mockResolvedValueOnce({ service: { id: 'svc-1', title: 'One' } })
      .mockResolvedValueOnce({ questions: null })
      .mockResolvedValueOnce({ reviews: [{ id: 'rev-1', rating: 5 }] });

    await expect(getService('svc-1')).resolves.toEqual({ id: 'svc-1', title: 'One' });
    await expect(getServiceQuestions('svc-1')).resolves.toEqual([]);
    await expect(getServiceReviews('svc-1')).resolves.toEqual([{ id: 'rev-1', rating: 5 }]);
  });

  it('moderation question actions hit expected endpoints', async () => {
    requestMock.mockResolvedValueOnce({ questions: [{ id: 'q1', question: 'Q?' }] }).mockResolvedValue({});

    await expect(listPendingQuestions()).resolves.toEqual([{ id: 'q1', question: 'Q?' }]);
    await submitServiceQuestion('svc-1', 'How long?');
    await publishQuestion('q1', 'Answer');
    await rejectQuestion('q1');

    expect(requestMock).toHaveBeenNthCalledWith(2, {
      method: 'POST',
      path: '/api/services/svc-1/questions',
      body: { question: 'How long?' },
    });
    expect(requestMock).toHaveBeenNthCalledWith(3, {
      method: 'POST',
      path: '/api/moderation/questions/q1/publish',
      body: { answer: 'Answer' },
    });
    expect(requestMock).toHaveBeenNthCalledWith(4, {
      method: 'POST',
      path: '/api/moderation/questions/q1/reject',
    });
  });
});
