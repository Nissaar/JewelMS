import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';

const CHECK_INTERVAL_MS = 5 * 60 * 1000;

async function fetchVersion(): Promise<string | null> {
  try {
    const res = await fetch('/api/version', { cache: 'no-store' });
    return res.ok ? (await res.json()).version : null;
  } catch {
    return null; // offline or server restarting: try again next time
  }
}

/**
 * Tells the user when a new version has been deployed and lets them reload
 * when it suits them, instead of reloading under them and losing a cart.
 */
export const UpdateBanner: React.FC = () => {
  const loadedVersion = useRef<string | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchVersion().then(v => { if (!cancelled) loadedVersion.current = v; });
    const timer = setInterval(async () => {
      const current = await fetchVersion();
      if (!cancelled && current && loadedVersion.current && current !== loadedVersion.current) {
        setUpdateAvailable(true);
      }
    }, CHECK_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  if (!updateAvailable) return null;

  return (
    <div role="status" className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl max-w-[calc(100%-2rem)]">
      <span className="text-sm font-bold">Une nouvelle version est disponible.</span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="flex items-center gap-2 bg-amber-500 text-slate-900 px-4 py-2 rounded-xl text-sm font-black hover:bg-amber-400"
      >
        <RefreshCw size={16} /> Recharger
      </button>
      <button type="button" onClick={() => setUpdateAvailable(false)} className="text-slate-400 text-sm font-bold hover:text-white">
        Plus tard
      </button>
    </div>
  );
};
