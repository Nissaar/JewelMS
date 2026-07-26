import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { 
  Scale, User, Camera, Plus, Check, AlertCircle, 
  Loader2, Search, History, Image as ImageIcon,
  X, UserPlus, Info, Tag, Calendar, FileText, Printer, Send, Banknote,
  Smartphone, Mail
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatCurrency, formatWeight, formatItemDetails } from '../lib/utils';
import CustomerModal from '../components/CustomerModal';

const ODF = () => {
  const { token } = useAuth();
  const [view, setView] = useState<'list' | 'create' | 'success'>('list');
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
    itemReservedRepair: '',
    description: '',
    comments: '',
    createdAt: new Date().toISOString().split('T')[0]
  });
  const [tradeInItems, setTradeInItems] = useState<Array<{ description: string, mass: string, fineness: string, price: string }>>([
    { description: '', mass: '', fineness: '22K', price: '' }
  ]);
  const [dailyGoldRate, setDailyGoldRate] = useState<number>(3300);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Success View State
  const [successData, setSuccessData] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleResetForm = () => {
    setSelectedCustomer(null);
    setFormData({
      metalType: 'Gold',
      itemReservedRepair: '',
      description: '',
      comments: '',
      createdAt: new Date().toISOString().split('T')[0]
    });
    setTradeInItems([
      { description: '', mass: '', fineness: '22K', price: '' }
    ]);
    setImageFile(null);
    setImagePreview(null);
    setSuccessData(null);
  };

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

  const getPurityFraction = (fineness: string): number => {
    const clean = String(fineness || '').toLowerCase().trim();
    if (clean.includes('24k') || clean.includes('999') || clean.includes('99.9')) return 1.0;
    if (clean.includes('22k') || clean.includes('916') || clean.includes('91.6')) return 0.916;
    if (clean.includes('18k') || clean.includes('750') || clean.includes('75')) return 0.75;
    if (clean.includes('14k') || clean.includes('585') || clean.includes('58.5')) return 0.585;
    if (clean.includes('9k') || clean.includes('375') || clean.includes('37.5')) return 0.375;
    
    const matchFraction = clean.match(/(\d+)\s*\/\s*(\d+)/);
    if (matchFraction) {
      const num = parseInt(matchFraction[1]);
      const den = parseInt(matchFraction[2]);
      if (den > 0) return num / den;
    }
    
    const matchPct = clean.match(/([\d.]+)\s*%/);
    if (matchPct) {
      return parseFloat(matchPct[1]) / 100;
    }
    
    const matchNum = clean.match(/^(\d+)$/);
    if (matchNum) {
      const val = parseInt(matchNum[1]);
      if (val > 100) return val / 1000;
      if (val > 0) return val / 100;
    }
    
    return 0.75; // Default to 18K
  };

  const getMetalRatePerGram = (mType: string): number => {
    const metal = String(mType || 'Gold').toLowerCase().trim();
    if (metal.includes('silver') || metal.includes('argent')) {
      return 60; // Rs 60 per gram of pure silver
    }
    if (metal.includes('platinum') || metal.includes('platine')) {
      return 1800; // Rs 1800 per gram of pure platinum
    }
    return 3300; // Rs 3300 per gram of pure gold
  };

  // When metalType changes, update dailyGoldRate to default value
  useEffect(() => {
    setDailyGoldRate(getMetalRatePerGram(formData.metalType));
  }, [formData.metalType]);

  // Real-time Calculations
  let totalWeight = 0;
  let totalAmount = 0;

  tradeInItems.forEach((item) => {
    const massVal = parseFloat(item.mass || "0");
    const itemValuation = parseFloat(item.price || "0");
    
    totalWeight += massVal;
    totalAmount += itemValuation;
  });

  const handleAddItem = () => {
    setTradeInItems([...tradeInItems, { description: '', mass: '', fineness: '22K', price: '' }]);
  };

  const handleRemoveItem = (index: number) => {
    if (tradeInItems.length > 1) {
      setTradeInItems(tradeInItems.filter((_, i) => i !== index));
    }
  };

  const handleItemChange = (index: number, field: string, value: string) => {
    const updated = [...tradeInItems];
    updated[index] = { ...updated[index], [field]: value };
    setTradeInItems(updated);
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

  const handlePrintDeclaration = async (id: number) => {
    try {
      const res = await axios.get(`/api/odfs/${id}/declaration-pdf`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      const blobUrl = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      window.open(blobUrl, '_blank');
    } catch (err) {
      console.error("Declaration PDF Export Error:", err);
      alert("Erreur lors de l'export de la déclaration de propriété");
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
      } else if (err.response?.status === 400) {
        if (err.response.data?.error === 'CLIENT_EMAIL_MISSING') {
          setMessage({ type: 'error', text: 'Erreur : Veuillez ajouter une adresse email au profil de ce client.' });
        } else {
          setMessage({ type: 'error', text: "Erreur d'envoi. Vérifiez la configuration Brevo." });
        }
      } else {
        setMessage({ type: 'error', text: "Erreur lors de l'envoi" });
      }
    } finally {
      setIsProcessing(false);
      setTimeout(() => setMessage({ type: '', text: '' }), 5000); // Increased timeout for reading
    }
  };

  const handleCustomerSearch = async (query?: string) => {
    const q = query !== undefined ? query : customerSearch;
    try {
      const res = await axios.get(`/api/customers?search=${q}`, { headers: { Authorization: `Bearer ${token}` } });
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
      payload.append('itemReservedRepair', formData.itemReservedRepair);
      payload.append('description', formData.description);
      payload.append('comments', formData.comments);
      payload.append('createdAt', formData.createdAt);
      payload.append('tradeInItems', JSON.stringify(tradeInItems));
      payload.append('appliedRate', dailyGoldRate.toString());
      if (imageFile) payload.append('image', imageFile);

      const res = await axios.post('/api/odf', payload, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      
      setSuccessData(res.data);
      setView('success');
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
          onClick={() => {
            if (view !== 'list') {
              handleResetForm();
              setView('list');
            } else {
              setView('create');
            }
          }}
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
                        handleCustomerSearch(e.target.value);
                      }}
                      onFocus={() => handleCustomerSearch()}
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

                <div className="col-span-2 md:col-span-1">
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

                {/* Dynamic Trade-in Items List */}
                <div className="col-span-2 space-y-4 border-t-2 border-slate-50 pt-6">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider">Articles à échanger (Trade-In Items)</h4>
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white text-xs font-bold rounded-xl hover:bg-amber-600 transition-colors shadow-sm shadow-amber-500/20"
                    >
                      <Plus size={16} /> Ajouter un article
                    </button>
                  </div>

                  <div className="space-y-4">
                    {tradeInItems.map((item, index) => (
                      <div key={index} className="grid grid-cols-12 gap-3 items-end bg-slate-50/50 p-4 rounded-2xl border-2 border-slate-100">
                        <div className="col-span-12 sm:col-span-4">
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Description</label>
                          <input
                            type="text" required placeholder="Ex: Bracelet, Collier..."
                            className="w-full bg-white border-2 border-slate-100 rounded-xl py-2 px-3 text-sm font-bold outline-none focus:border-amber-400"
                            value={item.description}
                            onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                          />
                        </div>

                        <div className="col-span-6 sm:col-span-2">
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Masse (g)</label>
                          <input
                            type="number" step="0.001" required placeholder="0.000"
                            className="w-full bg-white border-2 border-slate-100 rounded-xl py-2 px-3 text-sm font-bold outline-none focus:border-amber-400"
                            value={item.mass}
                            onChange={(e) => handleItemChange(index, 'mass', e.target.value)}
                          />
                        </div>

                        <div className="col-span-6 sm:col-span-2">
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Finesse / Karat</label>
                          <input
                            type="text" required placeholder="Ex: 22K, 750"
                            className="w-full bg-white border-2 border-slate-100 rounded-xl py-2 px-3 text-sm font-bold outline-none focus:border-amber-400"
                            value={item.fineness}
                            onChange={(e) => handleItemChange(index, 'fineness', e.target.value)}
                          />
                        </div>

                        <div className="col-span-12 sm:col-span-3">
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Prix / Valeur Agréée (Rs)</label>
                          <input
                            type="number" step="0.01" required placeholder="0.00"
                            className="w-full bg-white border-2 border-slate-100 rounded-xl py-2 px-3 text-sm font-bold outline-none focus:border-amber-400 font-mono"
                            value={item.price}
                            onChange={(e) => handleItemChange(index, 'price', e.target.value)}
                          />
                        </div>

                        <div className="col-span-12 sm:col-span-1 flex justify-center sm:justify-end pb-1">
                          <button
                            type="button"
                            disabled={tradeInItems.length === 1}
                            onClick={() => handleRemoveItem(index)}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all disabled:opacity-30"
                            title="Supprimer"
                          >
                            <X size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Calculations Live Summary */}
                  <div className="bg-amber-50/50 p-6 rounded-2xl border-2 border-amber-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-6">
                    <div>
                      <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1.5">Rachat / Échange</p>
                      <p className="text-xs font-semibold text-slate-500">Valeur totale calculée d'après les prix manuels saisis pour chaque article.</p>
                    </div>
                    <div className="flex gap-6">
                      <div className="text-right">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Poids Total</p>
                        <p className="text-xl font-black text-slate-900">{formatWeight(totalWeight)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Valeur Agréée Totale</p>
                        <p className="text-xl font-black text-emerald-600">{formatCurrency(totalAmount)}</p>
                      </div>
                    </div>
                  </div>
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
        ) : view === 'success' ? (
          <motion.div 
            key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            className="max-w-2xl mx-auto bg-white p-8 sm:p-12 rounded-[2.5rem] shadow-xl border border-slate-100 text-center space-y-8"
          >
            <div className="h-24 w-24 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <Check size={48} strokeWidth={3} />
            </div>
            
            <div>
              <h2 className="text-3xl font-black text-slate-900 mb-2">ODF Créé avec Succès!</h2>
              <p className="text-slate-500 font-bold">L'enregistrement de rachat a été validé et enregistré.</p>
            </div>
            
            {successData && (
              <div className="bg-slate-50 rounded-2xl p-6 text-left space-y-3 border border-slate-100">
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-400 font-bold text-sm uppercase">N° de Série ODF</span>
                  <span className="font-mono font-black text-slate-900 text-sm">{successData.odfSerialNumber}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-400 font-bold text-sm uppercase">Client</span>
                  <span className="font-bold text-slate-900 text-sm">{selectedCustomer?.name || 'N/A'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-400 font-bold text-sm uppercase">Métal</span>
                  <span className="font-bold text-slate-900 text-sm">{successData.metalType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold text-sm uppercase">Valeur Agréée Totale</span>
                  <span className="font-black text-emerald-600 text-sm">{formatCurrency(successData.amount || totalAmount)}</span>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-4">
              <button 
                onClick={() => handlePrintDeclaration(successData?.id)}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-black shadow-lg transition-all text-base animate-pulse"
              >
                <Printer size={20} /> Imprimer Déclaration de Propriété
              </button>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button 
                  onClick={() => handleExportPDF(successData?.id)}
                  className="flex items-center justify-center gap-2 py-3.5 px-4 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 font-bold transition-all text-sm"
                >
                  <FileText size={18} /> Exporter Fiche PDF
                </button>
                <button 
                  onClick={() => handleSendFull(successData?.id, 'whatsapp')}
                  disabled={isProcessing}
                  className="flex items-center justify-center gap-2 py-3.5 px-4 bg-emerald-50 text-emerald-700 rounded-xl hover:bg-emerald-100 font-bold transition-all text-sm disabled:opacity-50"
                >
                  {isProcessing ? <Loader2 className="animate-spin" size={18} /> : <Smartphone size={18} />} WhatsApp
                </button>
                <button 
                  onClick={() => handleSendFull(successData?.id, 'email')}
                  disabled={isProcessing}
                  className="flex items-center justify-center gap-2 py-3.5 px-4 bg-blue-50 text-blue-700 rounded-xl hover:bg-blue-100 font-bold transition-all text-sm disabled:opacity-50"
                >
                  {isProcessing ? <Loader2 className="animate-spin" size={18} /> : <Mail size={18} />} Email
                </button>
              </div>
            </div>

            <button 
              onClick={() => { handleResetForm(); setView('list'); }}
              className="w-full py-4 text-slate-400 font-black uppercase tracking-widest hover:text-slate-600 transition-colors"
            >
              Retour à l'historique
            </button>
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
                            {formatItemDetails(record.metalType)} {formatItemDetails(record.fineness)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <p className="font-black text-slate-900">{formatWeight(record.weight)}</p>
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
                              onClick={() => handlePrintDeclaration(record.id)}
                              className="p-2 bg-slate-50 text-slate-400 hover:text-amber-500 rounded-lg transition-colors"
                              title="Imprimer Déclaration de Propriété"
                            >
                              <Printer size={18} strokeWidth={2.5} />
                            </button>
                            <button 
                              onClick={() => handleSendFull(record.id, 'whatsapp')}
                              className="p-2 bg-slate-50 text-slate-400 hover:text-emerald-600 rounded-lg transition-colors"
                              title="Envoyer via WhatsApp"
                            >
                              <Smartphone size={18} />
                            </button>
                            <button 
                              onClick={() => handleSendFull(record.id, 'email')}
                              className="p-2 bg-slate-50 text-slate-400 hover:text-blue-500 rounded-lg transition-colors"
                              title="Envoyer via Email"
                            >
                              <Mail size={18} />
                            </button>
                            <button 
                              onClick={() => handleSendFull(record.id, 'both')}
                              className="p-2 bg-slate-50 text-slate-400 hover:text-indigo-500 rounded-lg transition-colors"
                              title="Envoyer via WhatsApp et Email"
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
    </div>
  );
};

export default ODF;
