import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { useAuthMock, listTicketsMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  listTicketsMock: vi.fn(),
}));

vi.mock('@/features/auth/hooks/useAuth', () => ({
  useAuth: useAuthMock,
  hasRole: (roles: string[], allowed: string[]) => roles.some((r) => allowed.includes(r)),
}));

vi.mock('@/features/tickets/api/ticketsApi', () => ({
  listTickets: listTicketsMock,
}));

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { TicketsListPage } from '@/features/tickets/pages/TicketsListPage';

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <TicketsListPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('TicketsListPage', () => {
  it('renders "Your tickets" heading for customer role', async () => {
    useAuthMock.mockReturnValue({ roles: ['customer'] });
    listTicketsMock.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText('Your tickets')).toBeTruthy();
  });

  it('renders "Dispute queue" heading for administrator role', async () => {
    useAuthMock.mockReturnValue({ roles: ['administrator'] });
    listTicketsMock.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText('Dispute queue')).toBeTruthy();
  });

  it('shows "No tickets yet" empty state when data is empty', async () => {
    useAuthMock.mockReturnValue({ roles: ['customer'] });
    listTicketsMock.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText('No tickets yet')).toBeTruthy();
  });

  it('renders ticket cards when data has entries', async () => {
    useAuthMock.mockReturnValue({ roles: ['customer'] });
    listTicketsMock.mockResolvedValue([
      { id: 't1', orderId: 'o1', category: 'billing', status: 'open' },
      { id: 't2', orderId: 'o2', category: 'scheduling', status: 'resolved' },
    ]);
    renderPage();
    await waitFor(() => expect(screen.getByText('billing')).toBeTruthy());
    expect(screen.getByText('scheduling')).toBeTruthy();
    expect(screen.getByText(/Order o1/)).toBeTruthy();
    expect(screen.getByText(/Order o2/)).toBeTruthy();
  });

  it('shows error state when query fails', async () => {
    useAuthMock.mockReturnValue({ roles: ['customer'] });
    listTicketsMock.mockRejectedValue(new Error('boom'));
    renderPage();
    expect(await screen.findByText('Tickets unavailable')).toBeTruthy();
  });
});
