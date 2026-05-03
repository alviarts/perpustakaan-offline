import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';

describe('useDebouncedSearch', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns initial query immediately for both raw and debounced', () => {
    const { result } = renderHook(() => useDebouncedSearch('init', 200));
    expect(result.current.query).toBe('init');
    expect(result.current.debouncedQuery).toBe('init');
    expect(result.current.isPending).toBe(false);
  });

  it('debounces value updates by the specified delay', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useDebouncedSearch('', 200));

    act(() => {
      result.current.setQuery('a');
    });
    expect(result.current.query).toBe('a');
    expect(result.current.debouncedQuery).toBe('');
    expect(result.current.isPending).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(199);
    });
    expect(result.current.debouncedQuery).toBe('');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2);
    });
    expect(result.current.debouncedQuery).toBe('a');
    expect(result.current.isPending).toBe(false);
  });

  it('coalesces rapid successive changes into one debounced value', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useDebouncedSearch('', 200));

    act(() => {
      result.current.setQuery('a');
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    act(() => {
      result.current.setQuery('ab');
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    act(() => {
      result.current.setQuery('abc');
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(199);
    });
    expect(result.current.debouncedQuery).toBe('');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5);
    });
    expect(result.current.debouncedQuery).toBe('abc');
  });

  it('isPending stays false when the value is unchanged', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useDebouncedSearch('x', 200));
    act(() => {
      result.current.setQuery('x');
    });
    expect(result.current.isPending).toBe(false);
  });
});
