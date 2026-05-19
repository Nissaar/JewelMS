import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePWA } from '../context/PWAContext';
import axios from 'axios';
import { Save, UserPlus, Shield, Check, X, AlertCircle, Loader2, Download, Smartphone, Monitor } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const Settings = () => {
  const { token, user: currentUser } = useAuth();
  const { isInstallable, installApp } = usePWA();
  const [activeTab, setActiveTab] = useState<'general' | 'users' | 'pwa'>('general');
  const [settings, setSettings] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // User creation/edit state
  const [showAddUser, setShowAddUser] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', email: '', password: '', role: 'User' });
  const [editingUser, setEditingUser] = useState<any>(null);

  // Permissions state
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]); // format: "funcId:action"

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
      const perms: string[] = [];
      res.data.forEach((p: any) => {
        if (p.canView) perms.push(`${p.functionality}:canView`);
        if (p.canCreate) perms.push(`${p.functionality}:canCreate`);
        if (p.canEdit) perms.push(`${p.functionality}:canEdit`);
        if (p.canDelete) perms.push(`${p.functionality}:canDelete`);
      });
      setSelectedPermissions(perms);
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditUser = (user: any) => {
    setEditingUser(user);
    fetchPermissions(user.id);
    setIsEditModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setIsSaving(true);
    try {
      // 1. Update basic info (role/email)
      await axios.put(`/api/users/${editingUser.id}`, {
        email: editingUser.email,
        role: editingUser.role
      }, { headers: { Authorization: `Bearer ${token}` } });

      // 2. Prepare permissions objects for backend
      const permsToSave = functionalities.map(f => {
        return {
          functionality: f.id,
          canView: selectedPermissions.includes(`${f.id}:canView`),
          canCreate: selectedPermissions.includes(`${f.id}:canCreate`),
          canEdit: selectedPermissions.includes(`${f.id}:canEdit`),
          canDelete: selectedPermissions.includes(`${f.id}:canDelete`),
        };
      });

      // 3. Update permissions
      await axios.put(`/api/users/${editingUser.id}/permissions`, { permissions: permsToSave }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setMessage({ type: 'success', text: 'Utilisateur mis à jour' });
      setIsEditModalOpen(false);
      fetchData();
    } catch (err) {
      setMessage({ type: 'error', text: 'Erreur lors de la mise à jour' });
    } finally {
      setIsSaving(false);
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    }
  };

  const togglePermission = (permId: string) => {
    setSelectedPermissions(prev => 
      prev.includes(permId) ? prev.filter(p => p !== permId) : [...prev, permId]
    );
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
        <button
          onClick={() => setActiveTab('pwa')}
          className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'pwa' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          App Mobile & Bureau
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
          ) : activeTab === 'users' ? (
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
                      onClick={() => handleEditUser(u)}
                      className="w-full flex items-center justify-center space-x-2 py-3 rounded-xl bg-slate-50 text-slate-600 font-bold hover:bg-slate-900 hover:text-white transition-all underline decoration-amber-400 decoration-2 underline-offset-4"
                    >
                      <Shield size={18} />
                      <span>Éditer l'Accès</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl space-y-8">
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                <div className="flex items-center space-x-4 mb-6">
                  <div className="h-14 w-14 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center">
                    <Smartphone size={32} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900">Installation Standalone</h3>
                    <p className="text-slate-500 font-medium">Installez Haujee Jewellery comme une application native pour une expérience optimale.</p>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="bg-slate-50 p-10 rounded-[2rem] border border-slate-100 flex flex-col items-center text-center space-y-6">
                    <div className="h-24 w-24 bg-white rounded-3xl flex items-center justify-center text-amber-500 shadow-xl shadow-amber-500/10 border border-slate-100">
                      <Smartphone size={48} />
                    </div>
                    
                    <div className="max-w-md">
                      <h4 className="text-xl font-black text-slate-900">Application Officielle</h4>
                      <p className="text-slate-500 font-medium mt-2">
                        L'installation permet d'accéder à l'application sans barres de recherche, avec des performances accrues et un accès direct depuis votre écran d'accueil.
                      </p>
                    </div>

                    {isInstallable ? (
                      <button 
                        onClick={installApp}
                        className="w-full max-w-sm bg-slate-900 text-white py-5 rounded-2xl font-black text-lg shadow-2xl shadow-slate-900/20 hover:bg-slate-800 transition-all flex items-center justify-center gap-3 animate-bounce-subtle"
                      >
                        <Download size={24} /> Installer sur cet appareil
                      </button>
                    ) : (
                      <div className="bg-emerald-50 text-emerald-700 px-8 py-4 rounded-2xl font-bold border border-emerald-100 flex items-center gap-3">
                        <Check size={20} /> Application déjà installée ou non supportée
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white p-6 rounded-3xl border border-slate-100">
                      <h5 className="font-black text-slate-900 mb-2 flex items-center gap-2">
                        <Smartphone size={16} className="text-slate-400" /> Mobile / Tablette
                      </h5>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Sur iOS: Utilisez "Ajouter à l'écran d'accueil" dans le menu de partage de Safari.<br/>
                        Sur Android: Appuyez sur le bouton "Installer" ci-dessus ou via le menu Chrome.
                      </p>
                    </div>
                    <div className="bg-white p-6 rounded-3xl border border-slate-100">
                      <h5 className="font-black text-slate-900 mb-2 flex items-center gap-2">
                        <Monitor size={16} className="text-slate-400" /> Bureau / PC
                      </h5>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Utilisez Chrome ou Edge et cliquez sur l'icône d'installation dans la barre d'adresse pour transformer l'onglet en fenêtre indépendante.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white">
                <h4 className="font-bold mb-4 flex items-center gap-2">
                  <Shield size={20} className="text-amber-500" /> 
                  Avantages du mode Standalone
                </h4>
                <div className="grid grid-cols-1 gap-4 text-slate-400 text-sm">
                  <div className="flex items-start space-x-3">
                    <div className="h-5 w-5 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center flex-shrink-0 mt-0.5">✓</div>
                    <p>Accès immédiat dès le démarrage de l'appareil.</p>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="h-5 w-5 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center flex-shrink-0 mt-0.5">✓</div>
                    <p>Interface plein écran sans distractions de navigation.</p>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="h-5 w-5 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center flex-shrink-0 mt-0.5">✓</div>
                    <p>Rapidité de chargement optimisée via le cache local.</p>
                  </div>
                </div>
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

      {/* Edit User & Permissions Modal */}
      <AnimatePresence>
        {isEditModalOpen && editingUser && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 flex-shrink-0">
                <div className="flex items-center space-x-4">
                  <div className="h-14 w-14 bg-amber-500 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-amber-500/20">
                    <Shield size={28} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900">Éditer: {editingUser.username}</h3>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Configuration des accès système</p>
                  </div>
                </div>
                <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-white hover:shadow-md rounded-full transition-all">
                  <X size={24} className="text-slate-400" />
                </button>
              </div>

              <div className="p-8 lg:p-10 overflow-y-auto flex-1">
                <form onSubmit={handleSaveUser} className="space-y-10">
                  {/* Basic Info Section */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-slate-50 p-6 rounded-3xl border border-slate-100">
                    <div className="space-y-2">
                       <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Email de l'utilisateur</label>
                       <input 
                         type="email"
                         className="w-full bg-white border-2 border-slate-100 rounded-2xl p-4 outline-none focus:border-amber-400 font-bold"
                         value={editingUser.email}
                         onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Rôle Principal</label>
                       <select 
                         className="w-full bg-white border-2 border-slate-100 rounded-2xl p-4 outline-none focus:border-amber-400 font-bold appearance-none"
                         value={editingUser.role}
                         onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                       >
                         <option value="User">Utilisateur (Standard)</option>
                         <option value="Admin">Administrateur (Complet)</option>
                       </select>
                    </div>
                  </div>

                  {/* Permissions Section */}
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xl font-black text-slate-900 px-1">Permissions Granulaires</h4>
                      <div className="h-1 flex-1 mx-6 bg-slate-100 rounded-full hidden sm:block"></div>
                    </div>
                    
                    <div className="bg-white rounded-3xl border-2 border-slate-50 overflow-x-auto shadow-inner">
                      <table className="w-full min-w-[600px] border-collapse">
                        <thead>
                          <tr className="bg-slate-50/50">
                            <th className="text-left py-5 px-6 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em] sticky left-0 bg-slate-50/50 z-10">Module Système</th>
                            <th className="text-center py-5 px-4 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em]">Voir</th>
                            <th className="text-center py-5 px-4 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em]">Créer</th>
                            <th className="text-center py-5 px-4 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em]">Éditer</th>
                            <th className="text-center py-5 px-4 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em]">Suppr.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {functionalities.map((f) => (
                            <tr key={f.id} className="border-t border-slate-50 hover:bg-amber-50/30 transition-colors">
                              <td className="py-5 px-6 sticky left-0 bg-white group-hover:bg-amber-50/30 font-bold text-slate-900 min-w-[150px]">
                                {f.name}
                              </td>
                              {['canView', 'canCreate', 'canEdit', 'canDelete'].map((action) => {
                                const permId = `${f.id}:${action}`;
                                const isSelected = selectedPermissions.includes(permId);
                                return (
                                  <td key={action} className="text-center py-5 px-4">
                                    <button
                                      type="button"
                                      onClick={() => togglePermission(permId)}
                                      className={`h-7 w-7 rounded-lg border-2 flex items-center justify-center mx-auto transition-all ${
                                        isSelected 
                                          ? 'bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-500/30' 
                                          : 'bg-white border-slate-200 text-transparent'
                                      }`}
                                    >
                                      <Check size={16} strokeWidth={4} />
                                    </button>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button
                      type="button"
                      onClick={() => setIsEditModalOpen(false)}
                      className="flex-1 bg-slate-100 text-slate-500 font-black py-4 rounded-2xl hover:bg-slate-200 transition-all"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="flex-[2] bg-slate-900 text-white font-black py-4 rounded-2xl shadow-xl shadow-slate-900/10 hover:bg-slate-800 transition-all flex items-center justify-center space-x-3"
                    >
                      {isSaving ? <Loader2 className="animate-spin" size={24} /> : (
                        <>
                          <Save size={20} />
                          <span>Mettre à jour l'utilisateur</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Settings;
