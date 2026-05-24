import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { 
  History, Search, Filter, Calendar, FileText, 
  Download, Eye, X, Loader2, Banknote,
  Smartphone, Mail, Check, AlertCircle, ExternalLink,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatCurrency, formatWeight, formatItemDetails } from '../lib/utils';

const SalesHistory = () => {
  const { token, user } = useAuth();
  const [sales, setSales] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchSalesHistory();
  }, []);

  const fetchSalesHistory = async () => {
    setIsLoading(true);
    try {
      const res = await axios.get('/api/sales/history', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSales(res.data);
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Échec de la récupération de l\'historique' });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredSales = (sales || []).filter(sale => {
    const search = String(searchQuery || '').toLowerCase();
    const cName = String(sale?.customerName || '').toLowerCase();
    const rNo = String(sale?.receiptNo || '').toLowerCase();
    const sId = String(sale?.id || '').toLowerCase();
    
    const matchesSearch = cName.includes(search) || rNo.includes(search) || sId.includes(search);
    
    const saleDateStr = new Date(sale.date).toISOString().split('T')[0];
    const matchesDate = !dateFilter || saleDateStr === dateFilter;
    
    return matchesSearch && matchesDate;
  });

  const handleDownloadPDF = async (saleId: number) => {
    setIsGeneratingPDF(true);
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
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const openDetails = (sale: any) => {
    setSelectedSale(sale);
    setIsModalOpen(true);
  };

  const handleCancelSale = async (saleId: number) => {
    if (!window.confirm("Êtes-vous sûr de vouloir annuler cette vente ? L'article sera remis en stock et la transaction sera marquée comme annulée.")) return;

    setIsCancelling(true);
    try {
      await axios.post(`/api/sales/${saleId}/cancel`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage({ type: 'success', text: "Vente annulée avec succès" });
      setIsModalOpen(false);
      fetchSalesHistory();
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: err.response?.data?.error || "Erreur lors de l'annulation" });
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
            <History className="text-emerald-500" size={32} />
            Historique des Ventes
          </h1>
          <p className="text-slate-500 font-medium">Consultez et gérez vos transactions passées</p>
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

      {/* Filters Bar */}
      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex flex-wrap items-center gap-6">
        <div className="flex-1 min-w-[300px] relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder="Rechercher par Client, N° Receipt, ID..."
            className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-3 pl-12 pr-4 font-bold outline-none focus:border-emerald-400 focus:bg-white transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="date"
              className="bg-slate-50 border-2 border-slate-50 rounded-2xl py-3 pl-12 pr-4 font-bold outline-none focus:border-emerald-400 focus:bg-white transition-all"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
          </div>
          <button 
            onClick={fetchSalesHistory}
            className="p-3 bg-slate-900 text-white rounded-2xl hover:bg-slate-800 transition-all shadow-lg"
          >
            <History size={20} />
          </button>
        </div>
      </div>

      {/* Sales Table */}
      <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">Date & ID</th>
                <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">Client</th>
                <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">Article</th>
                <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">Mode Paiement</th>
                <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Total</th>
                <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                <tr><td colSpan={6} className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-emerald-500" size={40} /></td></tr>
              ) : filteredSales.length === 0 ? (
                <tr><td colSpan={6} className="py-20 text-center text-slate-400 font-bold">Aucune vente trouvée</td></tr>
              ) : (
                filteredSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-8 py-6">
                      <p className="font-black text-slate-900">{new Date(sale.date).toLocaleDateString('fr-FR')}</p>
                      <p className="text-[10px] font-bold text-slate-400 tracking-wider">SALE #{sale.id} {sale.receiptNo ? `| RECO N°${sale.receiptNo}` : ''}</p>
                      {sale.status === 'Cancelled' && (
                        <span className="mt-1 inline-block px-2 py-0.5 bg-red-100 text-red-600 text-[8px] font-black uppercase rounded-md">Annulée</span>
                      )}
                    </td>
                    <td className="px-8 py-6">
                      <p className="font-bold text-slate-800">{sale.customerName || 'Client de Passage'}</p>
                      <p className="text-xs text-slate-500">{sale.paymentMode === 'Cheque' ? `Chèque: ${sale.chequeNumber}` : sale.paymentMode}</p>
                    </td>
                    <td className="px-8 py-6">
                      <p className="text-sm font-medium text-slate-700 truncate max-w-[200px]">
                        {formatItemDetails(sale.itemDetails) || `${formatItemDetails(sale.barcode)} - ${formatItemDetails(sale.category)} ${formatItemDetails(sale.subCategory)} ${sale.metalType ? `(${formatItemDetails(sale.metalType)})` : ''}`.trim().replace(/\s+/g, ' ')}
                      </p>
                      {sale.category === 'Jewellery' && (
                        <p className="text-[10px] font-bold text-emerald-600 tracking-widest uppercase">{formatItemDetails(sale.metalType)} {formatItemDetails(sale.fineness)}</p>
                      )}
                    </td>
                    <td className="px-8 py-6">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        sale.paymentMode === 'Cash' ? 'bg-emerald-50 text-emerald-600' :
                        sale.paymentMode === 'Card' ? 'bg-blue-50 text-blue-600' :
                        'bg-amber-50 text-amber-600'
                      }`}>
                        {sale.paymentMode}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <p className="text-lg font-black text-slate-900">{formatCurrency(sale.totalAmount || "0")}</p>
                      <p className="text-[10px] font-bold text-slate-400 italic">TVA incluse</p>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <button 
                        onClick={() => openDetails(sale)}
                        className="p-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-900 hover:text-white transition-all shadow-sm"
                      >
                        <Eye size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details Modal */}
      <AnimatePresence>
        {isModalOpen && selectedSale && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">Détails de la Vente</h2>
                  <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest mt-1">N° TRANSACTION: {selectedSale.id}</p>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-8 space-y-8 overflow-y-auto max-h-[70vh]">
                {selectedSale.status === 'Cancelled' && (
                  <div className="bg-red-50 border-2 border-red-100 p-6 rounded-3xl flex items-center gap-4 text-red-600">
                    <Trash2 size={32} />
                    <div>
                      <p className="font-black uppercase text-sm tracking-widest">Transaction Annulée</p>
                      <p className="text-xs font-bold opacity-80">Cette vente a été annulée et l'article a été remis en stock.</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-4 text-center p-6 bg-slate-50 rounded-3xl">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Client</p>
                    <p className="text-lg font-black text-slate-900">{selectedSale.customerName || 'Client de Passage'}</p>
                  </div>
                  <div className="space-y-4 text-center p-6 bg-slate-50 rounded-3xl">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</p>
                    <p className="text-lg font-black text-slate-900">{new Date(selectedSale.date).toLocaleDateString('fr-FR')}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Détails de l'article</p>
                  <div className="bg-white border-2 border-slate-50 p-6 rounded-3xl space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-black text-slate-900 text-lg">
                          {formatItemDetails(selectedSale.itemDetails) || `${formatItemDetails(selectedSale.barcode)} - ${formatItemDetails(selectedSale.category)} ${formatItemDetails(selectedSale.subCategory)} ${selectedSale.metalType ? `(${formatItemDetails(selectedSale.metalType)})` : ''}`.trim().replace(/\s+/g, ' ')}
                        </p>
                        {selectedSale.category === 'Jewellery' && (
                          <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest">{formatItemDetails(selectedSale.metalType)} {formatItemDetails(selectedSale.fineness)}</p>
                        )}
                      </div>
                      <div className="text-right">
                        {selectedSale.category === 'Jewellery' ? (
                          <>
                            <p className="font-black text-slate-900">{formatWeight(selectedSale.weight)}</p>
                            <p className="text-[10px] font-bold text-slate-400 italic">Poids net</p>
                          </>
                        ) : (
                          <>
                            <p className="font-black text-slate-900">-</p>
                            <p className="text-[10px] font-bold text-slate-400 italic">Accessoire</p>
                          </>
                        )}
                      </div>
                    </div>
                    
                    <div className="pt-4 border-t border-slate-50 grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Prix Unitaire</p>
                        <p className="font-bold text-slate-700">{formatCurrency(selectedSale.unitSalesPrice || "0")}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Quantité</p>
                        <p className="font-bold text-slate-700">x{selectedSale.qty}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-8 bg-slate-900 text-white rounded-[2.5rem] space-y-4">
                   <div className="flex justify-between items-center text-sm font-bold text-slate-400">
                     <span>SOUS-TOTAL</span>
                     <span>{formatCurrency(selectedSale.totalAmount || "0")}</span>
                   </div>
                   <div className="flex justify-between items-center text-sm font-bold text-amber-400">
                     <span>TVA (15%)</span>
                     <span>{formatCurrency(selectedSale.vat15 || "0")}</span>
                   </div>
                   
                   {selectedSale.orderId && (
                     <div className="flex justify-between items-center text-sm font-bold text-blue-400">
                       <span>ACOMPTE DÉDUIT (COMMANDE #{selectedSale.orderNumber})</span>
                       <span>- {formatCurrency(selectedSale.orderDeposit || "0")}</span>
                     </div>
                   )}

                   <div className="pt-4 border-t border-slate-800 flex justify-between items-center">
                     <span className="text-lg font-black tracking-tight">{selectedSale.orderId ? 'RESTE À PAYER' : 'TOTAL TTC'}</span>
                     <span className="text-2xl font-black text-emerald-400">
                       { formatCurrency(
                         parseFloat(selectedSale.totalAmount || "0") + 
                         parseFloat(selectedSale.vat15 || "0") - 
                         (selectedSale.orderId ? parseFloat(selectedSale.orderDeposit || "0") : 0)
                       ) }
                     </span>
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4">
                  {user?.role === 'Admin' && selectedSale.status !== 'Cancelled' && (
                    <button 
                      onClick={() => handleCancelSale(selectedSale.id)}
                      disabled={isCancelling}
                      className="col-span-2 flex items-center justify-center gap-3 py-4 bg-red-50 text-red-600 border-2 border-red-100 rounded-2xl font-black hover:bg-red-100 transition-all shadow-sm mb-2 disabled:opacity-50"
                    >
                      {isCancelling ? <Loader2 className="animate-spin" size={20} /> : <Trash2 size={20} />}
                      {isCancelling ? 'Annulation en cours...' : 'Annuler la vente'}
                    </button>
                  )}
                  <button 
                    onClick={() => handleDownloadPDF(selectedSale.id)}
                    disabled={isGeneratingPDF || selectedSale.status === 'Cancelled'}
                    className="flex items-center justify-center gap-3 py-4 bg-emerald-500 text-white rounded-2xl font-black hover:bg-emerald-600 transition-all shadow-lg disabled:opacity-50"
                  >
                    {isGeneratingPDF ? (
                      <Loader2 className="animate-spin" size={20} />
                    ) : (
                      <Download size={20} />
                    )}
                    {isGeneratingPDF ? 'Génération...' : 'Télécharger PDF'}
                  </button>
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="flex items-center justify-center gap-3 py-4 bg-slate-100 text-slate-700 rounded-2xl font-black hover:bg-slate-200 transition-all"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SalesHistory;
