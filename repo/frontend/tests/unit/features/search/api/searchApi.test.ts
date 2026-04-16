import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requestMock } = vi.hoisted(() => ({ requestMock: vi.fn() }));

vi.mock('@/api/client', () => ({
  client: {
    request: requestMock,
    withAuth: () => ({ request: requestMock }),
  },
}));

import { search } from '@/features/search/api/searchApi';

describe('searchApi', () => {
  beforeEach(() => {
    requestMock.mockReset();
  });

  it('search normalizes empty responses', async () => {
    requestMock.mockResolvedValue(null);
    await expect(search('help')).resolves.toEqual([]);
  });

  it('search maps snippets into summary fields', async () => {
    requestMock.mockResolvedValue({
      results: [{ id: '1', type: 'content', title: 'Hello', snippet: 'World' }],
    });

    await expect(search('hello')).resolves.toEqual([
      { id: '1', type: 'content', title: 'Hello', summary: 'World' },
    ]);
    expect(requestMock).toHaveBeenCalledWith({
      method: 'GET',
      path: '/api/search',
      query: { q: 'hello' },
    });
  });
});
