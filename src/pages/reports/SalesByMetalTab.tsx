import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { motion } from 'motion/react';
import { ArrowUpRight, Banknote, RefreshCcw, Loader2, Scale, Download } from 'lucide-react';
import { formatCurrency, formatWeight } from '../../lib/utils';
import { downloadCsv } from '../../lib/csv';
import { downloadAuthenticatedFile } from '../../lib/openFile';
import { currentMonthRange, type Notify } from './types';

const EMPTY_SUMMARY = { totalWeight: 0, totalRevenue: 0, totalRevenueWithVat: 0, count: 0 };

/** Sales per item, filtered by date, metal and fineness, with CSV and PDF export. */
export const SalesByMetalTab: React.FC<{ notify: Notify }> = ({ notify }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [salesByMetalData, setSalesByMetalData] = useState<any[]>([]);
  const [salesByMetalSummary, setSalesByMetalSummary] = useState<any>(EMPTY_SUMMARY);
  const [metalFilters, setMetalFilters] = useState(() => ({ ...currentMonthRange(), metalType: 'all', fineness: 'all' }));

  useEffect(() => { fetchSalesByMetalReport(); }, [metalFilters]);

  const fetchSalesByMetalReport = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (metalFilters.startDate) params.append('startDate', metalFilters.startDate);
      if (metalFilters.endDate) params.append('endDate', metalFilters.endDate);
      if (metalFilters.metalType) params.append('metalType', metalFilters.metalType);
      if (metalFilters.fineness) params.append('fineness', metalFilters.fineness);

      const res = await axios.get(`/api/reports/sales-by-metal?${params.toString()}`);
      setSalesByMetalData(res.data.items || []);
      setSalesByMetalSummary(res.data.summary || EMPTY_SUMMARY);
    } catch (err) {
      console.error(err);
      notify('error', 'Échec du chargement du rapport de ventes par métal');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportSalesByMetalExcel = () => {
    try {
      if (salesByMetalData.length === 0) {
        notify('error', 'Aucune donnée à exporter');
        return;
      }

      // CSV Headers
      const headers = ['DATE', 'FACTURE N° / RECEIPT NO.', 'CLIENT / CUSTOMER', 'DESCRIPTION', 'MÉTAL / METAL', 'PURETÉ / FINENESS', 'POIDS (g) / WEIGHT', 'REVENU HT (Rs) / REVENUE EXCL. VAT', 'TOTAL TTC (Rs) / TOTAL INCL. VAT'];
      const rows = salesByMetalData.map(row => [
        row.createdAt ? new Date(row.createdAt).toLocaleDateString('fr-FR') : 'N/A',
        row.receiptNo ? `#FS-${row.receiptNo}` : `Ref #${row.id}`,
        row.customerName || '',
        row.itemDetails || '',
        row.metalType || '-',
        row.fineness || '-',
        row.weight ? parseFloat(row.weight).toFixed(3) : '0.000',
        row.amount ? parseFloat(row.amount).toFixed(2) : '0.00',
        row.totalWithVat ? parseFloat(row.totalWithVat).toFixed(2) : '0.00'
      ]);
      downloadCsv(`rapport_ventes_metal_${metalFilters.metalType}_${metalFilters.fineness}_${metalFilters.startDate}_to_${metalFilters.endDate}.csv`, headers, rows);

      notify('success', 'Rapport de ventes par métal CSV exporté avec succès');
    } catch (err) {
      console.error(err);
      notify('error', 'Échec de l\'exportation CSV');
    }
  };

  const handleExportSalesByMetalPDF = async () => {
    try {
      if (salesByMetalData.length === 0) {
        notify('error', 'Aucune donnée à exporter');
        return;
      }

      const params = new URLSearchParams();
      if (metalFilters.startDate) params.append('startDate', metalFilters.startDate);
      if (metalFilters.endDate) params.append('endDate', metalFilters.endDate);
      if (metalFilters.metalType) params.append('metalType', metalFilters.metalType);
      if (metalFilters.fineness) params.append('fineness', metalFilters.fineness);

      await downloadAuthenticatedFile(`/api/reports/sales-by-metal/pdf?${params.toString()}`, `rapport_ventes_metal_${metalFilters.metalType}_${metalFilters.fineness}_${metalFilters.startDate || 'all'}_to_${metalFilters.endDate || 'all'}.pdf`);
      notify('success', 'Rapport ventes par métal PDF exporté avec succès');
    } catch (err) {
      console.error(err);
      notify('error', 'Échec de l\'exportation du PDF');
    }
  };

  return (
    <motion.div 
      key="metal" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="flex justify-end gap-2">
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
          <input aria-label="Date de Début / Start Date" 
            type="date" 
            className="w-48 bg-slate-50 border-2 border-slate-100 rounded-xl py-2 px-3 font-bold outline-none focus:border-amber-400 text-sm"
            value={metalFilters.startDate}
            onChange={(e) => setMetalFilters({...metalFilters, startDate: e.target.value})}
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">Date de Fin / End Date</label>
          <input aria-label="Date de Fin / End Date" 
            type="date" 
            className="w-48 bg-slate-50 border-2 border-slate-100 rounded-xl py-2 px-3 font-bold outline-none focus:border-amber-400 text-sm"
            value={metalFilters.endDate}
            onChange={(e) => setMetalFilters({...metalFilters, endDate: e.target.value})}
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">Métal / Metal</label>
          <select aria-label="Métal / Metal" 
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
          <select aria-label="Pureté / Purity" 
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
        <button aria-label="Rafraîchir le rapport" 
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
  );
};
