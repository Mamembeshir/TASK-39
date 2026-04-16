import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }));

vi.mock('@/features/auth/hooks/useAuth', () => ({
  useAuth: useAuthMock,
  hasRole: (roles: string[], allowed: string[]) =>
    roles.some((role) => allowed.includes(role)),
}));

import { RoleRoute } from '@/features/auth/components/RoleRoute';

function renderRouter() {
  return render(
    <MemoryRouter initialEntries={['/staff']}>
      <Routes>
        <Route path="/login" element={<div>LOGIN</div>} />
        <Route path="/app" element={<div>APP</div>} />
        <Route element={<RoleRoute roles={['administrator']} />}>
          <Route path="/staff" element={<div>STAFF</div>} />
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

describe('RoleRoute', () => {
  it('shows "Loading..." while auth is loading', () => {
    useAuthMock.mockReturnValue({ isLoading: true, user: null, roles: [] });
    renderRouter();
    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('redirects to /login when unauthenticated', () => {
    useAuthMock.mockReturnValue({ isLoading: false, user: null, roles: [] });
    renderRouter();
    expect(screen.getByText('LOGIN')).toBeTruthy();
  });

  it('redirects to /app when authenticated without required role', () => {
    useAuthMock.mockReturnValue({ isLoading: false, user: { id: 'u1' }, roles: ['customer'] });
    renderRouter();
    expect(screen.getByText('APP')).toBeTruthy();
  });

  it('renders Outlet when authenticated with required role', () => {
    useAuthMock.mockReturnValue({ isLoading: false, user: { id: 'u1' }, roles: ['administrator'] });
    renderRouter();
    expect(screen.getByText('STAFF')).toBeTruthy();
  });
});
