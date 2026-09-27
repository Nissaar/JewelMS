import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import type { StockMetadata } from './types';

/** Parses a JSON list setting; a malformed value becomes an empty list instead of crashing the page. */
function parseList(key: string, value: string | null): unknown[] {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    console.warn(`Setting ${key} is not valid JSON; ignoring it.`);
    return [];
  }
}

/** Loads the stock drop-down options and saves changes to them. */
export function useStockMetadata() {
  const [metadata, setMetadata] = useState<StockMetadata>({});
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    axios.get('/api/stock/metadata')
      .then(res => {
        const meta: StockMetadata = {};
        for (const s of res.data) meta[s.key] = parseList(s.key, s.value);
        setMetadata(meta);
      })
      .catch(err => console.error('Failed to load stock options:', err))
      .finally(() => setIsLoaded(true));
  }, []);

  // Latest options, so two quick edits build on each other instead of one being lost.
  const latest = useRef(metadata);
  latest.current = metadata;

  /** Saves one option list, then shows it. */
  const saveList = useCallback(async (key: string, update: (current: any[]) => any[]) => {
    const current = latest.current[key];
    const next = update(Array.isArray(current) ? current : []);
    await axios.put(`/api/settings/${key}`, { value: JSON.stringify(next) });
    latest.current = { ...latest.current, [key]: next };
    setMetadata(prev => ({ ...prev, [key]: next }));
  }, []);

  return { metadata, isLoaded, saveList };
}
