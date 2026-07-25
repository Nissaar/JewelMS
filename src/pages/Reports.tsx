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
  const [activeTab, setActiveTab] = useState<'vat' | 'receipts' | 'tradein' | 'metal'>('vat');
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

  // Trade-In (Assay Office) State
  const [tradeInData, setTradeInData] = useState<any[]>([]);
  const [tradeInFilters, setTradeInFilters] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  // Sales by Metal Report State
  const [salesByMetalData, setSalesByMetalData] = useState<any[]>([]);
  const [salesByMetalSummary, setSalesByMetalSummary] = useState<any>({
    totalWeight: 0,
    totalRevenue: 0,
    totalRevenueWithVat: 0,
    count: 0
  });
  const [metalFilters, setMetalFilters] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    metalType: 'all',
    fineness: 'all'
  });

  useEffect(() => {
    if (activeTab === 'vat') {
      fetchVatReport();
    } else if (activeTab === 'receipts') {
      fetchReceiptHistory();
    } else if (activeTab === 'tradein') {
      fetchTradeInReport();
    } else if (activeTab === 'metal') {
      fetchSalesByMetalReport();
    }
  }, [activeTab, filters, tradeInFilters, metalFilters]);

  const fetchSalesByMetalReport = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (metalFilters.startDate) params.append('startDate', metalFilters.startDate);
      if (metalFilters.endDate) params.append('endDate', metalFilters.endDate);
      if (metalFilters.metalType) params.append('metalType', metalFilters.metalType);
      if (metalFilters.fineness) params.append('fineness', metalFilters.fineness);

      const res = await axios.get(`/api/reports/sales-by-metal?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSalesByMetalData(res.data.items || []);
      setSalesByMetalSummary(res.data.summary || {
        totalWeight: 0,
        totalRevenue: 0,
        totalRevenueWithVat: 0,
        count: 0
      });
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Échec du chargement du rapport de ventes par métal' });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTradeInReport = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (tradeInFilters.startDate) params.append('startDate', tradeInFilters.startDate);
      if (tradeInFilters.endDate) params.append('endDate', tradeInFilters.endDate);

      const res = await axios.get(`/api/reports/tradein?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTradeInData(res.data);
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Échec du chargement du registre Trade-In' });
    } finally {
      setIsLoading(false);
    }
  };

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

  const handleResend = async (saleId: number, method: 'whatsapp' | 'email') => {
    try {
      await axios.post(`/api/receipts/${saleId}/send`, { method }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage({ type: 'success', text: `Reçu envoyé via ${method}` });
    } catch (err: any) {
      if (err.response?.status === 400) {
        if (err.response.data?.error === 'CLIENT_EMAIL_MISSING') {
          setMessage({ type: 'error', text: 'Erreur : Veuillez ajouter une adresse email au profil de ce client.' });
        } else {
          setMessage({ type: 'error', text: "Erreur d'envoi. Vérifiez la configuration Brevo." });
        }
      } else if (err.response?.status === 412) {
        setMessage({ type: 'error', text: 'Configuration manquante — Veuillez configurer vos paramètres Email/WhatsApp.' });
      } else {
        setMessage({ type: 'error', text: 'Échec de l\'envoi' });
      }
    }
    setTimeout(() => setMessage({ type: '', text: '' }), 4000);
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

  const handleExportTradeInPDF = async () => {
    try {
      const params = new URLSearchParams();
      if (tradeInFilters.startDate) params.append('startDate', tradeInFilters.startDate);
      if (tradeInFilters.endDate) params.append('endDate', tradeInFilters.endDate);

      const response = await axios.get(`/api/reports/tradein/pdf?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `registre_tradein_${tradeInFilters.startDate || 'all'}_to_${tradeInFilters.endDate || 'all'}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
      setMessage({ type: 'success', text: 'Registre Trade-In PDF exporté avec succès' });
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Échec de l\'exportation du PDF' });
    }
    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
  };

  const handleExportTradeInExcel = () => {
    try {
      if (tradeInData.length === 0) {
        setMessage({ type: 'error', text: 'Aucune donnée à exporter' });
        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
        return;
      }

      // CSV Headers matching the exact physical register layout
      const headers = ['DATE', 'DESCRIPTION', 'NAME', 'NIC', 'ADDRESS', 'IN (Mass/g)', 'FINENESS', 'INV. NO.', 'OUT'];
      const rows = tradeInData.map(row => [
        row.date ? new Date(row.date).toLocaleDateString('fr-FR') : 'N/A',
        `"${(row.description || '').replace(/"/g, '""')}"`,
        `"${(row.customerName || '').replace(/"/g, '""')}"`,
        `"${(row.customerNIC || '').replace(/"/g, '""')}"`,
        `"${(row.customerAddress || '').replace(/"/g, '""')}"`,
        row.weight ? parseFloat(row.weight).toFixed(3) : '0.000',
        row.fineness || '-',
        row.invNo || '-',
        row.out || '-'
      ]);

      const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `registre_tradein_${tradeInFilters.startDate || 'all'}_to_${tradeInFilters.endDate || 'all'}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setMessage({ type: 'success', text: 'Registre Trade-In CSV (Excel) exporté avec succès' });
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Échec de l\'exportation CSV' });
    }
    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
  };

  const handleExportSalesByMetalExcel = () => {
    try {
      if (salesByMetalData.length === 0) {
        setMessage({ type: 'error', text: 'Aucune donnée à exporter' });
        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
        return;
      }

      // CSV Headers
      const headers = ['DATE', 'FACTURE N° / RECEIPT NO.', 'CLIENT / CUSTOMER', 'DESCRIPTION', 'MÉTAL / METAL', 'PURETÉ / FINENESS', 'POIDS (g) / WEIGHT', 'REVENU HT (Rs) / REVENUE EXCL. VAT', 'TOTAL TTC (Rs) / TOTAL INCL. VAT'];
      const rows = salesByMetalData.map(row => [
        row.createdAt ? new Date(row.createdAt).toLocaleDateString('fr-FR') : 'N/A',
        row.receiptNo ? `#FS-${row.receiptNo}` : `Ref #${row.id}`,
        `"${(row.customerName || '').replace(/"/g, '""')}"`,
        `"${(row.itemDetails || '').replace(/"/g, '""')}"`,
        row.metalType || '-',
        row.fineness || '-',
        row.weight ? parseFloat(row.weight).toFixed(3) : '0.000',
        row.amount ? parseFloat(row.amount).toFixed(2) : '0.00',
        row.totalWithVat ? parseFloat(row.totalWithVat).toFixed(2) : '0.00'
      ]);

      const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `rapport_ventes_metal_${metalFilters.metalType}_${metalFilters.fineness}_${metalFilters.startDate}_to_${metalFilters.endDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setMessage({ type: 'success', text: 'Rapport de ventes par métal CSV exporté avec succès' });
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Échec de l\'exportation CSV' });
    }
    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
  };

  const handleExportSalesByMetalPDF = async () => {
    try {
      if (salesByMetalData.length === 0) {
        setMessage({ type: 'error', text: 'Aucune donnée à exporter' });
        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
        return;
      }

      const params = new URLSearchParams();
      if (metalFilters.startDate) params.append('startDate', metalFilters.startDate);
      if (metalFilters.endDate) params.append('endDate', metalFilters.endDate);
      if (metalFilters.metalType) params.append('metalType', metalFilters.metalType);
      if (metalFilters.fineness) params.append('fineness', metalFilters.fineness);

      const response = await axios.get(`/api/reports/sales-by-metal/pdf?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `rapport_ventes_metal_${metalFilters.metalType}_${metalFilters.fineness}_${metalFilters.startDate || 'all'}_to_${metalFilters.endDate || 'all'}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
      setMessage({ type: 'success', text: 'Rapport ventes par métal PDF exporté avec succès' });
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
          <button
            onClick={() => setActiveTab('tradein')}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'tradein' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Registre Trade-In (Assay Office)
          </button>
          <button
            onClick={() => setActiveTab('metal')}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'metal' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Rapport par Métal
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

        {activeTab === 'tradein' && (
          <div className="flex gap-2">
            <button
              id="export-tradein-excel-btn"
              onClick={handleExportTradeInExcel}
              className="bg-slate-900 hover:bg-slate-800 text-white font-black px-6 py-3 rounded-2xl shadow-lg transition-all flex items-center gap-2 text-sm select-none"
            >
              <Download size={18} />
              Exporter en Excel (CSV)
            </button>
            <button
              id="export-tradein-pdf-btn"
              onClick={handleExportTradeInPDF}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-6 py-3 rounded-2xl shadow-lg transition-all flex items-center gap-2 text-sm select-none"
            >
              <Download size={18} />
              Exporter en PDF
            </button>
          </div>
        )}

        {activeTab === 'metal' && (
          <div className="flex gap-2">
            <button
              id="export-sales-metal-excel-btn"
              onClick={handleExportSalesByMetalExcel}
              className="bg-slate-900 hover:bg-slate-800 text-white font-black px-6 py-3 rounded-2xl shadow-lg transition-all flex items-center gap-2 text-sm select-none"
            >
              <Download size={18} />
              Exporter en CSV (Excel)
            </button>
            <button
              id="export-sales-metal-pdf-btn"
              onClick={handleExportSalesByMetalPDF}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-6 py-3 rounded-2xl shadow-lg transition-all flex items-center gap-2 text-sm select-none"
            >
              <Download size={18} />
              Exporter en PDF
            </button>
          </div>
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
        ) : activeTab === 'receipts' ? (
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
                        onClick={() => handleResend(r.saleId, 'whatsapp')}
                        className="flex items-center justify-center gap-2 py-2 rounded-lg bg-emerald-50 text-emerald-600 text-xs font-bold hover:bg-emerald-600 hover:text-white transition-all underline decoration-transparent hover:decoration-white"
                       >
                         <Smartphone size={14} /> WhatsApp
                       </button>
                       <button 
                        onClick={() => handleResend(r.saleId, 'email')}
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
        ) : activeTab === 'tradein' ? (
          <motion.div 
            key="tradein" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Filters */}
            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 flex flex-wrap items-end gap-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Date de Début / Start Date</label>
                <input 
                  type="date" 
                  className="w-48 bg-slate-50 border-2 border-slate-100 rounded-xl py-2 px-3 font-bold outline-none focus:border-amber-400"
                  value={tradeInFilters.startDate}
                  onChange={(e) => setTradeInFilters({...tradeInFilters, startDate: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Date de Fin / End Date</label>
                <input 
                  type="date" 
                  className="w-48 bg-slate-50 border-2 border-slate-100 rounded-xl py-2 px-3 font-bold outline-none focus:border-amber-400"
                  value={tradeInFilters.endDate}
                  onChange={(e) => setTradeInFilters({...tradeInFilters, endDate: e.target.value})}
                />
              </div>
              <button 
                onClick={fetchTradeInReport}
                className="bg-slate-900 text-white p-3 rounded-xl hover:bg-slate-800 transition-all shadow-lg flex items-center justify-center"
              >
                <RefreshCcw size={20} />
              </button>
            </div>

            {/* Assay Office Ledger Table */}
            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-6 border-b border-slate-50 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                  <h3 className="text-lg font-black text-slate-900">Registre Physique de Contrôle - Assay Office</h3>
                  <p className="text-xs text-slate-500 font-medium">Format conforme aux exigences règlementaires de l'Assay Office</p>
                </div>
                <div className="text-right text-xs text-slate-400 font-mono">
                  {tradeInData.length} Ligne(s) trouvée(s)
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">DATE</th>
                      <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">DESCRIPTION</th>
                      <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">NAME</th>
                      <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">NIC</th>
                      <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">ADDRESS</th>
                      <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-widest text-right">IN (g)</th>
                      <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">FINENESS</th>
                      <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">INV. NO.</th>
                      <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-widest text-right">OUT (g)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {isLoading ? (
                      <tr>
                        <td colSpan={9} className="py-20 text-center">
                          <Loader2 className="animate-spin mx-auto text-amber-500" />
                        </td>
                      </tr>
                    ) : tradeInData.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-20 text-center text-slate-400 font-medium">
                          Aucune transaction de Trade-In enregistrée pour cette période
                        </td>
                      </tr>
                    ) : (
                      tradeInData.map((row, idx) => (
                        <tr key={`${row.id}-${idx}`} className="hover:bg-slate-50/80 transition-colors text-sm">
                          <td className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">
                            {row.date ? new Date(row.date).toLocaleDateString('fr-FR') : 'N/A'}
                          </td>
                          <td className="px-4 py-3 text-slate-900 font-bold">
                            {row.description}
                          </td>
                          <td className="px-4 py-3 font-black text-slate-900">
                            {row.customerName}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-slate-600 font-bold">
                            {row.customerNIC}
                          </td>
                          <td className="px-4 py-3 text-slate-500 font-medium max-w-xs truncate" title={row.customerAddress}>
                            {row.customerAddress || '-'}
                          </td>
                          <td className="px-4 py-3 text-right font-black text-emerald-600">
                            {row.weight ? parseFloat(row.weight).toFixed(3) : '0.000'}g
                          </td>
                          <td className="px-4 py-3 font-bold text-amber-600">
                            {row.fineness}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs font-black text-slate-800">
                            {row.invNo}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-400 font-medium">
                            {row.out}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Signature Blocks inside UI */}
              <div className="p-8 bg-slate-50/50 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="border border-dashed border-slate-200 p-6 rounded-2xl bg-white space-y-3">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Preparer Signature</h4>
                  <div className="h-12 border-b border-slate-200 flex items-end">
                    <p className="text-xs text-slate-300 italic font-medium">Signé électroniquement par {user?.username || 'Haujee Jewellery'}</p>
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Nom & Signature du Responsable</p>
                </div>
                <div className="border border-dashed border-slate-200 p-6 rounded-2xl bg-white space-y-3">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Assay Office Verification</h4>
                  <div className="h-12 border-b border-slate-200 flex items-end justify-center">
                    <p className="text-xs text-slate-300 uppercase font-bold tracking-widest italic">[ STAMP AREA ]</p>
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Stamp & Date of Inspection</p>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="metal" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Poids Total Vendu</p>
                  <h3 className="text-2xl font-black text-slate-900 mt-1">{formatWeight(salesByMetalSummary.totalWeight)}</h3>
                  <p className="text-xs text-slate-500 font-medium mt-1">Poids total cumulé (g)</p>
                </div>
                <div className="p-4 bg-amber-50 rounded-2xl text-amber-500">
                  <Scale size={24} />
                </div>
              </div>

              <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Revenu Total (HT)</p>
                  <h3 className="text-2xl font-black text-slate-900 mt-1">{formatCurrency(salesByMetalSummary.totalRevenue)}</h3>
                  <p className="text-xs text-slate-500 font-medium mt-1">Total ventes hors taxes</p>
                </div>
                <div className="p-4 bg-emerald-50 rounded-2xl text-emerald-600">
                  <Banknote size={24} />
                </div>
              </div>

              <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Revenu Total (TTC)</p>
                  <h3 className="text-2xl font-black text-slate-900 mt-1">{formatCurrency(salesByMetalSummary.totalRevenueWithVat)}</h3>
                  <p className="text-xs text-slate-500 font-medium mt-1">Total ventes avec TVA (15%)</p>
                </div>
                <div className="p-4 bg-blue-50 rounded-2xl text-blue-600">
                  <ArrowUpRight size={24} />
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 flex flex-wrap items-end gap-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">Date de Début / Start Date</label>
                <input 
                  type="date" 
                  className="w-48 bg-slate-50 border-2 border-slate-100 rounded-xl py-2 px-3 font-bold outline-none focus:border-amber-400 text-sm"
                  value={metalFilters.startDate}
                  onChange={(e) => setMetalFilters({...metalFilters, startDate: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">Date de Fin / End Date</label>
                <input 
                  type="date" 
                  className="w-48 bg-slate-50 border-2 border-slate-100 rounded-xl py-2 px-3 font-bold outline-none focus:border-amber-400 text-sm"
                  value={metalFilters.endDate}
                  onChange={(e) => setMetalFilters({...metalFilters, endDate: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">Métal / Metal</label>
                <select 
                  className="w-48 bg-slate-50 border-2 border-slate-100 rounded-xl py-2 px-3 font-bold outline-none focus:border-amber-400 text-sm"
                  value={metalFilters.metalType}
                  onChange={(e) => setMetalFilters({...metalFilters, metalType: e.target.value})}
                >
                  <option value="all">Tous les métaux</option>
                  <option value="Or">Or / Gold</option>
                  <option value="Argent">Argent / Silver</option>
                  <option value="Platinum">Platine / Platinum</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">Pureté / Purity</label>
                <select 
                  className="w-48 bg-slate-50 border-2 border-slate-100 rounded-xl py-2 px-3 font-bold outline-none focus:border-amber-400 text-sm"
                  value={metalFilters.fineness}
                  onChange={(e) => setMetalFilters({...metalFilters, fineness: e.target.value})}
                >
                  <option value="all">Toutes les puretés</option>
                  <option value="18K">18K (750)</option>
                  <option value="22K">22K (916)</option>
                  <option value="24K">24K (999)</option>
                  <option value="925">925 (Argent)</option>
                  <option value="950">950 (Platine)</option>
                </select>
              </div>
              <button 
                onClick={fetchSalesByMetalReport}
                className="bg-slate-900 text-white p-3 rounded-xl hover:bg-slate-800 transition-all shadow-lg flex items-center justify-center h-[38px] w-[38px]"
              >
                <RefreshCcw size={18} />
              </button>
            </div>

            {/* Sales table */}
            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-6 border-b border-slate-50 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                  <h3 className="text-lg font-black text-slate-900 font-sans tracking-tight">Rapport de Ventes - Détails par Métal</h3>
                  <p className="text-xs text-slate-500 font-medium">Bilan analytique des ventes de métaux précieux</p>
                </div>
                <div className="text-right text-xs text-slate-400 font-mono">
                  {salesByMetalData.length} Vente(s) trouvée(s)
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">DATE</th>
                      <th className="px-6 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">FACTURE N°</th>
                      <th className="px-6 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">CLIENT</th>
                      <th className="px-6 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">DESCRIPTION</th>
                      <th className="px-6 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">MÉTAL</th>
                      <th className="px-6 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">PURETÉ</th>
                      <th className="px-6 py-3 text-xs font-black text-slate-500 uppercase tracking-widest text-right">POIDS (g)</th>
                      <th className="px-6 py-3 text-xs font-black text-slate-500 uppercase tracking-widest text-right">REVENU HT</th>
                      <th className="px-6 py-3 text-xs font-black text-slate-500 uppercase tracking-widest text-right">TOTAL TTC</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {isLoading ? (
                      <tr>
                        <td colSpan={9} className="py-20 text-center">
                          <Loader2 className="animate-spin mx-auto text-amber-500" />
                        </td>
                      </tr>
                    ) : salesByMetalData.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-20 text-center text-slate-400 font-medium">
                          Aucune transaction enregistrée pour ces critères de recherche
                        </td>
                      </tr>
                    ) : (
                      salesByMetalData.map((row, idx) => (
                        <tr key={`${row.id}-${idx}`} className="hover:bg-slate-50/80 transition-colors text-sm">
                          <td className="px-6 py-4 font-semibold text-slate-700 whitespace-nowrap">
                            {row.createdAt ? new Date(row.createdAt).toLocaleDateString('fr-FR') : 'N/A'}
                          </td>
                          <td className="px-6 py-4 font-mono text-xs font-black text-slate-800">
                            {row.receiptNo ? `#FS-${row.receiptNo}` : `Ref #${row.id}`}
                          </td>
                          <td className="px-6 py-4 font-black text-slate-900">
                            {row.customerName || 'Client de passage'}
                          </td>
                          <td className="px-6 py-4 text-slate-600 font-medium max-w-xs truncate" title={row.itemDetails}>
                            {row.itemDetails || '-'}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                              row.metalType === 'Gold' || row.metalType === 'Or'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}>
                              {row.metalType || '-'}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-bold text-amber-600">
                            {row.fineness || '-'}
                          </td>
                          <td className="px-6 py-4 text-right font-bold text-slate-900 whitespace-nowrap">
                            {row.weight ? parseFloat(row.weight).toFixed(3) : '0.000'} g
                          </td>
                          <td className="px-6 py-4 text-right font-black text-emerald-600 whitespace-nowrap">
                            {formatCurrency(row.amount)}
                          </td>
                          <td className="px-6 py-4 text-right font-black text-slate-950 whitespace-nowrap">
                            {formatCurrency(row.totalWithVat)}
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
      </AnimatePresence>
    </div>
  );
};

export default Reports;
