import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { 
  Package, User, Plus, Check, AlertCircle, 
  Loader2, Search, Scale, X,
  ShoppingCart, Info, Clock, CheckCircle2, Banknote, UserPlus,
  Smartphone, Mail, Download, History
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '../lib/utils';
import CustomerModal from '../components/CustomerModal';

const Orders = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [view, setView] = useState<'list' | 'create'>('list');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // List State
  const [orders, setOrders] = useState<any[]>([]);
  const [orderSearch, setOrderSearch] = useState('');

  // Create State
  const [customerSearch, setCustomerSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [itemDescription, setItemDescription] = useState('');
  const [estimatedWeight, setEstimatedWeight] = useState('');
  const [estimatedPrice, setEstimatedPrice] = useState('');
  const [deposit, setDeposit] = useState('');
  const [goldRate, setGoldRate] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [lastCreatedOrderId, setLastCreatedOrderId] = useState<number | null>(null);

  // Finalize Modal State
  const [finalizingOrder, setFinalizingOrder] = useState<any>(null);
  const [finalWeight, setFinalWeight] = useState('');
  const [finalPrice, setFinalPrice] = useState('');
  const [finalGoldRate, setFinalGoldRate] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');

  // Post-Finalize State
  const [completedOrderSaleId, setCompletedOrderSaleId] = useState<number | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  useEffect(() => {
    if (view === 'list') fetchOrders();
  }, [view]);

  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const res = await axios.get('/api/orders', { headers: { Authorization: `Bearer ${token}` } });
      setOrders(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCustomerSearch = async () => {
    if (customerSearch.length < 2) return;
    try {
      const res = await axios.get(`/api/customers?search=${customerSearch}`, { headers: { Authorization: `Bearer ${token}` } });
      setSearchResults(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) {
      setMessage({ type: 'error', text: 'Veuillez sélectionner un client' });
      return;
    }

    setIsLoading(true);
    try {
      const res = await axios.post('/api/orders', {
        customerId: selectedCustomer.id,
        itemDescription,
        estimatedWeight,
        estimatedPrice,
        deposit,
        goldRate,
        createdAt: orderDate
      }, { headers: { Authorization: `Bearer ${token}` } });
      
      setLastCreatedOrderId(res.data.id);
      setMessage({ type: 'success', text: 'Commande enregistrée avec succès!' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Erreur lors de la création de la commande' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinalize = async () => {
    if (!finalizingOrder || !finalWeight || !finalPrice) return;

    setIsLoading(true);
    try {
      const res = await axios.post(`/api/orders/${finalizingOrder.id}/finalize`, {
        finalWeight,
        finalPrice,
        goldRate: finalGoldRate,
        paymentMode
      }, { headers: { Authorization: `Bearer ${token}` } });
      
      setCompletedOrderSaleId(res.data.saleId);
      setMessage({ type: 'success', text: 'Commande finalisée avec succès!' });
      fetchOrders();
    } catch (err) {
      setMessage({ type: 'error', text: 'Erreur lors de la finalisation' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadFinalPDF = async () => {
    if (!completedOrderSaleId) return;
    setIsGeneratingPDF(true);
    try {
      const response = await axios.get(`/api/receipts/${completedOrderSaleId}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      const blobUrl = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      window.open(blobUrl, '_blank');
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Échec de la génération du PDF' });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleUploadAndSend = async (method: 'whatsapp' | 'email' | 'both') => {
    if (!completedOrderSaleId) return;
    setIsSending(true);
    try {
      await axios.post(`/api/receipts/${completedOrderSaleId}/upload`, {}, { headers: { Authorization: `Bearer ${token}` } });
      await axios.post(`/api/notifications/send-receipt`, { 
        saleId: completedOrderSaleId, 
        method 
      }, { headers: { Authorization: `Bearer ${token}` } });
      setMessage({ type: 'success', text: 'Reçu envoyé avec succès!' });
    } catch (err: any) {
      if (err.response?.status === 412) {
        setMessage({ type: 'error', text: 'Configuration manquante — Veuillez configurer vos paramètres Email/WhatsApp.' });
      } else {
        setMessage({ type: 'error', text: 'Erreur lors de l\'envoi du reçu.' });
      }
    } finally {
      setIsSending(false);
    }
  };

  const filteredOrders = (orders || []).filter(o => {
    const search = String(orderSearch || '').toLowerCase();
    const cName = String(o?.customerName || '').toLowerCase();
    const desc = String(o?.itemDescription || '').toLowerCase();
    return cName.includes(search) || desc.includes(search);
  });

  const handlePrintOrder = async (orderId: number) => {
    try {
      const response = await axios.get(`/api/orders/${orderId}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      const blobUrl = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      window.open(blobUrl, '_blank');
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Échec de la génération du PDF' });
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <Package className="text-amber-500" size={32} />
            Commandes Spéciales
          </h1>
          <p className="text-slate-500 font-bold">Gestion des commandes manuelles en attente</p>
        </div>
        <button 
          onClick={() => setView(view === 'list' ? 'create' : 'list')}
          className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black transition-all ${
            view === 'list' ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          {view === 'list' ? <><Plus size={20} /> Nouvelle Commande</> : <><ShoppingCart size={20} /> Voir Liste</>}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {view === 'create' ? (
          <motion.div 
            key="create" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            {/* Left: Customer Selection */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white p-6 rounded-[2rem] shadow-xl border border-slate-100">
                <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2">
                  <User className="text-amber-500" size={20} /> Client (KYC)
                </h3>
                <div className="flex gap-2 mb-6">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input 
                      type="text"
                      placeholder="Chercher Client..."
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 pl-12 pr-4 font-bold outline-none focus:border-amber-400"
                      value={customerSearch}
                      onChange={(e) => {
                        setCustomerSearch(e.target.value);
                        handleCustomerSearch();
                      }}
                    />
                  </div>
                  <button 
                    type="button"
                    onClick={() => setIsCustomerModalOpen(true)}
                    className="p-3 bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-colors shadow-lg shadow-amber-500/20"
                    title="Nouveau Client"
                  >
                    <Plus size={24} />
                  </button>
                </div>
                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                  {searchResults.map((c) => (
                    <div 
                      key={c.id} 
                      onClick={() => setSelectedCustomer(c)}
                      className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                        selectedCustomer?.id === c.id ? 'border-amber-400 bg-amber-50' : 'border-slate-50 hover:border-slate-200'
                      }`}
                    >
                      <p className="font-bold text-slate-900">{c.name}</p>
                      <p className="text-xs text-slate-500">{c.idNumber}</p>
                    </div>
                  ))}
                </div>
                {selectedCustomer && (
                  <div className="mt-6 p-4 bg-emerald-50 text-emerald-700 rounded-2xl flex items-center gap-3">
                    <Check size={20} />
                    <span className="text-sm font-bold">Client: {selectedCustomer.name}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Form */}
            <form onSubmit={handleCreateOrder} className="lg:col-span-2 space-y-8">
              <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-slate-100 space-y-6">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Date de Commande</label>
                  <input 
                    type="date" required
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 font-bold outline-none focus:border-amber-400"
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Détails de la Commande</label>
                  <textarea 
                    rows={4} required
                    placeholder="Décrivez l'article (ex: Collier 22K sculpté, motif fleur...)"
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-4 px-4 font-bold outline-none focus:border-amber-400"
                    value={itemDescription}
                    onChange={(e) => setItemDescription(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Poids Estimé (g)</label>
                    <input 
                      type="number" step="0.01"
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 font-bold outline-none focus:border-amber-400"
                      value={estimatedWeight}
                      onChange={(e) => setEstimatedWeight(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Cours Or Estimé (Rs/g)</label>
                    <input 
                      type="number" step="0.01"
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 font-bold outline-none focus:border-amber-400"
                      value={goldRate}
                      onChange={(e) => setGoldRate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Prix Estimé Total (Rs)</label>
                    <input 
                      type="number"
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 font-bold outline-none focus:border-amber-400"
                      value={estimatedPrice}
                      onChange={(e) => setEstimatedPrice(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Acompte Payé (Rs)</label>
                    <input 
                      type="number" required
                      className="w-full bg-slate-50 border-2 border-amber-200 rounded-xl py-3 px-4 font-bold outline-none focus:border-amber-400 text-amber-600 shadow-sm"
                      value={deposit}
                      onChange={(e) => setDeposit(e.target.value)}
                    />
                  </div>
                </div>

                <div className="p-4 bg-amber-50 rounded-2xl flex gap-3 text-sm text-amber-700">
                  <Info size={18} className="shrink-0" />
                  <p><b>Note:</b> Le poids et le prix final seront saisis lors de la livraison et de la facturation finale. L'acompte sera déduit du total.</p>
                </div>
              </div>

              {message.text && (
                <div className={`p-6 rounded-[2rem] text-center font-bold flex flex-col items-center justify-center gap-4 ${
                  message.type === 'success' ? 'bg-emerald-50 text-emerald-600 border-2 border-emerald-100' : 'bg-red-50 text-red-600'
                }`}>
                  <div className="flex items-center gap-2">
                    {message.type === 'success' ? <CheckCircle2 size={28}/> : <AlertCircle size={28}/>}
                    <span className="text-xl">{message.text}</span>
                  </div>
                  
                  {message.type === 'success' && lastCreatedOrderId && (
                    <div className="flex gap-4 w-full max-w-md">
                      <button 
                        type="button"
                        onClick={() => {
                          handlePrintOrder(lastCreatedOrderId);
                        }}
                        className="flex-1 bg-emerald-600 text-white py-4 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20"
                      >
                        <Package size={20} /> Imprimer Reçu d'Acompte
                      </button>
                      <button 
                        type="button"
                        onClick={() => {
                           setView('list');
                           setMessage({ type: '', text: '' });
                           setLastCreatedOrderId(null);
                           // Reset form
                           setItemDescription('');
                           setEstimatedWeight('');
                           setEstimatedPrice('');
                           setDeposit('');
                           setGoldRate('');
                           setSelectedCustomer(null);
                        }}
                        className="flex-1 bg-white text-slate-600 py-4 rounded-2xl font-black border-2 border-slate-100 hover:bg-slate-50 transition-all"
                      >
                        Retour à la Liste
                      </button>
                    </div>
                  )}
                </div>
              )}

              <button 
                type="submit" 
                disabled={isLoading}
                className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-xl shadow-2xl flex items-center justify-center gap-3 hover:bg-slate-800 transition-all disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="animate-spin" size={24} /> : <>Enregistrer Commande <Check size={24} /></>}
              </button>
            </form>
          </motion.div>
        ) : (
          <motion.div 
            key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6"
          >
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
              <Search className="text-slate-400" size={20} />
              <input 
                type="text" 
                placeholder="Rechercher Commande ou Client..."
                className="flex-1 bg-transparent border-none outline-none font-medium"
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {isLoading ? (
                <div className="col-span-full py-20 text-center"><Loader2 className="animate-spin mx-auto text-amber-500" /></div>
              ) : filteredOrders.length === 0 ? (
                <div className="col-span-full py-20 text-center text-slate-400">Aucune commande trouvée</div>
              ) : (
                filteredOrders.map((order) => (
                  <div key={order.id} className={`bg-white p-6 rounded-3xl shadow-sm border transition-all ${order.status === 'Finalized' ? 'border-emerald-100' : 'border-slate-100 hover:border-amber-200'}`}>
                    <div className="flex justify-between items-start mb-4">
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${order.status === 'Finalized' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                        {order.status === 'Finalized' ? <CheckCircle2 size={24} /> : <Clock size={24} />}
                      </div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{new Date(order.createdAt).toLocaleDateString()}</span>
                    </div>

                    <h4 className="text-lg font-black text-slate-900 mb-1">{order.customerName}</h4>
                    <p className="text-sm font-medium text-slate-500 mb-4 line-clamp-2">{order.itemDescription}</p>

                    {order.status === 'Finalized' ? (
                      <div className="p-4 bg-emerald-50 rounded-2xl space-y-1">
                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Détails de Finalisation</p>
                        <div className="flex justify-between font-bold">
                          <span>{order.finalWeight}g</span>
                          <span>{formatCurrency(order.finalPrice)}</span>
                        </div>
                      </div>
                    ) : (
                      <button 
                        onClick={() => setFinalizingOrder(order)}
                        className="w-full bg-amber-500 text-slate-900 py-3 rounded-xl font-black text-sm hover:bg-amber-400 transition-all flex items-center justify-center gap-2"
                      >
                        Finaliser & Facturer <ShoppingCart size={16} />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <CustomerModal 
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        onSuccess={(customer) => setSelectedCustomer(customer)}
        initialName={customerSearch}
      />

      {/* Finalize Modal */}
      <AnimatePresence>
        {finalizingOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden mx-auto"
            >
              {completedOrderSaleId ? (
                <div className="flex flex-col">
                  <div className="bg-emerald-600 p-10 text-center text-white relative">
                    <div className="absolute top-6 left-1/2 -translate-x-1/2 h-16 w-16 bg-white rounded-full flex items-center justify-center text-emerald-600 shadow-xl">
                      <Check size={36} strokeWidth={4} />
                    </div>
                    <div className="mt-14">
                      <h2 className="text-3xl font-black mb-1">Livraison Confirmée</h2>
                      <p className="text-emerald-100 font-bold opacity-80 uppercase tracking-widest text-xs">Vente N° {completedOrderSaleId}</p>
                    </div>
                  </div>

                  <div className="p-10 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                      <div className="p-6 bg-slate-50 rounded-3xl hover:bg-emerald-50 transition-colors cursor-pointer group" onClick={handleDownloadFinalPDF}>
                        {isGeneratingPDF ? (
                          <Loader2 className="mx-auto text-emerald-600 mb-4 animate-spin" size={32} />
                        ) : (
                          <Download className="mx-auto text-slate-400 mb-4 group-hover:text-emerald-600" size={32} />
                        )}
                        <p className="font-black text-slate-900">Facture Finale</p>
                        <p className="text-xs text-slate-500">Imprimer/Télécharger</p>
                      </div>
                      <div className="p-6 bg-slate-50 rounded-3xl hover:bg-emerald-50 transition-colors cursor-pointer group" onClick={() => handleUploadAndSend('whatsapp')}>
                        <Smartphone className="mx-auto text-slate-400 mb-4 group-hover:text-emerald-600" size={32} />
                        <p className="font-black text-slate-900">WhatsApp</p>
                        <p className="text-xs text-slate-500">Notifier le client</p>
                      </div>
                      <div className="p-6 bg-slate-50 rounded-3xl hover:bg-emerald-50 transition-colors cursor-pointer group" onClick={() => handleUploadAndSend('email')}>
                        <Mail className="mx-auto text-slate-400 mb-4 group-hover:text-emerald-600" size={32} />
                        <p className="font-black text-slate-900">Email</p>
                        <p className="text-xs text-slate-500">Envoi sécurisé</p>
                      </div>
                    </div>

                    {isSending && (
                      <div className="flex items-center justify-center p-4 bg-emerald-50 rounded-2xl">
                        <Loader2 className="animate-spin text-emerald-600 mr-3" />
                        <span className="font-bold text-emerald-600">Envoi en cours...</span>
                      </div>
                    )}

                    {message.text && (
                      <div className={`p-4 rounded-2xl text-center font-bold flex items-center justify-center gap-2 ${
                        message.type === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {message.type === 'success' ? <Check size={20}/> : <AlertCircle size={20}/>}
                        {message.text}
                      </div>
                    )}

                    <div className="pt-8 border-t border-slate-100 flex gap-4">
                      <button 
                        onClick={() => {
                          setFinalizingOrder(null);
                          setCompletedOrderSaleId(null);
                          setMessage({ type: '', text: '' });
                          setView('list');
                        }}
                        className="flex-1 bg-slate-900 text-white py-4 rounded-2xl font-black text-lg hover:shadow-xl transition-all"
                      >
                        Terminer la Session
                      </button>
                      <button 
                        onClick={() => navigate('/sales-history')}
                        className="px-8 bg-slate-100 text-slate-600 py-4 rounded-2xl font-bold flex items-center gap-2 hover:bg-slate-200 transition-all"
                      >
                        <History size={20}/> Ventes
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6 md:p-10 space-y-8 overflow-y-auto max-h-[92vh]">
                  <div className="flex justify-between items-center">
                    <h3 className="text-2xl md:text-3xl font-black text-slate-900">Finalisation Vente</h3>
                    <button onClick={() => setFinalizingOrder(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={28}/></button>
                  </div>

                  <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Commande N° {finalizingOrder.id}</p>
                    <p className="font-bold text-slate-900 text-lg">{finalizingOrder.itemDescription}</p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-black text-slate-400 uppercase mb-2">Poids Final (g)</label>
                          <div className="relative">
                            <Scale className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                            <input 
                              type="number" step="0.01" 
                              className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-4 pl-12 pr-4 font-bold outline-none focus:border-amber-400 transition-all"
                              value={finalWeight}
                              onChange={(e) => setFinalWeight(e.target.value)}
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-black text-slate-400 uppercase mb-2">Cours de l'Or Final (Rs/g)</label>
                          <div className="relative">
                            <Scale className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                            <input 
                              type="number" step="0.01" 
                              className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-4 pl-12 pr-4 font-bold outline-none focus:border-amber-400 transition-all"
                              value={finalGoldRate}
                              onChange={(e) => setFinalGoldRate(e.target.value)}
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-black text-slate-400 uppercase mb-2">Prix TTC Total (Réel)</label>
                        <div className="relative">
                          <Banknote className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={24} />
                          <input 
                            type="number" 
                            className="w-full bg-slate-50 border-2 border-amber-200 rounded-2xl py-6 pl-16 pr-6 font-black text-3xl outline-none focus:border-amber-400 text-slate-900 shadow-inner"
                            value={finalPrice}
                            onChange={(e) => setFinalPrice(e.target.value)}
                            placeholder="0.00"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-black text-slate-400 uppercase mb-4">Mode de Paiement</label>
                        <div className="grid grid-cols-3 gap-3">
                          {['Cash', 'Juice', 'Card'].map(m => (
                            <button 
                              key={m}
                              onClick={() => setPaymentMode(m)}
                              className={`py-4 rounded-xl font-black text-sm border-2 transition-all ${paymentMode === m ? 'bg-slate-900 border-slate-900 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200'}`}
                            >
                              {m}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      {finalizingOrder.deposit && (
                        <div className="p-8 bg-amber-50 rounded-3xl border-2 border-amber-100 space-y-6">
                          <h4 className="font-black text-amber-900 uppercase tracking-wider text-xs">Récapitulatif financier</h4>
                          <div className="space-y-4">
                            <div className="flex justify-between items-center text-lg">
                              <span className="text-slate-500 font-bold">Total Final:</span>
                              <span className="text-slate-900 font-black">{formatCurrency(Number(finalPrice) || 0)}</span>
                            </div>
                            <div className="flex justify-between items-center text-lg">
                              <span className="text-amber-600 font-bold">Acompte Déjà Réglé:</span>
                              <span className="text-amber-600 font-black">- {formatCurrency(Number(finalizingOrder.deposit))}</span>
                            </div>
                            <div className="pt-6 border-t-2 border-amber-200 flex justify-between items-center">
                              <span className="text-slate-900 font-black text-xl">NET À PAYER:</span>
                              <span className="text-4xl font-black text-slate-900">
                                {formatCurrency(Math.max(0, (Number(finalPrice) || 0) - Number(finalizingOrder.deposit)))}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      <button 
                        onClick={handleFinalize}
                        disabled={isLoading || !finalWeight || !finalPrice}
                        className="w-full bg-emerald-600 text-white py-6 rounded-2xl font-black text-xl shadow-2xl shadow-emerald-600/30 hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                      >
                        {isLoading ? <Loader2 className="animate-spin" size={28} /> : <>Finaliser la Vente <CheckCircle2 size={24} /></>}
                      </button>
                      
                      <p className="text-center text-slate-400 text-xs font-bold uppercase tracking-widest">
                        Une facture sera générée automatiquement
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Orders;
