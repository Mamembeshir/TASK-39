import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }));

vi.mock('@/features/auth/hooks/useAuth', () => ({
  useAuth: useAuthMock,
  hasRole: (roles: string[], allowed: string[]) =>
    roles.some((role) => allowed.includes(role)),
}));

import { RoleGate } from '@/shared/components/RoleGate';

function renderGate(ui: React.ReactElement) {
  return render(
    <MemoryRouter initialEntries={['/gated']}>
      <Routes>
        <Route path="/login" element={<div>LOGIN</div>} />
        <Route path="/app" element={<div>APP</div>} />
        <Route path="/fallback" element={<div>FALLBACK</div>} />
        <Route path="/gated" element={ui} />
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

describe('RoleGate', () => {
  it('shows Loading... when auth is loading', () => {
    useAuthMock.mockReturnValue({ isLoading: true, user: null, roles: [] });
    renderGate(<RoleGate roles={['administrator']}>secret</RoleGate>);
    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('redirects to /login when unauthenticated', () => {
    useAuthMock.mockReturnValue({ isLoading: false, user: null, roles: [] });
    renderGate(<RoleGate roles={['administrator']}>secret</RoleGate>);
    expect(screen.getByText('LOGIN')).toBeTruthy();
  });

  it('redirects to fallback /app when authenticated without required role', () => {
    useAuthMock.mockReturnValue({ isLoading: false, user: { id: 'u1' }, roles: ['customer'] });
    renderGate(<RoleGate roles={['administrator']}>secret</RoleGate>);
    expect(screen.getByText('APP')).toBeTruthy();
  });

  it('redirects to custom fallback when provided', () => {
    useAuthMock.mockReturnValue({ isLoading: false, user: { id: 'u1' }, roles: ['customer'] });
    renderGate(
      <RoleGate roles={['administrator']} fallback="/fallback">
        secret
      </RoleGate>,
    );
    expect(screen.getByText('FALLBACK')).toBeTruthy();
  });

  it('renders children when authenticated with required role', () => {
    useAuthMock.mockReturnValue({ isLoading: false, user: { id: 'u1' }, roles: ['administrator'] });
    renderGate(<RoleGate roles={['administrator']}><div>SECRET</div></RoleGate>);
    expect(screen.getByText('SECRET')).toBeTruthy();
  });
});
