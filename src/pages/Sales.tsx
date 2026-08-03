import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { 
  ShoppingCart, Barcode, User, CreditCard, Search, 
  Plus, Check, AlertCircle, Loader2, Banknote,
  Smartphone, Mail, Download, History, X, UserPlus,
  Scale, Tag, Info, Camera, ArrowLeft, FileText, Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import BarcodeScanner from '../components/BarcodeScanner';
import { formatCurrency, formatItemDetails, getCleanDisplayLabel, getItemFullDescription } from '../lib/utils';
import CustomerModal from '../components/CustomerModal';

const Sales = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [saleStep, setSaleStep] = useState<'item' | 'customer' | 'payment' | 'completed'>('item');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // Scanned Item & Cart State
  const [barcode, setBarcode] = useState('');
  const [scannedItem, setScannedItem] = useState<any>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [cartItems, setCartItems] = useState<Array<{
    id: string | number;
    stockItem: any;
    barcode: string;
    qty: number;
    editedInclusivePrice: string;
    netPrice: number;
    computedDiscountAmount: number;
    computedDiscountPercentage: number;
  }>>([]);
  
  // Stock Search State
  const [stockSearchResults, setStockSearchResults] = useState<any[]>([]);
  
  // Customer State
  const [customerSearch, setCustomerSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);

  // Linked Documents State
  const [linkedOdf, setLinkedOdf] = useState<any>(null);
  const [linkedCommande, setLinkedCommande] = useState<any>(null);
  const [odfSearch, setOdfSearch] = useState('');
  const [commandeSearch, setCommandeSearch] = useState('');
  const [showOdfDropdown, setShowOdfDropdown] = useState(false);
  const [showCommandeDropdown, setShowCommandeDropdown] = useState(false);
  const [odfsList, setOdfsList] = useState<any[]>([]);
  const [commandesList, setCommandesList] = useState<any[]>([]);
  const [customersList, setCustomersList] = useState<any[]>([]);

  // Sale Details
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [chequeNumber, setChequeNumber] = useState('');
  const [finalPrice, setFinalPrice] = useState('');
  const [editedInclusivePrice, setEditedInclusivePrice] = useState('');

  // Cart Calculations using .reduce()
  const totalNetHT = cartItems.reduce((sum, item) => sum + (item.netPrice * item.qty), 0);
  const vatAmount = totalNetHT * 0.15;
  const totalWithVat = totalNetHT * 1.15;
  const totalDiscount = cartItems.reduce((sum, item) => sum + (item.computedDiscountAmount * item.qty), 0);

  const handleAddToCart = (itemToAdd: any, customPriceTtc?: string) => {
    const exists = cartItems.some(ci => ci.stockItem.id === itemToAdd.id || (ci.barcode && ci.barcode === itemToAdd.barcode));
    if (exists) {
      setMessage({ type: 'error', text: 'Cet article est déjà dans le panier.' });
      return;
    }

    const rawPriceTtc = customPriceTtc !== undefined ? customPriceTtc : (itemToAdd.price ? Number(itemToAdd.price).toString() : '0');
    const priceTtcNum = parseFloat(rawPriceTtc);
    const net = !isNaN(priceTtcNum) && priceTtcNum > 0 ? priceTtcNum / 1.15 : 0;
    
    const originalPrice = parseFloat(itemToAdd.price || '0');
    let discAmt = 0;
    let discPct = 0;
    if (originalPrice > 0 && priceTtcNum < originalPrice) {
      discAmt = originalPrice - priceTtcNum;
      discPct = (discAmt / originalPrice) * 100;
    }

    const newItem = {
      id: itemToAdd.id || itemToAdd.barcode || Date.now(),
      stockItem: itemToAdd,
      barcode: itemToAdd.barcode || '',
      qty: 1,
      editedInclusivePrice: rawPriceTtc,
      netPrice: net,
      computedDiscountAmount: discAmt,
      computedDiscountPercentage: discPct,
    };

    setCartItems(prev => [...prev, newItem]);
    setScannedItem(null);
    setBarcode('');
    setEditedInclusivePrice('');
    setFinalPrice('');
    setMessage({ type: '', text: '' });
  };

  const handleRemoveFromCart = (index: number) => {
    setCartItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateCartItemPrice = (index: number, newPriceTtc: string) => {
    setCartItems(prev => prev.map((item, i) => {
      if (i !== index) return item;
      const priceNum = parseFloat(newPriceTtc);
      const net = !isNaN(priceNum) && priceNum > 0 ? priceNum / 1.15 : 0;
      const origPrice = parseFloat(item.stockItem.price || '0');
      let discAmt = 0;
      let discPct = 0;
      if (origPrice > 0 && priceNum < origPrice) {
        discAmt = origPrice - priceNum;
        discPct = (discAmt / origPrice) * 100;
      }
      return {
        ...item,
        editedInclusivePrice: newPriceTtc,
        netPrice: net,
        computedDiscountAmount: discAmt,
        computedDiscountPercentage: discPct
      };
    }));
  };

  useEffect(() => {
    if (saleStep === 'customer' && token) {
      const loadDocuments = async () => {
        try {
          const [odfsRes, ordersRes, custsRes] = await Promise.all([
            axios.get('/api/odf', { headers: { Authorization: `Bearer ${token}` } }),
            axios.get('/api/orders', { headers: { Authorization: `Bearer ${token}` } }),
            axios.get('/api/customers', { headers: { Authorization: `Bearer ${token}` } })
          ]);
          setOdfsList(odfsRes.data);
          setCommandesList(ordersRes.data);
          setCustomersList(custsRes.data);
        } catch (err) {
          console.error("Error loading linked documents lists:", err);
        }
      };
      loadDocuments();
    }
  }, [saleStep, token]);

  const filteredOdfs = odfsList.filter(o => 
    `odf #${o.id}`.toLowerCase().includes(odfSearch.toLowerCase()) || 
    o.customerName?.toLowerCase().includes(odfSearch.toLowerCase()) ||
    (o.amount && o.amount.toString().includes(odfSearch))
  );

  const filteredCommandes = commandesList.filter(c => 
    `commande ${c.orderNumber}`.toLowerCase().includes(commandeSearch.toLowerCase()) || 
    c.customerName?.toLowerCase().includes(commandeSearch.toLowerCase()) ||
    (c.deposit && c.deposit.toString().includes(commandeSearch))
  );

  const handleSelectOdf = (o: any) => {
    setLinkedOdf(o);
    setOdfSearch(`ODF #${o.id} - ${o.customerName}`);
    setShowOdfDropdown(false);
    
    // Auto-fill customer
    const foundCust = customersList.find(c => c.id === o.customerId);
    if (foundCust) {
      setSelectedCustomer(foundCust);
    } else {
      setSelectedCustomer({ id: o.customerId, name: o.customerName });
    }
  };

  const handleSelectCommande = (c: any) => {
    setLinkedCommande(c);
    setCommandeSearch(`Commande N° ${c.orderNumber} - ${c.customerName}`);
    setShowCommandeDropdown(false);

    // Auto-fill customer
    const foundCust = customersList.find(cust => cust.id === c.customerId);
    if (foundCust) {
      setSelectedCustomer(foundCust);
    } else {
      setSelectedCustomer({ id: c.customerId, name: c.customerName });
    }
  };
  
  // Post-Sale State
  const [completedSale, setCompletedSale] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isGeneratingDecl, setIsGeneratingDecl] = useState(false);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (saleStep === 'item' && barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, [saleStep]);

  // Debounce Stock Search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (saleStep === 'item' && barcode) {
        handleStockSearch();
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [barcode, saleStep]);

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
    handleAddToCart(item);
    setStockSearchResults([]);
  };

  const fetchItemByBarcode = async (codeToFetch: string) => {
    if (!codeToFetch) return;
    
    setIsLoading(true);
    try {
      const res = await axios.get(`/api/stock/${codeToFetch}`, { headers: { Authorization: `Bearer ${token}` } });
      handleAddToCart(res.data);
      setIsScannerOpen(false);
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Article non trouvé dans le stock.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBarcodeScan = (e: React.FormEvent) => {
    e.preventDefault();
    fetchItemByBarcode(barcode);
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

  const handleFinalizeSale = async () => {
    if (cartItems.length === 0 || !selectedCustomer) return;
    
    setIsLoading(true);
    try {
      const salePayload = {
        customerId: selectedCustomer.id,
        paymentMode,
        chequeNumber: paymentMode === 'Cheque' ? chequeNumber : null,
        items: cartItems.map(item => ({
          stockId: item.stockItem.id,
          barcode: item.barcode,
          qty: item.qty,
          amount: item.netPrice.toFixed(2),
          unitSalesPrice: item.netPrice.toFixed(2),
          discountAmount: item.computedDiscountAmount > 0 ? item.computedDiscountAmount.toFixed(2) : '0.00',
          discountPercentage: item.computedDiscountPercentage > 0 ? item.computedDiscountPercentage.toFixed(2) : '0.00',
          itemDetails: `${item.stockItem.subCategory || item.stockItem.category || ''} (${item.stockItem.metalType || ''} ${item.stockItem.fineness || ''})`.trim()
        })),
        linkedOdfId: linkedOdf?.id || null,
        linkedCommandeId: linkedCommande?.id || null,
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
      
      const blobUrl = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      window.open(blobUrl, '_blank');
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Échec de la génération du PDF' });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleDownloadDeclarationPDF = async () => {
    if (!completedSale) return;
    setIsGeneratingDecl(true);
    try {
      const response = await axios.get(`/api/receipts/${completedSale.id}/declaration-pdf`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const blobUrl = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      window.open(blobUrl, '_blank');
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Échec de la génération de la Déclaration PDF' });
    } finally {
      setIsGeneratingDecl(false);
    }
  };

  const handleUploadAndSend = async (method: 'whatsapp' | 'email' | 'both') => {
    if (!completedSale) return;
    setIsSending(true);
    try {
      // 1. Upload if not already (backend logic handles it better if we just call the upload endpoint)
      await axios.post(`/api/receipts/${completedSale.id}/upload`, {}, { headers: { Authorization: `Bearer ${token}` } });
      
      // 2. Send (using the unified notification endpoint or the specific one, both have the guard now)
      await axios.post(`/api/notifications/send-receipt`, { 
        saleId: completedSale.id, 
        method 
      }, { headers: { Authorization: `Bearer ${token}` } });
      
      setMessage({ type: 'success', text: 'Reçu envoyé avec succès!' });
    } catch (err: any) {
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
        setMessage({ type: 'error', text: 'Erreur lors de l\'envoi du reçu.' });
      }
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
                      if (!scannedItem) handleStockSearch();
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
                                <p className="font-bold text-slate-900">{getCleanDisplayLabel(item)}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-black text-amber-600 italic">
                                {item.category === 'Jewellery' && item.weightGrams ? `${item.weightGrams}g` : '-'}
                              </p>
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

               {cartItems.length > 0 ? (
                 <div className="space-y-4 border-t border-slate-100 pt-6">
                   <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                     <ShoppingCart className="text-amber-500" size={20} /> Panier d'Achat ({cartItems.length} article{cartItems.length > 1 ? 's' : ''})
                   </h3>
                   <div className="overflow-x-auto">
                     <table className="w-full text-left border-collapse">
                       <thead>
                         <tr className="border-b border-slate-100 text-slate-400 text-xs uppercase font-extrabold pb-3 font-bold">
                           <th className="pb-3 pr-2">Article / Barcode</th>
                           <th className="pb-3 px-2 text-center text-xs">Poids</th>
                           <th className="pb-3 px-2 text-right text-xs">Prix TTC (Rs)</th>
                           <th className="pb-3 pl-2 text-center text-xs">Action</th>
                         </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-50">
                         {cartItems.map((item, idx) => (
                           <tr key={item.id} className="text-sm">
                             <td className="py-4 pr-2 font-bold text-slate-900">
                               <div>{getItemFullDescription(item.stockItem)}</div>
                               <div className="text-xs text-slate-400 font-mono">{item.barcode}</div>
                             </td>
                             <td className="py-4 px-2 text-center font-bold text-amber-600 italic">
                               {item.stockItem.category === 'Jewellery' && item.stockItem.weightGrams ? `${item.stockItem.weightGrams}g` : '-'}
                             </td>
                             <td className="py-4 px-2 text-right">
                               <input 
                                 type="number"
                                 step="0.01"
                                 className="w-28 bg-slate-50 border border-slate-200 rounded-xl py-1 px-2 font-extrabold text-right focus:border-amber-400 outline-none text-slate-900 transition-all font-mono"
                                 value={item.editedInclusivePrice}
                                 onChange={(e) => handleUpdateCartItemPrice(idx, e.target.value)}
                               />
                             </td>
                             <td className="py-4 pl-2 text-center">
                               <button 
                                 onClick={() => handleRemoveFromCart(idx)}
                                 className="text-slate-400 hover:text-red-500 p-2 rounded-lg transition-colors"
                                 title="Supprimer du panier"
                               >
                                 <Trash2 size={18} />
                               </button>
                             </td>
                           </tr>
                         ))}
                       </tbody>
                     </table>
                   </div>

                   <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100 flex-wrap gap-4">
                     <div>
                       <p className="text-xs font-bold text-slate-400 uppercase">Total Net HT</p>
                       <p className="text-lg font-black text-slate-900">{formatCurrency(totalNetHT)}</p>
                     </div>
                     <div>
                       <p className="text-xs font-bold text-slate-400 uppercase">TVA (15%)</p>
                       <p className="text-lg font-black text-amber-600">{formatCurrency(vatAmount)}</p>
                     </div>
                     <div>
                       <p className="text-xs font-bold text-slate-400 uppercase">Total TTC</p>
                       <p className="text-2xl font-black text-slate-900">{formatCurrency(totalWithVat)}</p>
                     </div>
                     <button 
                       onClick={() => setSaleStep('customer')}
                       className="bg-amber-500 text-slate-900 px-6 py-3 rounded-xl font-bold hover:bg-amber-400 transition-all flex items-center gap-2"
                     >
                       Continuer <Plus size={18} />
                     </button>
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
                    <p className="text-slate-400 font-medium">En attente d'un scan ou d'une saisie pour ajouter au panier...</p>
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
                  <button 
                    onClick={() => setIsCustomerModalOpen(true)}
                    className="text-amber-600 font-bold flex items-center gap-2 hover:bg-amber-50 px-4 py-2 rounded-xl transition-all"
                  >
                    <Plus size={18} /> Nouveau Client
                  </button>
               </div>

               {/* Lier à un document existant Section */}
               <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 mb-6 space-y-4">
                  <h3 className="text-sm font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
                     <FileText size={18} className="text-amber-500" />
                     Lier à un document existant
                  </h3>
                  <p className="text-xs text-slate-500 font-medium -mt-2">
                     Liez cette vente à un acompte de commande ou à une reprise (ODF) pour calculer le solde et remplir les détails du client.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     {/* Rechercher ODF */}
                     <div className="relative">
                        <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-widest mb-1">Rechercher ODF</label>
                        <div className="relative">
                           <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                           <input 
                              type="text"
                              placeholder="N° ODF, nom client..."
                              className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-9 pr-8 text-sm font-bold outline-none focus:border-amber-400 transition-all font-mono"
                              value={odfSearch}
                              onChange={(e) => {
                                setOdfSearch(e.target.value);
                                setShowOdfDropdown(true);
                              }}
                              onFocus={() => setShowOdfDropdown(true)}
                              onBlur={() => setTimeout(() => setShowOdfDropdown(false), 200)}
                           />
                           {linkedOdf && (
                             <button 
                               onClick={() => {
                                 setLinkedOdf(null);
                                 setOdfSearch('');
                               }}
                               className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 font-bold"
                             >
                               <X size={16} />
                             </button>
                           )}
                        </div>
                        
                        {showOdfDropdown && filteredOdfs.length > 0 && (
                          <div className="absolute z-10 w-full bg-white border border-slate-200 rounded-xl mt-1 shadow-xl max-h-48 overflow-y-auto divide-y divide-slate-100">
                             {filteredOdfs.map(o => (
                               <div 
                                 key={o.id}
                                 onMouseDown={() => handleSelectOdf(o)}
                                 className="p-3 hover:bg-slate-50 cursor-pointer transition-all flex justify-between items-center text-xs text-slate-700"
                               >
                                  <div className="text-left">
                                     <p className="font-bold text-slate-900 font-mono">ODF #{o.id}</p>
                                     <p className="text-slate-500 font-medium">{o.customerName}</p>
                                  </div>
                                  <span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded font-black font-mono">
                                     {formatCurrency(parseFloat(o.amount || '0'))}
                                  </span>
                               </div>
                             ))}
                          </div>
                        )}
                     </div>

                     {/* Rechercher Commande */}
                     <div className="relative">
                        <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-widest mb-1">Rechercher Commande</label>
                        <div className="relative">
                           <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                           <input 
                              type="text"
                              placeholder="N° Commande, nom client..."
                              className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-9 pr-8 text-sm font-bold outline-none focus:border-amber-400 transition-all font-mono"
                              value={commandeSearch}
                              onChange={(e) => {
                                setCommandeSearch(e.target.value);
                                setShowCommandeDropdown(true);
                              }}
                              onFocus={() => setShowCommandeDropdown(true)}
                              onBlur={() => setTimeout(() => setShowCommandeDropdown(false), 200)}
                           />
                           {linkedCommande && (
                             <button 
                               onClick={() => {
                                 setLinkedCommande(null);
                                 setCommandeSearch('');
                               }}
                               className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 font-bold"
                             >
                               <X size={16} />
                             </button>
                           )}
                        </div>
                        
                        {showCommandeDropdown && filteredCommandes.length > 0 && (
                          <div className="absolute z-10 w-full bg-white border border-slate-200 rounded-xl mt-1 shadow-xl max-h-48 overflow-y-auto divide-y divide-slate-100">
                             {filteredCommandes.map(c => (
                               <div 
                                 key={c.id}
                                 onMouseDown={() => handleSelectCommande(c)}
                                 className="p-3 hover:bg-slate-50 cursor-pointer transition-all flex justify-between items-center text-xs text-slate-700"
                               >
                                  <div className="text-left">
                                     <p className="font-bold text-slate-900 font-mono">Commande N° {c.orderNumber}</p>
                                     <p className="text-slate-500 font-medium">{c.customerName}</p>
                                  </div>
                                  <span className="bg-amber-50 text-amber-700 px-2 py-1 rounded font-black font-mono">
                                     Acompte: {formatCurrency(parseFloat(c.deposit || '0'))}
                                  </span>
                               </div>
                             ))}
                          </div>
                        )}
                     </div>
                  </div>
               </div>

               <div className="space-y-6">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={24} />
                    <input 
                      type="text"
                      placeholder="Rechercher par Nom ou N° ID..."
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 pl-14 pr-4 text-lg font-bold outline-none focus:border-amber-400 transition-all font-mono"
                      value={customerSearch}
                      onChange={(e) => {
                        setCustomerSearch(e.target.value);
                        handleCustomerSearch(e.target.value);
                      }}
                      onFocus={() => handleCustomerSearch()}
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

                  <div className="flex justify-between items-center pt-8 gap-4">
                    <button 
                      onClick={() => setSaleStep('item')}
                      className="px-6 py-4 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-all flex items-center gap-2 border-2 border-slate-100"
                    >
                      <ArrowLeft size={20} /> Retour
                    </button>
                    {selectedCustomer && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
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
               </div>
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
                   <ShoppingCart className="text-amber-500" size={20} /> Panier d'Achat ({cartItems.length} article{cartItems.length > 1 ? 's' : ''})
                 </h3>
                 <div className="overflow-x-auto">
                   <table className="w-full text-left border-collapse">
                     <thead>
                       <tr className="border-b border-slate-100 text-slate-400 text-xs uppercase font-extrabold pb-3 font-bold">
                         <th className="pb-3 pr-2">Article / Barcode</th>
                         <th className="pb-3 px-2 text-center text-xs">Poids</th>
                         <th className="pb-3 px-2 text-right text-xs">Prix TTC (Rs)</th>
                         <th className="pb-3 pl-2 text-center text-xs">Action</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-50">
                       {cartItems.map((item, idx) => (
                         <tr key={item.id} className="text-sm">
                           <td className="py-4 pr-2 font-bold text-slate-900">
                             <div>{getItemFullDescription(item.stockItem)}</div>
                             <div className="text-xs text-slate-400 font-mono">{item.barcode}</div>
                           </td>
                           <td className="py-4 px-2 text-center font-bold text-amber-600 italic">
                             {item.stockItem.category === 'Jewellery' && item.stockItem.weightGrams ? `${item.stockItem.weightGrams}g` : '-'}
                           </td>
                           <td className="py-4 px-2 text-right">
                             <input 
                               type="number"
                               step="0.01"
                               className="w-28 bg-slate-50 border border-slate-200 rounded-xl py-1 px-2 font-extrabold text-right focus:border-amber-400 outline-none text-slate-900 transition-all font-mono"
                               value={item.editedInclusivePrice}
                               onChange={(e) => handleUpdateCartItemPrice(idx, e.target.value)}
                             />
                           </td>
                           <td className="py-4 pl-2 text-center">
                             <button 
                               onClick={() => handleRemoveFromCart(idx)}
                               className="text-slate-400 hover:text-red-500 p-2 rounded-lg transition-colors"
                             >
                               <Trash2 size={18} />
                             </button>
                           </td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 </div>
                 
                 {/* Client display */}
                 <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-center text-sm font-medium">
                   <span className="text-slate-500">Client Facturé:</span>
                   <span className="font-extrabold text-slate-900">{selectedCustomer?.name}</span>
                 </div>
               </div>

               <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-xl">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-bold uppercase text-xs tracking-widest">Sous-Total (Excl. TVA)</span>
                      <span className="text-xl font-bold">{formatCurrency(totalNetHT)}</span>
                    </div>
                    <div className="flex justify-between items-center text-amber-400">
                      <span className="font-bold uppercase text-xs tracking-widest">TVA (15%)</span>
                      <span className="text-xl font-bold">{formatCurrency(vatAmount)}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-300 border-t border-slate-800/60 pt-2">
                      <span className="font-bold uppercase text-xs tracking-widest">Total Brut TTC</span>
                      <span className="text-xl font-bold">{formatCurrency(totalWithVat)}</span>
                    </div>

                    {linkedOdf && (
                      <div className="flex justify-between items-center text-rose-400">
                        <span className="font-bold uppercase text-xs tracking-widest font-mono text-xs">Reprise Trade-In (ODF #{linkedOdf.id})</span>
                        <span className="text-xl font-bold">-{formatCurrency(parseFloat(linkedOdf.amount || '0'))}</span>
                      </div>
                    )}

                    {linkedCommande && (
                      <div className="flex justify-between items-center text-rose-400">
                        <span className="font-bold uppercase text-xs tracking-widest font-mono text-xs">Acompte Reçu (N° {linkedCommande.orderNumber})</span>
                        <span className="text-xl font-bold">-{formatCurrency(parseFloat(linkedCommande.deposit || '0'))}</span>
                      </div>
                    )}

                    <div className="pt-4 border-t border-slate-800 flex justify-between items-center">
                      <span className="text-slate-200 font-black uppercase text-sm tracking-widest">Net À Payer</span>
                      <span className="text-4xl font-black text-white tracking-tighter">
                        {formatCurrency(totalWithVat - (linkedOdf ? parseFloat(linkedOdf.amount || '0') : 0) - (linkedCommande ? parseFloat(linkedCommande.deposit || '0') : 0))}
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
                    <label className="block text-sm font-bold text-slate-700 mb-2">Montant HT Total</label>
                    <div className="relative">
                      <Banknote className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={24} />
                      <input 
                        type="text"
                        disabled
                        className="w-full bg-slate-100 border-2 border-slate-100 rounded-2xl py-4 pl-14 pr-4 text-2xl font-black text-slate-900 outline-none font-mono"
                        value={formatCurrency(totalNetHT)}
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

                  <div className="pt-8 flex flex-col gap-3">
                    <button 
                      onClick={handleFinalizeSale}
                      disabled={isLoading || cartItems.length === 0}
                      className="w-full bg-emerald-600 text-white py-5 rounded-2xl font-black text-xl shadow-2xl flex items-center justify-center gap-3 hover:bg-emerald-700 transition-all disabled:opacity-50"
                    >
                      {isLoading ? <Loader2 className="animate-spin" /> : <>Finaliser & Facturer <PlusCircle size={24}/></>}
                    </button>
                    <button 
                      onClick={() => setSaleStep('item')}
                      className="w-full bg-slate-100 text-slate-600 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-200 transition-all"
                    >
                      <ArrowLeft size={18} /> Retour / Modifier le panier
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
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-center">
                   <div className="p-6 bg-slate-50 rounded-3xl hover:bg-emerald-50 transition-colors cursor-pointer group" onClick={handleDownloadPDF}>
                      {isGeneratingPDF ? (
                        <Loader2 className="mx-auto text-emerald-600 mb-4 animate-spin" size={32} />
                      ) : (
                        <Download className="mx-auto text-slate-400 mb-4 group-hover:text-emerald-600" size={32} />
                      )}
                      <p className="font-black text-slate-900">{isGeneratingPDF ? 'Génération...' : 'Télécharger PDF'}</p>
                      <p className="text-xs text-slate-500 font-medium">{isGeneratingPDF ? 'Veuillez patienter' : 'Impression directe'}</p>
                    </div>
                    <div className="p-6 bg-slate-50 rounded-3xl hover:bg-emerald-50 transition-colors cursor-pointer group" onClick={handleDownloadDeclarationPDF}>
                       {isGeneratingDecl ? (
                         <Loader2 className="mx-auto text-emerald-600 mb-4 animate-spin" size={32} />
                       ) : (
                         <FileText className="mx-auto text-slate-400 mb-4 group-hover:text-emerald-600" size={32} />
                       )}
                       <p className="font-black text-slate-900">{isGeneratingDecl ? 'Génération...' : 'Imprimer Déclaration (Trade-in)'}</p>
                       <p className="text-xs text-slate-500 font-medium">{isGeneratingDecl ? 'Veuillez patienter' : 'Trade-in PDF'}</p>
                    </div>
                    <div className="hidden" style={{display: 'none'}}>
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
                      setLinkedOdf(null);
                      setLinkedCommande(null);
                      setOdfSearch('');
                      setCommandeSearch('');
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

      <CustomerModal 
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        onSuccess={(customer) => {
          setSelectedCustomer(customer);
          setSaleStep('payment');
        }}
        initialName={customerSearch}
      />
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
