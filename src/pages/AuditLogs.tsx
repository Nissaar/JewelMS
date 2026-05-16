import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { 
  ShieldAlert, Fingerprint, Clock, User, 
  Search, RefreshCcw, Filter, Loader2,
  Terminal, ShieldCheck, Database
} from 'lucide-react';
import { motion } from 'motion/react';

const AuditLogs = () => {
  const { token, user } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const res = await axios.get('/api/audit-logs', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLogs(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredLogs = logs.filter(l => {
    const query = searchQuery.toLowerCase();
    const username = l.username?.toLowerCase() || '';
    const action = l.action?.toLowerCase() || '';
    const details = typeof l.details === 'object' 
      ? JSON.stringify(l.details).toLowerCase() 
      : l.details?.toLowerCase() || '';
    
    return username.includes(query) || action.includes(query) || details.includes(query);
  });

  if (user?.role !== 'Admin') {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <ShieldAlert size={64} className="text-red-500 mb-4" />
        <h1 className="text-2xl font-black text-slate-900">Accès Refusé</h1>
        <p className="text-slate-500">Seuls les administrateurs peuvent consulter les journaux d'audit.</p>
      </div>
    );
  }

  const renderDetails = (details: any) => {
    if (!details) return 'N/A';
    if (typeof details === 'string') return details;
    return JSON.stringify(details);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
            <Fingerprint className="text-purple-600" size={32} />
            Journaux d'Audit
          </h1>
          <p className="text-slate-500 font-medium">Surveillance en temps réel des actions système</p>
        </div>
        <button 
          onClick={fetchLogs}
          className="flex items-center gap-2 bg-white border-2 border-slate-100 px-4 py-2 rounded-xl text-slate-600 font-bold hover:bg-slate-50 transition-all shadow-sm"
        >
          <RefreshCcw size={18} />
          Rafraîchir
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4">
           <div className="h-12 w-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
             <Terminal size={24} />
           </div>
           <div>
             <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Actions</p>
             <p className="text-2xl font-black text-slate-900">{logs.length}</p>
           </div>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4">
           <div className="h-12 w-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
             <ShieldCheck size={24} />
           </div>
           <div>
             <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Dernière Action</p>
             <p className="text-sm font-bold text-slate-900">{logs[0] ? new Date(logs[0].createdAt).toLocaleTimeString() : 'N/A'}</p>
           </div>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4">
           <div className="h-12 w-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
             <Database size={24} />
           </div>
           <div>
             <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Base de Données</p>
             <p className="text-sm font-bold text-slate-900">Actif / Sécurisé</p>
           </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
        <Search className="text-slate-400" size={20} />
        <input 
          type="text" 
          placeholder="Rechercher par utilisateur, action ou détails..."
          className="flex-1 bg-transparent border-none outline-none font-medium"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Horodatage</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Utilisateur</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Action</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Détails</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                <tr><td colSpan={4} className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-amber-500" /></td></tr>
              ) : filteredLogs.length === 0 ? (
                <tr><td colSpan={4} className="py-20 text-center text-slate-400 font-medium">Aucun journal d'audit trouvé</td></tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-slate-400">
                        <Clock size={14} />
                        <span className="text-xs font-bold">{new Date(log.createdAt).toLocaleString()}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 bg-slate-100 rounded-full flex items-center justify-center text-xs font-black text-slate-600">
                          {log.username?.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-bold text-slate-900">{log.username}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                        log.action?.includes('DELETE') ? 'bg-red-100 text-red-600' : 
                        log.action?.includes('CREATE') ? 'bg-emerald-100 text-emerald-600' :
                        log.action?.includes('UPDATE') ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="max-w-md truncate text-sm text-slate-500 font-mono bg-slate-50 p-2 rounded-lg border border-slate-100" title={renderDetails(log.details)}>
                        {renderDetails(log.details)}
                      </div>
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

export default AuditLogs;
