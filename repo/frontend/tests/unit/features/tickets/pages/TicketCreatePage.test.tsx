import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const { createTicketMock, uploadAttachmentsMock, navigateMock, showApiErrorMock, toastErrorMock } =
  vi.hoisted(() => ({
    createTicketMock: vi.fn(),
    uploadAttachmentsMock: vi.fn(),
    navigateMock: vi.fn(),
    showApiErrorMock: vi.fn(),
    toastErrorMock: vi.fn(),
  }));

vi.mock('@/features/tickets/api/ticketsApi', () => ({
  createTicket: createTicketMock,
  uploadTicketAttachments: uploadAttachmentsMock,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

vi.mock('sonner', () => ({ toast: { error: toastErrorMock, success: vi.fn() } }));

vi.mock('@/shared/lib/showApiError', () => ({ showApiError: showApiErrorMock }));

import { TicketCreatePage } from '@/features/tickets/pages/TicketCreatePage';

function renderPage() {
  return render(
    <MemoryRouter>
      <TicketCreatePage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('TicketCreatePage', () => {
  it('renders Open ticket heading, order ID input, description textarea, and categories', () => {
    renderPage();
    expect(screen.getByText('Open ticket')).toBeTruthy();
    expect(screen.getByLabelText(/order id/i)).toBeTruthy();
    expect(screen.getByLabelText(/description/i)).toBeTruthy();
    expect(screen.getByText('Billing')).toBeTruthy();
    expect(screen.getByText('Scheduling')).toBeTruthy();
    expect(screen.getByText('General support')).toBeTruthy();
  });

  it('shows "Order context is required" when submitting with empty orderId', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /create ticket/i }));
    expect(screen.getByText('Order context is required to create a ticket.')).toBeTruthy();
    expect(createTicketMock).not.toHaveBeenCalled();
  });

  it('submits valid form and navigates on success', async () => {
    createTicketMock.mockResolvedValue({ id: 'ticket-42' });
    renderPage();
    fireEvent.change(screen.getByLabelText(/order id/i), { target: { value: 'ord-1' } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'broken' } });
    fireEvent.click(screen.getByRole('button', { name: /Billing/i }));
    fireEvent.click(screen.getByRole('button', { name: /create ticket/i }));
    await waitFor(() => expect(createTicketMock).toHaveBeenCalled());
    expect(createTicketMock).toHaveBeenCalledWith({
      orderId: 'ord-1',
      category: 'billing',
      description: 'broken',
      attachmentIds: undefined,
    });
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/tickets/ticket-42'));
  });

  it('shows error toast and message when createTicket rejects', async () => {
    createTicketMock.mockRejectedValue({ code: 'T', message: 'bad' });
    showApiErrorMock.mockReturnValue('T: bad');
    renderPage();
    fireEvent.change(screen.getByLabelText(/order id/i), { target: { value: 'ord-1' } });
    fireEvent.click(screen.getByRole('button', { name: /create ticket/i }));
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith('T: bad'));
    expect(await screen.findByText('T: bad')).toBeTruthy();
  });
});
