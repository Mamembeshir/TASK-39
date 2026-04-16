import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requestMock } = vi.hoisted(() => ({ requestMock: vi.fn() }));

vi.mock('@/api/client', () => ({
  client: {
    request: requestMock,
    withAuth: () => ({ request: requestMock }),
  },
}));

import {
  createArticle,
  getArticle,
  listArticles,
  listManageArticles,
  publishArticle,
  rollbackArticle,
  saveArticleDraft,
  scheduleArticle,
} from '@/features/content/api/contentApi';

describe('contentApi', () => {
  beforeEach(() => {
    requestMock.mockReset();
  });

  it('listArticles and listManageArticles normalize array responses', async () => {
    requestMock.mockResolvedValueOnce(null).mockResolvedValueOnce([{ id: '1', slug: 'a', title: 'A' }]);

    await expect(listArticles()).resolves.toEqual([]);
    await expect(listManageArticles()).resolves.toEqual([{ id: '1', slug: 'a', title: 'A' }]);
  });

  it('getArticle calls public content endpoint', async () => {
    requestMock.mockResolvedValue({ id: '1' });
    await getArticle('1');
    expect(requestMock).toHaveBeenCalledWith({ method: 'GET', path: '/api/content/1' });
  });

  it('create, draft, schedule, publish, and rollback send expected payloads', async () => {
    requestMock.mockResolvedValue({});

    await createArticle({ slug: 'slug', title: 'Title', body: 'Body', mediaIds: ['m1'] });
    await saveArticleDraft('1', { title: 'Draft', body: 'Body', mediaIds: [] });
    await scheduleArticle('1', { publishAt: '2026-01-01T00:00:00.000Z', versionId: 'v1' });
    await publishArticle('1', { versionId: 'v1' });
    await rollbackArticle('1', { versionId: 'v0' });

    expect(requestMock).toHaveBeenNthCalledWith(1, {
      method: 'POST',
      path: '/api/content',
      body: { slug: 'slug', title: 'Title', body: 'Body', mediaIds: ['m1'] },
    });
    expect(requestMock).toHaveBeenNthCalledWith(2, {
      method: 'PATCH',
      path: '/api/content/1/draft',
      body: { title: 'Draft', body: 'Body', mediaIds: [] },
    });
    expect(requestMock).toHaveBeenNthCalledWith(3, {
      method: 'POST',
      path: '/api/content/1/schedule',
      body: { publishAt: '2026-01-01T00:00:00.000Z', versionId: 'v1' },
    });
    expect(requestMock).toHaveBeenNthCalledWith(4, {
      method: 'POST',
      path: '/api/content/1/publish',
      body: { versionId: 'v1' },
    });
    expect(requestMock).toHaveBeenNthCalledWith(5, {
      method: 'POST',
      path: '/api/content/1/rollback',
      body: { versionId: 'v0' },
    });
  });
});
