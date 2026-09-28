import React, { useRef, useState } from 'react';
import axios from 'axios';
import {
  User, ShieldAlert, FileText, MapPin,
  Phone, Mail, Check, AlertCircle, Loader2,
  X, UserPlus, ScanLine
} from 'lucide-react';
import { scanIdCard, type ScanStage } from '../lib/idCardScanner';
import { motion } from 'motion/react';
import { useDialog } from '../hooks/useDialog';

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (customer: any) => void;
  initialName?: string;
  customerToEdit?: any;
}

const CustomerModal: React.FC<CustomerModalProps> = ({ isOpen, onClose, onSuccess, initialName = '', customerToEdit = null }) => {
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    email: '',
    address: '',
    phoneNumber: '',
    idNumber: '',
    riskRating: 'Low'
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scanStage, setScanStage] = useState<ScanStage | null>(null);
  const [scanned, setScanned] = useState<{ fields: string[]; warnings: string[] } | null>(null);
  const idPhotoInput = useRef<HTMLInputElement>(null);

  // Fills name and ID number from a photo of the customer's ID card. The photo
  // is read on this device and not kept.
  const handleIdPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same photo
    if (!file) return;
    setScanned(null);
    setMessage({ type: '', text: '' });
    try {
      const result = await scanIdCard(file, setScanStage);
      const filled = [result.fullName && 'name', result.idNumber && 'idNumber'].filter(Boolean) as string[];
      setNewCustomer(prev => ({
        ...prev,
        ...(result.fullName ? { name: result.fullName } : {}),
        ...(result.idNumber ? { idNumber: result.idNumber } : {}),
      }));
      if (!result.fullName && !result.idNumber) {
        setMessage({ type: 'error', text: "Carte non lue. Reprenez la photo bien à plat, nette et sans reflet, ou saisissez les informations." });
      } else {
        setScanned({ fields: filled, warnings: result.warnings });
      }
    } catch (err) {
      console.error('ID scan failed:', err);
      setMessage({ type: 'error', text: "La lecture de la carte a échoué. Saisissez les informations manuellement." });
    } finally {
      setScanStage(null);
    }
  };
  const scannedClass = (field: string) => scanned?.fields.includes(field) ? ' ring-2 ring-amber-300' : '';
  const [message, setMessage] = useState({ type: '', text: '' });
  const dialogRef = useDialog(isOpen, onClose);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Use useEffect to reset state when modal opens or editing customer changes
  // This prevents the "overwrite" bug if props change while modal is open
  React.useEffect(() => {
    if (isOpen) {
      if (!hasInitialized) {
        if (customerToEdit) {
          setNewCustomer({
            name: customerToEdit.name || '',
            email: customerToEdit.email || '',
            address: customerToEdit.address || '',
            phoneNumber: customerToEdit.phoneNumber || '',
            idNumber: customerToEdit.idNumber || '',
            riskRating: customerToEdit.riskRating || 'Low'
          });
        } else {
          setNewCustomer({
            name: initialName || '',
            email: '',
            address: '',
            phoneNumber: '',
            idNumber: '',
            riskRating: 'Low'
          });
        }
        setHasInitialized(true);
        setMessage({ type: '', text: '' });
        setScanned(null);
      }
    } else {
      setHasInitialized(false);
      setNewCustomer({
        name: '',
        email: '',
        address: '',
        phoneNumber: '',
        idNumber: '',
        riskRating: 'Low'
      });
    }
  }, [isOpen, customerToEdit, initialName, hasInitialized]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage({ type: '', text: '' });
    try {
      let res;
      if (customerToEdit) {
        res = await axios.put(`/api/customers/${customerToEdit.id}`, newCustomer);
      } else {
        res = await axios.post('/api/customers', newCustomer);
      }
      onSuccess(res.data);
      onClose();
    } catch (err: any) {
      setMessage({ 
        type: 'error', 
        text: err.response?.data?.message || err.response?.data?.error || 'Une erreur est survenue.' 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={customerToEdit ? "Modifier le client" : "Nouveau client"} tabIndex={-1} className="fixed inset-0 z-[100] flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative w-full max-w-xl max-h-[calc(100dvh-3rem)] overflow-y-auto bg-white rounded-[3rem] shadow-2xl"
      >
        <div className="p-5 sm:p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 bg-amber-500 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/30 text-white">
              <UserPlus size={28} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900">Enregistrer Client</h2>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Ajout rapide de conformité</p>
            </div>
          </div>
          <button aria-label="Fermer" 
            onClick={onClose}
            className="p-3 hover:bg-white hover:shadow-md rounded-full transition-all text-slate-400"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-8 space-y-6">
          {message.text && (
            <div className={`p-4 rounded-2xl flex items-center gap-3 font-bold ${message.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
              {message.type === 'success' ? <Check className="shrink-0" /> : <AlertCircle className="shrink-0" />}
              {message.text}
            </div>
          )}

          {/* Scan the ID card to fill the name and ID number */}
          <div className="flex flex-col gap-3">
            <input
              ref={idPhotoInput}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              aria-hidden="true"
              tabIndex={-1}
              onChange={handleIdPhoto}
            />
            <button
              type="button"
              onClick={() => idPhotoInput.current?.click()}
              disabled={scanStage !== null}
              className="flex items-center justify-center gap-3 w-full py-3 rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50 text-amber-700 font-black hover:bg-amber-100 transition-colors disabled:opacity-70"
            >
              {scanStage ? <Loader2 className="animate-spin" size={20} aria-hidden="true" /> : <ScanLine size={20} aria-hidden="true" />}
              {scanStage === 'loading' ? 'Préparation…' : scanStage === 'reading' ? 'Lecture de la carte…' : "Scanner la carte d'identité"}
            </button>
            {!scanned && !scanStage && (
              <p className="text-xs font-medium text-slate-400 text-center">
                Carte à plat, bien éclairée, sans reflet, et qui remplit la photo.
              </p>
            )}
            {scanned && (
              <div role="status" className="p-3 rounded-2xl bg-amber-50 text-amber-800 text-sm font-bold space-y-1">
                <p>Informations lues sur la carte : vérifiez-les avant d'enregistrer.</p>
                {scanned.warnings.map(w => <p key={w} className="font-medium">• {w}</p>)}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label htmlFor="customer-name" className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                Nom Complet <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                <input 
                  id="customer-name"
                  required
                  type="text" 
                  placeholder="Ex: Jean Dupont"
                  className={`w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-3 pl-12 pr-4 font-bold outline-none focus:border-amber-400${scannedClass('name')}`}
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="customer-id" className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                ID / Carte d'Identité (Optionnel)
              </label>
              <div className="relative">
                <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                <input 
                  id="customer-id"
                  type="text" 
                  placeholder="N° de Passeport / CNI"
                  className={`w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-3 pl-12 pr-4 font-bold outline-none focus:border-amber-400 font-mono tracking-tighter${scannedClass('idNumber')}`}
                  value={newCustomer.idNumber}
                  onChange={(e) => setNewCustomer({...newCustomer, idNumber: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="customer-email" className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                Email (Optionnel)
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                <input 
                  id="customer-email"
                  type="email" 
                  placeholder="client@email.com"
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-3 pl-12 pr-4 font-bold outline-none focus:border-amber-400"
                  value={newCustomer.email || ''}
                  onChange={(e) => setNewCustomer({...newCustomer, email: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="customer-phone" className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                Numéro de Téléphone (Optionnel)
              </label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                <input 
                  id="customer-phone"
                  type="text" 
                  placeholder="+230 5555 5555"
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-3 pl-12 pr-4 font-bold outline-none focus:border-amber-400"
                  value={newCustomer.phoneNumber}
                  onChange={(e) => setNewCustomer({...newCustomer, phoneNumber: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="customer-risk" className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Évaluation des Risques</label>
              <div className="relative">
                <ShieldAlert className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                <select 
                  id="customer-risk"
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
              <label htmlFor="customer-address" className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                Adresse Domiciliaire (Optionnel)
              </label>
              <div className="relative">
                <MapPin className="absolute left-4 top-4 text-slate-300" size={20} />
                <textarea 
                  id="customer-address"
                  rows={2}
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
              onClick={onClose}
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
              Enregistrer
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default CustomerModal;
