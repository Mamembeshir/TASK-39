import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requestMock } = vi.hoisted(() => ({ requestMock: vi.fn() }));

vi.mock('@/api/client', () => ({
  client: {
    request: requestMock,
    withAuth: () => ({ request: requestMock }),
  },
}));

import { login, logout, me, refresh, register } from '@/features/auth/api/authApi';

describe('authApi', () => {
  beforeEach(() => {
    requestMock.mockReset();
    requestMock.mockResolvedValue({});
  });

  it('login sends auth login request', async () => {
    await login({ username: 'demo', password: 'secret' });
    expect(requestMock).toHaveBeenCalledWith({
      method: 'POST',
      path: '/api/auth/login',
      body: { username: 'demo', password: 'secret' },
    });
  });

  it('register sends auth register request', async () => {
    await register({ username: 'demo', password: 'secret' });
    expect(requestMock).toHaveBeenCalledWith({
      method: 'POST',
      path: '/api/auth/register',
      body: { username: 'demo', password: 'secret' },
    });
  });

  it('refresh, logout, and me hit expected endpoints', async () => {
    await refresh();
    await logout();
    await me();

    expect(requestMock).toHaveBeenNthCalledWith(1, { method: 'POST', path: '/api/auth/refresh' });
    expect(requestMock).toHaveBeenNthCalledWith(2, { method: 'POST', path: '/api/auth/logout' });
    expect(requestMock).toHaveBeenNthCalledWith(3, { method: 'GET', path: '/api/auth/me' });
  });
});
