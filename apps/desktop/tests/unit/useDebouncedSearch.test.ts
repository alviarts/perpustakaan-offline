import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';

describe('useDebouncedSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with empty value and not pending', () => {
    const { result } = renderHook(() => useDebouncedSearch());
    expect(result.current.query).toBe('');
    expect(result.current.debouncedQuery).toBe('');
    expect(result.current.isPending).toBe(false);
  });

  it('marks pending while waiting and resolves after the delay', () => {
    const { result } = renderHook(() => useDebouncedSearch({ delay: 200 }));

    act(() => {
      result.current.setQuery('foo');
    });
    expect(result.current.query).toBe('foo');
    expect(result.current.debouncedQuery).toBe('');
    expect(result.current.isPending).toBe(true);

    act(() => {
      vi.advanceTimersByTime(199);
    });
    expect(result.current.isPending).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.debouncedQuery).toBe('foo');
    expect(result.current.isPending).toBe(false);
  });

  it('coalesces rapid typing into a single committed value', () => {
    const { result } = renderHook(() => useDebouncedSearch({ delay: 200 }));

    act(() => result.current.setQuery('a'));
    act(() => vi.advanceTimersByTime(50));
    act(() => result.current.setQuery('ab'));
    act(() => vi.advanceTimersByTime(50));
    act(() => result.current.setQuery('abc'));
    act(() => vi.advanceTimersByTime(199));
    expect(result.current.debouncedQuery).toBe('');

    act(() => vi.advanceTimersByTime(1));
    expect(result.current.debouncedQuery).toBe('abc');
  });

  it('reset() clears both raw and debounced values', () => {
    const { result } = renderHook(() => useDebouncedSearch({ delay: 200 }));
    act(() => result.current.setQuery('xyz'));
    act(() => vi.advanceTimersByTime(200));
    expect(result.current.debouncedQuery).toBe('xyz');

    act(() => result.current.reset());
    expect(result.current.query).toBe('');
    expect(result.current.debouncedQuery).toBe('');
  });
});
