import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { formatWeight, formatItemDetails } from '../lib/utils';
import BarcodeScanner from '../components/BarcodeScanner';
import { 
  Package, Plus, Search, Filter, Edit2, Trash2, Save, X, 
  Settings as SettingsIcon, Check, AlertCircle, Loader2,
  ChevronDown, Barcode, Scale, Info, Tag, History, Camera
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface StockItem {
  id: number;
  barcode: string;
  category: string;
  subCategory: string;
  stockType: string;
  brand?: string;
  yearsOfGuarantee?: number;
  serialNumber?: string;
  metalType?: string;
  fineness?: string;
  weightGrams?: string;
  createdAt: string;
}

const Stock = () => {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [metadata, setMetadata] = useState<any>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [view, setView] = useState<'list' | 'add' | 'config'>('list');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');

  // Form State
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [formData, setFormData] = useState<any>({
    barcode: '',
    category: 'Jewellery',
    subCategory: '',
    stockType: 'on-display',
    brand: '',
    yearsOfGuarantee: 0,
    serialNumber: '',
    metalType: '',
    fineness: '',
    weightGrams: ''
  });

  useEffect(() => {
    fetchStock();
    fetchMetadata();
  }, []);

  const fetchStock = async () => {
    try {
      const res = await axios.get('/api/stock', { headers: { Authorization: `Bearer ${token}` } });
      setStockItems(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMetadata = async () => {
    try {
      const res = await axios.get('/api/stock/metadata', { headers: { Authorization: `Bearer ${token}` } });
      const metaObj: any = {};
      res.data.forEach((s: any) => {
        metaObj[s.key] = JSON.parse(s.value || '[]');
      });
      setMetadata(metaObj);
      
      // Set defaults for form if metadata is available
      if (metaObj.stock_categories?.length > 0) {
        setFormData((prev: any) => ({ 
          ...prev, 
          category: metaObj.stock_categories[0],
          metalType: metaObj.stock_metal_types?.[0] || '',
          fineness: metaObj.stock_fineness_options?.[0] || '',
          subCategory: metaObj.stock_sub_categories?.find((sc: any) => sc.category === metaObj.stock_categories[0])?.name || '',
          brand: metaObj.stock_sewing_machine_brands?.[0] || ''
        }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCategoryChange = (val: string) => {
    const filteredSubs = metadata.stock_sub_categories?.filter((sc: any) => sc.category === val) || [];
    const defaultSub = filteredSubs.length > 0 ? filteredSubs[0].name : '';
      
    setFormData((prev: any) => ({
      ...prev,
      category: val,
      subCategory: defaultSub,
      metalType: val === 'Jewellery' ? (metadata.stock_metal_types?.[0] || '') : '',
      fineness: val === 'Jewellery' ? (metadata.stock_fineness_options?.[0] || '') : '',
      weightGrams: '',
      brand: val === 'Sewing Machine' ? (metadata.stock_sewing_machine_brands?.[0] || '') : '',
      yearsOfGuarantee: 0,
      serialNumber: ''
    }));
  };

  const handleEdit = (item: StockItem) => {
    setEditingId(item.id);
    setFormData({
      barcode: item.barcode,
      category: item.category,
      subCategory: item.subCategory,
      stockType: item.stockType,
      brand: item.brand || '',
      yearsOfGuarantee: item.yearsOfGuarantee || 0,
      serialNumber: item.serialNumber || '',
      metalType: item.metalType || '',
      fineness: item.fineness || '',
      weightGrams: item.weightGrams || ''
    });
    setView('add');
  };

  const handleSubmitStock = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (editingId) {
        await axios.put(`/api/stock/${editingId}`, formData, { headers: { Authorization: `Bearer ${token}` } });
        setMessage({ type: 'success', text: 'Article mis à jour' });
      } else {
        await axios.post('/api/stock', formData, { headers: { Authorization: `Bearer ${token}` } });
        setMessage({ type: 'success', text: 'Article ajouté au stock' });
      }
      
      setFormData({
        barcode: '',
        category: 'Jewellery',
        subCategory: metadata.stock_sub_categories?.[0] || '',
        stockType: 'on-display',
        brand: '',
        yearsOfGuarantee: 0,
        serialNumber: '',
        metalType: metadata.stock_metal_types?.[0] || '',
        fineness: metadata.stock_fineness_options?.[0] || '',
        weightGrams: ''
      });
      setEditingId(null);
      fetchStock();
      setView('list');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || err.response?.data?.error || 'Échec de l\'opération' });
    } finally {
      setIsSaving(false);
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Supprimer cet article du stock ?')) return;
    try {
      await axios.delete(`/api/stock/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      setStockItems(prev => prev.filter(i => i.id !== id));
      setMessage({ type: 'success', text: 'Article supprimé' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Échec de la suppression' });
    }
    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
  };

  const filteredItems = (stockItems || []).filter(item => {
    const search = String(searchQuery || '').toLowerCase();
    const barcode = String(item?.barcode || '').toLowerCase();
    const serial = String(item?.serialNumber || '').toLowerCase();
    
    const matchesSearch = barcode.includes(search) || serial.includes(search);
    const matchesCategory = filterCategory === 'All' || item.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
            <Package className="text-amber-500" size={32} />
            Gestion du Stock
          </h1>
          <p className="text-slate-500 font-medium">Contrôlez votre inventaire et vos articles</p>
        </div>
        
        <div className="flex items-center gap-3">
          {view === 'list' ? (
            <>
              {user?.role === 'Admin' && (
                <button 
                  onClick={() => setView('config')}
                  className="p-3 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-all flex items-center gap-2 font-bold"
                >
                  <SettingsIcon size={20} />
                  <span className="hidden sm:inline">Options</span>
                </button>
              )}
              <button 
                onClick={() => navigate('/stock/sold')}
                className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 hover:bg-red-100 transition-all flex items-center gap-2 font-bold"
              >
                <History size={20} />
                <span className="hidden sm:inline">Historique Ventes</span>
              </button>
              <button 
                onClick={() => {
                  setEditingId(null);
                  setView('add');
                }}
                className="p-3 bg-amber-500 text-slate-900 rounded-xl hover:bg-amber-400 transition-all shadow-lg flex items-center gap-2 font-bold"
              >
                <Plus size={20} />
                <span>Ajouter</span>
              </button>
            </>
          ) : (
            <button 
              onClick={() => setView('list')}
              className="p-3 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-all flex items-center gap-2 font-bold"
            >
              <X size={20} />
              <span>Annuler</span>
            </button>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {view === 'list' && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Rechercher par code-barres ou N° de série..." 
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-2 pl-10 pr-4 outline-none focus:border-amber-400 transition-all font-medium"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="text-slate-400" size={18} />
                <select 
                  className="bg-slate-50 border-2 border-slate-100 rounded-xl py-2 px-4 outline-none focus:border-amber-400 font-bold"
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                >
                  <option value="All">Toutes Catégories</option>
                  {metadata.stock_categories?.map((cat: any) => {
                    const val = typeof cat === 'string' ? cat : (cat.name || cat.category || '');
                    return <option key={val} value={val}>{val}</option>;
                  })}
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
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {isLoading ? (
                      <tr>
                        <td colSpan={5} className="py-20 text-center">
                          <Loader2 className="animate-spin mx-auto text-amber-500" size={32} />
                        </td>
                      </tr>
                    ) : filteredItems.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-20 text-center text-slate-400 font-medium">
                          Aucun article trouvé dans l'inventaire
                        </td>
                      </tr>
                    ) : (
                      filteredItems.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                                <Barcode size={20} />
                              </div>
                              <div>
                                  <p className="font-bold text-slate-900">{formatItemDetails(item.barcode)}</p>
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
                              {item.category === 'Jewellery' ? (
                                <>
                                  <p className="text-slate-700 font-medium">{formatItemDetails(item.metalType)} {formatItemDetails(item.fineness)}</p>
                                  <p className="text-amber-600 font-bold">{formatWeight(item.weightGrams)}</p>
                                </>
                              ) : (
                                <p className="text-slate-400 font-medium">-</p>
                              )}
                              {item.category === 'Pen' && (
                                <p className="text-slate-700 font-medium">{formatItemDetails(item.subCategory)}</p>
                              )}
                              {item.category === 'Sewing Machine' && (
                                <p className="text-slate-700 font-medium">Garantie: {item.yearsOfGuarantee} ans</p>
                              )}
                              {item.serialNumber && (
                                <p className="text-xs text-slate-400 italic">S/N: {item.serialNumber}</p>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                             <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                               item.stockType === 'on-display' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
                             }`}>
                               {item.stockType === 'on-display' ? 'En Vitrine' : 'En Réserve'}
                             </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => handleEdit(item)}
                                className="p-2 text-slate-400 hover:text-amber-500 transition-colors"
                              >
                                <Edit2 size={18} />
                              </button>
                              <button 
                                onClick={() => handleDelete(item.id)}
                                className="p-2 text-slate-400 hover:text-red-500 transition-colors"
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
            </div>
          </motion.div>
        )}

        {view === 'add' && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            {/* Form */}
            <div className="lg:col-span-2 bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
              <div className="p-8 bg-slate-900 text-white">
                <h3 className="text-2xl font-bold">{editingId ? 'Modifier l\'Article' : 'Nouvel Article'}</h3>
                <p className="text-slate-400 font-medium">{editingId ? 'Mettez à jour les informations de l\'article' : 'Remplissez les informations de l\'article'}</p>
              </div>
              
              <form onSubmit={handleSubmitStock} className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-bold text-slate-700">Code-Barres / SKU</label>
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
                              setFormData({ ...formData, barcode: code });
                              setIsScannerOpen(false);
                            }}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="relative">
                      <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        type="text" 
                        required
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 pl-10 pr-4 outline-none focus:border-amber-400 font-bold"
                        value={formData.barcode}
                        onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Catégorie</label>
                    <div className="relative">
                      <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <select 
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 pl-10 pr-4 outline-none focus:border-amber-400 font-bold appearance-none"
                        value={formData.category}
                        onChange={(e) => handleCategoryChange(e.target.value)}
                      >
                        {metadata.stock_categories?.map((cat: any) => {
                          const val = typeof cat === 'string' ? cat : (cat.name || cat.category || '');
                          return <option key={val} value={val}>{val}</option>;
                        })}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Emplacement par défaut</label>
                  <div className="flex bg-slate-100 p-1 rounded-xl max-w-md">
                    <button 
                      type="button"
                      onClick={() => setFormData({ ...formData, stockType: 'on-display' })}
                      className={`flex-1 py-3 rounded-lg text-sm font-black transition-all ${
                        formData.stockType === 'on-display' ? 'bg-white shadow-md text-slate-900' : 'text-slate-500'
                      }`}
                    >
                      En Vitrine
                    </button>
                    <button 
                      type="button"
                      onClick={() => setFormData({ ...formData, stockType: 'in-store' })}
                      className={`flex-1 py-3 rounded-lg text-sm font-black transition-all ${
                        formData.stockType === 'in-store' ? 'bg-white shadow-md text-slate-900' : 'text-slate-500'
                      }`}
                    >
                      En Réserve
                    </button>
                  </div>
                </div>

                {/* Dynamic Fields */}
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  key={formData.category}
                  className="pt-6 border-t border-slate-100"
                >
                  {formData.category === 'Jewellery' && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-2">Type de Bijou (Sous-Catégorie)</label>
                          <select 
                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-amber-400 font-bold"
                            value={formData.subCategory}
                            onChange={(e) => setFormData({ ...formData, subCategory: e.target.value })}
                          >
                            {(metadata.stock_sub_categories || [])
                              .filter((sc: any) => sc.category === 'Jewellery')
                              .map((sc: any) => (
                                <option key={sc.name} value={sc.name}>{sc.name}</option>
                              ))}
                            <option value="Autre">Autre</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-2">Métal</label>
                          <select 
                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-amber-400 font-bold"
                            value={formData.metalType}
                            onChange={(e) => setFormData({ ...formData, metalType: e.target.value })}
                          >
                            {metadata.stock_metal_types?.map((m: string) => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-2">Pureté (Finesse)</label>
                          <select 
                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-amber-400 font-bold"
                            value={formData.fineness}
                            onChange={(e) => setFormData({ ...formData, fineness: e.target.value })}
                          >
                            {metadata.stock_fineness_options?.map((f: string) => (
                              <option key={f} value={f}>{f}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-2">Poids (Grammes)</label>
                          <div className="relative">
                            <Scale className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input 
                              type="number" 
                              step="0.001"
                              placeholder="0.000"
                              className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 pl-10 pr-4 outline-none focus:border-amber-400 font-bold"
                              value={formData.weightGrams}
                              onChange={(e) => setFormData({ ...formData, weightGrams: e.target.value })}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {formData.category === 'Pen' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Marque (Brand)</label>
                        <select 
                          className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-amber-400 font-bold"
                          value={formData.subCategory}
                          onChange={(e) => setFormData({ ...formData, subCategory: e.target.value })}
                        >
                          {(metadata.stock_sub_categories || [])
                            .filter((sc: any) => sc.category === 'Pen')
                            .map((sc: any) => (
                              <option key={sc.name} value={sc.name}>{sc.name}</option>
                            ))}
                          <option value="Autre">Autre</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">N° de Série (Optionnel)</label>
                        <input 
                          type="text" 
                          placeholder="Ex: P123456"
                          className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-amber-400 font-bold"
                          value={formData.serialNumber}
                          onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                        />
                      </div>
                    </div>
                  )}

                  {formData.category === 'Sewing Machine' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                         <label className="block text-sm font-bold text-slate-700 mb-2">Marque</label>
                         <select 
                           className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-amber-400 font-bold"
                           value={formData.brand}
                           onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                         >
                           {(metadata.stock_sub_categories || [])
                            .filter((sc: any) => typeof sc === 'object' && sc.category === 'Sewing Machine')
                            .map((sc: any) => (
                              <option key={sc.name} value={sc.name}>{sc.name}</option>
                            ))}
                           <option value="Autre">Autre</option>
                         </select>
                       </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Garantie (Années)</label>
                        <select 
                          className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-amber-400 font-bold"
                          value={formData.yearsOfGuarantee}
                          onChange={(e) => setFormData({ ...formData, yearsOfGuarantee: parseInt(e.target.value) })}
                        >
                          {metadata.guarantee_options?.map((y: string) => (
                            <option key={y} value={y}>{y} ans</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">N° de Série</label>
                        <input 
                          type="text" 
                          placeholder="Ex: SM-9988"
                          className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-amber-400 font-bold"
                          value={formData.serialNumber}
                          onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                        />
                      </div>
                    </div>
                  )}
                  {formData.category === 'Parts' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Type de Pièce</label>
                        <select 
                          className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-amber-400 font-bold"
                          value={formData.subCategory}
                          onChange={(e) => setFormData({ ...formData, subCategory: e.target.value })}
                        >
                          {(metadata.stock_sub_categories || [])
                            .filter((sc: any) => typeof sc === 'object' && sc.category === 'Parts')
                            .map((sc: any) => (
                              <option key={sc.name} value={sc.name}>{sc.name}</option>
                            ))}
                          <option value="Autre">Autre</option>
                        </select>
                      </div>
                    </div>
                  )}
                </motion.div>

                <div className="pt-8 flex gap-4">
                   <button 
                    type="button"
                    onClick={() => {
                      setView('list');
                      setEditingId(null);
                      setFormData({
                        barcode: '',
                        category: 'Jewellery',
                        subCategory: metadata.stock_sub_categories?.[0] || '',
                        stockType: 'on-display',
                        brand: '',
                        yearsOfGuarantee: 0,
                        serialNumber: '',
                        metalType: '',
                        fineness: '',
                        weightGrams: ''
                      });
                    }}
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
                        <Save size={20} />
                        <span>{editingId ? 'Mettre à jour l\'Inventaire' : 'Enregistrer dans l\'Inventaire'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Sidebar / Info */}
            <div className="space-y-6">
              <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100">
                 <h4 className="font-bold text-amber-800 flex items-center gap-2 mb-3">
                   <Info size={18} />
                   Rappel KYC
                 </h4>
                 <p className="text-sm text-amber-700 leading-relaxed">
                   Chaque article doit avoir un code-barres unique. Pour les bijoux en métaux précieux, le poids doit être précis à 3 décimales.
                 </p>
              </div>

              {message.text && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`p-4 rounded-2xl flex items-center gap-3 text-sm font-bold ${
                    message.type === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'
                  }`}
                >
                  {message.type === 'success' ? <Check size={20} /> : <AlertCircle size={20} />}
                  {message.text}
                </motion.div>
              )}
            </div>
          </motion.div>
        )}

        {view === 'config' && (
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
                <button 
                  onClick={() => setView('list')}
                  className="p-2 text-slate-400 hover:text-slate-900"
                >
                  <X size={24} />
                </button>
             </div>

             <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Categories Management */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-bold text-slate-700">Catégories Principales</label>
                    <button 
                      onClick={async () => {
                        const val = (document.getElementById(`input-categories`) as HTMLInputElement).value;
                        if (!val) return;
                        const newArr = [...(metadata.stock_categories || []), val];
                        try {
                          await axios.put(`/api/settings/stock_categories`, { value: JSON.stringify(newArr) }, { headers: { Authorization: `Bearer ${token}` } });
                          setMetadata({ ...metadata, stock_categories: newArr });
                          (document.getElementById(`input-categories`) as HTMLInputElement).value = '';
                        } catch (err) { console.error(err); }
                      }}
                      className="text-xs font-bold text-amber-600 hover:text-amber-700"
                    >
                      + Ajouter
                    </button>
                  </div>
                  <input id="input-categories" type="text" placeholder="Nouvelle catégorie..." className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm outline-none focus:border-amber-400" />
                  <div className="flex flex-wrap gap-2">
                    {metadata.stock_categories?.map((val: string, idx: number) => (
                      <div key={idx} className="flex items-center gap-1 bg-slate-100 px-3 py-1 rounded-full text-xs font-bold text-slate-600">
                        {val}
                        <button onClick={async () => {
                          const newArr = metadata.stock_categories.filter((_: any, i: number) => i !== idx);
                          await axios.put(`/api/settings/stock_categories`, { value: JSON.stringify(newArr) }, { headers: { Authorization: `Bearer ${token}` } });
                          setMetadata({ ...metadata, stock_categories: newArr });
                        }} className="text-slate-400 hover:text-red-500"><X size={14} /></button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Linked Subcategories Management */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-bold text-slate-700">Sous-Catégories & Marques</label>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl space-y-3">
                    <input id="input-sub-name" type="text" placeholder="Nom (ex: Ring, Parker...)" className="w-full bg-white border border-slate-200 rounded-lg py-2 px-3 text-sm outline-none focus:border-amber-400" />
                    <div className="flex gap-2">
                      <select id="select-sub-parent" className="flex-1 bg-white border border-slate-200 rounded-lg py-2 px-3 text-sm outline-none focus:border-amber-400 font-bold">
                        {metadata.stock_categories?.map((cat: string) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                      <button 
                        onClick={async () => {
                          const name = (document.getElementById(`input-sub-name`) as HTMLInputElement).value;
                          const parent = (document.getElementById(`select-sub-parent`) as HTMLSelectElement).value;
                          if (!name || !parent) return;
                          
                          const newArr = Array.isArray(metadata.stock_sub_categories) 
                            ? (typeof metadata.stock_sub_categories[0] === 'string' ? [] : metadata.stock_sub_categories) 
                            : [];
                          
                          const updated = [...newArr, { name, category: parent }];
                          try {
                            await axios.put(`/api/settings/stock_sub_categories`, { value: JSON.stringify(updated) }, { headers: { Authorization: `Bearer ${token}` } });
                            setMetadata({ ...metadata, stock_sub_categories: updated });
                            (document.getElementById(`input-sub-name`) as HTMLInputElement).value = '';
                          } catch (err) { console.error(err); }
                        }}
                        className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-800 transition-colors"
                      >
                        Ajouter
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                    {metadata.stock_categories?.map((cat: string) => (
                      <div key={cat} className="space-y-2">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{cat}</h4>
                        <div className="flex flex-wrap gap-2">
                          {(metadata.stock_sub_categories || [])
                            .filter((sc: any) => typeof sc === 'object' && sc.category === cat)
                            .map((sc: any, idx: number) => (
                              <div key={idx} className="flex items-center gap-1 bg-white border border-slate-100 px-3 py-1 rounded-full text-xs font-bold text-slate-600 shadow-sm">
                                {sc.name}
                                <button onClick={async () => {
                                  const updated = metadata.stock_sub_categories.filter((item: any) => item !== sc);
                                  await axios.put(`/api/settings/stock_sub_categories`, { value: JSON.stringify(updated) }, { headers: { Authorization: `Bearer ${token}` } });
                                  setMetadata({ ...metadata, stock_sub_categories: updated });
                                }} className="text-slate-400 hover:text-red-500"><X size={14} /></button>
                              </div>
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Other standard settings */}
                {Object.keys(metadata).filter(k => !['stock_categories', 'stock_sub_categories', 'stock_pen_brands', 'stock_sewing_machine_brands'].includes(k)).map((key) => (
                  <div key={key} className="space-y-4 pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                       <label className="text-sm font-bold text-slate-700 capitalize">{key.replace(/_/g, ' ')}</label>
                       <button 
                        onClick={async () => {
                          const val = (document.getElementById(`input-${key}`) as HTMLInputElement).value;
                          if (!val) return;
                          const newArr = [...metadata[key], val];
                          try {
                            await axios.put(`/api/settings/${key}`, { value: JSON.stringify(newArr) }, { headers: { Authorization: `Bearer ${token}` } });
                            setMetadata({ ...metadata, [key]: newArr });
                            (document.getElementById(`input-${key}`) as HTMLInputElement).value = '';
                          } catch (err) { console.error(err); }
                        }}
                        className="text-xs font-bold text-amber-600 hover:text-amber-700"
                       >
                         + Ajouter
                       </button>
                    </div>
                    <div className="flex gap-2">
                       <input 
                        id={`input-${key}`}
                        type="text" 
                        placeholder="Valeur..."
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm outline-none focus:border-amber-400"
                       />
                    </div>
                    <div className="flex flex-wrap gap-2">
                       {metadata[key].map((val: string, idx: number) => (
                         <div key={idx} className="flex items-center gap-1 bg-slate-100 px-3 py-1 rounded-full text-xs font-bold text-slate-600">
                           {val}
                           <button 
                            onClick={async () => {
                              const newArr = metadata[key].filter((_: any, i: number) => i !== idx);
                              try {
                                await axios.put(`/api/settings/${key}`, { value: JSON.stringify(newArr) }, { headers: { Authorization: `Bearer ${token}` } });
                                setMetadata({ ...metadata, [key]: newArr });
                              } catch (err) { console.error(err); }
                            }}
                            className="text-slate-400 hover:text-red-500"
                           >
                             <X size={14} />
                           </button>
                         </div>
                       ))}
                    </div>
                  </div>
                ))}
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Stock;
