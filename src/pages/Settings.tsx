import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Save, UserPlus, Shield, Check, X, AlertCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const Settings = () => {
  const { token, user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'general' | 'users'>('general');
  const [settings, setSettings] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // User creation state
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', email: '', password: '', role: 'User' });

  // Permissions state
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userPermissions, setUserPermissions] = useState<any[]>([]);

  const functionalities = [
    { id: 'stock', name: 'Gestion du Stock' },
    { id: 'customers', name: 'Fichier Clients (KYC)' },
    { id: 'sales', name: 'Enregistrement des Ventes' },
    { id: 'orders', name: 'Commandes Spéciales' },
    { id: 'reports', name: 'Rapports' },
  ];

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'general') {
        const res = await axios.get('/api/settings', { headers: { Authorization: `Bearer ${token}` } });
        setSettings(res.data);
      } else {
        const res = await axios.get('/api/users', { headers: { Authorization: `Bearer ${token}` } });
        setUsers(res.data);
      }
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Échec de la récupération des données' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateSetting = async (key: string, value: string) => {
    setIsSaving(true);
    try {
      await axios.put(`/api/settings/${key}`, { value }, { headers: { Authorization: `Bearer ${token}` } });
      setMessage({ type: 'success', text: 'Paramètres mis à jour' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Erreur lors de la mise à jour' });
    } finally {
      setIsSaving(false);
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await axios.post('/api/users', newUser, { headers: { Authorization: `Bearer ${token}` } });
      setMessage({ type: 'success', text: 'Utilisateur créé' });
      setShowAddUser(false);
      setNewUser({ username: '', email: '', password: '', role: 'User' });
      fetchData();
    } catch (err) {
      setMessage({ type: 'error', text: 'Erreur lors de la création' });
    } finally {
      setIsSaving(false);
    }
  };

  const fetchPermissions = async (userId: number) => {
    try {
      const res = await axios.get(`/api/users/${userId}/permissions`, { headers: { Authorization: `Bearer ${token}` } });
      // Initialize with all functionalities if empty
      const existing = res.data;
      const merged = functionalities.map(f => {
        const found = existing.find((p: any) => p.functionality === f.id);
        return found || { functionality: f.id, canView: false, canCreate: false, canEdit: false, canDelete: false };
      });
      setUserPermissions(merged);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSavePermissions = async () => {
    if (!selectedUser) return;
    setIsSaving(true);
    try {
      await axios.put(`/api/users/${selectedUser.id}/permissions`, { permissions: userPermissions }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage({ type: 'success', text: 'Permissions mises à jour' });
      setSelectedUser(null);
    } catch (err) {
      setMessage({ type: 'error', text: 'Erreur lors de la sauvegarde' });
    } finally {
      setIsSaving(false);
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    }
  };

  const togglePermission = (funcId: string, action: string) => {
    setUserPermissions(prev => prev.map(p => {
      if (p.functionality === funcId) {
        return { ...p, [action]: !p[action] };
      }
      return p;
    }));
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Paramètres Système</h1>
        {message.text && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center space-x-2 ${
              message.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
            }`}
          >
            {message.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
            <span>{message.text}</span>
          </motion.div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-slate-200 p-1 rounded-2xl mb-8 w-fit">
        <button
          onClick={() => setActiveTab('general')}
          className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'general' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Général
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'users' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Contrôle d'Accès
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-amber-500" size={40} />
        </div>
      ) : (
        <div className="space-y-6">
          {activeTab === 'general' ? (
            <div className="grid grid-cols-1 gap-8">
              {['receipt_heading', 'receipt_policy_wording'].map((key) => {
                const setting = settings.find(s => s.key === key);
                return (
                  <div key={key} className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-slate-800 capitalize">
                        {key.replace(/_/g, ' ')}
                      </h3>
                      <button
                        onClick={() => {
                          const val = (document.getElementById(key) as HTMLTextAreaElement).value;
                          handleUpdateSetting(key, val);
                        }}
                        disabled={isSaving}
                        className="flex items-center space-x-2 bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors disabled:opacity-50"
                      >
                        <Save size={16} />
                        <span>Enregistrer</span>
                      </button>
                    </div>
                    <textarea
                      id={key}
                      defaultValue={setting?.value || ''}
                      rows={key === 'receipt_heading' ? 2 : 10}
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 outline-none focus:border-amber-400 transition-colors font-medium text-slate-700"
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Gestion des Utilisateurs</h3>
                  <p className="text-sm text-slate-500">Gérez les accès et les permissions de votre équipe.</p>
                </div>
                <button
                  onClick={() => setShowAddUser(true)}
                  className="flex items-center space-x-2 bg-amber-500 text-slate-900 px-6 py-3 rounded-xl font-bold hover:bg-amber-400 transition-colors"
                >
                  <UserPlus size={20} />
                  <span>Ajouter un Utilisateur</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {users.map((u) => (
                  <div key={u.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:border-amber-200 transition-all group">
                    <div className="flex items-center justify-between mb-4">
                      <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-900 font-bold group-hover:bg-amber-100 transition-colors">
                        {u.username.charAt(0).toUpperCase()}
                      </div>
                      <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                        u.role === 'Admin' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'
                      }`}>
                        {u.role}
                      </span>
                    </div>
                    <h4 className="text-lg font-bold text-slate-900">{u.username}</h4>
                    <p className="text-sm text-slate-500 mb-6">{u.email}</p>
                    <button
                      onClick={() => { setSelectedUser(u); fetchPermissions(u.id); }}
                      className="w-full flex items-center justify-center space-x-2 py-3 rounded-xl bg-slate-50 text-slate-600 font-bold hover:bg-slate-900 hover:text-white transition-all"
                    >
                      <Shield size={18} />
                      <span>Permissions</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add User Modal */}
      <AnimatePresence>
        {showAddUser && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-2xl font-bold text-slate-900">Nouvel Utilisateur</h3>
                  <button onClick={() => setShowAddUser(false)} className="text-slate-400 hover:text-slate-900">
                    <X size={24} />
                  </button>
                </div>
                <form onSubmit={handleAddUser} className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Nom d'utilisateur</label>
                    <input
                      type="text"
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 outline-none focus:border-amber-400 font-medium"
                      value={newUser.username}
                      onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Email</label>
                    <input
                      type="email"
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 outline-none focus:border-amber-400 font-medium"
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Mot de passe</label>
                    <input
                      type="password"
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 outline-none focus:border-amber-400 font-medium"
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Rôle</label>
                    <select
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 outline-none focus:border-amber-400 font-bold"
                      value={newUser.role}
                      onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                    >
                      <option value="User">Utilisateur</option>
                      <option value="Admin">Administrateur</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl shadow-xl hover:bg-slate-800 transition-all mt-4"
                  >
                    {isSaving ? <Loader2 className="animate-spin mx-auto" /> : "Créer l'utilisateur"}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Permissions Modal */}
      <AnimatePresence>
        {selectedUser && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900">Permissions: {selectedUser.username}</h3>
                    <p className="text-sm text-slate-500 italic">Configuration granulaire des accès</p>
                  </div>
                  <button onClick={() => setSelectedUser(null)} className="text-slate-400 hover:text-slate-900">
                    <X size={24} />
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left py-4 px-2 font-bold text-slate-500 uppercase text-xs tracking-wider">Fonctionnalité</th>
                        <th className="text-center py-4 px-2 font-bold text-slate-500 uppercase text-xs tracking-wider">Voir</th>
                        <th className="text-center py-4 px-2 font-bold text-slate-500 uppercase text-xs tracking-wider">Créer</th>
                        <th className="text-center py-4 px-2 font-bold text-slate-500 uppercase text-xs tracking-wider">Éditer</th>
                        <th className="text-center py-4 px-2 font-bold text-slate-500 uppercase text-xs tracking-wider">Supprimer</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userPermissions.map((p) => (
                        <tr key={p.functionality} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                          <td className="py-4 px-2 font-bold text-slate-800">{functionalities.find(f => f.id === p.functionality)?.name}</td>
                          {['canView', 'canCreate', 'canEdit', 'canDelete'].map((action) => (
                            <td key={action} className="text-center py-4 px-2">
                              <button
                                onClick={() => togglePermission(p.functionality, action)}
                                className={`h-6 w-6 rounded-md border-2 flex items-center justify-center transition-all ${
                                  p[action] ? 'bg-amber-400 border-amber-400 text-slate-900' : 'bg-white border-slate-200'
                                }`}
                              >
                                {p[action] && <Check size={14} strokeWidth={4} />}
                              </button>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex space-x-4 mt-8">
                  <button
                    onClick={handleSavePermissions}
                    disabled={isSaving}
                    className="flex-1 bg-slate-900 text-white font-bold py-4 rounded-2xl shadow-xl hover:bg-slate-800 transition-all flex items-center justify-center space-x-2"
                  >
                    {isSaving ? <Loader2 className="animate-spin" size={20} /> : (
                      <>
                        <Save size={20} />
                        <span>Enregistrer les Permissions</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setSelectedUser(null)}
                    className="flex-1 bg-slate-100 text-slate-600 font-bold py-4 rounded-2xl hover:bg-slate-200 transition-all"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Settings;
