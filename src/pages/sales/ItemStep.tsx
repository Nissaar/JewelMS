import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingCart, Barcode, Plus, AlertCircle, Loader2, X, Tag, Camera } from 'lucide-react';
import BarcodeScanner from '../../components/BarcodeScanner';
import { formatCurrency, getCleanDisplayLabel } from '../../lib/utils';
import { CartTable } from './CartTable';
import type { Cart } from './useCart';

/** Step 1: find items by scan, barcode or search, and review the cart. */
export const ItemStep: React.FC<{ cart: Cart; onContinue: () => void }> = ({ cart, onContinue }) => {
  const [barcode, setBarcode] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Suggestions while typing; a newer query cancels the previous request.
  useEffect(() => {
    if (!barcode.trim()) { setResults([]); return; }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await axios.get('/api/stock/autocomplete', { params: { q: barcode }, signal: controller.signal });
        setResults(res.data);
      } catch (err) {
        if (!axios.isCancel(err)) console.error(err);
      }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [barcode]);

  const addItem = (item: any) => {
    if (!cart.add(item)) {
      setError('Cet article est déjà dans le panier.');
      return;
    }
    setBarcode('');
    setResults([]);
    setError('');
  };

  const fetchByBarcode = async (code: string) => {
    if (!code) return;
    setIsLoading(true);
    try {
      const res = await axios.get(`/api/stock/${encodeURIComponent(code)}`);
      addItem(res.data);
      setIsScannerOpen(false);
    } catch {
      setError('Article non trouvé dans le stock.');
    } finally {
      setIsLoading(false);
    }
  };

  const itemCount = cart.items.length;

  return (
    <motion.div
      key="step1"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-black text-slate-900">Identifier l'Article</h2>
          <button
            type="button"
            onClick={() => setIsScannerOpen(!isScannerOpen)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all ${
              isScannerOpen ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
            }`}
          >
            {isScannerOpen ? <X size={18} /> : <Camera size={18} />}
            {isScannerOpen ? 'Fermer Scanner' : 'Scanner Barcode'}
          </button>
        </div>

        <AnimatePresence>
          {isScannerOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-8"
            >
              <BarcodeScanner onScanSuccess={fetchByBarcode} onScanError={(err) => console.log(err)} />
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={(e) => { e.preventDefault(); fetchByBarcode(barcode); }} className="flex gap-4 mb-8 relative">
          <div className="relative flex-1">
            <Barcode className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={24} aria-hidden="true" />
            <input
              ref={inputRef}
              type="text"
              aria-label="Code-barres ou recherche d'article"
              placeholder="Saisir barcode ou catégorie..."
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 pl-14 pr-4 text-lg font-bold outline-none focus:border-amber-400 transition-all font-mono"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
            />

            {/* Suggestions */}
            <AnimatePresence>
              {results.length > 0 && (
                <motion.ul
                  role="listbox"
                  aria-label="Articles trouvés"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  className="absolute left-0 right-0 top-full mt-2 bg-white border-2 border-slate-100 rounded-2xl shadow-2xl z-50 overflow-hidden max-h-[300px] overflow-y-auto"
                >
                  {results.map((item) => (
                    <li key={item.id} role="option" aria-selected={false}>
                      <button
                        type="button"
                        onClick={() => addItem(item)}
                        className="w-full text-left p-4 hover:bg-slate-50 focus:bg-slate-50 border-b border-slate-50 last:border-0 flex items-center justify-between group transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="bg-amber-100 text-amber-600 p-2 rounded-lg">
                            <Tag size={18} aria-hidden="true" />
                          </div>
                          <p className="font-bold text-slate-900">{getCleanDisplayLabel(item)}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-amber-600 italic">
                            {item.category === 'Jewellery' && item.weightGrams ? `${item.weightGrams}g` : '-'}
                          </p>
                          <p className="text-[10px] uppercase font-bold text-slate-400">{item.metalType} {item.fineness}</p>
                        </div>
                      </button>
                    </li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="bg-slate-900 text-white px-8 rounded-2xl font-bold hover:bg-slate-800 transition-all disabled:opacity-50 h-[60px]"
          >
            {isLoading ? <Loader2 className="animate-spin" /> : 'Rechercher'}
          </button>
        </form>

        {itemCount > 0 && error && (
          <p role="alert" className="mb-4 text-sm font-bold text-red-600">{error}</p>
        )}

        {itemCount > 0 ? (
          <div className="space-y-4 border-t border-slate-100 pt-6">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <ShoppingCart className="text-amber-500" size={20} aria-hidden="true" /> Panier d'Achat ({itemCount} article{itemCount > 1 ? 's' : ''})
            </h3>
            <CartTable cart={cart} />

            <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100 flex-wrap gap-4">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase">Total Net HT</p>
                <p className="text-lg font-black text-slate-900">{formatCurrency(cart.totals.netCents / 100)}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase">TVA (15%)</p>
                <p className="text-lg font-black text-amber-600">{formatCurrency(cart.totals.vatCents / 100)}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase">Total TTC</p>
                <p className="text-2xl font-black text-slate-900">{formatCurrency(cart.totals.grossCents / 100)}</p>
              </div>
              {cart.error && (
                <p role="alert" className="w-full text-sm font-bold text-red-600">{cart.error}</p>
              )}
              <button
                type="button"
                onClick={onContinue}
                disabled={!!cart.error}
                className="bg-amber-500 text-slate-900 px-6 py-3 rounded-xl font-bold hover:bg-amber-400 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continuer <Plus size={18} aria-hidden="true" />
              </button>
            </div>
          </div>
        ) : error ? (
          <div className="p-10 text-center space-y-4 border-2 border-dashed border-slate-100 rounded-3xl">
            <div className="h-20 w-20 bg-red-50 text-red-500 mx-auto rounded-full flex items-center justify-center">
              <AlertCircle size={40} aria-hidden="true" />
            </div>
            <p role="alert" className="text-lg font-bold text-slate-700">{error}</p>
            <button type="button" onClick={() => { setBarcode(''); setError(''); }} className="text-amber-600 font-bold hover:underline">Réessayer</button>
          </div>
        ) : (
          <div className="p-20 text-center space-y-4 border-2 border-dashed border-slate-100 rounded-3xl">
            <Barcode className="mx-auto text-slate-200" size={64} aria-hidden="true" />
            <p className="text-slate-400 font-medium">En attente d'un scan ou d'une saisie pour ajouter au panier...</p>
          </div>
        )}
      </div>
    </motion.div>
  );
};
