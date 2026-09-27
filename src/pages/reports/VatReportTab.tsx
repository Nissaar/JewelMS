import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { motion } from 'motion/react';
import { ArrowUpRight, Calendar, RefreshCcw, Loader2, Scale, Download } from 'lucide-react';
import { formatCurrency, formatWeight } from '../../lib/utils';
import { downloadAuthenticatedFile } from '../../lib/openFile';
import type { Notify } from './types';

/** VAT collected per sale for a year / month / day. */
export const VatReportTab: React.FC<{ notify: Notify }> = ({ notify }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [vatData, setVatData] = useState<any[]>([]);
  const [totalVat, setTotalVat] = useState('0');
  const [filters, setFilters] = useState({
    day: '',
    month: (new Date().getMonth() + 1).toString(),
    year: new Date().getFullYear().toString()
  });

  useEffect(() => { fetchVatReport(); }, [filters]);

  const fetchVatReport = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.year) params.append('year', filters.year);
      if (filters.month) params.append('month', filters.month);
      if (filters.day) params.append('day', filters.day);

      const res = await axios.get(`/api/reports/vat?${params.toString()}`);
      setVatData(res.data.data);
      setTotalVat(res.data.summary.totalVat);
    } catch (err: any) {
      notify('error', err.response?.data?.error || 'Échec du chargement du rapport TVA');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportVatPDF = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.year) params.append('year', filters.year);
      if (filters.month) params.append('month', filters.month);
      if (filters.day) params.append('day', filters.day);

      await downloadAuthenticatedFile(`/api/reports/vat/pdf?${params.toString()}`, `rapport_tva_${filters.year || 'all'}_${filters.month || 'all'}_${filters.day || 'all'}.pdf`);
      notify('success', 'Rapport TVA PDF téléchargé avec succès');
    } catch (err) {
      console.error(err);
      notify('error', 'Échec de l\'exportation du PDF');
    }
  };

  return (
    <motion.div 
      key="vat" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="flex justify-end gap-2">
        <button
          id="export-vat-pdf-btn"
          onClick={handleExportVatPDF}
          className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-6 py-3 rounded-2xl shadow-lg transition-all flex items-center gap-2 text-sm select-none"
        >
          <Download size={18} />
          Exporter en PDF
        </button>
      </div>
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
            <select aria-label="Année" 
              className="w-32 bg-slate-50 border-2 border-slate-100 rounded-xl py-2 px-3 font-bold outline-none focus:border-amber-400"
              value={filters.year}
              onChange={(e) => setFilters({...filters, year: e.target.value})}
            >
              {Array.from({ length: new Date().getFullYear() - 2023 }, (_, i) => 2024 + i).map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Mois</label>
            <select aria-label="Mois" 
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
            <input aria-label="Jour (Optionnel)" 
              type="number" min="1" max="31" 
              placeholder="DD"
              className="w-24 bg-slate-50 border-2 border-slate-100 rounded-xl py-2 px-3 font-bold outline-none focus:border-amber-400"
              value={filters.day}
              onChange={(e) => setFilters({...filters, day: e.target.value})}
            />
          </div>
          <button aria-label="Rafraîchir le rapport" 
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
  );
};
