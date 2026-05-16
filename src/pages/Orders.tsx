import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { 
  Package, User, Plus, Check, AlertCircle, 
  Loader2, Search, IndianRupee, Scale, X,
  ShoppingCart, Info, Clock, CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const Orders = () => {
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
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);

  // Finalize Modal State
  const [finalizingOrder, setFinalizingOrder] = useState<any>(null);
  const [finalWeight, setFinalWeight] = useState('');
  const [finalPrice, setFinalPrice] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');

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
      await axios.post('/api/orders', {
        customerId: selectedCustomer.id,
        itemDescription,
        createdAt: orderDate
      }, { headers: { Authorization: `Bearer ${token}` } });
      
      setMessage({ type: 'success', text: 'Commande manuelle enregistrée!' });
      setTimeout(() => setView('list'), 2000);
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
      await axios.post(`/api/orders/${finalizingOrder.id}/finalize`, {
        finalWeight,
        finalPrice,
        paymentMode
      }, { headers: { Authorization: `Bearer ${token}` } });
      
      setMessage({ type: 'success', text: 'Commande finalisée et convertie en vente!' });
      setFinalizingOrder(null);
      fetchOrders();
    } catch (err) {
      setMessage({ type: 'error', text: 'Erreur lors de la finalisation' });
    } finally {
      setIsLoading(false);
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    }
  };

  const filteredOrders = (orders || []).filter(o => {
    const search = String(orderSearch || '').toLowerCase();
    const cName = String(o?.customerName || '').toLowerCase();
    const desc = String(o?.itemDescription || '').toLowerCase();
    return cName.includes(search) || desc.includes(search);
  });

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
                <div className="relative mb-6">
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
                <div className="p-4 bg-amber-50 rounded-2xl flex gap-3 text-sm text-amber-700">
                  <Info size={18} className="shrink-0" />
                  <p><b>Note:</b> Le poids et le prix final seront saisis lors de la livraison et de la facturation finale.</p>
                </div>
              </div>

              {message.text && (
                <div className={`p-4 rounded-xl text-center font-bold flex items-center justify-center gap-2 ${
                  message.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                }`}>
                  {message.type === 'success' ? <Check size={20}/> : <AlertCircle size={20}/>}
                  {message.text}
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
                  <div key={order.id} className={`bg-white p-6 rounded-3xl shadow-sm border transition-all ${order.status === 'Completed' ? 'border-emerald-100' : 'border-slate-100 hover:border-amber-200'}`}>
                    <div className="flex justify-between items-start mb-4">
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${order.status === 'Completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                        {order.status === 'Completed' ? <CheckCircle2 size={24} /> : <Clock size={24} />}
                      </div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{new Date(order.createdAt).toLocaleDateString()}</span>
                    </div>

                    <h4 className="text-lg font-black text-slate-900 mb-1">{order.customerName}</h4>
                    <p className="text-sm font-medium text-slate-500 mb-4 line-clamp-2">{order.itemDescription}</p>

                    {order.status === 'Completed' ? (
                      <div className="p-4 bg-emerald-50 rounded-2xl space-y-1">
                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Détails de Finalisation</p>
                        <div className="flex justify-between font-bold">
                          <span>{order.finalWeight}g</span>
                          <span>{parseFloat(order.finalPrice).toLocaleString()} Rs</span>
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

      {/* Finalize Modal */}
      <AnimatePresence>
        {finalizingOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl p-8 space-y-8"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-black text-slate-900">Finalisation Vente</h3>
                <button onClick={() => setFinalizingOrder(null)} className="p-2 hover:bg-slate-100 rounded-full"><X size={24}/></button>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl">
                 <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Commande N° {finalizingOrder.id}</p>
                 <p className="font-bold text-slate-900">{finalizingOrder.itemDescription}</p>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase mb-2">Poids Final (g)</label>
                    <div className="relative">
                      <Scale className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                      <input 
                        type="number" step="0.01" 
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 pl-12 pr-4 font-bold outline-none focus:border-amber-400"
                        value={finalWeight}
                        onChange={(e) => setFinalWeight(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase mb-2">Prix TTC (Rs)</label>
                    <div className="relative">
                      <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                      <input 
                        type="number" 
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 pl-12 pr-4 font-bold outline-none focus:border-amber-400"
                        value={finalPrice}
                        onChange={(e) => setFinalPrice(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase mb-2">Mode de Paiement</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['Cash', 'Juice', 'Card'].map(m => (
                      <button 
                        key={m}
                        onClick={() => setPaymentMode(m)}
                        className={`py-2 rounded-lg font-bold text-xs border-2 transition-all ${paymentMode === m ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-100 text-slate-600'}`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={handleFinalize}
                  disabled={isLoading || !finalWeight || !finalPrice}
                  className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-emerald-600/20 hover:bg-emerald-700 transition-all disabled:opacity-50"
                >
                  {isLoading ? <Loader2 className="animate-spin mx-auto" /> : 'Confirmer & Facturer'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Orders;
