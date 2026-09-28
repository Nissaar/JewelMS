import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { motion } from 'motion/react';
import { Search, Plus, Check, X, ArrowLeft, FileText } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';

interface CustomerStepProps {
  selectedCustomer: any;
  onSelectCustomer: (customer: any) => void;
  linkedOdf: any;
  onLinkOdf: (odf: any) => void;
  linkedCommande: any;
  onLinkCommande: (order: any) => void;
  /** Opens the new-customer form, prefilled with what was typed. */
  onNewCustomer: (name: string) => void;
  onBack: () => void;
  onNext: () => void;
}

/** A searchable drop-down of existing documents (trade-ins or orders) to link to the sale. */
const DocumentPicker: React.FC<{
  label: string;
  placeholder: string;
  query: string;
  onQuery: (q: string) => void;
  options: any[];
  selected: any;
  onSelect: (doc: any) => void;
  onClear: () => void;
  renderOption: (doc: any) => React.ReactNode;
}> = ({ label, placeholder, query, onQuery, options, selected, onSelect, onClear, renderOption }) => {
  const [open, setOpen] = useState(false);
  const id = `picker-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <div className="relative">
      <label htmlFor={id} className="block text-xs font-extrabold text-slate-500 uppercase tracking-widest mb-1">{label}</label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} aria-hidden="true" />
        <input
          id={id}
          type="text"
          placeholder={placeholder}
          className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-9 pr-8 text-sm font-bold outline-none focus:border-amber-400 transition-all font-mono"
          value={query}
          onChange={(e) => { onQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
        />
        {selected && (
          <button
            type="button"
            onClick={onClear}
            aria-label={`Retirer le lien ${label}`}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 font-bold"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {open && options.length > 0 && (
        <ul role="listbox" className="absolute z-10 w-full bg-white border border-slate-200 rounded-xl mt-1 shadow-xl max-h-48 overflow-y-auto divide-y divide-slate-100">
          {options.map(doc => (
            <li key={doc.id} role="option" aria-selected={selected?.id === doc.id}>
              <button
                type="button"
                onMouseDown={() => { onSelect(doc); setOpen(false); }}
                className="w-full p-3 hover:bg-slate-50 focus:bg-slate-50 transition-all flex justify-between items-center text-xs text-slate-700"
              >
                {renderOption(doc)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/** Step 2: identify the customer (KYC) and optionally link a trade-in or an order. */
export const CustomerStep: React.FC<CustomerStepProps> = ({
  selectedCustomer, onSelectCustomer, linkedOdf, onLinkOdf, linkedCommande, onLinkCommande, onNewCustomer, onBack, onNext,
}) => {
  const [customerSearch, setCustomerSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [odfs, setOdfs] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [odfSearch, setOdfSearch] = useState(linkedOdf ? `ODF #${linkedOdf.id} - ${linkedOdf.customerName}` : '');
  const [commandeSearch, setCommandeSearch] = useState(linkedCommande ? `Commande N° ${linkedCommande.orderNumber} - ${linkedCommande.customerName}` : '');

  // Documents that can be linked. Loaded separately so one failing (e.g. no
  // permission for trade-ins) doesn't hide the other.
  useEffect(() => {
    axios.get('/api/odf').then(res => setOdfs(res.data)).catch(() => setOdfs([]));
    axios.get('/api/orders', { params: { status: 'Pending' } }).then(res => setOrders(res.data)).catch(() => setOrders([]));
  }, []);

  // Customer search; a newer query cancels the previous one.
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await axios.get('/api/customers', { params: { search: customerSearch }, signal: controller.signal });
        setSearchResults(res.data);
      } catch (err) {
        if (!axios.isCancel(err)) console.error(err);
      }
    }, customerSearch ? 250 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [customerSearch]);

  const matches = (text: string, q: string) => text.toLowerCase().includes(q.toLowerCase());
  const filteredOdfs = odfs.filter(o =>
    matches(`odf #${o.id}`, odfSearch) || matches(o.customerName || '', odfSearch) || String(o.amount || '').includes(odfSearch));
  const filteredOrders = orders.filter(c =>
    matches(`commande ${c.orderNumber}`, commandeSearch) || matches(c.customerName || '', commandeSearch) || String(c.deposit || '').includes(commandeSearch));

  // Linking a document bills its customer.
  const selectDocumentCustomer = (customerId: number, customerName: string) =>
    onSelectCustomer(searchResults.find(c => c.id === customerId) || { id: customerId, name: customerName });

  return (
    <motion.div
      key="step2"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="bg-white p-5 sm:p-8 rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-black text-slate-900">Identification Client (KYC)</h2>
          <button
            type="button"
            onClick={() => onNewCustomer(customerSearch)}
            className="text-amber-600 font-bold flex items-center gap-2 hover:bg-amber-50 px-4 py-2 rounded-xl transition-all"
          >
            <Plus size={18} aria-hidden="true" /> Nouveau Client
          </button>
        </div>

        {/* Link an existing document */}
        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 mb-6 space-y-4">
          <h3 className="text-sm font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <FileText size={18} className="text-amber-500" aria-hidden="true" />
            Lier à un document existant
          </h3>
          <p className="text-xs text-slate-500 font-medium -mt-2">
            Liez cette vente à un acompte de commande ou à une reprise (ODF) pour calculer le solde et remplir les détails du client.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DocumentPicker
              label="Rechercher ODF"
              placeholder="N° ODF, nom client..."
              query={odfSearch}
              onQuery={setOdfSearch}
              options={filteredOdfs}
              selected={linkedOdf}
              onSelect={o => {
                onLinkOdf(o);
                setOdfSearch(`ODF #${o.id} - ${o.customerName}`);
                selectDocumentCustomer(o.customerId, o.customerName);
              }}
              onClear={() => { onLinkOdf(null); setOdfSearch(''); }}
              renderOption={o => (
                <>
                  <div className="text-left">
                    <p className="font-bold text-slate-900 font-mono">ODF #{o.id}</p>
                    <p className="text-slate-500 font-medium">{o.customerName}</p>
                  </div>
                  <span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded font-black font-mono">
                    {formatCurrency(parseFloat(o.amount || '0'))}
                  </span>
                </>
              )}
            />
            <DocumentPicker
              label="Rechercher Commande"
              placeholder="N° Commande, nom client..."
              query={commandeSearch}
              onQuery={setCommandeSearch}
              options={filteredOrders}
              selected={linkedCommande}
              onSelect={c => {
                onLinkCommande(c);
                setCommandeSearch(`Commande N° ${c.orderNumber} - ${c.customerName}`);
                selectDocumentCustomer(c.customerId, c.customerName);
              }}
              onClear={() => { onLinkCommande(null); setCommandeSearch(''); }}
              renderOption={c => (
                <>
                  <div className="text-left">
                    <p className="font-bold text-slate-900 font-mono">Commande N° {c.orderNumber}</p>
                    <p className="text-slate-500 font-medium">{c.customerName}</p>
                  </div>
                  <span className="bg-amber-50 text-amber-700 px-2 py-1 rounded font-black font-mono">
                    Acompte: {formatCurrency(parseFloat(c.deposit || '0'))}
                  </span>
                </>
              )}
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={24} aria-hidden="true" />
            <input
              type="text"
              aria-label="Rechercher un client"
              placeholder="Rechercher par Nom ou N° ID..."
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 pl-14 pr-4 text-lg font-bold outline-none focus:border-amber-400 transition-all font-mono"
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
            />
          </div>

          <div className="max-h-[300px] overflow-y-auto space-y-3 pr-2" role="listbox" aria-label="Clients">
            {searchResults.map((c) => (
              <button
                type="button"
                role="option"
                aria-selected={selectedCustomer?.id === c.id}
                key={c.id}
                onClick={() => onSelectCustomer(c)}
                className={`w-full text-left p-4 rounded-2xl border-2 transition-all flex items-center justify-between ${
                  selectedCustomer?.id === c.id ? 'border-amber-400 bg-amber-50 shadow-sm' : 'border-slate-50 hover:border-slate-200'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600" aria-hidden="true">
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{c.name}</p>
                    <p className="text-xs text-slate-500">{c.idNumber}</p>
                  </div>
                </div>
                {selectedCustomer?.id === c.id && <Check className="text-amber-500" size={24} aria-hidden="true" />}
              </button>
            ))}
            {customerSearch.length >= 2 && searchResults.length === 0 && (
              <div className="text-center py-10 text-slate-400 italic">Aucun client trouvé</div>
            )}
          </div>

          <div className="flex justify-between items-center pt-8 gap-4">
            <button
              type="button"
              onClick={onBack}
              className="px-6 py-4 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-all flex items-center gap-2 border-2 border-slate-100"
            >
              <ArrowLeft size={20} aria-hidden="true" /> Retour
            </button>
            {selectedCustomer && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <button
                  type="button"
                  onClick={onNext}
                  className="bg-amber-500 text-slate-900 px-8 py-4 rounded-xl font-black text-lg hover:bg-amber-400 transition-all flex items-center gap-2 shadow-xl shadow-amber-500/20"
                >
                  Valider Client <Check size={24} aria-hidden="true" />
                </button>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
