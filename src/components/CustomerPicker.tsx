import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Search, Plus, Check } from 'lucide-react';
import CustomerModal from './CustomerModal';

interface CustomerPickerProps {
  selected: any;
  onSelect: (customer: any) => void;
  /** Extra line under the selected customer's name, e.g. "Prêt pour ODF". */
  selectedNote?: string;
}

/** Search for a customer or register a new one, then select them. */
export const CustomerPicker: React.FC<CustomerPickerProps> = ({ selected, onSelect, selectedNote }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  // A newer query cancels the previous request, so results never arrive out of order.
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await axios.get('/api/customers', { params: { search: query }, signal: controller.signal });
        setResults(res.data);
      } catch (err) {
        if (!axios.isCancel(err)) console.error(err);
      }
    }, query ? 250 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);

  return (
    <>
      <div className="flex gap-2 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} aria-hidden="true" />
          <input
            type="text"
            aria-label="Chercher un client"
            placeholder="Chercher Client..."
            className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 pl-12 pr-4 font-bold outline-none focus:border-amber-400"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={() => setIsCreating(true)}
          className="p-3 bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-colors shadow-lg shadow-amber-500/20"
          title="Nouveau Client"
          aria-label="Nouveau Client"
        >
          <Plus size={24} />
        </button>
      </div>

      <div className="space-y-3 max-h-[300px] overflow-y-auto" role="listbox" aria-label="Clients">
        {results.map((c) => (
          <button
            type="button"
            role="option"
            aria-selected={selected?.id === c.id}
            key={c.id}
            onClick={() => onSelect(c)}
            className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${
              selected?.id === c.id ? 'border-amber-400 bg-amber-50' : 'border-slate-50 hover:border-slate-200'
            }`}
          >
            <p className="font-bold text-slate-900">{c.name}</p>
            <p className="text-xs text-slate-500">{c.idNumber}</p>
          </button>
        ))}
      </div>

      {selected && (
        <div role="status" className="mt-6 p-4 bg-emerald-50 text-emerald-700 rounded-2xl flex items-center gap-3">
          <Check size={20} aria-hidden="true" />
          <div className="text-sm font-bold">
            <p>Client: {selected.name}</p>
            {selectedNote && <p className="opacity-70 font-medium">{selectedNote}</p>}
          </div>
        </div>
      )}

      <CustomerModal
        isOpen={isCreating}
        onClose={() => setIsCreating(false)}
        onSuccess={(customer) => { onSelect(customer); setIsCreating(false); }}
        initialName={query}
      />
    </>
  );
};
