import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PagerProps {
  page: number;
  pageCount: number;
  total: number;
  isLoading?: boolean;
  onPage: (page: number) => void;
  /** What is being counted, e.g. "articles". */
  noun?: string;
}

/** Previous / next controls for a paged list. Hidden when everything fits on one page. */
export const Pager: React.FC<PagerProps> = ({ page, pageCount, total, isLoading, onPage, noun = 'résultats' }) => {
  if (total === 0) return null;
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-4 px-6 py-4 border-t border-slate-100 text-sm font-bold text-slate-500">
      <span>{total} {noun}{pageCount > 1 ? ` · page ${page} / ${pageCount}` : ''}</span>
      {pageCount > 1 && (
        <div className="flex gap-2">
          <button type="button" aria-label="Page précédente" disabled={page <= 1 || isLoading} onClick={() => onPage(page - 1)}
            className="flex items-center gap-1 px-3 py-2 bg-white border-2 border-slate-100 rounded-xl hover:bg-slate-50 disabled:opacity-40">
            <ChevronLeft size={16} /> Précédent
          </button>
          <button type="button" aria-label="Page suivante" disabled={page >= pageCount || isLoading} onClick={() => onPage(page + 1)}
            className="flex items-center gap-1 px-3 py-2 bg-white border-2 border-slate-100 rounded-xl hover:bg-slate-50 disabled:opacity-40">
            Suivant <ChevronRight size={16} />
          </button>
        </div>
      )}
    </nav>
  );
};
