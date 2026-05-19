import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { 
  Scale, User, Camera, Plus, Check, AlertCircle, 
  Loader2, Search, History, Image as ImageIcon,
  X, UserPlus, Info, Tag, Calendar, FileText, Printer, Send, Banknote
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatCurrency } from '../lib/utils';
import CustomerModal from '../components/CustomerModal';

const ODF = () => {
  const { token } = useAuth();
  const [view, setView] = useState<'list' | 'create'>('list');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // List View State
  const [odfRecords, setOdfRecords] = useState<any[]>([]);

  // Form State
  const [customerSearch, setCustomerSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    metalType: 'Gold',
    fineness: '22K',
    weight: '',
    amount: '',
    itemReservedRepair: '',
    description: '',
    parameters: '',
    comments: '',
    createdAt: new Date().toISOString().split('T')[0]
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Success View State
  const [successData, setSuccessData] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (view === 'list') fetchODFRecords();
  }, [view]);

  const fetchODFRecords = async () => {
    setIsLoading(true);
    try {
      const res = await axios.get('/api/odf', { headers: { Authorization: `Bearer ${token}` } });
      setOdfRecords(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportPDF = async (id: number) => {
    try {
      const res = await axios.get(`/api/odf/${id}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      const blobUrl = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      window.open(blobUrl, '_blank');
    } catch (err) {
      console.error("PDF Export Error:", err);
      alert("Erreur lors de l'export PDF");
    }
  };

  const handleSendFull = async (id: number, method: 'whatsapp' | 'email' | 'both') => {
    setIsProcessing(true);
    try {
      // 1. Save locally first
      await axios.post(`/api/odf/${id}/upload`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // 2. Send
      await axios.post(`/api/odf/${id}/send`, { method }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setMessage({ type: 'success', text: `Document envoyé par ${method === 'both' ? 'Email & WhatsApp' : method === 'whatsapp' ? 'WhatsApp' : 'Email'}!` });
    } catch (err: any) {
      console.error("Send Error:", err);
      if (err.response?.status === 412) {
        setMessage({ 
          type: 'error', 
          text: 'Configuration manquante — Veuillez configurer vos paramètres Email/WhatsApp dans les réglages.' 
        });
      } else {
        setMessage({ type: 'error', text: "Erreur lors de l'envoi" });
      }
    } finally {
      setIsProcessing(false);
      setTimeout(() => setMessage({ type: '', text: '' }), 5000); // Increased timeout for reading
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

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) {
      setMessage({ type: 'error', text: 'Veuillez sélectionner un client' });
      return;
    }

    setIsLoading(true);
    try {
      const payload = new FormData();
      payload.append('customerId', selectedCustomer.id);
      payload.append('metalType', formData.metalType);
      payload.append('fineness', formData.fineness);
      payload.append('weight', formData.weight);
      payload.append('amount', formData.amount);
      payload.append('itemReservedRepair', formData.itemReservedRepair);
      payload.append('description', formData.description);
      payload.append('parameters', formData.parameters);
      payload.append('comments', formData.comments);
      payload.append('createdAt', formData.createdAt);
      if (imageFile) payload.append('image', imageFile);

      const res = await axios.post('/api/odf', payload, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      
      setSuccessData(res.data);
      // Removed the view='list' timeout to show modal instead
    } catch (err) {
      setMessage({ type: 'error', text: 'Erreur lors de l’enregistrement ODF' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <Scale className="text-amber-500" size={32} />
            Espace ODF (Trade-ins)
          </h1>
          <p className="text-slate-500 font-bold">Gestion des rachats et échanges de métaux</p>
        </div>
        <button 
          onClick={() => setView(view === 'list' ? 'create' : 'list')}
          className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black transition-all ${
            view === 'list' ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          {view === 'list' ? <><Plus size={20} /> Nouveau Rachat</> : <><History size={20} /> Voir Historique</>}
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
                    <div className="text-sm font-bold">
                      <p>{selectedCustomer.name}</p>
                      <p className="opacity-70 font-medium">Prêt pour ODF</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Form */}
            <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-8">
              <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-slate-100 grid grid-cols-2 gap-6">
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Date du Rachat</label>
                  <input 
                    type="date" required
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 font-bold outline-none focus:border-amber-400"
                    value={formData.createdAt}
                    onChange={(e) => setFormData({...formData, createdAt: e.target.value})}
                  />
                </div>

                <div className="col-span-2 md:col-span-1">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Métal</label>
                  <select 
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 font-bold outline-none focus:border-amber-400"
                    value={formData.metalType}
                    onChange={(e) => setFormData({...formData, metalType: e.target.value})}
                  >
                    <option value="Gold">Or (Gold)</option>
                    <option value="Silver">Argent (Silver)</option>
                    <option value="Platinum">Platine</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Finesse / Karat</label>
                  <input 
                    type="text" required placeholder="Ex: 22K, 916"
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 font-bold outline-none focus:border-amber-400"
                    value={formData.fineness}
                    onChange={(e) => setFormData({...formData, fineness: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Poids (Grammes)</label>
                  <div className="relative">
                    <Scale className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input 
                      type="number" step="0.01" required placeholder="0.00"
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 pl-12 pr-4 font-bold outline-none focus:border-amber-400"
                      value={formData.weight}
                      onChange={(e) => setFormData({...formData, weight: e.target.value})}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Montant du Rachat</label>
                  <div className="relative">
                    <Banknote className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input 
                      type="number" required placeholder="0"
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 pl-12 pr-4 font-bold outline-none focus:border-amber-400"
                      value={formData.amount}
                      onChange={(e) => setFormData({...formData, amount: e.target.value})}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Article Réservé / Réparé</label>
                  <div className="relative">
                    <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input 
                      type="text" placeholder="Bague, Chaîne..."
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 pl-12 pr-4 font-bold outline-none focus:border-amber-400"
                      value={formData.itemReservedRepair}
                      onChange={(e) => setFormData({...formData, itemReservedRepair: e.target.value})}
                    />
                  </div>
                </div>

                <div className="col-span-2 md:col-span-1">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Description de l'Article</label>
                  <input 
                    type="text" placeholder="Détails de l'article..."
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 font-bold outline-none focus:border-amber-400"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Paramètres / Spécifications</label>
                  <input 
                    type="text" placeholder="Tailles, mesures, gravures..."
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 font-bold outline-none focus:border-amber-400"
                    value={formData.parameters}
                    onChange={(e) => setFormData({...formData, parameters: e.target.value})}
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Commentaires / Remarques</label>
                  <textarea 
                    rows={2}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 font-bold outline-none focus:border-amber-400"
                    placeholder="Détails supplémentaires..."
                    value={formData.comments}
                    onChange={(e) => setFormData({...formData, comments: e.target.value})}
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Preuve Photo (N° de Série / Article)</label>
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-100 rounded-2xl p-8 text-center cursor-pointer hover:border-amber-400 hover:bg-amber-50 transition-all group"
                  >
                    {imagePreview ? (
                      <div className="relative inline-block">
                        <img src={imagePreview} alt="Preview" className="h-32 w-auto rounded-xl shadow-lg" />
                        <button 
                          onClick={(e) => { e.stopPropagation(); setImagePreview(null); setImageFile(null); }}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Camera className="mx-auto text-slate-300 group-hover:text-amber-500 transition-colors" size={48} />
                        <p className="text-sm font-bold text-slate-400">Cliquez pour capturer ou uploader une photo</p>
                      </div>
                    )}
                    <input 
                      type="file" accept="image/*" capture="environment" 
                      className="hidden" ref={fileInputRef} 
                      onChange={handleImageChange}
                    />
                  </div>
                </div>
              </div>

              {message.text && (
                <div className={`p-4 rounded-xl text-center font-bold flex items-center justify-center gap-2 ${
                  message.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                }`}>
                  {message.type === 'success' ? <Check size={20} /> : <AlertCircle size={20} />}
                  {message.text}
                </div>
              )}

              <button 
                type="submit" 
                disabled={isLoading}
                className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-xl shadow-2xl flex items-center justify-center gap-3 hover:bg-slate-800 transition-all disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="animate-spin" size={24} /> : <>Enregistrer le Rachat <Check size={24} /></>}
              </button>
            </form>
          </motion.div>
        ) : (
          <motion.div 
            key="list" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Client</th>
                    <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Métal / Finesse</th>
                    <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider text-right">Poids / Montant</th>
                    <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {isLoading ? (
                    <tr><td colSpan={5} className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-amber-500" /></td></tr>
                  ) : odfRecords.length === 0 ? (
                    <tr><td colSpan={5} className="py-20 text-center text-slate-400 font-medium">Aucun enregistrement ODF trouvé</td></tr>
                  ) : (
                    odfRecords.map((record) => (
                      <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-500">{new Date(record.createdAt).toLocaleDateString()}</td>
                        <td className="px-6 py-4">
                          <p className="font-bold text-slate-900">{record.customerName}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${
                            record.metalType === 'Gold' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {record.metalType} {record.fineness}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <p className="font-black text-slate-900">{record.weight}g</p>
                          <p className="font-bold text-emerald-600">-{formatCurrency(record.amount)}</p>
                        </td>
                        <td className="px-6 py-4">
                           <div className="flex items-center gap-3">
                            {record.imageUrl && (
                              <button 
                                onClick={() => window.open(record.imageUrl, '_blank')}
                                className="p-2 bg-slate-50 text-slate-400 hover:text-amber-500 rounded-lg transition-colors"
                                title="Voir Photo"
                              >
                                <ImageIcon size={18} />
                              </button>
                            )}
                            <button 
                              onClick={() => handleExportPDF(record.id)}
                              className="p-2 bg-slate-50 text-slate-400 hover:text-indigo-500 rounded-lg transition-colors"
                              title="Exporter PDF"
                            >
                              <FileText size={18} />
                            </button>
                            <button 
                              onClick={() => handleSendFull(record.id, 'both')}
                              className="p-2 bg-slate-50 text-slate-400 hover:text-emerald-500 rounded-lg transition-colors"
                              title="Envoyer WhatsApp/Email"
                            >
                              <Send size={18} />
                            </button>
                           </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
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

      <AnimatePresence>
        {successData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => { setSuccessData(null); setView('list'); }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white w-full max-w-lg rounded-[3rem] shadow-2xl p-10 text-center"
            >
              <div className="h-24 w-24 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
                <Check size={48} strokeWidth={3} />
              </div>
              
              <h2 className="text-3xl font-black text-slate-900 mb-2">Rachat Enregistré!</h2>
              <p className="text-slate-400 font-bold mb-8 italic">ODF N°: {successData.odfSerialNumber}</p>
              
              <div className="grid grid-cols-2 gap-4 mb-8">
                <button 
                  onClick={() => handleExportPDF(successData.id)}
                  className="flex flex-col items-center gap-3 p-6 bg-slate-50 rounded-3xl hover:bg-slate-100 transition-colors group"
                >
                  <div className="p-3 bg-white rounded-xl shadow-sm text-indigo-500 group-hover:scale-110 transition-transform">
                    <FileText size={24} />
                  </div>
                  <span className="text-xs font-black uppercase text-slate-600">Export PDF</span>
                </button>
                <button 
                  onClick={() => handleSendFull(successData.id, 'both')}
                  disabled={isProcessing}
                  className="flex flex-col items-center gap-3 p-6 bg-slate-50 rounded-3xl hover:bg-slate-100 transition-colors group"
                >
                  <div className="p-3 bg-white rounded-xl shadow-sm text-emerald-500 group-hover:scale-110 transition-transform">
                    {isProcessing ? <Loader2 className="animate-spin" size={24} /> : <Send size={24} />}
                  </div>
                  <span className="text-xs font-black uppercase text-slate-600">Envoyer Tout</span>
                </button>
              </div>

              <button 
                onClick={() => { setSuccessData(null); setView('list'); }}
                className="w-full py-4 text-slate-400 font-black uppercase tracking-widest hover:text-slate-600 transition-colors"
              >
                Retour à l'historique
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ODF;
