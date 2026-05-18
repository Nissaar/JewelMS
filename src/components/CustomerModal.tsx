import React, { useState } from 'react';
import axios from 'axios';
import { 
  User, ShieldAlert, FileText, MapPin, 
  Phone, Mail, Check, AlertCircle, Loader2, 
  X, UserPlus
} from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (customer: any) => void;
  initialName?: string;
}

const CustomerModal: React.FC<CustomerModalProps> = ({ isOpen, onClose, onSuccess, initialName = '' }) => {
  const { token } = useAuth();
  const [newCustomer, setNewCustomer] = useState({
    name: initialName,
    email: '',
    address: '',
    phoneNumber: '',
    idNumber: '',
    riskRating: 'Low'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage({ type: '', text: '' });
    try {
      const res = await axios.post('/api/customers', newCustomer, {
        headers: { Authorization: `Bearer ${token}` }
      });
      onSuccess(res.data);
      onClose();
    } catch (err: any) {
      setMessage({ 
        type: 'error', 
        text: err.response?.data?.message || err.response?.data?.error || 'Erreur lors de la création du client.' 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
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
        className="relative w-full max-w-xl bg-white rounded-[3rem] shadow-2xl overflow-hidden"
      >
        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 bg-amber-500 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/30 text-white">
              <UserPlus size={28} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900">Enregistrer Client</h2>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Ajout rapide de conformité</p>
            </div>
          </div>
          <button 
            onClick={onClose}
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
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                <input 
                  type="email" 
                  placeholder="client@email.com"
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-3 pl-12 pr-4 font-bold outline-none focus:border-amber-400"
                  value={newCustomer.email || ''}
                  onChange={(e) => setNewCustomer({...newCustomer, email: e.target.value})}
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
