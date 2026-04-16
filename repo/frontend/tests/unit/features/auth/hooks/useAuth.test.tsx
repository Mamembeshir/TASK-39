import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import React from 'react';

// ----- hoisted mocks -----
const { setOnUnauthorizedMock } = vi.hoisted(() => ({
  setOnUnauthorizedMock: vi.fn(),
}));

const {
  loginMock,
  logoutMock,
  meMock,
  refreshMock,
  registerMock,
} = vi.hoisted(() => ({
  loginMock: vi.fn(),
  logoutMock: vi.fn(),
  meMock: vi.fn(),
  refreshMock: vi.fn(),
  registerMock: vi.fn(),
}));

vi.mock('@/api/client', () => ({
  setOnUnauthorized: setOnUnauthorizedMock,
}));

vi.mock('@/features/auth/api/authApi', () => ({
  login: loginMock,
  logout: logoutMock,
  me: meMock,
  refresh: refreshMock,
  register: registerMock,
}));

// ----- import after mocks -----
import { AuthProvider, useAuth, hasRole } from '@/features/auth/hooks/useAuth';

// -----------------------------------------------------------------------
// helpers
// -----------------------------------------------------------------------
const mockUser = { id: 'u1', username: 'alice', roles: ['moderator'] };

function wrapper({ children }: PropsWithChildren) {
  return <AuthProvider>{children}</AuthProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: refresh fails (unauthenticated), me returns mockUser when called directly
  refreshMock.mockRejectedValue(new Error('Unauthenticated'));
  meMock.mockResolvedValue({ user: mockUser });
  loginMock.mockResolvedValue({});
  logoutMock.mockResolvedValue({});
  registerMock.mockResolvedValue({});
});

// -----------------------------------------------------------------------
// hasRole (pure utility)
// -----------------------------------------------------------------------
describe('hasRole', () => {
  it('returns true when roles contain an allowed role', () => {
    expect(hasRole(['moderator', 'customer'], ['moderator'])).toBe(true);
  });

  it('returns true when roles contain an administrator', () => {
    expect(hasRole(['administrator'], ['administrator'])).toBe(true);
  });

  it('returns false when roles do not match any allowed role', () => {
    expect(hasRole(['customer'], ['moderator', 'administrator'])).toBe(false);
  });

  it('returns false for an empty roles array', () => {
    expect(hasRole([], ['moderator'])).toBe(false);
  });

  it('returns false for an empty allowed array', () => {
    expect(hasRole(['moderator'], [])).toBe(false);
  });

  it('returns false for both empty arrays', () => {
    expect(hasRole([], [])).toBe(false);
  });
});

// -----------------------------------------------------------------------
// useAuth outside provider
// -----------------------------------------------------------------------
describe('useAuth outside AuthProvider', () => {
  it('throws an error when used outside of AuthProvider', () => {
    // Suppress expected console.error from React
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useAuth())).toThrow('useAuth must be used within AuthProvider');
    consoleSpy.mockRestore();
  });
});

// -----------------------------------------------------------------------
// AuthProvider – initial state
// -----------------------------------------------------------------------
describe('AuthProvider initial state', () => {
  it('starts with isLoading=true and user=null before bootstrap resolves', () => {
    // Never resolves — keeps loading state frozen
    refreshMock.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.user).toBeNull();
  });

  it('sets isLoading=false after bootstrap completes', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it('leaves user=null when bootstrap refresh fails', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.user).toBeNull();
  });

  it('sets user when bootstrap refresh succeeds', async () => {
    refreshMock.mockResolvedValue({});
    meMock.mockResolvedValue({ user: mockUser });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.user).toEqual(mockUser));
  });
});

// -----------------------------------------------------------------------
// AuthProvider – login
// -----------------------------------------------------------------------
describe('AuthProvider login', () => {
  it('calls loginRequest then meRequest', async () => {
    refreshMock.mockResolvedValue({});
    meMock.mockResolvedValue({ user: mockUser });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    meMock.mockClear();
    loginMock.mockClear();

    await act(async () => {
      await result.current.login({ username: 'alice', password: 'secret' });
    });

    expect(loginMock).toHaveBeenCalledWith({ username: 'alice', password: 'secret' });
    expect(meMock).toHaveBeenCalledTimes(1);
  });

  it('updates user state after login', async () => {
    refreshMock.mockResolvedValue({});
    meMock
      .mockResolvedValueOnce({ user: mockUser }) // bootstrap
      .mockResolvedValueOnce({ user: { ...mockUser, username: 'bob' } }); // after login

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.user?.username).toBe('alice'));

    await act(async () => {
      await result.current.login({ username: 'bob', password: 'pass' });
    });

    expect(result.current.user?.username).toBe('bob');
  });
});

// -----------------------------------------------------------------------
// AuthProvider – logout
// -----------------------------------------------------------------------
describe('AuthProvider logout', () => {
  it('clears the user after logout', async () => {
    refreshMock.mockResolvedValue({});
    meMock.mockResolvedValue({ user: mockUser });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.user).toEqual(mockUser));

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.user).toBeNull();
  });

  it('calls logoutRequest', async () => {
    refreshMock.mockResolvedValue({});
    meMock.mockResolvedValue({ user: mockUser });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    logoutMock.mockClear();
    await act(async () => {
      await result.current.logout();
    });

    expect(logoutMock).toHaveBeenCalledTimes(1);
  });

  it('clears user even if logoutRequest throws', async () => {
    refreshMock.mockResolvedValue({});
    meMock.mockResolvedValue({ user: mockUser });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.user).toEqual(mockUser));

    logoutMock.mockRejectedValue(new Error('Network error'));

    await act(async () => {
      await result.current.logout().catch(() => {});
    });

    expect(result.current.user).toBeNull();
  });
});

// -----------------------------------------------------------------------
// AuthProvider – register
// -----------------------------------------------------------------------
describe('AuthProvider register', () => {
  it('calls registerRequest then meRequest', async () => {
    refreshMock.mockResolvedValue({});
    meMock.mockResolvedValue({ user: mockUser });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    meMock.mockClear();
    registerMock.mockClear();

    await act(async () => {
      await result.current.register({ username: 'newuser', password: 'pass' });
    });

    expect(registerMock).toHaveBeenCalledWith({ username: 'newuser', password: 'pass' });
    expect(meMock).toHaveBeenCalledTimes(1);
  });
});

// -----------------------------------------------------------------------
// AuthProvider – refresh
// -----------------------------------------------------------------------
describe('AuthProvider refresh', () => {
  it('returns true and loads user on success', async () => {
    refreshMock.mockResolvedValue({});
    meMock.mockResolvedValue({ user: mockUser });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    refreshMock.mockClear();
    meMock.mockClear();
    refreshMock.mockResolvedValue({});
    meMock.mockResolvedValue({ user: mockUser });

    let refreshResult: boolean | undefined;
    await act(async () => {
      refreshResult = await result.current.refresh();
    });

    expect(refreshResult).toBe(true);
  });

  it('returns false and clears user when refresh request throws', async () => {
    refreshMock.mockResolvedValue({});
    meMock.mockResolvedValue({ user: mockUser });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.user).toEqual(mockUser));

    refreshMock.mockRejectedValue(new Error('Token expired'));

    let refreshResult: boolean | undefined;
    await act(async () => {
      refreshResult = await result.current.refresh();
    });

    expect(refreshResult).toBe(false);
    expect(result.current.user).toBeNull();
  });
});

// -----------------------------------------------------------------------
// AuthProvider – unauthorized handler registration
// -----------------------------------------------------------------------
describe('AuthProvider setOnUnauthorized', () => {
  it('registers an unauthorized handler via setOnUnauthorized on mount', async () => {
    refreshMock.mockResolvedValue({});
    meMock.mockResolvedValue({ user: mockUser });
    renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(setOnUnauthorizedMock).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  it('clears the unauthorized handler on unmount', async () => {
    refreshMock.mockResolvedValue({});
    meMock.mockResolvedValue({ user: mockUser });
    const { unmount } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(setOnUnauthorizedMock).toHaveBeenCalled());

    setOnUnauthorizedMock.mockClear();
    unmount();

    expect(setOnUnauthorizedMock).toHaveBeenCalledWith(null);
  });
});

// -----------------------------------------------------------------------
// AuthProvider – exposed roles
// -----------------------------------------------------------------------
describe('AuthProvider roles', () => {
  it('exposes the roles array from the current user', async () => {
    refreshMock.mockResolvedValue({});
    meMock.mockResolvedValue({ user: mockUser });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.roles).toEqual(['moderator']));
  });

  it('exposes an empty roles array when no user is set', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.roles).toEqual([]);
  });
});
