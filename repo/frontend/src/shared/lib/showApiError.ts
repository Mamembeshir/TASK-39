import type { ApiError } from '@/api/types/api-error';

export function showApiError(error: unknown) {
  const fallback = 'Something went wrong. Please try again.';
  if (error && typeof error === 'object') {
    const apiError = error as Partial<ApiError> & { message?: unknown };
    const code = typeof apiError.code === 'string' ? apiError.code : 'ERROR';
    const message = typeof apiError.message === 'string' ? apiError.message : fallback;
    return `${code}: ${message}`;
  }
  return fallback;
}
