import { describe, it, expect, vi } from 'vitest';

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return { ...actual, startTransition: (fn: () => void) => fn() };
});

import { navigateTransition } from '@/shared/lib/navigateTransition';

describe('navigateTransition', () => {
  it('calls navigate with the given path', () => {
    const navigate = vi.fn();
    navigateTransition(navigate, '/dashboard');
    expect(navigate).toHaveBeenCalledWith('/dashboard', undefined);
  });

  it('passes options to navigate when provided', () => {
    const navigate = vi.fn();
    const options = { replace: true, state: { from: '/' } };
    navigateTransition(navigate, '/settings', options);
    expect(navigate).toHaveBeenCalledWith('/settings', options);
  });

  it('calls navigate with undefined options when omitted', () => {
    const navigate = vi.fn();
    navigateTransition(navigate, '/home');
    expect(navigate).toHaveBeenCalledWith('/home', undefined);
  });

  it('navigate is only called once per call', () => {
    const navigate = vi.fn();
    navigateTransition(navigate, '/foo');
    expect(navigate).toHaveBeenCalledTimes(1);
  });
});
