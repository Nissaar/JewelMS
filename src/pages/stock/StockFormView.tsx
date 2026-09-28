import React, { useState } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'motion/react';
import { Save, X, Check, AlertCircle, Loader2, ChevronDown, Barcode, Scale, Info, Tag, Camera, Coins, Hash } from 'lucide-react';
import BarcodeScanner from '../../components/BarcodeScanner';
import { emptyStockForm, firstSubCategory, type StockForm, type StockItem, type StockMetadata } from './types';

export type StockFormMode =
  | { kind: 'create' }
  | { kind: 'edit'; item: StockItem }
  | { kind: 'bulk'; item: StockItem; baseCode: string };

interface StockFormViewProps {
  mode: StockFormMode;
  metadata: StockMetadata;
  /** Called after a successful save with the message to show on the list. */
  onSaved: (message: string) => void;
  onCancel: () => void;
}

const fromItem = (item: StockItem): StockForm => ({
  barcode: item.barcode,
  itemCode: item.itemCode || '',
  category: item.category,
  subCategory: item.subCategory,
  stockType: item.stockType,
  brand: item.brand || '',
  yearsOfGuarantee: item.yearsOfGuarantee || 0,
  serialNumber: item.serialNumber || '',
  metalType: item.metalType || '',
  fineness: item.fineness || '',
  weightGrams: item.weightGrams || '',
  price: item.price || '',
  quantity: 1,
});

const selectClass = 'w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-amber-400 font-bold';

/** Sub-categories of the chosen category, plus "Autre". */
const SubCategorySelect: React.FC<{ label: string; value: string; options: string[]; onChange: (v: string) => void }> = ({ label, value, options, onChange }) => (
  <div>
    <label className="block text-sm font-bold text-slate-700 mb-2">{label}</label>
    <select aria-label={label} className={selectClass} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.length === 0
        ? <option value="">Aucune sous-catégorie trouvée</option>
        : options.map(name => <option key={name} value={name}>{name}</option>)}
      <option value="Autre">Autre</option>
    </select>
  </div>
);

/** Create one or several items, edit one, or edit every available item of a group. */
export const StockFormView: React.FC<StockFormViewProps> = ({ mode, metadata, onSaved, onCancel }) => {
  const [formData, setFormData] = useState<StockForm>(() => mode.kind === 'create' ? emptyStockForm(metadata) : fromItem(mode.item));
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const isBulk = mode.kind === 'bulk';
  const isEdit = mode.kind === 'edit';
  const set = (patch: Partial<StockForm>) => setFormData(prev => ({ ...prev, ...patch }));
  const subCategories = (metadata.stock_sub_categories || []).filter(sc => sc.category === formData.category).map(sc => sc.name);

  const handleCategoryChange = (category: string) => {
    const isJewellery = category === 'Jewellery';
    set({
      category,
      subCategory: firstSubCategory(metadata, category),
      metalType: isJewellery ? (metadata.stock_metal_types?.[0] || '') : '',
      fineness: isJewellery ? (metadata.stock_fineness_options?.[0] || '') : '',
      weightGrams: '',
      brand: category === 'Sewing Machine' ? (metadata.stock_sewing_machine_brands?.[0] || '') : '',
      yearsOfGuarantee: 0,
      serialNumber: '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');
    try {
      const { quantity, ...fields } = formData;
      if (mode.kind === 'bulk') {
        const { barcode, itemCode, ...groupFields } = fields;
        const res = await axios.put('/api/stock/bulk-edit', { baseItemCode: mode.baseCode, ...groupFields });
        onSaved(`${res.data.updated} articles du groupe mis à jour`);
      } else if (mode.kind === 'edit') {
        await axios.put(`/api/stock/${mode.item.id}`, fields);
        onSaved('Article mis à jour');
      } else {
        await axios.post('/api/stock', formData);
        onSaved(quantity > 1 ? `${quantity} articles ajoutés au stock` : 'Article ajouté au stock');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || "Échec de l'opération");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="w-full max-w-5xl mx-auto flex flex-col gap-8"
    >
      <div className="w-full bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
        <div className="p-5 sm:p-8 bg-slate-900 text-white">
          <h3 className="text-2xl font-bold">
            {mode.kind === 'bulk' ? `Modifier le Groupe — ${mode.baseCode}` : isEdit ? "Modifier l'Article" : 'Nouvel Article'}
          </h3>
          <p className="text-slate-400 font-medium">
            {isBulk
              ? 'Tous les articles encore disponibles de ce groupe seront modifiés'
              : isEdit ? "Mettez à jour les informations de l'article" : "Remplissez les informations de l'article"}
          </p>
          {isBulk && (
            <div className="mt-3 px-4 py-2 bg-indigo-600/30 border border-indigo-400/30 rounded-xl text-indigo-200 text-sm font-medium flex items-center gap-2">
              <Info size={16} aria-hidden="true" />
              Les codes-barres et codes articles resteront inchangés (uniques par article)
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Barcode — not editable in bulk mode */}
            {!isBulk && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="stock-barcode" className="block text-sm font-bold text-slate-700">Code-Barres / SKU</label>
                  <button
                    type="button"
                    onClick={() => setIsScannerOpen(!isScannerOpen)}
                    className={`flex items-center gap-1 text-xs font-black px-2 py-1 rounded-lg transition-all ${
                      isScannerOpen ? 'bg-red-50 text-red-600' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                    }`}
                  >
                    {isScannerOpen ? <X size={14} /> : <Camera size={14} />}
                    {isScannerOpen ? 'Fermer Caméra' : 'Scan avec Caméra'}
                  </button>
                </div>

                <AnimatePresence>
                  {isScannerOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="mb-4 overflow-hidden"
                    >
                      <BarcodeScanner
                        onScanSuccess={(code) => {
                          set({ barcode: code });
                          setIsScannerOpen(false);
                        }}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="relative">
                  <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} aria-hidden="true" />
                  <input
                    id="stock-barcode"
                    type="text"
                    required
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 pl-10 pr-4 outline-none focus:border-amber-400 font-bold"
                    value={formData.barcode}
                    onChange={(e) => set({ barcode: e.target.value })}
                  />
                </div>
              </div>
            )}

            {/* Item code — not editable in bulk mode */}
            {!isBulk && (
              <div>
                <label htmlFor="stock-item-code" className="block text-sm font-bold text-slate-700 mb-2">Code Article (Optionnel)</label>
                <div className="relative">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} aria-hidden="true" />
                  <input
                    id="stock-item-code"
                    type="text"
                    placeholder="Ex: H-1234"
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 pl-10 pr-4 outline-none focus:border-amber-400 font-bold"
                    value={formData.itemCode}
                    onChange={(e) => set({ itemCode: e.target.value })}
                  />
                </div>
                {mode.kind === 'create' && formData.itemCode && formData.quantity > 1 && (
                  <div className="mt-2 px-3 py-2 bg-indigo-50 border border-indigo-100 rounded-lg text-xs text-indigo-600 font-medium">
                    <span className="font-black">Codes générés:</span>{' '}
                    {Array.from({ length: Math.min(formData.quantity, 5) }, (_, i) => `${formData.itemCode}-${i + 1}`).join(', ')}
                    {formData.quantity > 5 && ` ... ${formData.itemCode}-${formData.quantity}`}
                  </div>
                )}
              </div>
            )}

            {/* Quantity — only when adding */}
            {mode.kind === 'create' && (
              <div>
                <label htmlFor="stock-quantity" className="block text-sm font-bold text-slate-700 mb-2">Quantité</label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} aria-hidden="true" />
                  <input
                    id="stock-quantity"
                    type="number"
                    min="1"
                    max="100"
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 pl-10 pr-4 outline-none focus:border-amber-400 font-bold"
                    value={formData.quantity}
                    onChange={(e) => set({ quantity: Math.min(Math.max(parseInt(e.target.value) || 1, 1), 100) })}
                  />
                </div>
                {formData.quantity > 1 && (
                  <p className="mt-1 text-xs text-amber-600 font-semibold">
                    {formData.quantity} articles seront créés avec des codes incrémentés
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Catégorie</label>
              <div className="relative">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} aria-hidden="true" />
                <select aria-label="Catégorie"
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 pl-10 pr-4 outline-none focus:border-amber-400 font-bold appearance-none"
                  value={formData.category}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                >
                  {metadata.stock_categories?.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} aria-hidden="true" />
              </div>
            </div>

            <div>
              <label htmlFor="stock-price" className="block text-sm font-bold text-slate-700 mb-2">Prix de Vente (TVA 15% Incluse)</label>
              <div className="relative">
                <Coins className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} aria-hidden="true" />
                <input
                  id="stock-price"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 pl-10 pr-4 outline-none focus:border-amber-400 font-bold"
                  value={formData.price}
                  onChange={(e) => set({ price: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div>
            <span className="block text-sm font-bold text-slate-700 mb-2">Emplacement par défaut</span>
            <div className="flex bg-slate-100 p-1 rounded-xl max-w-md" role="radiogroup" aria-label="Emplacement">
              {([['on-display', 'En Vitrine'], ['in-store', 'En Réserve']] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={formData.stockType === value}
                  onClick={() => set({ stockType: value })}
                  className={`flex-1 py-3 rounded-lg text-sm font-black transition-all ${
                    formData.stockType === value ? 'bg-white shadow-md text-slate-900' : 'text-slate-500'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Fields that depend on the category */}
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            key={formData.category}
            className="pt-6 border-t border-slate-100"
          >
            {formData.category === 'Jewellery' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <SubCategorySelect label="Type de Bijou (Sous-Catégorie)" value={formData.subCategory} options={subCategories} onChange={v => set({ subCategory: v })} />
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Métal</label>
                    <select aria-label="Métal" className={selectClass} value={formData.metalType} onChange={(e) => set({ metalType: e.target.value })}>
                      {metadata.stock_metal_types?.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Pureté (Finesse)</label>
                    <select aria-label="Pureté (Finesse)" className={selectClass} value={formData.fineness} onChange={(e) => set({ fineness: e.target.value })}>
                      {metadata.stock_fineness_options?.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Poids (Grammes)</label>
                    <div className="relative">
                      <Scale className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} aria-hidden="true" />
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        placeholder="0.000"
                        aria-label="Poids en grammes"
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 pl-10 pr-4 outline-none focus:border-amber-400 font-bold"
                        value={formData.weightGrams}
                        onChange={(e) => set({ weightGrams: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {formData.category === 'Pen' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SubCategorySelect label="Marque (Brand)" value={formData.subCategory} options={subCategories} onChange={v => set({ subCategory: v })} />
                <div>
                  <label htmlFor="stock-serial" className="block text-sm font-bold text-slate-700 mb-2">N° de Série (Optionnel)</label>
                  <input id="stock-serial" type="text" placeholder="Ex: P123456" className={selectClass} value={formData.serialNumber} onChange={(e) => set({ serialNumber: e.target.value })} />
                </div>
              </div>
            )}

            {formData.category === 'Sewing Machine' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <SubCategorySelect label="Marque" value={formData.brand} options={subCategories} onChange={v => set({ brand: v })} />
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Garantie (Années)</label>
                  <select aria-label="Garantie (Années)" className={selectClass} value={formData.yearsOfGuarantee} onChange={(e) => set({ yearsOfGuarantee: parseInt(e.target.value) })}>
                    {metadata.guarantee_options?.map(y => <option key={y} value={y}>{y} ans</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="stock-serial" className="block text-sm font-bold text-slate-700 mb-2">N° de Série</label>
                  <input id="stock-serial" type="text" placeholder="Ex: SM-9988" className={selectClass} value={formData.serialNumber} onChange={(e) => set({ serialNumber: e.target.value })} />
                </div>
              </div>
            )}

            {formData.category === 'Parts' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SubCategorySelect label="Type de Pièce" value={formData.subCategory} options={subCategories} onChange={v => set({ subCategory: v })} />
              </div>
            )}

            {!['Jewellery', 'Pen', 'Sewing Machine', 'Parts'].includes(formData.category) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SubCategorySelect label="Sous-Catégorie" value={formData.subCategory} options={subCategories} onChange={v => set({ subCategory: v })} />
              </div>
            )}
          </motion.div>

          {error && (
            <div role="alert" className="p-4 rounded-2xl flex items-center gap-3 text-sm font-bold bg-red-50 text-red-600 border border-red-100">
              <AlertCircle size={20} aria-hidden="true" /> {error}
            </div>
          )}

          <div className="pt-8 flex gap-4">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 bg-slate-100 text-slate-600 font-bold py-4 rounded-2xl hover:bg-slate-200 transition-all"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-[2] bg-slate-900 text-white font-bold py-4 rounded-2xl shadow-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-3"
            >
              {isSaving ? <Loader2 className="animate-spin" /> : (
                <>
                  <Save size={20} aria-hidden="true" />
                  <span>
                    {isBulk ? 'Modifier les articles du groupe' : isEdit ? "Mettre à jour l'Inventaire" : "Enregistrer dans l'Inventaire"}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </motion.div>
  );
};

/** Success banner shown on the list after a save. */
export const StockMessage: React.FC<{ text: string }> = ({ text }) => (
  <motion.div
    role="status"
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    className="p-6 rounded-3xl flex items-center gap-3 text-sm font-bold w-full bg-emerald-50 text-emerald-600 border border-emerald-100"
  >
    <Check size={20} aria-hidden="true" />
    {text}
  </motion.div>
);
