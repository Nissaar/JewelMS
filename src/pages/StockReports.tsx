import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { 
  BarChart3, Scale, Filter, ChevronDown, 
  Loader2, Info, Package, Store, Eye,
  RefreshCw, TrendingUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const StockReports = () => {
  const { token } = useAuth();
  const [reportData, setReportData] = useState<any>(null);
  const [metadata, setMetadata] = useState<any>({});
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState({
    category: '',
    subCategory: ''
  });

  useEffect(() => {
    fetchMetadata();
    fetchStockReport();
  }, []);

  const fetchMetadata = async () => {
    try {
      const res = await axios.get('/api/stock/metadata', { headers: { Authorization: `Bearer ${token}` } });
      const metaObj: any = {};
      res.data.forEach((s: any) => {
        metaObj[s.key] = JSON.parse(s.value || '[]');
      });
      setMetadata(metaObj);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchStockReport = async (appliedFilters = filters) => {
    setIsLoading(true);
    try {
      const { category, subCategory } = appliedFilters;
      let url = '/api/reports/stock-weight?';
      if (category) url += `category=${encodeURIComponent(category)}&`;
      if (subCategory) url += `subCategory=${encodeURIComponent(subCategory)}&`;
      
      const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
      setReportData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    fetchStockReport(newFilters);
  };

  const colors = {
    Gold: ['#F59E0B', '#FDE68A'], // Amber-500, Amber-200
    Silver: ['#64748B', '#CBD5E1'], // Slate-500, Slate-200
  };

  const getChartData = (metal: 'Gold' | 'Silver') => {
    if (!reportData || !reportData[metal]) return [];
    return [
      { name: 'En Vitrine', value: reportData[metal]['on-display'] || 0 },
      { name: 'En Réserve', value: reportData[metal]['in-store'] || 0 }
    ].filter(item => item.value > 0);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <BarChart3 className="text-amber-500" size={32} />
            Rapport d'Inventaire
          </h1>
          <p className="text-slate-500 font-bold">Analyse du poids des métaux précieux en stock</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="text-slate-400" size={18} />
            <select 
              className="bg-slate-50 border-2 border-slate-100 rounded-xl py-2 px-4 font-bold outline-none focus:border-amber-400"
              value={filters.category}
              onChange={(e) => handleFilterChange('category', e.target.value)}
            >
              <option value="">Toutes Catégories</option>
              {metadata.stock_categories?.map((cat: string) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <select 
              className="bg-slate-50 border-2 border-slate-100 rounded-xl py-2 px-4 font-bold outline-none focus:border-amber-400"
              value={filters.subCategory}
              onChange={(e) => handleFilterChange('subCategory', e.target.value)}
            >
              <option value="">Toutes Sous-Catégories</option>
              {metadata.stock_sub_categories?.map((sc: string) => (
                <option key={sc} value={sc}>{sc}</option>
              ))}
            </select>
          </div>
          <button 
            onClick={() => fetchStockReport()}
            className="p-3 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all shadow-lg"
          >
            <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-4">
          <Loader2 className="animate-spin text-amber-500" size={48} />
          <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Calcul des stocks en cours...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Gold Stats */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 space-y-8"
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center shadow-inner">
                  <TrendingUp size={28} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900">Total Or (Gold)</h3>
                  <p className="text-slate-400 font-bold text-sm italic">Accumulation pondérée</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-4xl font-black text-slate-900">
                  {((reportData?.Gold?.['on-display'] || 0) + (reportData?.Gold?.['in-store'] || 0)).toFixed(2)}
                </span>
                <span className="text-xl font-black text-amber-500 ml-1">g</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-amber-50 p-6 rounded-3xl space-y-1">
                <div className="flex items-center gap-2 text-amber-600 mb-2">
                  <Eye size={18} />
                  <span className="text-[10px] font-black uppercase tracking-widest">En Vitrine</span>
                </div>
                <p className="text-2xl font-black text-amber-900">{(reportData?.Gold?.['on-display'] || 0).toFixed(2)} g</p>
              </div>
              <div className="bg-slate-50 p-6 rounded-3xl space-y-1">
                <div className="flex items-center gap-2 text-slate-400 mb-2">
                  <Store size={18} />
                  <span className="text-[10px] font-black uppercase tracking-widest">En Réserve</span>
                </div>
                <p className="text-2xl font-black text-slate-900">{(reportData?.Gold?.['in-store'] || 0).toFixed(2)} g</p>
              </div>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={getChartData('Gold')}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={8}
                    dataKey="value"
                  >
                    {getChartData('Gold').map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={colors.Gold[index % colors.Gold.length]} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Silver Stats */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 space-y-8"
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 bg-slate-50 text-slate-500 rounded-2xl flex items-center justify-center shadow-inner">
                  <Scale size={28} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900">Total Argent</h3>
                  <p className="text-slate-400 font-bold text-sm italic">Stock argentifère</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-4xl font-black text-slate-900">
                  {((reportData?.Silver?.['on-display'] || 0) + (reportData?.Silver?.['in-store'] || 0)).toFixed(2)}
                </span>
                <span className="text-xl font-black text-slate-400 ml-1">g</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 p-6 rounded-3xl space-y-1">
                <div className="flex items-center gap-2 text-slate-400 mb-2">
                  <Eye size={18} />
                  <span className="text-[10px] font-black uppercase tracking-widest">En Vitrine</span>
                </div>
                <p className="text-2xl font-black text-slate-900">{(reportData?.Silver?.['on-display'] || 0).toFixed(2)} g</p>
              </div>
              <div className="bg-slate-100/50 p-6 rounded-3xl space-y-1">
                <div className="flex items-center gap-2 text-slate-300 mb-2">
                  <Store size={18} />
                  <span className="text-[10px] font-black uppercase tracking-widest">En Réserve</span>
                </div>
                <p className="text-2xl font-black text-slate-600">{(reportData?.Silver?.['in-store'] || 0).toFixed(2)} g</p>
              </div>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={getChartData('Silver')}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={8}
                    dataKey="value"
                  >
                    {getChartData('Silver').map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={colors.Silver[index % colors.Silver.length]} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>
      )}

      {/* Info Card */}
      <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100 flex gap-4">
        <Info className="text-amber-500 shrink-0" size={24} />
        <div className="text-sm text-amber-800 leading-relaxed font-medium">
          <p>
            Ce rapport calcule la somme totale des champs <b>Poids (Grammes)</b> pour tous les articles actuellement présents dans l'inventaire. 
            Les articles vendus ne sont pas inclus dans ces totaux. Utilisez les filtres en haut pour affiner les résultats par catégorie.
          </p>
        </div>
      </div>
    </div>
  );
};

export default StockReports;
