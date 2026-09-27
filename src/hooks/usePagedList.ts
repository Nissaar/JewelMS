import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';

export interface PagedList<T> {
  items: T[];
  total: number;
  page: number;
  pageCount: number;
  isLoading: boolean;
  error: string | null;
  setPage: (page: number) => void;
  /** Re-fetches the current page (after a create, edit or delete). */
  reload: () => void;
}

/**
 * One page of a server-side list. Filters are sent as query parameters; when
 * they change the list returns to page 1. Typing is debounced and a newer
 * request cancels the older one, so results never arrive out of order.
 */
export function usePagedList<T>(url: string, filters: Record<string, string | undefined>, pageSize = 25): PagedList<T> {
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const filterKey = JSON.stringify(filters);
  const lastFilterKey = useRef(filterKey);

  useEffect(() => {
    // New filters start again from the first page.
    const filtersChanged = lastFilterKey.current !== filterKey;
    lastFilterKey.current = filterKey;
    if (filtersChanged && page !== 1) {
      setPage(1);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsLoading(true);
      setError(null);
      try {
        const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined && v !== ''));
        const res = await axios.get(url, { params: { ...params, page, pageSize }, signal: controller.signal });
        setItems(res.data.items);
        setTotal(res.data.total);
      } catch (err: any) {
        if (!axios.isCancel(err)) setError(err.response?.data?.error || 'Impossible de charger la liste.');
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }, filtersChanged ? 300 : 0);

    return () => { clearTimeout(timer); controller.abort(); };
    // `filters` is tracked through filterKey.
  }, [url, filterKey, page, pageSize, reloadKey]);

  const reload = useCallback(() => setReloadKey(k => k + 1), []);

  return { items, total, page, pageCount: Math.max(1, Math.ceil(total / pageSize)), isLoading, error, setPage, reload };
}
