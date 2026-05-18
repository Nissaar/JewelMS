import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { 
  ShieldAlert, Fingerprint, Clock, User, 
  Search, RefreshCcw, Filter, Loader2,
  Terminal, ShieldCheck, Database
} from 'lucide-react';
import { motion } from 'motion/react';

const AuditLogDetails = ({ data }: { data: any }) => {
  if (!data) return <span className="text-slate-400 italic text-xs">No details</span>;
  
  // If it's a string, just show it
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      if (typeof parsed === 'object') return <AuditLogDetails data={parsed} />;
    } catch {
      return <span className="text-xs">{data}</span>;
    }
  }

  // Handle object display
  if (typeof data === 'object') {
    const keys = Object.keys(data);
    
    // Check if it's a change-set (old/new pairs)
    const isChangeSet = keys.some(k => {
      const val = data[k];
      return val && typeof val === 'object' && ('old' in val || 'new' in val);
    });

    if (isChangeSet) {
      return (
        <ul className="space-y-1 py-1">
          {keys.map(key => {
            const val = data[key];
            if (val && typeof val === 'object' && ('old' in val || 'new' in val)) {
              return (
                <li key={key} className="text-[11px] flex flex-wrap items-center gap-1">
                  <strong className="text-slate-700 capitalize">{key.replace(/([A-Z])/g, ' $1')}:</strong>
                  <span className="text-red-500 line-through decoration-red-200">{val.old === null || val.old === undefined ? 'null' : String(val.old)}</span>
                  <span className="text-slate-400">&rarr;</span>
                  <span className="text-emerald-600 font-bold">{val.new === null || val.new === undefined ? 'null' : String(val.new)}</span>
                </li>
              );
            }
            return (
                <li key={key} className="text-[11px]">
                  <strong className="text-slate-700 capitalize">{key.replace(/([A-Z])/g, ' $1')}:</strong>
                  <span className="ml-1">{JSON.stringify(val)}</span>
                </li>
            );
          })}
        </ul>
      );
    }

    // Default object display
    return (
      <div className="text-[11px] grid grid-cols-1 gap-1 py-1">
        {keys.map(key => (
          <div key={key} className="flex gap-1 truncate">
            <span className="font-black text-slate-700 capitalize shrink-0">{key.replace(/([A-Z])/g, ' $1')}:</span>
            <span className="truncate">{JSON.stringify(data[key])}</span>
          </div>
        ))}
      </div>
    );
  }

  return <span className="text-xs">{String(data)}</span>;
};

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

  const filteredLogs = (logs || []).filter(l => {
    const query = String(searchQuery || '').toLowerCase();
    const username = String(l.username || '').toLowerCase();
    const action = String(l.action || '').toLowerCase();
    const details = typeof l.details === 'object' 
      ? JSON.stringify(l.details).toLowerCase() 
      : String(l.details || '').toLowerCase();
    
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
                      <div className="max-w-md bg-slate-50 p-3 rounded-xl border border-slate-100 overflow-hidden shadow-inner">
                        <AuditLogDetails data={log.details} />
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
