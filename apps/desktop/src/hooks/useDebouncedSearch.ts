import { useEffect, useState } from 'react';

/**
 * Debounced search hook (revisi #15).
 *
 * Returns the input `query` plus a `debouncedQuery` that lags by `delay` ms.
 * `isPending` is true while the debounce timer is running.
 *
 * Usage:
 * ```ts
 * const { query, debouncedQuery, setQuery, isPending } = useDebouncedSearch('', 200);
 * useEffect(() => { fetch(`/api?q=${debouncedQuery}`); }, [debouncedQuery]);
 * ```
 */
export function useDebouncedSearch(initial = '', delay = 200) {
  const [query, setQuery] = useState(initial);
  const [debouncedQuery, setDebouncedQuery] = useState(initial);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    if (query === debouncedQuery) {
      setIsPending(false);
      return;
    }
    setIsPending(true);
    const handle = window.setTimeout(() => {
      setDebouncedQuery(query);
      setIsPending(false);
    }, delay);
    return () => window.clearTimeout(handle);
  }, [query, debouncedQuery, delay]);

  return { query, debouncedQuery, setQuery, isPending };
}
