import { describe, it, expect } from 'vitest';
import { showApiError } from '@/shared/lib/showApiError';

const FALLBACK = 'Something went wrong. Please try again.';

describe('showApiError', () => {
  it('formats a full ApiError object as "CODE: message"', () => {
    const error = { code: 'NOT_FOUND', message: 'Resource not found' };
    expect(showApiError(error)).toBe('NOT_FOUND: Resource not found');
  });

  it('uses "ERROR" as code when code field is missing', () => {
    const error = { message: 'Unexpected error occurred' };
    expect(showApiError(error)).toBe('ERROR: Unexpected error occurred');
  });

  it('uses "ERROR" as code when code field is not a string', () => {
    const error = { code: 42, message: 'Bad input' };
    expect(showApiError(error)).toBe('ERROR: Bad input');
  });

  it('uses fallback message when message field is missing', () => {
    const error = { code: 'SERVER_ERROR' };
    expect(showApiError(error)).toBe(`SERVER_ERROR: ${FALLBACK}`);
  });

  it('uses fallback message when message field is not a string', () => {
    const error = { code: 'BAD_REQUEST', message: 123 };
    expect(showApiError(error)).toBe(`BAD_REQUEST: ${FALLBACK}`);
  });

  it('returns fallback for a plain string error', () => {
    expect(showApiError('some string error')).toBe(FALLBACK);
  });

  it('returns fallback for null', () => {
    expect(showApiError(null)).toBe(FALLBACK);
  });

  it('returns fallback for undefined', () => {
    expect(showApiError(undefined)).toBe(FALLBACK);
  });

  it('returns fallback for a number', () => {
    expect(showApiError(404)).toBe(FALLBACK);
  });

  it('formats an error object with both code and message present', () => {
    const error = { code: 'UNAUTHORIZED', message: 'You are not authorized' };
    expect(showApiError(error)).toBe('UNAUTHORIZED: You are not authorized');
  });
});
