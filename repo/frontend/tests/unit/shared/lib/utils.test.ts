import { describe, it, expect } from 'vitest';
import { cn } from '@/shared/lib/utils';

describe('cn', () => {
  it('merges multiple class names into a single string', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('resolves tailwind conflicts by keeping the last class', () => {
    expect(cn('p-4', 'p-8')).toBe('p-8');
  });

  it('resolves multiple tailwind conflicts', () => {
    expect(cn('text-sm', 'font-bold', 'text-lg')).toBe('font-bold text-lg');
  });

  it('handles conditional classes (falsy values are omitted)', () => {
    expect(cn('base', false && 'excluded', 'included')).toBe('base included');
  });

  it('handles undefined and null gracefully', () => {
    expect(cn('foo', undefined, null, 'bar')).toBe('foo bar');
  });

  it('handles array inputs', () => {
    expect(cn(['foo', 'bar'], 'baz')).toBe('foo bar baz');
  });

  it('returns empty string when given no arguments', () => {
    expect(cn()).toBe('');
  });

  it('handles object syntax where truthy keys are included', () => {
    expect(cn({ active: true, disabled: false }, 'base')).toBe('active base');
  });

  it('handles empty string inputs', () => {
    expect(cn('', 'foo', '')).toBe('foo');
  });
});
