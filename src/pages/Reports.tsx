import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { 
  FileText, Download, Calendar, Filter, Search, 
  RefreshCcw, Smartphone, Mail, ExternalLink,
  ChevronDown, ArrowUpRight, Scale, Banknote,
  Loader2, AlertCircle, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatCurrency, formatWeight } from '../lib/utils';

const Reports = () => {
  const { token, user } = useAuth();
  const [activeTab, setActiveTab] = useState<'vat' | 'receipts'>('vat');
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });

  // VAT Report State
  const [vatData, setVatData] = useState<any[]>([]);
  const [totalVat, setTotalVat] = useState('0');
  const [filters, setFilters] = useState({
    day: '',
    month: (new Date().getMonth() + 1).toString(),
    year: new Date().getFullYear().toString()
  });

  // Receipt History State
  const [receipts, setReceipts] = useState<any[]>([]);
  const [receiptSearch, setReceiptSearch] = useState('');

  useEffect(() => {
    if (activeTab === 'vat') fetchVatReport();
    else fetchReceiptHistory();
  }, [activeTab, filters]);

  const fetchVatReport = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.year) params.append('year', filters.year);
      if (filters.month) params.append('month', filters.month);
      if (filters.day) params.append('day', filters.day);

      const res = await axios.get(`/api/reports/vat?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVatData(res.data.data);
      setTotalVat(res.data.summary.totalVat);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchReceiptHistory = async () => {
    setIsLoading(true);
    try {
      const res = await axios.get('/api/receipts', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReceipts(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async (receiptId: number, method: 'whatsapp' | 'email') => {
    try {
      await axios.post(`/api/receipts/${receiptId}/send`, { method }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage({ type: 'success', text: `Reçu envoyé via ${method}` });
    } catch (err) {
      setMessage({ type: 'error', text: 'Échec de l\'envoi' });
    }
    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
  };

  const handleViewPDF = async (saleId: number) => {
    try {
      const response = await axios.get(`/api/receipts/${saleId}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      const blobUrl = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      window.open(blobUrl, '_blank');
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Échec de l\'ouverture du PDF' });
    }
  };

  const handleExportVatPDF = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.year) params.append('year', filters.year);
      if (filters.month) params.append('month', filters.month);
      if (filters.day) params.append('day', filters.day);

      const response = await axios.get(`/api/reports/vat/pdf?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `rapport_tva_${filters.year || 'all'}_${filters.month || 'all'}_${filters.day || 'all'}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
      setMessage({ type: 'success', text: 'Rapport TVA PDF téléchargé avec succès' });
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Échec de l\'exportation du PDF' });
    }
    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
  };

  const filteredReceipts = (receipts || []).filter(r => {
    const rNo = String(r?.receiptNo || '').toLowerCase();
    const cName = String(r?.customerName || '').toLowerCase();
    const search = String(receiptSearch || '').toLowerCase();
    return rNo.includes(search) || cName.includes(search);
  });

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
            <FileText className="text-amber-500" size={32} />
            Rapports & Archives
          </h1>
          <p className="text-slate-500 font-medium">Bilan fiscal et historique des ventes</p>
        </div>

        {message.text && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
            className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 ${
              message.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
            }`}
          >
            {message.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
            {message.text}
          </motion.div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex space-x-1 bg-slate-200 p-1 rounded-2xl w-fit">
          <button
            onClick={() => setActiveTab('vat')}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'vat' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Rapport TVA
          </button>
          <button
            onClick={() => setActiveTab('receipts')}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'receipts' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Archives Factures
          </button>
        </div>

        {activeTab === 'vat' && (
          <button
            id="export-vat-pdf-btn"
            onClick={handleExportVatPDF}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-6 py-3 rounded-2xl shadow-lg transition-all flex items-center gap-2 text-sm select-none"
          >
            <Download size={18} />
            Exporter en PDF
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'vat' ? (
          <motion.div 
            key="vat" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Summary Card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-900 text-white p-8 rounded-[2rem] shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                   <ArrowUpRight size={100} />
                </div>
                <p className="text-slate-400 font-bold uppercase text-xs tracking-widest mb-2">Total Collecté TVA</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black">{formatCurrency(totalVat)}</span>
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
                  <Calendar size={14} />
                  <span>Période: {filters.month}/{filters.year}</span>
                </div>
              </div>

              {/* Filters */}
              <div className="md:col-span-2 bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 flex flex-wrap items-end gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Année</label>
                  <select 
                    className="w-32 bg-slate-50 border-2 border-slate-100 rounded-xl py-2 px-3 font-bold outline-none focus:border-amber-400"
                    value={filters.year}
                    onChange={(e) => setFilters({...filters, year: e.target.value})}
                  >
                    {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Mois</label>
                  <select 
                    className="w-40 bg-slate-50 border-2 border-slate-100 rounded-xl py-2 px-3 font-bold outline-none focus:border-amber-400"
                    value={filters.month}
                    onChange={(e) => setFilters({...filters, month: e.target.value})}
                  >
                    {['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'].map((m, i) => (
                      <option key={i} value={i+1}>{m}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Jour (Optionnel)</label>
                  <input 
                    type="number" min="1" max="31" 
                    placeholder="DD"
                    className="w-24 bg-slate-50 border-2 border-slate-100 rounded-xl py-2 px-3 font-bold outline-none focus:border-amber-400"
                    value={filters.day}
                    onChange={(e) => setFilters({...filters, day: e.target.value})}
                  />
                </div>
                <button 
                  onClick={fetchVatReport}
                  className="bg-slate-900 text-white p-3 rounded-xl hover:bg-slate-800 transition-all shadow-lg"
                >
                  <RefreshCcw size={20} />
                </button>
              </div>
            </div>

            {/* VAT Table */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
               <div className="overflow-x-auto">
                 <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Réf. Facture / Invoice Ref</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Détails Article</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Taxable Value (Rs HT)</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">VAT Amount (TVA 15%)</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Total TTC (Rs)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {isLoading ? (
                        <tr><td colSpan={6} className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-amber-500" /></td></tr>
                      ) : vatData.length === 0 ? (
                        <tr><td colSpan={6} className="py-20 text-center text-slate-400">Aucune donnée pour cette période</td></tr>
                      ) : (
                        vatData.map((row) => (
                          <tr key={row.saleId} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 text-sm font-semibold text-slate-700">
                              {row.createdAt ? new Date(row.createdAt).toLocaleDateString() : 'N/A'}
                            </td>
                            <td className="px-6 py-4 text-sm">
                              <p className="font-bold text-slate-900">{row.receiptNo ? `#FS-${row.receiptNo}` : 'N/A'}</p>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Réf Vente #{row.saleId}</p>
                            </td>
                            <td className="px-6 py-4">
                              <p className="font-medium text-slate-800 text-sm">{row.itemDetails || 'N/A'}</p>
                              {row.weight && Number(row.weight) > 0 && (
                                <p className="text-xs text-slate-400 font-semibold flex items-center gap-1 mt-1">
                                  <Scale size={12} className="text-slate-400" /> Poids: {formatWeight(row.weight)}
                                </p>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right font-bold text-slate-900">
                              {formatCurrency(row.amountExclVat || "0")}
                            </td>
                            <td className="px-6 py-4 text-right font-bold text-amber-600">
                              {row.vatAmount ? formatCurrency(row.vatAmount) : '0'}
                            </td>
                            <td className="px-6 py-4 text-right font-black text-slate-900">
                              {row.total ? formatCurrency(row.total) : '0'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
               </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="receipts" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Search */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                <Search className="text-slate-400" size={20} />
                <input 
                  type="text" 
                  placeholder="Rechercher par N° Facture ou Client..."
                  className="flex-1 bg-transparent border-none outline-none font-medium"
                  value={receiptSearch}
                  onChange={(e) => setReceiptSearch(e.target.value)}
                />
            </div>

            {/* Receipts Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {isLoading ? (
                <div className="col-span-full py-20 text-center"><Loader2 className="animate-spin mx-auto text-amber-500" /></div>
              ) : filteredReceipts.length === 0 ? (
                <div className="col-span-full py-20 text-center text-slate-400">Aucun historique trouvé</div>
              ) : (
                filteredReceipts.map((r) => (
                  <div key={r.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:border-amber-200 transition-all group">
                    <div className="flex justify-between items-start mb-4">
                      <div className="h-10 w-10 bg-slate-900 text-white rounded-xl flex items-center justify-center">
                        <FileText size={20} />
                      </div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{new Date(r.createdAt).toLocaleDateString()}</span>
                    </div>
                    <h4 className="text-lg font-black text-slate-900 mb-1">{r.receiptNo}</h4>
                    <p className="text-sm font-bold text-amber-600 mb-4">{r.customerName}</p>
                    
                    <div className="flex justify-between items-center mb-6 p-3 bg-slate-50 rounded-xl">
                       <span className="text-xs font-bold text-slate-400 uppercase">Total</span>
                       <span className="font-black text-slate-900">{formatCurrency(r.totalAmount || "0")}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                       <button 
                        onClick={() => handleResend(r.id, 'whatsapp')}
                        className="flex items-center justify-center gap-2 py-2 rounded-lg bg-emerald-50 text-emerald-600 text-xs font-bold hover:bg-emerald-600 hover:text-white transition-all underline decoration-transparent hover:decoration-white"
                       >
                         <Smartphone size={14} /> WhatsApp
                       </button>
                       <button 
                        onClick={() => handleResend(r.id, 'email')}
                        className="flex items-center justify-center gap-2 py-2 rounded-lg bg-blue-50 text-blue-600 text-xs font-bold hover:bg-blue-600 hover:text-white transition-all underline decoration-transparent hover:decoration-white"
                       >
                         <Mail size={14} /> Email
                       </button>
                       <button 
                        onClick={() => handleViewPDF(r.saleId)}
                        className="col-span-2 flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-100 text-slate-700 text-sm font-black hover:bg-slate-900 hover:text-white transition-all"
                       >
                         <ExternalLink size={16} /> Voir PDF
                       </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Reports;
