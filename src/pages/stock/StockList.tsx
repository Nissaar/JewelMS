import React from 'react';
import { Search, Filter, Edit2, Trash2, Loader2, Barcode, Copy } from 'lucide-react';
import { motion } from 'motion/react';
import { formatWeight, formatItemDetails, formatCurrency } from '../../lib/utils';
import { Pager } from '../../components/Pager';
import type { PagedList } from '../../hooks/usePagedList';
import { getBaseItemCode, type StockItem, type StockMetadata } from './types';

interface StockListProps {
  list: PagedList<StockItem>;
  metadata: StockMetadata;
  searchQuery: string;
  onSearch: (value: string) => void;
  category: string;
  onCategory: (value: string) => void;
  onEdit: (item: StockItem) => void;
  onBulkEdit: (item: StockItem) => void;
  onDelete: (item: StockItem) => void;
}

/** Available stock: search, category filter, and per-item actions. */
export const StockList: React.FC<StockListProps> = ({
  list, metadata, searchQuery, onSearch, category, onCategory, onEdit, onBulkEdit, onDelete,
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    className="space-y-6"
  >
    {/* Filters */}
    <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} aria-hidden="true" />
        <input
          type="text"
          aria-label="Rechercher dans le stock"
          placeholder="Rechercher par code-barres ou N° de série..."
          className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-2 pl-10 pr-4 outline-none focus:border-amber-400 transition-all font-medium"
          value={searchQuery}
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>
      <div className="flex items-center gap-2">
        <Filter className="text-slate-400" size={18} aria-hidden="true" />
        <select
          aria-label="Filtrer par catégorie"
          className="bg-slate-50 border-2 border-slate-100 rounded-xl py-2 px-4 outline-none focus:border-amber-400 font-bold"
          value={category}
          onChange={(e) => onCategory(e.target.value)}
        >
          <option value="All">Toutes Catégories</option>
          {metadata.stock_categories?.map(cat => <option key={cat} value={cat}>{cat}</option>)}
        </select>
      </div>
    </div>

    {/* Table */}
    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Article</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Catégorie</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Détails</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Prix de Vente</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Type</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {list.isLoading ? (
              <tr>
                <td colSpan={6} className="py-20 text-center">
                  <Loader2 className="animate-spin mx-auto text-amber-500" size={32} />
                </td>
              </tr>
            ) : list.items.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-20 text-center text-slate-400 font-medium">
                  {list.error || "Aucun article trouvé dans l'inventaire"}
                </td>
              </tr>
            ) : (
              list.items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                        <Barcode size={20} aria-hidden="true" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-900">{formatItemDetails(item.barcode)}</p>
                          {item.itemCode && (
                            <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-md text-[10px] font-black uppercase">
                              {item.itemCode}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">
                          {`${formatItemDetails(item.category)} ${formatItemDetails(item.subCategory)} ${item.metalType ? `(${formatItemDetails(item.metalType)})` : ''}`.trim().replace(/\s+/g, ' ')}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold">
                      {item.category}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm space-y-1">
                      {item.category === 'Jewellery' && (
                        <>
                          <p className="text-slate-700 font-medium">{formatItemDetails(item.metalType)} {formatItemDetails(item.fineness)}</p>
                          <p className="text-amber-600 font-bold">{formatWeight(item.weightGrams)}</p>
                        </>
                      )}
                      {item.category === 'Pen' && (
                        <p className="text-slate-700 font-medium">{formatItemDetails(item.subCategory)}</p>
                      )}
                      {item.category === 'Sewing Machine' && (
                        <p className="text-slate-700 font-medium">Garantie: {item.yearsOfGuarantee} ans</p>
                      )}
                      {item.category !== 'Jewellery' && item.brand && (
                        <p className="text-xs text-slate-500 font-semibold bg-slate-100 rounded-md px-1.5 py-0.5 inline-block border border-slate-200 mt-1">
                          Marque: {item.brand}
                        </p>
                      )}
                      {item.serialNumber && (
                        <p className="text-xs text-slate-400 italic">S/N: {item.serialNumber}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-extrabold text-slate-900">{formatCurrency(item.price)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      item.stockType === 'on-display' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
                    }`}>
                      {item.stockType === 'on-display' ? 'En Vitrine' : 'En Réserve'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {/* Always visible on touch screens; revealed on hover or keyboard focus with a mouse. */}
                    <div className="flex items-center justify-end gap-2 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100">
                      <button
                        type="button"
                        onClick={() => onEdit(item)}
                        className="p-2 text-slate-400 hover:text-amber-500 transition-colors"
                        title="Modifier cet article"
                        aria-label={`Modifier ${item.barcode}`}
                      >
                        <Edit2 size={18} />
                      </button>
                      {getBaseItemCode(item.itemCode) && (
                        <button
                          type="button"
                          onClick={() => onBulkEdit(item)}
                          className="p-2 text-slate-400 hover:text-indigo-500 transition-colors"
                          title={`Modifier tout le groupe ${getBaseItemCode(item.itemCode)}`}
                          aria-label={`Modifier tout le groupe ${getBaseItemCode(item.itemCode)}`}
                        >
                          <Copy size={18} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onDelete(item)}
                        className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                        title="Supprimer cet article"
                        aria-label={`Supprimer ${item.barcode}`}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Pager page={list.page} pageCount={list.pageCount} total={list.total} isLoading={list.isLoading} onPage={list.setPage} noun="articles" />
    </div>
  </motion.div>
);
