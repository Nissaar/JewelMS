import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { 
  Users, Search, Plus, MapPin, Phone, 
  ShieldAlert, History, FileText, Package, 
  Scale, X, Loader2, User, ChevronRight,
  TrendingDown, TrendingUp, Minus, UserPlus,
  Check, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatCurrency } from '../lib/utils';

const Customers = () => {
  const { token } = useAuth();
  const [customers, setCustomers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [history, setHistory] = useState<any>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  
  // New Customer Form State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    address: '',
    phoneNumber: '',
    idNumber: '',
    riskRating: 'Low'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [isSearching, setIsSearching] = useState(false);

  // Debounce Search
  useEffect(() => {
    if (search === '') {
      fetchCustomers();
      return;
    }
    
    setIsSearching(true);
    const timer = setTimeout(() => {
      fetchCustomers(search);
      setIsSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  const fetchCustomers = async (query = '') => {
    setIsLoading(true);
    try {
      const res = await axios.get(`/api/customers${query ? `?search=${query}` : ''}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCustomers(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCustomerHistory = async (id: number) => {
    setIsHistoryLoading(true);
    try {
      const res = await axios.get(`/api/customers/${id}/history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHistory(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const openDetails = (customer: any) => {
    setSelectedCustomer(customer);
    fetchCustomerHistory(customer.id);
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage({ type: '', text: '' });
    try {
      await axios.post('/api/customers', newCustomer, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage({ type: 'success', text: 'Client créé avec succès !' });
      setIsCreateModalOpen(false);
      setNewCustomer({
        name: '',
        address: '',
        phoneNumber: '',
        idNumber: '',
        riskRating: 'Low'
      });
      fetchCustomers(search);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || err.response?.data?.error || 'Erreur lors de la création du client.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRiskColor = (rating: string) => {
    switch (rating?.toLowerCase()) {
      case 'high': return 'bg-red-100 text-red-600 border-red-200';
      case 'medium': return 'bg-amber-100 text-amber-600 border-amber-200';
      default: return 'bg-emerald-100 text-emerald-600 border-emerald-200';
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <Users className="text-amber-500" size={32} />
            Répertoire Customers (KYC)
          </h1>
          <p className="text-slate-500 font-bold">Base de données centralisée et historique transactionnel</p>
        </div>
        
        <div className="flex gap-4">
          <div className="flex gap-2">
            <div className="relative">
              {isSearching || isLoading ? (
                <Loader2 className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-500 animate-spin" size={20} />
              ) : (
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              )}
              <input 
                type="text" 
                placeholder="Nom ou N° de Carte..."
                className="bg-slate-50 border-2 border-slate-100 rounded-2xl py-3 pl-12 pr-4 font-bold outline-none focus:border-amber-400 w-64 transition-all"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          
          <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 bg-amber-500 text-white px-6 py-3 rounded-2xl font-black hover:bg-amber-600 shadow-lg shadow-amber-500/20 transition-all whitespace-nowrap"
          >
            <Plus size={20} />
            Ajouter un Client
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <div className="col-span-full py-20 flex justify-center"><Loader2 className="animate-spin text-amber-500" size={48} /></div>
        ) : customers.length === 0 ? (
          <div className="col-span-full py-24 flex flex-col items-center gap-6 bg-white rounded-[3rem] border-4 border-dashed border-slate-100">
            <div className="h-20 w-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
              <Users size={40} />
            </div>
            <div className="text-center">
              <p className="text-xl font-black text-slate-900 uppercase tracking-widest mb-2">Aucun client trouvé</p>
              <p className="text-slate-400 font-bold">Voulez-vous ajouter ce client au système ?</p>
            </div>
            <button 
              onClick={() => {
                setNewCustomer({ ...newCustomer, name: search });
                setIsCreateModalOpen(true);
              }}
              className="mt-4 bg-amber-500 text-white px-10 py-4 rounded-2xl font-black shadow-xl shadow-amber-500/20 hover:bg-amber-600 transition-all flex items-center gap-3"
            >
              <Plus size={24} />
              Ajouter ce client
            </button>
          </div>
        ) : (
          customers.map((c) => (
            <motion.div 
              key={c.id}
              layoutId={`card-${c.id}`}
              onClick={() => openDetails(c)}
              className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 hover:shadow-xl hover:border-amber-100 transition-all cursor-pointer group"
            >
              <div className="flex justify-between items-start mb-6">
                <div className="h-16 w-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-amber-50 group-hover:text-amber-500 transition-colors">
                  <User size={32} />
                </div>
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border ${getRiskColor(c.riskRating)}`}>
                  RISK: {c.riskRating}
                </span>
              </div>

              <div className="space-y-1 mb-6">
                <h3 className="text-xl font-black text-slate-900 truncate">{c.name}</h3>
                <p className="text-sm font-bold text-slate-400 font-mono tracking-tighter uppercase">{c.idNumber}</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3 text-slate-500">
                  <Phone size={16} />
                  <span className="text-xs font-bold">{c.phoneNumber || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-500">
                  <MapPin size={16} />
                  <span className="text-xs font-bold truncate">{c.address || 'N/A'}</span>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Voir Détails</span>
                <ChevronRight className="text-slate-300 group-hover:translate-x-1 transition-transform" size={20} />
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Create Customer Modal */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-xl bg-white rounded-[3rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 bg-amber-500 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/30 text-white">
                    <UserPlus size={28} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900">Nouveau Client KYC</h2>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Enregistrement de conformité</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsCreateModalOpen(false)}
                  className="p-3 hover:bg-white hover:shadow-md rounded-full transition-all text-slate-400"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleCreateCustomer} className="p-8 space-y-6">
                {message.text && (
                  <div className={`p-4 rounded-2xl flex items-center gap-3 font-bold ${message.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                    {message.type === 'success' ? <Check className="shrink-0" /> : <AlertCircle className="shrink-0" />}
                    {message.text}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Nom Complet</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                      <input 
                        required
                        type="text" 
                        placeholder="Ex: Jean Dupont"
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-3 pl-12 pr-4 font-bold outline-none focus:border-amber-400"
                        value={newCustomer.name}
                        onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">ID / Carte d'Identité</label>
                    <div className="relative">
                      <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                      <input 
                        required
                        type="text" 
                        placeholder="N° de Passeport / CNI"
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-3 pl-12 pr-4 font-bold outline-none focus:border-amber-400 font-mono tracking-tighter"
                        value={newCustomer.idNumber}
                        onChange={(e) => setNewCustomer({...newCustomer, idNumber: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Numéro de Téléphone</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                      <input 
                        type="text" 
                        placeholder="+230 5555 5555"
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-3 pl-12 pr-4 font-bold outline-none focus:border-amber-400"
                        value={newCustomer.phoneNumber}
                        onChange={(e) => setNewCustomer({...newCustomer, phoneNumber: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Évaluation des Risques</label>
                    <div className="relative">
                      <ShieldAlert className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                      <select 
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-3 pl-12 pr-4 font-bold outline-none focus:border-amber-400 appearance-none"
                        value={newCustomer.riskRating}
                        onChange={(e) => setNewCustomer({...newCustomer, riskRating: e.target.value})}
                      >
                        <option value="Low">Faible (Low)</option>
                        <option value="Medium">Moyen (Medium)</option>
                        <option value="High">Élevé (High)</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Adresse Domiciliaire</label>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-4 text-slate-300" size={20} />
                      <textarea 
                        rows={3}
                        placeholder="Adresse complète du client..."
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-3 pl-12 pr-4 font-bold outline-none focus:border-amber-400 resize-none"
                        value={newCustomer.address}
                        onChange={(e) => setNewCustomer({...newCustomer, address: e.target.value})}
                      ></textarea>
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="flex-1 bg-slate-50 text-slate-500 py-4 rounded-2xl font-black hover:bg-slate-100 transition-all"
                  >
                    Annuler
                  </button>
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-[2] bg-slate-900 text-white py-4 rounded-2xl font-black hover:bg-slate-800 shadow-xl shadow-slate-900/10 transition-all flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? <Loader2 className="animate-spin" /> : <Check />}
                    Enregistrer le Client
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Details Side-Drawer/Modal */}
      <AnimatePresence>
        {selectedCustomer && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedCustomer(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col"
            >
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 bg-white rounded-2xl flex items-center justify-center border border-slate-200">
                    <User size={24} className="text-slate-400" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900">{selectedCustomer.name}</h2>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{selectedCustomer.idNumber}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedCustomer(null)}
                  className="p-3 hover:bg-white hover:shadow-md rounded-full transition-all text-slate-400"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-12">
                {/* Info Bar */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-6 bg-slate-50 rounded-3xl space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Risque Compliance</p>
                    <div className={`p-3 rounded-xl border text-center font-black ${getRiskColor(selectedCustomer.riskRating)}`}>
                      {selectedCustomer.riskRating}
                    </div>
                  </div>
                  <div className="p-6 bg-slate-50 rounded-3xl space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Coordonnées</p>
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-slate-900 flex items-center gap-2"><Phone size={14} className="text-slate-400" /> {selectedCustomer.phoneNumber}</p>
                      <p className="text-[10px] font-medium text-slate-500 italic truncate">{selectedCustomer.address}</p>
                    </div>
                  </div>
                </div>

                {/* History Sections */}
                <div className="space-y-8">
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-3">
                    <History className="text-amber-500" /> Historique des Transactions
                  </h3>

                  {isHistoryLoading ? (
                    <div className="flex flex-col items-center py-20 gap-4">
                      <Loader2 className="animate-spin text-amber-500" />
                      <p className="text-xs font-black text-slate-400 uppercase">Synchronisation du profil...</p>
                    </div>
                  ) : history && (
                    <div className="space-y-8">
                      {/* Receipts (Sales) */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Achats / Factures</h4>
                          <span className="h-6 px-2 bg-slate-100 rounded-lg text-[10px] flex items-center font-black">{history.receipts.length}</span>
                        </div>
                        <div className="space-y-3">
                          {history.receipts.length === 0 ? <p className="text-sm text-slate-300 italic">Aucun achat enregistré</p> : history.receipts.map((r: any) => (
                            <div key={r.id} className="p-4 border-2 border-slate-50 rounded-2xl flex justify-between items-center hover:border-emerald-100 transition-colors">
                              <div className="flex items-center gap-4">
                                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><TrendingUp size={18} /></div>
                                <div>
                                  <p className="font-bold text-slate-900">{r.barcode ? `${r.barcode} - ` : ''}{r.itemDetails}</p>
                                  <p className="text-[10px] font-black text-slate-400">{r.receiptNo ? `FACTURE #${r.receiptNo}` : 'PAS DE FACTURE'}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-black text-indigo-600">{formatCurrency(r.amount)}</p>
                                <p className="text-[10px] font-bold text-slate-400">{new Date(r.date).toLocaleDateString()}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Orders */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Commandes Spéciales</h4>
                          <span className="h-6 px-2 bg-slate-100 rounded-lg text-[10px] flex items-center font-black">{history.orders.length}</span>
                        </div>
                        <div className="space-y-3">
                          {history.orders.length === 0 ? <p className="text-sm text-slate-300 italic">Aucune commande spéciale</p> : history.orders.map((o: any) => (
                            <div key={o.id} className="p-4 border-2 border-slate-50 rounded-2xl flex justify-between items-center hover:border-amber-100 transition-colors">
                              <div className="flex items-center gap-4">
                                <div className="p-3 bg-amber-50 text-amber-600 rounded-xl"><Package size={18} /></div>
                                <div>
                                  <p className="font-bold text-slate-900 truncate max-w-[250px]">{o.itemDescription}</p>
                                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${o.status === 'Finalized' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>{o.status}</span>
                                </div>
                              </div>
                              <div className="text-right text-[10px] font-bold text-slate-400">
                                {new Date(o.createdAt).toLocaleDateString()}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* ODF Trade-ins */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Rachats / Trade-ins (ODF)</h4>
                          <span className="h-6 px-2 bg-slate-100 rounded-lg text-[10px] flex items-center font-black">{history.odf.length}</span>
                        </div>
                        <div className="space-y-3">
                          {history.odf.length === 0 ? <p className="text-sm text-slate-300 italic">Aucun rachat enregistré</p> : history.odf.map((od: any) => (
                            <div key={od.id} className="p-4 border-2 border-slate-50 rounded-2xl flex justify-between items-center hover:border-indigo-100 transition-colors">
                              <div className="flex items-center gap-4">
                                <div className="p-3 bg-red-50 text-red-600 rounded-xl"><TrendingDown size={18} /></div>
                                <div>
                                  <p className="font-bold text-slate-900">{od.metalType} {od.fineness}</p>
                                  <p className="text-[10px] font-black text-slate-400">{od.weight}g est. {formatCurrency(od.amount || 0)}</p>
                                </div>
                              </div>
                              <div className="text-right text-[10px] font-bold text-slate-400">
                                {new Date(od.date).toLocaleDateString()}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Customers;
