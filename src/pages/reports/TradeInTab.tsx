import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { motion } from 'motion/react';
import { RefreshCcw, Loader2, Download } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { downloadCsv } from '../../lib/csv';
import { downloadAuthenticatedFile } from '../../lib/openFile';
import { currentMonthRange, type Notify } from './types';

/** Assay Office trade-in register for a date range, with CSV and PDF export. */
export const TradeInTab: React.FC<{ notify: Notify }> = ({ notify }) => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [tradeInData, setTradeInData] = useState<any[]>([]);
  const [tradeInFilters, setTradeInFilters] = useState(currentMonthRange);

  useEffect(() => { fetchTradeInReport(); }, [tradeInFilters]);

  const fetchTradeInReport = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (tradeInFilters.startDate) params.append('startDate', tradeInFilters.startDate);
      if (tradeInFilters.endDate) params.append('endDate', tradeInFilters.endDate);

      const res = await axios.get(`/api/reports/tradein?${params.toString()}`);
      setTradeInData(res.data);
    } catch (err) {
      console.error(err);
      notify('error', 'Échec du chargement du registre Trade-In');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportTradeInPDF = async () => {
    try {
      const params = new URLSearchParams();
      if (tradeInFilters.startDate) params.append('startDate', tradeInFilters.startDate);
      if (tradeInFilters.endDate) params.append('endDate', tradeInFilters.endDate);

      await downloadAuthenticatedFile(`/api/reports/tradein/pdf?${params.toString()}`, `registre_tradein_${tradeInFilters.startDate || 'all'}_to_${tradeInFilters.endDate || 'all'}.pdf`);
      notify('success', 'Registre Trade-In PDF exporté avec succès');
    } catch (err) {
      console.error(err);
      notify('error', 'Échec de l\'exportation du PDF');
    }
  };

  const handleExportTradeInExcel = () => {
    try {
      if (tradeInData.length === 0) {
        notify('error', 'Aucune donnée à exporter');
        return;
      }

      // CSV Headers matching the exact physical register layout
      const headers = ['DATE', 'DESCRIPTION', 'NAME', 'NIC', 'ADDRESS', 'IN (Mass/g)', 'FINENESS', 'INV. NO.', 'OUT'];
      const rows = tradeInData.map(row => [
        row.date ? new Date(row.date).toLocaleDateString('fr-FR') : 'N/A',
        row.description || '',
        row.customerName || '',
        row.customerNIC || '',
        row.customerAddress || '',
        row.weight ? parseFloat(row.weight).toFixed(3) : '0.000',
        row.fineness || '-',
        row.invNo || '-',
        row.out || '-'
      ]);
      downloadCsv(`registre_tradein_${tradeInFilters.startDate || 'all'}_to_${tradeInFilters.endDate || 'all'}.csv`, headers, rows);

      notify('success', 'Registre Trade-In CSV (Excel) exporté avec succès');
    } catch (err) {
      console.error(err);
      notify('error', 'Échec de l\'exportation CSV');
    }
  };

  return (
    <motion.div 
      key="tradein" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="flex justify-end gap-2">
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
      {/* Filters */}
      <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 flex flex-wrap items-end gap-6">
        <div className="space-y-2">
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Date de Début / Start Date</label>
          <input aria-label="Date de Début / Start Date" 
            type="date" 
            className="w-48 bg-slate-50 border-2 border-slate-100 rounded-xl py-2 px-3 font-bold outline-none focus:border-amber-400"
            value={tradeInFilters.startDate}
            onChange={(e) => setTradeInFilters({...tradeInFilters, startDate: e.target.value})}
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Date de Fin / End Date</label>
          <input aria-label="Date de Fin / End Date" 
            type="date" 
            className="w-48 bg-slate-50 border-2 border-slate-100 rounded-xl py-2 px-3 font-bold outline-none focus:border-amber-400"
            value={tradeInFilters.endDate}
            onChange={(e) => setTradeInFilters({...tradeInFilters, endDate: e.target.value})}
          />
        </div>
        <button aria-label="Rafraîchir le registre" 
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
  );
};
