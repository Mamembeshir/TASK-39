import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { listServicesMock } = vi.hoisted(() => ({ listServicesMock: vi.fn() }));

vi.mock('@/features/catalog/api/catalogApi', () => ({
  listServices: listServicesMock,
}));

vi.mock('@/features/catalog/components/ServiceCard', () => ({
  ServiceCard: ({ service }: { service: { id: string; title: string } }) => (
    <div data-testid="service-card">{service.title}</div>
  ),
}));

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { CatalogPage } from '@/features/catalog/pages/CatalogPage';

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CatalogPage />
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

describe('CatalogPage', () => {
  it('renders "Catalog" heading', async () => {
    listServicesMock.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText('Catalog')).toBeTruthy();
  });

  it('shows "Catalog unavailable" when services query errors', async () => {
    listServicesMock.mockRejectedValue(new Error('boom'));
    renderPage();
    expect(await screen.findByText('Catalog unavailable')).toBeTruthy();
  });

  it('shows "No services match filters" when services array is empty', async () => {
    listServicesMock.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText('No services match filters')).toBeTruthy();
  });

  it('renders service cards when services data is present', async () => {
    listServicesMock.mockResolvedValue([
      { id: 's1', title: 'Home cleaning', category: 'cleaning' },
      { id: 's2', title: 'Lawn care', category: 'outdoor' },
    ]);
    renderPage();
    await waitFor(() => expect(screen.getAllByTestId('service-card').length).toBeGreaterThan(0));
    expect(screen.getByText('Home cleaning')).toBeTruthy();
    expect(screen.getByText('Lawn care')).toBeTruthy();
  });
});
