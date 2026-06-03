import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { 
  Percent, Tag, Search, Calendar, RefreshCcw, 
  Loader2, AlertCircle, TrendingDown, ArrowDownRight, 
  ShoppingBag, Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatCurrency } from '../lib/utils';

interface DiscountRecord {
  saleId: number;
  createdAt: string;
  customerName: string;
  customerIdNumber: string;
  itemBarcode: string;
  itemDetails: string;
  originalPriceTTC: string;
  finalPriceTTC: string;
  discountAmount: string;
  discountPercentage: string;
}

const DiscountReport: React.FC = () => {
  const { token } = useAuth();
  const [records, setRecords] = useState<DiscountRecord[]>([]);
  const [summary, setSummary] = useState({ totalDiscounts: '0.00', count: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchDiscountReport = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await axios.get('/api/reports/discounts', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRecords(res.data.data || []);
      setSummary({
        totalDiscounts: res.data.summary?.totalDiscounts || '0.00',
        count: res.data.summary?.count || 0
      });
    } catch (err: any) {
      console.error("Error fetching discount report:", err);
      setError("Impossible de charger le rapport d'audit des remises");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDiscountReport();
  }, [token]);

  // Handle local filtering (search + date range)
  const filteredRecords = records.filter(rec => {
    // Search filter
    const term = searchTerm.toLowerCase().trim();
    const matchesSearch = !term || 
      rec.customerName.toLowerCase().includes(term) ||
      rec.customerIdNumber.toLowerCase().includes(term) ||
      rec.itemBarcode.toLowerCase().includes(term) ||
      rec.itemDetails.toLowerCase().includes(term) ||
      `#${rec.saleId}`.includes(term);

    // Date range filter
    const createdAtTime = new Date(rec.createdAt).getTime();
    let matchesStartDate = true;
    let matchesEndDate = true;

    if (startDate) {
      // Start of startDay
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      matchesStartDate = createdAtTime >= start.getTime();
    }

    if (endDate) {
      // End of endDay
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      matchesEndDate = createdAtTime <= end.getTime();
    }

    return matchesSearch && matchesStartDate && matchesEndDate;
  });

  // Re-calculate aggregates of filtered entries
  const filteredTotal = filteredRecords.reduce((sum, r) => sum + parseFloat(r.discountAmount), 0);
  const averageDiscountPercentage = filteredRecords.length > 0 
    ? (filteredRecords.reduce((sum, r) => sum + parseFloat(r.discountPercentage), 0) / filteredRecords.length)
    : 0;

  const handleResetFilters = () => {
    setSearchTerm('');
    setStartDate('');
    setEndDate('');
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
            <Percent className="text-amber-500 bg-amber-50 p-2 rounded-2xl" size={48} />
            Audit des Remises & Prix Modifiés
          </h1>
          <p className="text-slate-500 font-medium">Contrôle des réductions et contournements de prix de vente</p>
        </div>
        <button 
          onClick={fetchDiscountReport}
          disabled={isLoading}
          className="flex items-center gap-2 px-5 py-3 bg-white text-slate-755 border-2 border-slate-100 rounded-2xl font-bold shadow-sm hover:bg-slate-50 hover:border-slate-200 transition-all disabled:opacity-55 active:scale-95"
        >
          {isLoading ? (
            <Loader2 className="animate-spin text-amber-500" size={18} />
          ) : (
            <RefreshCcw className="text-amber-500 animate-hover" size={18} />
          )}
          <span>Rafraîchir</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total remises accordées */}
        <div className="bg-slate-900 text-white p-8 rounded-[2rem] shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-all duration-300">
             <TrendingDown size={110} />
          </div>
          <p className="text-slate-400 font-black uppercase text-xs tracking-widest mb-2">Total Remises Accordées</p>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black">{formatCurrency(filteredTotal)}</span>
          </div>
          <p className="mt-4 text-xs text-slate-300 flex items-center gap-1">
            <span className="font-extrabold text-amber-400">{filteredRecords.length}</span> transaction(s) filtrée(s)
          </p>
        </div>

        {/* Global Remises Ratio */}
        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-all duration-300 text-amber-500">
             <Tag size={110} />
          </div>
          <p className="text-slate-400 font-black uppercase text-xs tracking-widest mb-2">Remise Moyenne (%)</p>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black text-slate-900">{averageDiscountPercentage.toFixed(1)}%</span>
          </div>
          <p className="mt-4 text-xs text-slate-500">Pourcentage moyen calculé sur les ventes affichées</p>
        </div>

        {/* Transactions with discounts */}
        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-all duration-300 text-slate-900">
             <ShoppingBag size={110} />
          </div>
          <p className="text-slate-400 font-black uppercase text-xs tracking-widest mb-2">Transactions Remisées</p>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black text-slate-900">{filteredRecords.length}</span>
          </div>
          <p className="mt-4 text-xs text-slate-500">Volume total de ventes avec rabais accordés</p>
        </div>
      </div>

      {/* Filter panel */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Filtres de Recherche</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          {/* Search bar */}
          <div className="md:col-span-2 space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Rechercher</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="N° Vente, Client, Code-barres ou Article..."
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-2 pl-10 pr-4 font-medium outline-none focus:border-amber-400 transition-all placeholder:text-slate-400"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Date range filters */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Date Début</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
              <input 
                type="date" 
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-2 pl-10 pr-3 font-bold outline-none focus:border-amber-400 transition-all"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Date Fin</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
              <input 
                type="date" 
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-2 pl-10 pr-3 font-bold outline-none focus:border-amber-400 transition-all"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        {(searchTerm || startDate || endDate) && (
          <div className="flex justify-end pt-2">
            <button 
              onClick={handleResetFilters}
              className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-red-500 transition-colors"
            >
              <Trash2 size={14} />
              <span>Réinitialiser les filtres</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
        {error ? (
          <div className="p-20 text-center text-red-500 flex flex-col items-center gap-2">
            <AlertCircle size={32} />
            <p className="font-bold">{error}</p>
            <button onClick={fetchDiscountReport} className="text-amber-500 underline font-semibold mt-2">Réessayer</button>
          </div>
        ) : isLoading ? (
          <div className="py-32 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
            <Loader2 className="animate-spin text-amber-500" size={32} />
            <p className="font-semibold">Calcul et audit des transactions...</p>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-20 text-center text-slate-400 flex flex-col items-center gap-2">
            <Tag size={48} className="text-slate-300" />
            <p className="font-bold text-lg">Aucune remise trouvée</p>
            <p className="text-sm">Aucune transaction correspondante n'implique une réduction de prix.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">ID Vente / Date</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Client</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Article / Détails</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Prix Initial</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Prix Payé (TTC)</th>
                  <th className="px-6 py-4 text-xs font-bold text-red-500 uppercase tracking-wider text-right">Économie (Rs)</th>
                  <th className="px-6 py-4 text-xs font-bold text-red-500 uppercase tracking-wider text-center">Remise (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredRecords.map((row) => (
                  <tr key={row.saleId} className="hover:bg-slate-50/80 transition-colors">
                    {/* ID & Date */}
                    <td className="px-6 py-5">
                      <p className="font-black text-slate-900">#{row.saleId}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        {new Date(row.createdAt).toLocaleDateString()} {new Date(row.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </td>

                    {/* Customer */}
                    <td className="px-6 py-5">
                      <p className="font-bold text-slate-800">{row.customerName}</p>
                      <p className="text-xs font-mono text-slate-400 font-semibold">{row.customerIdNumber}</p>
                    </td>

                    {/* Item details */}
                    <td className="px-6 py-5">
                      <p className="font-bold text-slate-900">{row.itemDetails}</p>
                      <p className="text-xs text-amber-500 font-mono font-semibold">Code: {row.itemBarcode}</p>
                    </td>

                    {/* Original Price */}
                    <td className="px-6 py-5 text-right font-semibold text-slate-500">
                      {formatCurrency(row.originalPriceTTC)}
                    </td>

                    {/* Final Sale Price */}
                    <td className="px-6 py-5 text-right font-black text-slate-900">
                      {formatCurrency(row.finalPriceTTC)}
                    </td>

                    {/* Discount Amount */}
                    <td className="px-6 py-5 text-right font-extrabold text-red-600 bg-red-50/10">
                      -{formatCurrency(row.discountAmount)}
                    </td>

                    {/* Discount Percentage */}
                    <td className="px-6 py-5 text-center">
                      <span className="bg-red-50 text-red-600 text-xs font-black px-3 py-1.5 rounded-full inline-block">
                        -{parseFloat(row.discountPercentage).toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default DiscountReport;
