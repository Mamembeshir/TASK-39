import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { client, setOnUnauthorized } from '@/api/client';

describe('api client.request', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setOnUnauthorized(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setOnUnauthorized(null);
    Reflect.deleteProperty(globalThis, 'document');
  });

  it('returns parsed JSON on success', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await client.request<{ status: string }>({
      method: 'GET',
      path: '/api/health',
    });

    expect(result).toEqual({ status: 'ok' });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.test/api/health',
      expect.objectContaining({
        method: 'GET',
        credentials: 'include',
        body: undefined,
        signal: undefined,
        headers: expect.any(Headers),
      }),
    );
    // Optional: ensure headers include application/json acceptance
    const initArg = (fetchMock as any).mock.calls[0][1];
    if (initArg && initArg.headers instanceof Headers) {
      // Accept header should be present
      expect(initArg.headers.get('Accept')).toBe('application/json');
    }
  });

  it('throws typed ApiError from JSON response without triggering unauthorized hook for auth endpoints', async () => {
    const unauthorizedSpy = vi.fn();
    setOnUnauthorized(unauthorizedSpy);

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            code: 'AUTH_REQUIRED',
            message: 'You must log in',
            details: [{ field: 'token', message: 'Missing bearer token' }],
          }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      ),
    );

    await expect(
      client.request({ method: 'GET', path: '/api/auth/me' }),
    ).rejects.toMatchObject({
      code: 'AUTH_REQUIRED',
      message: 'You must log in',
      details: [{ field: 'token', message: 'Missing bearer token' }],
    });

    expect(unauthorizedSpy).not.toHaveBeenCalled();
  });

  it('throws network ApiError when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('socket hang up')));

    await expect(
      client.request({ method: 'POST', path: '/api/auth/login', body: { username: 'a' } }),
    ).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      message: 'Network request failed',
    });
  });

  it('adds csrf header for unsafe requests when cookie is present', async () => {
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: { cookie: 'csrf_token=test-csrf-token' },
    });
    Object.defineProperty(globalThis.document, 'cookie', {
      configurable: true,
      get: () => 'csrf_token=test-csrf-token',
    });

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await client.request({ method: 'POST', path: '/api/favorites/123' });

    const initArg = (fetchMock as any).mock.calls[0][1];
    expect(initArg.headers.get('X-CSRF-Token')).toBe('test-csrf-token');
  });

  it('does not add csrf header for get requests', async () => {
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: { cookie: 'csrf_token=test-csrf-token' },
    });
    Object.defineProperty(globalThis.document, 'cookie', {
      configurable: true,
      get: () => 'csrf_token=test-csrf-token',
    });

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await client.request({ method: 'GET', path: '/api/health' });

    const initArg = (fetchMock as any).mock.calls[0][1];
    expect(initArg.headers.get('X-CSRF-Token')).toBeNull();
  });

  it('rejects invalid api paths before making fetch calls', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(client.request({ method: 'GET', path: 'api/health' as any })).rejects.toThrow(
      'API path must start with a leading slash',
    );
    await expect(client.request({ method: 'GET', path: '/health' as any })).rejects.toThrow(
      'API path must begin with /api',
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('serializes query parameters and skips nullish values', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await client.request({
      method: 'GET',
      path: '/api/search',
      query: { q: 'hello', page: 2, draft: false, ignored: undefined, nil: null },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.test/api/search?q=hello&page=2&draft=false',
      expect.any(Object),
    );
  });

  it('does not set json content-type when using form data', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const formData = new FormData();
    formData.set('purpose', 'review');

    await client.request({ method: 'POST', path: '/api/media', formData });

    const initArg = (fetchMock as any).mock.calls[0][1];
    expect(initArg.body).toBe(formData);
    expect(initArg.headers.get('Content-Type')).toBeNull();
  });

  it('uses fallback http error shape for non-json auth endpoint responses without triggering unauthorized hook', async () => {
    const unauthorizedSpy = vi.fn();
    setOnUnauthorized(unauthorizedSpy);

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('Unauthorized plain text', {
          status: 401,
          headers: { 'Content-Type': 'text/plain' },
        }),
      ),
    );

    await expect(client.request({ method: 'GET', path: '/api/auth/me' })).rejects.toMatchObject({
      code: 'HTTP_401',
      message: 'Unauthorized plain text',
    });

    expect(unauthorizedSpy).not.toHaveBeenCalled();
  });

  it('triggers unauthorized hook once for parallel non-auth 401 responses', async () => {
    const unauthorizedSpy = vi.fn();
    setOnUnauthorized(unauthorizedSpy);

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ code: 'UNAUTHORIZED', message: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    await Promise.allSettled([
      client.request({ method: 'GET', path: '/api/orders' }),
      client.request({ method: 'GET', path: '/api/profile/me' }),
    ]);

    await Promise.resolve();

    expect(unauthorizedSpy).toHaveBeenCalledTimes(1);
  });

  it('rejects duplicate api prefix paths', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(client.request({ method: 'GET', path: '/api/api/health' as any })).rejects.toThrow(
      'API path must not contain duplicate /api prefix',
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('respects explicit credentials option', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await client.request({ method: 'GET', path: '/api/health', credentials: 'omit' });

    const initArg = (fetchMock as any).mock.calls[0][1];
    expect(initArg.credentials).toBe('omit');
  });
});
