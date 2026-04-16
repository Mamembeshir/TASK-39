import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }));

vi.mock('@/features/auth/hooks/useAuth', () => ({
  useAuth: useAuthMock,
}));

import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute';

function renderRouter() {
  return render(
    <MemoryRouter initialEntries={['/secret']}>
      <Routes>
        <Route path="/login" element={<div>LOGIN</div>} />
        <Route element={<ProtectedRoute />}>
          <Route path="/secret" element={<div>SECRET</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('ProtectedRoute', () => {
  it('shows "Loading..." while auth is loading', () => {
    useAuthMock.mockReturnValue({ isLoading: true, user: null });
    renderRouter();
    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('renders Outlet when authenticated', () => {
    useAuthMock.mockReturnValue({ isLoading: false, user: { id: 'u1' } });
    renderRouter();
    expect(screen.getByText('SECRET')).toBeTruthy();
  });

  it('redirects to /login when unauthenticated', () => {
    useAuthMock.mockReturnValue({ isLoading: false, user: null });
    renderRouter();
    expect(screen.getByText('LOGIN')).toBeTruthy();
  });
});
