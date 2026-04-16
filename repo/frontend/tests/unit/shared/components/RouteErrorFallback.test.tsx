import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

const { useRouteErrorMock, useNavigateMock, isRouteErrorResponseMock } = vi.hoisted(() => ({
  useRouteErrorMock: vi.fn(),
  useNavigateMock: vi.fn(),
  isRouteErrorResponseMock: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useRouteError: useRouteErrorMock,
  useNavigate: useNavigateMock,
  isRouteErrorResponse: isRouteErrorResponseMock,
}));

import { RouteErrorFallback } from '@/shared/components/RouteErrorFallback';

const navigate = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  useNavigateMock.mockReturnValue(navigate);
});

afterEach(() => {
  cleanup();
});

describe('RouteErrorFallback', () => {
  it('renders "Something went wrong" when error is a plain Error', () => {
    useRouteErrorMock.mockReturnValue(new Error('boom'));
    isRouteErrorResponseMock.mockReturnValue(false);
    render(<RouteErrorFallback />);
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByText('We could not load this page right now.')).toBeTruthy();
  });

  it('renders "{status} {statusText}" for a RouteErrorResponse', () => {
    useRouteErrorMock.mockReturnValue({
      status: 404,
      statusText: 'Not Found',
      data: { message: 'missing page' },
    });
    isRouteErrorResponseMock.mockReturnValue(true);
    render(<RouteErrorFallback />);
    expect(screen.getByText('404 Not Found')).toBeTruthy();
    expect(screen.getByText('missing page')).toBeTruthy();
  });

  it('falls back to default message when RouteErrorResponse has no data.message', () => {
    useRouteErrorMock.mockReturnValue({ status: 500, statusText: 'Server Error', data: undefined });
    isRouteErrorResponseMock.mockReturnValue(true);
    render(<RouteErrorFallback />);
    expect(screen.getByText('We could not load this page.')).toBeTruthy();
  });

  it('"Back home" button calls navigate("/catalog")', () => {
    useRouteErrorMock.mockReturnValue(new Error('oops'));
    isRouteErrorResponseMock.mockReturnValue(false);
    render(<RouteErrorFallback />);
    fireEvent.click(screen.getByRole('button', { name: /Back home/i }));
    expect(navigate).toHaveBeenCalledWith('/catalog');
  });

  it('"Reload" button triggers window.location.reload', () => {
    useRouteErrorMock.mockReturnValue(new Error('oops'));
    isRouteErrorResponseMock.mockReturnValue(false);
    const reloadSpy = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, reload: reloadSpy },
    });
    render(<RouteErrorFallback />);
    fireEvent.click(screen.getByRole('button', { name: /Reload/i }));
    expect(reloadSpy).toHaveBeenCalled();
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  });
});
