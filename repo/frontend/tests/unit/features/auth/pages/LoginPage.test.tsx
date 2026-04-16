import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const { useAuthMock, loginMock, navigateMock, showApiErrorMock, navigateTransitionMock, toastErrorMock } =
  vi.hoisted(() => ({
    useAuthMock: vi.fn(),
    loginMock: vi.fn(),
    navigateMock: vi.fn(),
    showApiErrorMock: vi.fn(),
    navigateTransitionMock: vi.fn(),
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

vi.mock('@/shared/lib/navigateTransition', () => ({
  navigateTransition: navigateTransitionMock,
}));

import { LoginPage } from '@/features/auth/pages/LoginPage';

function renderPage() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuthMock.mockReturnValue({ login: loginMock });
  loginMock.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
});

describe('LoginPage', () => {
  it('renders username, password inputs and a Sign in button', () => {
    renderPage();
    expect(screen.getByLabelText(/email or username/i)).toBeTruthy();
    expect(screen.getByLabelText(/password/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeTruthy();
  });

  it('shows inline error for short password without calling login', () => {
    renderPage();
    const password = screen.getByLabelText(/password/i) as HTMLInputElement;
    fireEvent.change(password, { target: { value: 'short' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(screen.getByText('Password must be at least 12 characters')).toBeTruthy();
    expect(loginMock).not.toHaveBeenCalled();
  });

  it('calls login and navigates to /catalog on success', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(loginMock).toHaveBeenCalled());
    expect(loginMock).toHaveBeenCalledWith({ username: 'customer_demo', password: 'devpass123456' });
    await waitFor(() =>
      expect(navigateTransitionMock).toHaveBeenCalledWith(navigateMock, '/catalog', { replace: true }),
    );
  });

  it('shows ApiError message via showApiError on failure', async () => {
    loginMock.mockRejectedValue({ code: 'AUTH', message: 'bad creds' });
    showApiErrorMock.mockReturnValue('AUTH: bad creds');
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(showApiErrorMock).toHaveBeenCalled());
    expect(await screen.findByText('AUTH: bad creds')).toBeTruthy();
    expect(toastErrorMock).toHaveBeenCalledWith('AUTH: bad creds');
  });
});
