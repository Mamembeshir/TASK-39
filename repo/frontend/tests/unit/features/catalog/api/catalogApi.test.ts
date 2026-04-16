import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requestMock } = vi.hoisted(() => ({ requestMock: vi.fn() }));

vi.mock('@/api/client', () => ({
  client: {
    request: requestMock,
    withAuth: () => ({ request: requestMock }),
  },
}));

import {
  createStaffBundle,
  createStaffService,
  getService,
  getServiceQuestions,
  getServiceReviews,
  listPendingQuestions,
  listServices,
  publishQuestion,
  publishStaffBundle,
  publishStaffService,
  rejectQuestion,
  submitServiceQuestion,
  unpublishStaffBundle,
  unpublishStaffService,
  updateStaffBundle,
  updateStaffService,
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

  it('staff service CRUD and publish/unpublish hit expected endpoints', async () => {
    requestMock.mockResolvedValue({});

    await createStaffService({ title: 'New', category: 'care', durationMinutes: 60, price: 100, tags: [] } as any);
    expect(requestMock).toHaveBeenCalledWith(expect.objectContaining({ method: 'POST', path: '/api/staff/services' }));

    requestMock.mockClear();
    await updateStaffService('svc-1', { title: 'Updated' });
    expect(requestMock).toHaveBeenCalledWith(expect.objectContaining({ method: 'PATCH', path: '/api/staff/services/svc-1' }));

    requestMock.mockClear();
    await publishStaffService('svc-1');
    expect(requestMock).toHaveBeenCalledWith({ method: 'POST', path: '/api/staff/services/svc-1/publish' });

    requestMock.mockClear();
    await unpublishStaffService('svc-1');
    expect(requestMock).toHaveBeenCalledWith({ method: 'POST', path: '/api/staff/services/svc-1/unpublish' });
  });

  it('staff bundle CRUD and publish/unpublish hit expected endpoints', async () => {
    requestMock.mockResolvedValue({});

    await createStaffBundle({ title: 'Bundle', serviceIds: ['s1'] } as any);
    expect(requestMock).toHaveBeenCalledWith(expect.objectContaining({ method: 'POST', path: '/api/staff/bundles' }));

    requestMock.mockClear();
    await updateStaffBundle('b1', { title: 'Updated bundle' });
    expect(requestMock).toHaveBeenCalledWith(expect.objectContaining({ method: 'PATCH', path: '/api/staff/bundles/b1' }));

    requestMock.mockClear();
    await publishStaffBundle('b1');
    expect(requestMock).toHaveBeenCalledWith({ method: 'POST', path: '/api/staff/bundles/b1/publish' });

    requestMock.mockClear();
    await unpublishStaffBundle('b1');
    expect(requestMock).toHaveBeenCalledWith({ method: 'POST', path: '/api/staff/bundles/b1/unpublish' });
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
