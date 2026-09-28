import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Package, Plus, X, Settings as SettingsIcon, History, AlertCircle } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { usePagedList } from '../hooks/usePagedList';
import { StockList } from './stock/StockList';
import { StockFormView, StockMessage, type StockFormMode } from './stock/StockFormView';
import { StockOptions } from './stock/StockOptions';
import { useStockMetadata } from './stock/useStockMetadata';
import { getBaseItemCode, type StockItem } from './stock/types';

type View = { name: 'list' } | { name: 'form'; mode: StockFormMode } | { name: 'options' };

const Stock = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [view, setView] = useState<View>({ name: 'list' });
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [category, setCategory] = useState('All');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { metadata, saveList } = useStockMetadata();
  // Searched and filtered on the server, one page at a time.
  const list = usePagedList<StockItem>('/api/stock', { q: searchQuery, category });

  const flash = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleSaved = (text: string) => {
    setView({ name: 'list' });
    list.reload();
    flash('success', text);
  };

  const handleDelete = async (item: StockItem) => {
    if (!window.confirm('Supprimer cet article du stock ?')) return;
    try {
      await axios.delete(`/api/stock/${item.id}`);
      list.reload();
      flash('success', 'Article supprimé');
    } catch (err: any) {
      flash('error', err.response?.data?.error || 'Échec de la suppression');
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 flex items-center gap-3">
            <Package className="text-amber-500" size={32} aria-hidden="true" />
            Gestion du Stock
          </h1>
          <p className="text-slate-500 font-medium">Contrôlez votre inventaire et vos articles</p>
        </div>

        <div className="flex items-center gap-3">
          {view.name === 'list' ? (
            <>
              {user?.role === 'Admin' && (
                <button
                  type="button"
                  onClick={() => setView({ name: 'options' })}
                  className="p-3 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-all flex items-center gap-2 font-bold"
                >
                  <SettingsIcon size={20} aria-hidden="true" />
                  <span className="hidden sm:inline">Options</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => navigate('/stock/sold')}
                className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 hover:bg-red-100 transition-all flex items-center gap-2 font-bold"
              >
                <History size={20} aria-hidden="true" />
                <span className="hidden sm:inline">Historique Ventes</span>
              </button>
              <button
                type="button"
                onClick={() => setView({ name: 'form', mode: { kind: 'create' } })}
                className="p-3 bg-amber-500 text-slate-900 rounded-xl hover:bg-amber-400 transition-all shadow-lg flex items-center gap-2 font-bold"
              >
                <Plus size={20} aria-hidden="true" />
                <span>Ajouter</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setView({ name: 'list' })}
              className="p-3 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-all flex items-center gap-2 font-bold"
            >
              <X size={20} aria-hidden="true" />
              <span>Annuler</span>
            </button>
          )}
        </div>
      </div>

      {message?.type === 'success' && <StockMessage text={message.text} />}
      {message?.type === 'error' && (
        <div role="alert" className="p-6 rounded-3xl flex items-center gap-3 text-sm font-bold bg-red-50 text-red-600 border border-red-100">
          <AlertCircle size={20} aria-hidden="true" /> {message.text}
        </div>
      )}

      <AnimatePresence mode="wait">
        {view.name === 'list' && (
          <StockList
            key="list"
            list={list}
            metadata={metadata}
            searchQuery={searchQuery}
            onSearch={setSearchQuery}
            category={category}
            onCategory={setCategory}
            onEdit={item => setView({ name: 'form', mode: { kind: 'edit', item } })}
            onBulkEdit={item => {
              const baseCode = getBaseItemCode(item.itemCode);
              if (baseCode) setView({ name: 'form', mode: { kind: 'bulk', item, baseCode } });
            }}
            onDelete={handleDelete}
          />
        )}

        {view.name === 'form' && (
          <StockFormView
            key={view.mode.kind === 'create' ? 'create' : `${view.mode.kind}-${view.mode.item.id}`}
            mode={view.mode}
            metadata={metadata}
            onSaved={handleSaved}
            onCancel={() => setView({ name: 'list' })}
          />
        )}

        {view.name === 'options' && (
          <StockOptions key="options" metadata={metadata} saveList={saveList} onClose={() => setView({ name: 'list' })} />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Stock;
