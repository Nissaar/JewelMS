import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import type { StockMetadata, SubCategory } from './types';

interface StockOptionsProps {
  metadata: StockMetadata;
  saveList: (key: string, update: (current: any[]) => any[]) => Promise<void>;
  onClose: () => void;
}

// Brands for pens and sewing machines are managed as sub-categories.
const HIDDEN_KEYS = ['stock_categories', 'stock_sub_categories', 'stock_pen_brands', 'stock_sewing_machine_brands'];

const Chip: React.FC<{ label: string; onRemove: () => void; className?: string }> = ({ label, onRemove, className = 'bg-slate-100' }) => (
  <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold text-slate-600 ${className}`}>
    {label}
    <button type="button" onClick={onRemove} aria-label={`Retirer ${label}`} className="text-slate-400 hover:text-red-500">
      <X size={14} />
    </button>
  </div>
);

/** A list of simple text options (metal types, fineness, guarantees, ...). */
const OptionList: React.FC<{ settingKey: string; values: string[]; saveList: StockOptionsProps['saveList']; label?: string }> = ({ settingKey, values, saveList, label }) => {
  const [draft, setDraft] = useState('');
  const add = async () => {
    const value = draft.trim();
    if (!value) return;
    await saveList(settingKey, list => [...list, value]);
    setDraft('');
  };
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label htmlFor={`input-${settingKey}`} className="text-sm font-bold text-slate-700 capitalize">{label || settingKey.replace(/_/g, ' ')}</label>
        <button type="button" onClick={add} className="text-xs font-bold text-amber-600 hover:text-amber-700">+ Ajouter</button>
      </div>
      <input
        id={`input-${settingKey}`}
        type="text"
        placeholder="Valeur..."
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm outline-none focus:border-amber-400"
      />
      <div className="flex flex-wrap gap-2">
        {values.map((val, idx) => (
          <Chip key={`${val}-${idx}`} label={val} onRemove={() => saveList(settingKey, list => list.filter((_, i) => i !== idx))} />
        ))}
      </div>
    </div>
  );
};

/** Admin screen for the stock drop-down options. */
export const StockOptions: React.FC<StockOptionsProps> = ({ metadata, saveList, onClose }) => {
  const categories = metadata.stock_categories || [];
  const subCategories = (metadata.stock_sub_categories || []).filter((sc): sc is SubCategory => typeof sc === 'object' && !!sc);
  const [subName, setSubName] = useState('');
  const [subParent, setSubParent] = useState(categories[0] || '');

  const addSubCategory = async () => {
    const name = subName.trim();
    const parent = subParent || categories[0];
    if (!name || !parent) return;
    await saveList('stock_sub_categories', list => [...list.filter(sc => typeof sc === 'object'), { name, category: parent }]);
    setSubName('');
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden"
    >
      <div className="p-8 border-b border-slate-100 flex justify-between items-center">
        <div>
          <h3 className="text-2xl font-bold text-slate-900">Options des Listes Déroulantes</h3>
          <p className="text-slate-500 font-medium">Configurez les valeurs disponibles pour le stock</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Fermer les options" className="p-2 text-slate-400 hover:text-slate-900">
          <X size={24} />
        </button>
      </div>

      <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
        <OptionList settingKey="stock_categories" label="Catégories Principales" values={categories} saveList={saveList} />

        {/* Sub-categories and brands, each linked to a category */}
        <div className="space-y-4">
          <span className="text-sm font-bold text-slate-700">Sous-Catégories & Marques</span>
          <div className="bg-slate-50 p-4 rounded-2xl space-y-3">
            <input
              type="text"
              aria-label="Nom de la sous-catégorie"
              placeholder="Nom (ex: Ring, Parker...)"
              value={subName}
              onChange={e => setSubName(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg py-2 px-3 text-sm outline-none focus:border-amber-400"
            />
            <div className="flex gap-2">
              <select
                aria-label="Catégorie parente"
                value={subParent}
                onChange={e => setSubParent(e.target.value)}
                className="flex-1 bg-white border border-slate-200 rounded-lg py-2 px-3 text-sm outline-none focus:border-amber-400 font-bold"
              >
                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              <button type="button" onClick={addSubCategory} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-800 transition-colors">
                Ajouter
              </button>
            </div>
          </div>

          <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
            {categories.map(cat => (
              <div key={cat} className="space-y-2">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{cat}</h4>
                <div className="flex flex-wrap gap-2">
                  {subCategories.filter(sc => sc.category === cat).map(sc => (
                    <Chip
                      key={`${sc.category}-${sc.name}`}
                      label={sc.name}
                      className="bg-white border border-slate-100 shadow-sm"
                      onRemove={() => saveList('stock_sub_categories', list => list.filter(x => !(x?.name === sc.name && x?.category === sc.category)))}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Other option lists */}
        {Object.keys(metadata).filter(k => !HIDDEN_KEYS.includes(k) && Array.isArray(metadata[k])).map(key => (
          <div key={key} className="pt-4 border-t border-slate-100">
            <OptionList settingKey={key} values={metadata[key] as string[]} saveList={saveList} />
          </div>
        ))}
      </div>
    </motion.div>
  );
};
