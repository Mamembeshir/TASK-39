import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const { useAuthMock, registerMock, navigateMock, showApiErrorMock, toastErrorMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  registerMock: vi.fn(),
  navigateMock: vi.fn(),
  showApiErrorMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock('@/features/auth/hooks/useAuth', () => ({
  useAuth: useAuthMock,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock('sonner', () => ({
  toast: { error: toastErrorMock, success: vi.fn() },
}));

vi.mock('@/shared/lib/showApiError', () => ({
  showApiError: showApiErrorMock,
}));

import { RegisterPage } from '@/features/auth/pages/RegisterPage';

function renderPage() {
  return render(
    <MemoryRouter>
      <RegisterPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuthMock.mockReturnValue({ register: registerMock });
  registerMock.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
});

describe('RegisterPage', () => {
  it('renders username, password inputs and a Create account button', () => {
    renderPage();
    expect(screen.getByLabelText(/^username$/i)).toBeTruthy();
    expect(screen.getByLabelText(/^password$/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /create account/i })).toBeTruthy();
  });

  it('shows inline error for short password without calling register', () => {
    renderPage();
    const password = screen.getByLabelText(/^password$/i) as HTMLInputElement;
    fireEvent.change(password, { target: { value: 'short' } });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(screen.getByText('Password must be at least 12 characters')).toBeTruthy();
    expect(registerMock).not.toHaveBeenCalled();
  });

  it('calls register and navigates to /catalog on success', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    await waitFor(() => expect(registerMock).toHaveBeenCalled());
    expect(registerMock).toHaveBeenCalledWith({ username: 'new_customer', password: 'devpass123456' });
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/catalog', { replace: true }));
  });

  it('shows ApiError message on failure', async () => {
    registerMock.mockRejectedValue({ code: 'REG', message: 'taken' });
    showApiErrorMock.mockReturnValue('REG: taken');
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    await waitFor(() => expect(showApiErrorMock).toHaveBeenCalled());
    expect(await screen.findByText('REG: taken')).toBeTruthy();
    expect(toastErrorMock).toHaveBeenCalledWith('REG: taken');
  });
});
