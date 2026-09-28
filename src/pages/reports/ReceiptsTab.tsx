import React, { useState } from 'react';
import { motion } from 'motion/react';
import { FileText, Search, Smartphone, Mail, ExternalLink, Loader2 } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';
import { sendErrorMessage } from '../../lib/sendErrors';
import { sendDocumentAndWait } from '../../lib/sendDocument';
import { openAuthenticatedFile } from '../../lib/openFile';
import { usePagedList } from '../../hooks/usePagedList';
import { Pager } from '../../components/Pager';
import type { Notify } from './types';

/** Issued invoices: search, resend by WhatsApp or email, open the PDF. */
export const ReceiptsTab: React.FC<{ notify: Notify }> = ({ notify }) => {
  const [receiptSearch, setReceiptSearch] = useState('');
  // Searched (invoice number or customer) and paged on the server.
  const list = usePagedList<any>('/api/receipts', { q: receiptSearch }, 24);

  const handleResend = async (saleId: number, method: 'whatsapp' | 'email') => {
    try {
      notify('success', 'Envoi en cours…');
      const result = await sendDocumentAndWait('receipt', saleId, method);
      notify(result.ok ? 'success' : 'error', result.text);
    } catch (err: any) {
      notify('error', sendErrorMessage(err));
    }
  };

  const handleViewPDF = async (saleId: number) => {
    try {
      await openAuthenticatedFile(`/api/receipts/${saleId}/pdf`);
    } catch (err) {
      console.error(err);
      notify('error', 'Échec de l\'ouverture du PDF');
    }
  };

  return (
    <motion.div 
      key="receipts" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {/* Search */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <Search className="text-slate-400" size={20} />
          <input aria-label="Rechercher par N° Facture ou Client..." 
            type="text" 
            placeholder="Rechercher par N° Facture ou Client..."
            className="flex-1 min-w-0 bg-transparent border-none outline-none font-medium"
            value={receiptSearch}
            onChange={(e) => setReceiptSearch(e.target.value)}
          />
      </div>

      {/* Receipts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {list.isLoading ? (
          <div className="col-span-full py-20 text-center"><Loader2 className="animate-spin mx-auto text-amber-500" /></div>
        ) : list.items.length === 0 ? (
          <div className="col-span-full py-20 text-center text-slate-400">Aucun historique trouvé</div>
        ) : (
          list.items.map((r) => (
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
            <Pager page={list.page} pageCount={list.pageCount} total={list.total} isLoading={list.isLoading} onPage={list.setPage} noun="factures" />
    </motion.div>
  );
};
