import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { 
  ShoppingCart, Barcode, User, CreditCard, Search, 
  Plus, Check, AlertCircle, Loader2, Banknote,
  Smartphone, Mail, Download, History, X, UserPlus,
  Scale, Tag, Info, Camera
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import BarcodeScanner from '../components/BarcodeScanner';
import { formatCurrency } from '../lib/utils';

const Sales = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [saleStep, setSaleStep] = useState<'item' | 'customer' | 'payment' | 'completed'>('item');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // Scanned Item State
  const [barcode, setBarcode] = useState('');
  const [scannedItem, setScannedItem] = useState<any>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  
  // Stock Search State
  const [stockSearchResults, setStockSearchResults] = useState<any[]>([]);
  
  // Customer State
  const [customerSearch, setCustomerSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', idNumber: '', phoneNumber: '', email: '', address: '' });
  
  // Sale Details
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [chequeNumber, setChequeNumber] = useState('');
  const [finalPrice, setFinalPrice] = useState('');
  const [vatAmount, setVatAmount] = useState(0);
  const [totalWithVat, setTotalWithVat] = useState(0);
  
  // Post-Sale State
  const [completedSale, setCompletedSale] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (saleStep === 'item' && barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, [saleStep]);

  useEffect(() => {
    if (finalPrice) {
      const price = parseFloat(finalPrice);
      if (!isNaN(price)) {
        const vat = price * 0.15;
        setVatAmount(vat);
        setTotalWithVat(price + vat);
      }
    }
  }, [finalPrice]);

  // Debounce Stock Search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (barcode.length >= 2 && !scannedItem && saleStep === 'item') {
        handleStockSearch();
      } else if (barcode.length < 2) {
        setStockSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [barcode, scannedItem, saleStep]);

  const handleStockSearch = async () => {
    try {
      const res = await axios.get(`/api/stock/autocomplete?q=${barcode}`, { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      setStockSearchResults(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectStockItem = (item: any) => {
    setScannedItem(item);
    setBarcode(item.barcode);
    setStockSearchResults([]);
    setFinalPrice(''); 
    setMessage({ type: '', text: '' });
  };

  const fetchItemByBarcode = async (codeToFetch: string) => {
    if (!codeToFetch) return;
    
    setIsLoading(true);
    setBarcode(codeToFetch);
    try {
      const res = await axios.get(`/api/stock/${codeToFetch}`, { headers: { Authorization: `Bearer ${token}` } });
      setScannedItem(res.data);
      setFinalPrice(''); // Reset price for new item
      setMessage({ type: '', text: '' });
      setIsScannerOpen(false);
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Article non trouvé dans le stock.' });
      setScannedItem(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBarcodeScan = (e: React.FormEvent) => {
    e.preventDefault();
    fetchItemByBarcode(barcode);
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

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await axios.post('/api/customers', newCustomer, { headers: { Authorization: `Bearer ${token}` } });
      setSelectedCustomer(res.data);
      setIsAddingCustomer(false);
      setSaleStep('payment');
    } catch (err) {
      setMessage({ type: 'error', text: 'Erreur lors de la création du client.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinalizeSale = async () => {
    if (!finalPrice || !selectedCustomer || !scannedItem) return;
    
    setIsLoading(true);
    try {
      const salePayload = {
        customerId: selectedCustomer.id,
        barcode: scannedItem.barcode,
        paymentMode,
        chequeNumber: paymentMode === 'Cheque' ? chequeNumber : null,
        qty: 1,
        amount: finalPrice,
        unitSalesPrice: finalPrice,
        itemDetails: `${scannedItem.subCategory} (${scannedItem.metalType} ${scannedItem.fineness})`
      };
      
      const res = await axios.post('/api/sales', salePayload, { headers: { Authorization: `Bearer ${token}` } });
      setCompletedSale(res.data.sale);
      setSaleStep('completed');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Échec de la vente' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!completedSale) return;
    setIsGeneratingPDF(true);
    try {
      const response = await axios.get(`/api/receipts/${completedSale.id}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `facture_${completedSale.id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Échec du téléchargement du PDF' });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleUploadAndSend = async (method: 'whatsapp' | 'email' | 'both') => {
    if (!completedSale) return;
    setIsSending(true);
    try {
      // 1. Upload if not already (backend logic handles it better if we just call the upload endpoint)
      await axios.post(`/api/receipts/${completedSale.id}/upload`, {}, { headers: { Authorization: `Bearer ${token}` } });
      
      // 2. Send
      await axios.post(`/api/receipts/${completedSale.id}/send`, { method }, { headers: { Authorization: `Bearer ${token}` } });
      
      setMessage({ type: 'success', text: 'Reçu envoyé avec succès!' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Erreur lors de l\'envoi du reçu.' });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* Sale Stepper */}
      <div className="mb-10 flex items-center justify-center">
        <div className="flex items-center w-full max-w-2xl">
          {[
            { id: 'item', label: 'Article', icon: Tag },
            { id: 'customer', label: 'Client', icon: User },
            { id: 'payment', label: 'Paiement', icon: CreditCard },
          ].map((s, i) => (
            <React.Fragment key={s.id}>
               <div className="flex flex-col items-center relative">
                 <div className={`h-12 w-12 rounded-2xl flex items-center justify-center transition-all ${
                   saleStep === s.id ? 'bg-amber-500 text-slate-900 shadow-lg scale-110' : 
                   (saleStep === 'completed' || (i === 0 && saleStep !== 'item') || (i === 1 && saleStep === 'payment')) ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'
                 }`}>
                   <s.icon size={20} />
                 </div>
                 <span className={`absolute top-full mt-2 text-xs font-bold whitespace-nowrap ${saleStep === s.id ? 'text-slate-900' : 'text-slate-400'}`}>
                    {s.label}
                 </span>
               </div>
               {i < 2 && <div className={`flex-1 h-1 mx-4 rounded-full ${
                 (i === 0 && (saleStep === 'customer' || saleStep === 'payment' || saleStep === 'completed')) || 
                 (i === 1 && (saleStep === 'payment' || saleStep === 'completed'))
                 ? 'bg-emerald-500' : 'bg-slate-200'
               }`} />}
            </React.Fragment>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* STEP 1: SCAN ITEM */}
        {saleStep === 'item' && (
          <motion.div 
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100">
               <div className="flex items-center justify-between mb-6">
                 <h2 className="text-2xl font-black text-slate-900">Identifier l'Article</h2>
                 <button 
                  onClick={() => setIsScannerOpen(!isScannerOpen)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all ${
                    isScannerOpen ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                  }`}
                 >
                   {isScannerOpen ? <X size={18} /> : <Camera size={18} />}
                   {isScannerOpen ? 'Fermer Scanner' : 'Scanner Barcode'}
                 </button>
               </div>

               <AnimatePresence>
                 {isScannerOpen && (
                   <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden mb-8"
                   >
                     <BarcodeScanner 
                        onScanSuccess={(code) => fetchItemByBarcode(code)}
                        onScanError={(err) => console.log(err)}
                     />
                   </motion.div>
                 )}
               </AnimatePresence>

               <form onSubmit={handleBarcodeScan} className="flex gap-4 mb-8 relative">
                 <div className="relative flex-1">
                   <Barcode className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={24} />
                   <input 
                    ref={barcodeInputRef}
                    type="text"
                    placeholder="Saisir barcode ou catégorie..."
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 pl-14 pr-4 text-lg font-bold outline-none focus:border-amber-400 transition-all font-mono"
                    value={barcode}
                    onChange={(e) => {
                      setBarcode(e.target.value);
                      if (scannedItem) setScannedItem(null); // Clear item if user starts re-typing
                    }}
                    onFocus={() => {
                      if (barcode.length >= 2 && !scannedItem) handleStockSearch();
                    }}
                   />
                   
                   {/* Autocomplete Dropdown */}
                   <AnimatePresence>
                    {stockSearchResults.length > 0 && (
                      <motion.div 
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        className="absolute left-0 right-0 top-full mt-2 bg-white border-2 border-slate-100 rounded-2xl shadow-2xl z-50 overflow-hidden max-h-[300px] overflow-y-auto"
                      >
                        {stockSearchResults.map((item) => (
                          <div 
                            key={item.id}
                            onClick={() => handleSelectStockItem(item)}
                            className="p-4 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0 flex items-center justify-between group transition-colors"
                          >
                            <div className="flex items-center gap-4">
                              <div className="bg-amber-100 text-amber-600 p-2 rounded-lg">
                                <Tag size={18} />
                              </div>
                              <div>
                                <p className="font-bold text-slate-900">{item.subCategory || item.category}</p>
                                <p className="text-xs text-slate-500 font-mono">{item.barcode}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-black text-amber-600 italic">{item.weightGrams ? `${item.weightGrams}g` : 'N/A'}</p>
                              <p className="text-[10px] uppercase font-bold text-slate-400">{item.metalType} {item.fineness}</p>
                            </div>
                          </div>
                        ))}
                      </motion.div>
                    )}
                   </AnimatePresence>
                 </div>
                 <button 
                  type="submit"
                  disabled={isLoading}
                  className="bg-slate-900 text-white px-8 rounded-2xl font-bold hover:bg-slate-800 transition-all disabled:opacity-50 h-[60px]"
                 >
                   {isLoading ? <Loader2 className="animate-spin" /> : 'Rechercher'}
                 </button>
               </form>

               {scannedItem ? (
                 <div className="bg-slate-50 p-6 rounded-2xl border-2 border-amber-100 flex items-start gap-6">
                    <div className="h-24 w-24 bg-white rounded-xl shadow-sm flex items-center justify-center text-amber-500">
                      <ShoppingCart size={48} />
                    </div>
                    <div className="flex-1 grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Détails</p>
                        <p className="text-lg font-black text-slate-900">{scannedItem.subCategory}</p>
                        <p className="text-sm font-medium text-slate-500">{scannedItem.metalType} {scannedItem.fineness}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Code-Barres</p>
                        <p className="text-md font-bold text-slate-900 font-mono">{scannedItem.barcode}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Poids</p>
                        <p className="text-2xl font-black text-amber-600 italic tracking-tighter">{scannedItem.weightGrams}g</p>
                      </div>
                      <div className="flex items-end justify-end">
                        <button 
                          onClick={() => setSaleStep('customer')}
                          className="bg-amber-500 text-slate-900 px-6 py-3 rounded-xl font-bold hover:bg-amber-400 transition-all flex items-center gap-2"
                        >
                          Continuer <Plus size={18} />
                        </button>
                      </div>
                    </div>
                 </div>
               ) : message.text ? (
                 <div className="p-10 text-center space-y-4 border-2 border-dashed border-slate-100 rounded-3xl">
                    <div className="h-20 w-20 bg-red-50 text-red-500 mx-auto rounded-full flex items-center justify-center">
                      <AlertCircle size={40} />
                    </div>
                    <p className="text-lg font-bold text-slate-700">{message.text}</p>
                    <button onClick={() => setBarcode('')} className="text-amber-600 font-bold hover:underline">Réessayer</button>
                 </div>
               ) : (
                 <div className="p-20 text-center space-y-4 border-2 border-dashed border-slate-100 rounded-3xl">
                    <Barcode className="mx-auto text-slate-200" size={64} />
                    <p className="text-slate-400 font-medium">En attente d'un scan ou d'une saisie...</p>
                 </div>
               )}
            </div>
          </motion.div>
        )}

        {/* STEP 2: SELECT CUSTOMER */}
        {saleStep === 'customer' && (
          <motion.div 
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
               <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-black text-slate-900">Identification Client (KYC)</h2>
                  {!isAddingCustomer && (
                    <button 
                      onClick={() => setIsAddingCustomer(true)}
                      className="text-amber-600 font-bold flex items-center gap-2 hover:bg-amber-50 px-4 py-2 rounded-xl transition-all"
                    >
                      <UserPlus size={18} /> Nouveau Client
                    </button>
                  )}
               </div>

               {isAddingCustomer ? (
                 <motion.form 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  onSubmit={handleCreateCustomer} 
                  className="space-y-6 p-6 bg-slate-50 rounded-3xl border-2 border-amber-100"
                 >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Nom Complet</label>
                        <input 
                          type="text" required
                          className="w-full bg-white border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-amber-400 font-bold"
                          value={newCustomer.name}
                          onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">N° National ID / Passeport</label>
                        <input 
                          type="text" required
                          className="w-full bg-white border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-amber-400 font-bold"
                          value={newCustomer.idNumber}
                          onChange={(e) => setNewCustomer({ ...newCustomer, idNumber: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Téléphone</label>
                        <input 
                          type="text" required
                          className="w-full bg-white border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-amber-400 font-bold"
                          value={newCustomer.phoneNumber}
                          onChange={(e) => setNewCustomer({ ...newCustomer, phoneNumber: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Email (Optionnel)</label>
                        <input 
                          type="email"
                          className="w-full bg-white border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-amber-400 font-bold"
                          value={newCustomer.email}
                          onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <button 
                        type="submit" 
                        disabled={isLoading}
                        className="flex-1 bg-slate-900 text-white py-4 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2"
                      >
                        {isLoading ? <Loader2 className="animate-spin" /> : <>Enregistrer & Continuer <Check size={20}/></>}
                      </button>
                      <button 
                        type="button"
                        onClick={() => setIsAddingCustomer(false)}
                        className="px-8 bg-slate-200 text-slate-600 rounded-xl font-bold"
                      >
                        Annuler
                      </button>
                    </div>
                 </motion.form>
               ) : (
                 <div className="space-y-6">
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={24} />
                      <input 
                        type="text"
                        placeholder="Rechercher par Nom ou N° ID..."
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 pl-14 pr-4 text-lg font-bold outline-none focus:border-amber-400 transition-all"
                        value={customerSearch}
                        onChange={(e) => {
                          setCustomerSearch(e.target.value);
                          handleCustomerSearch();
                        }}
                      />
                    </div>

                    <div className="max-h-[300px] overflow-y-auto space-y-3 pr-2">
                       {searchResults.map((c) => (
                         <div 
                           key={c.id} 
                           onClick={() => setSelectedCustomer(c)}
                           className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                             selectedCustomer?.id === c.id ? 'border-amber-400 bg-amber-50 shadow-sm' : 'border-slate-50 hover:border-slate-200'
                           }`}
                         >
                            <div className="flex items-center gap-4">
                              <div className="h-12 w-12 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600">
                                {c.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-bold text-slate-900">{c.name}</p>
                                <p className="text-xs text-slate-500">{c.idNumber}</p>
                              </div>
                            </div>
                            {selectedCustomer?.id === c.id && <Check className="text-amber-500" size={24} />}
                         </div>
                       ))}
                       {customerSearch.length >= 2 && searchResults.length === 0 && (
                         <div className="text-center py-10 text-slate-400 italic">Aucun client trouvé</div>
                       )}
                    </div>

                    {selectedCustomer && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex justify-end pt-4"
                      >
                        <button 
                          onClick={() => setSaleStep('payment')}
                          className="bg-amber-500 text-slate-900 px-8 py-4 rounded-xl font-black text-lg hover:bg-amber-400 transition-all flex items-center gap-2 shadow-xl shadow-amber-500/20"
                        >
                          Valider Client <Check size={24} />
                        </button>
                      </motion.div>
                    )}
                 </div>
               )}
            </div>
          </motion.div>
        )}

        {/* STEP 3: PAYMENT */}
        {saleStep === 'payment' && (
          <motion.div 
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-8"
          >
            {/* Left: Summary */}
            <div className="space-y-6">
               <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100">
                 <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                   <Info className="text-amber-500" size={20} /> Récapitulatif
                 </h3>
                 <div className="space-y-4">
                    <div className="flex justify-between items-center py-3 border-b border-slate-50">
                      <span className="text-slate-500 font-medium">Article</span>
                      <span className="font-black text-slate-900 text-right">{scannedItem.subCategory} ({scannedItem.metalType})</span>
                    </div>
                    <div className="flex justify-between items-center py-3 border-b border-slate-50">
                      <span className="text-slate-500 font-medium">Client</span>
                      <span className="font-black text-slate-900">{selectedCustomer.name}</span>
                    </div>
                    <div className="flex justify-between items-center py-3">
                      <span className="text-slate-500 font-medium">Poids</span>
                      <span className="font-black text-amber-600">{scannedItem.weightGrams}g</span>
                    </div>
                 </div>
               </div>

               <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-xl">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-bold uppercase text-xs tracking-widest">Sous-Total (Excl. TVA)</span>
                      <span className="text-xl font-bold">{finalPrice || '0'}</span>
                    </div>
                    <div className="flex justify-between items-center text-amber-400">
                      <span className="font-bold uppercase text-xs tracking-widest">TVA (15%)</span>
                      <span className="text-xl font-bold">{formatCurrency(vatAmount)}</span>
                    </div>
                    <div className="pt-4 border-t border-slate-800 flex justify-between items-center">
                      <span className="text-slate-200 font-black uppercase text-sm tracking-widest">Total TTC</span>
                      <span className="text-4xl font-black text-white tracking-tighter">
                        {formatCurrency(totalWithVat)}
                      </span>
                    </div>
                  </div>
               </div>
            </div>

            {/* Right: Payment Input */}
            <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100">
               <h2 className="text-2xl font-black text-slate-900 mb-8">Détails du Paiement</h2>
               <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Prix de Vente (Sans TVA)</label>
                    <div className="relative">
                      <Banknote className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={24} />
                      <input 
                        type="number"
                        placeholder="Ex: 5000"
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 pl-14 pr-4 text-2xl font-black text-slate-900 outline-none focus:border-amber-400 transition-all font-mono"
                        value={finalPrice}
                        onChange={(e) => setFinalPrice(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Mode de Paiement</label>
                    <div className="grid grid-cols-2 gap-3">
                      {['Cash', 'Juice', 'Card', 'Bank Transfer', 'Cheque'].map((mode) => (
                        <button 
                          key={mode}
                          onClick={() => setPaymentMode(mode)}
                          className={`py-3 px-4 rounded-xl text-sm font-bold transition-all border-2 ${
                            paymentMode === mode ? 'bg-slate-900 border-slate-900 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-600 hover:border-amber-200'
                          }`}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>

                  {paymentMode === 'Cheque' && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                       <label className="block text-sm font-bold text-slate-700 mb-2">N° de Chèque</label>
                       <input 
                        type="text"
                        placeholder="Entrez le numéro du chèque..."
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-4 font-bold outline-none focus:border-amber-400 transition-all"
                        value={chequeNumber}
                        onChange={(e) => setChequeNumber(e.target.value)}
                       />
                    </motion.div>
                  )}

                  <div className="pt-8">
                    <button 
                      onClick={handleFinalizeSale}
                      disabled={isLoading || !finalPrice}
                      className="w-full bg-emerald-600 text-white py-5 rounded-2xl font-black text-xl shadow-2xl flex items-center justify-center gap-3 hover:bg-emerald-700 transition-all disabled:opacity-50"
                    >
                      {isLoading ? <Loader2 className="animate-spin" /> : <>Finaliser & Facturer <PlusCircle size={24}/></>}
                    </button>
                  </div>
               </div>
            </div>
          </motion.div>
        )}

        {/* STEP 4: COMPLETED */}
        {saleStep === 'completed' && completedSale && (
          <motion.div 
            key="step4"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[3rem] shadow-2xl overflow-hidden border border-slate-100"
          >
             <div className="bg-emerald-600 p-12 text-center text-white relative">
                <div className="absolute top-8 left-1/2 -translate-x-1/2 h-20 w-20 bg-white rounded-full flex items-center justify-center text-emerald-600 shadow-xl">
                   <Check size={48} strokeWidth={4} />
                </div>
                <div className="mt-20">
                  <h2 className="text-4xl font-black tracking-tight mb-2">Vente Réussie !</h2>
                  <p className="text-emerald-100 font-bold opacity-80 uppercase tracking-widest text-sm">Facture N° {completedSale.id}</p>
                </div>
             </div>

             <div className="p-12 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                   <div className="p-6 bg-slate-50 rounded-3xl hover:bg-emerald-50 transition-colors cursor-pointer group" onClick={handleDownloadPDF}>
                      {isGeneratingPDF ? (
                        <Loader2 className="mx-auto text-emerald-600 mb-4 animate-spin" size={32} />
                      ) : (
                        <Download className="mx-auto text-slate-400 mb-4 group-hover:text-emerald-600" size={32} />
                      )}
                      <p className="font-black text-slate-900">{isGeneratingPDF ? 'Génération...' : 'Télécharger PDF'}</p>
                      <p className="text-xs text-slate-500 font-medium">{isGeneratingPDF ? 'Veuillez patienter' : 'Impression directe'}</p>
                   </div>
                   <div className="p-6 bg-slate-50 rounded-3xl hover:bg-emerald-50 transition-colors cursor-pointer group" onClick={() => handleUploadAndSend('whatsapp')}>
                      <Smartphone className="mx-auto text-slate-400 mb-4 group-hover:text-emerald-600" size={32} />
                      <p className="font-black text-slate-900">WhatsApp</p>
                      <p className="text-xs text-slate-500 font-medium">Envoyer au client</p>
                   </div>
                   <div className="p-6 bg-slate-50 rounded-3xl hover:bg-emerald-50 transition-colors cursor-pointer group" onClick={() => handleUploadAndSend('email')}>
                      <Mail className="mx-auto text-slate-400 mb-4 group-hover:text-emerald-600" size={32} />
                      <p className="font-black text-slate-900">Email</p>
                      <p className="text-xs text-slate-500 font-medium">Envoi automatique</p>
                   </div>
                </div>

                {isSending && (
                   <div className="flex items-center justify-center p-4 bg-emerald-50 rounded-2xl">
                      <Loader2 className="animate-spin text-emerald-600 mr-3" />
                      <span className="font-bold text-emerald-600">Traitement de l'envoi...</span>
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
                      setSaleStep('item');
                      setScannedItem(null);
                      setSelectedCustomer(null);
                      setBarcode('');
                      setCompletedSale(null);
                      setMessage({ type: '', text: '' });
                    }}
                    className="flex-1 bg-slate-900 text-white py-4 rounded-2xl font-black text-lg hover:shadow-xl transition-all"
                   >
                     Nouvelle Vente
                   </button>
                   <button 
                    onClick={() => navigate('/sales-history')}
                    className="px-8 bg-slate-100 text-slate-600 py-4 rounded-2xl font-bold flex items-center gap-2 hover:bg-slate-200 transition-all"
                   >
                     <History size={20}/> Historique
                   </button>
                </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const PlusCircle = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8v8" />
    <path d="M8 12h8" />
  </svg>
);

export default Sales;
