import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { 
  History, Search, Filter, Loader2, ArrowLeft,
  Barcode, Tag, User, IndianRupee, Scale, Calendar
} from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';

const SoldItems = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [soldItems, setSoldItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchSoldItems();
  }, []);

  const fetchSoldItems = async () => {
    setIsLoading(true);
    try {
      const res = await axios.get('/api/stock/sold', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSoldItems(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredItems = (soldItems || []).filter(item => {
    const search = String(searchQuery || '').toLowerCase();
    const barcode = String(item?.barcode || '').toLowerCase();
    const customer = String(item?.customerName || '').toLowerCase();
    const category = String(item?.category || '').toLowerCase();
    
    return barcode.includes(search) || customer.includes(search) || category.includes(search);
  });

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <button 
            onClick={() => navigate('/stock')}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold mb-2 transition-colors"
          >
            <ArrowLeft size={18} />
            Retour au Stock
          </button>
          <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
            <History className="text-red-500" size={32} />
            Articles Vendus
          </h1>
          <p className="text-slate-500 font-medium">Historique des sorties d'inventaire</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder="Rechercher par Code-Barres, Client, Catégorie..."
            className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-3 pl-12 pr-4 font-bold outline-none focus:border-red-400 focus:bg-white transition-all underline-offset-4"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">Article & QR</th>
                <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">Client</th>
                <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Date Vente</th>
                <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Prix Vente</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                <tr><td colSpan={4} className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-red-500" size={40} /></td></tr>
              ) : filteredItems.length === 0 ? (
                <tr><td colSpan={4} className="py-20 text-center text-slate-400 font-bold">Aucun article vendu trouvé</td></tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-red-50 text-red-500 rounded-2xl">
                          <Barcode size={24} />
                        </div>
                        <div>
                          <p className="font-black text-slate-900">{item.barcode}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md">{item.category}</span>
                            <span className="text-[10px] font-black uppercase tracking-widest text-red-600">{item.metalType}</span>
                            {item.weightGrams && <span className="text-[10px] font-black text-slate-400 flex items-center gap-1"><Scale size={10}/> {item.weightGrams}g</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2">
                        <User size={16} className="text-slate-400" />
                        <p className="font-bold text-slate-700">{item.customerName || 'Client de Passage'}</p>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-center text-sm font-bold text-slate-500">
                      <div className="flex flex-col items-center">
                        <Calendar size={14} className="mb-1 text-slate-300" />
                        {item.soldAt ? new Date(item.soldAt).toLocaleDateString('fr-FR') : 'N/A'}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <p className="text-lg font-black text-slate-900">{parseFloat(item.price || "0").toLocaleString()} Rs</p>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SoldItems;
