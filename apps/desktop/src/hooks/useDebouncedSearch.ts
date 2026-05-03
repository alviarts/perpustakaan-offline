import { useEffect, useRef, useState } from 'react';

interface UseDebouncedSearchOptions {
  /** Delay in milliseconds. Defaults to 200ms (revisi #15). */
  delay?: number;
  /** Initial query value. */
  initialValue?: string;
}

interface UseDebouncedSearchResult {
  query: string;
  debouncedQuery: string;
  setQuery: (value: string) => void;
  isPending: boolean;
  reset: () => void;
}

/**
 * Live-search hook with a 200ms debounce window. The raw `query` reflects the
 * current input value (synchronous), `debouncedQuery` lags by `delay` ms and is
 * the value callers should pass to API/list filtering. `isPending` is true
 * whenever the two diverge so callers can render a "searching..." indicator.
 */
export function useDebouncedSearch({
  delay = 200,
  initialValue = '',
}: UseDebouncedSearchOptions = {}): UseDebouncedSearchResult {
  const [query, setQueryState] = useState(initialValue);
  const [debouncedQuery, setDebouncedQuery] = useState(initialValue);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (query === debouncedQuery) return;
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = setTimeout(() => {
      setDebouncedQuery(query);
      timeout.current = null;
    }, delay);
    return () => {
      if (timeout.current) {
        clearTimeout(timeout.current);
        timeout.current = null;
      }
    };
  }, [query, debouncedQuery, delay]);

  return {
    query,
    debouncedQuery,
    setQuery: setQueryState,
    isPending: query !== debouncedQuery,
    reset: () => {
      setQueryState('');
      setDebouncedQuery('');
    },
  };
}
