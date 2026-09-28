import React, { useRef, useState } from 'react';
import { FileText, AlertCircle, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { VatReportTab } from './reports/VatReportTab';
import { ReceiptsTab } from './reports/ReceiptsTab';
import { TradeInTab } from './reports/TradeInTab';
import { SalesByMetalTab } from './reports/SalesByMetalTab';
import type { Notify } from './reports/types';

const Reports = () => {
  const [activeTab, setActiveTab] = useState<'vat' | 'receipts' | 'tradein' | 'metal'>('vat');
  const [message, setMessage] = useState({ type: '', text: '' });
  const clearTimer = useRef<ReturnType<typeof setTimeout>>();

  const notify: Notify = (type, text) => {
    setMessage({ type, text });
    clearTimeout(clearTimer.current);
    clearTimer.current = setTimeout(() => setMessage({ type: '', text: '' }), 4000);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 flex items-center gap-3">
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
        <div className="flex space-x-1 bg-slate-200 p-1 rounded-2xl w-fit max-w-full overflow-x-auto">
          <button
            onClick={() => setActiveTab('vat')}
            className={`px-4 sm:px-6 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap shrink-0 ${
              activeTab === 'vat' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Rapport TVA
          </button>
          <button
            onClick={() => setActiveTab('receipts')}
            className={`px-4 sm:px-6 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap shrink-0 ${
              activeTab === 'receipts' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Archives Factures
          </button>
          <button
            onClick={() => setActiveTab('tradein')}
            className={`px-4 sm:px-6 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap shrink-0 ${
              activeTab === 'tradein' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Registre Trade-In (Assay Office)
          </button>
          <button
            onClick={() => setActiveTab('metal')}
            className={`px-4 sm:px-6 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap shrink-0 ${
              activeTab === 'metal' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Rapport par Métal
          </button>
        </div>

      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'vat' && <VatReportTab key="vat" notify={notify} />}
        {activeTab === 'receipts' && <ReceiptsTab key="receipts" notify={notify} />}
        {activeTab === 'tradein' && <TradeInTab key="tradein" notify={notify} />}
        {activeTab === 'metal' && <SalesByMetalTab key="metal" notify={notify} />}
      </AnimatePresence>
    </div>
  );
};

export default Reports;
