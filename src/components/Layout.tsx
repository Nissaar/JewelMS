import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Search, User, LogOut, Package, Users, ShoppingCart, FileText, Settings, Menu, X, PlusCircle, Fingerprint, BarChart3, Download, History } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { motion, AnimatePresence } from 'motion/react';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, token, logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    });
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowInstallBtn(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.length >= 2) {
        setIsSearching(true);
        setIsSearchOpen(true);
        try {
          const response = await axios.get(`/api/search?q=${searchQuery}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setSearchResults(response.data);
        } catch (error) {
          console.error("Search failed:", error);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults(null);
        setIsSearchOpen(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, token]);

  const hasPermission = (funcId: string, action: 'canView' | 'canCreate' | 'canEdit' | 'canDelete' = 'canView') => {
    if (user?.role === 'Admin') return true;
    return user?.permissions?.some(p => p.functionality === funcId && p[action]);
  };

  const navItems = [
    { name: 'Dashboard', icon: Menu, path: '/', show: true },
    { name: 'Stock', icon: Package, path: '/stock', show: hasPermission('stock') },
    { name: 'Clients', icon: Users, path: '/customers', show: hasPermission('customers') },
    { name: 'Ventes', icon: ShoppingCart, path: '/sales', show: hasPermission('sales') },
    { name: 'Historique des Ventes', icon: History, path: '/sales-history', show: hasPermission('sales') },
    { name: 'Commandes', icon: FileText, path: '/orders', show: hasPermission('orders') },
    { name: 'Trade-ins (ODF)', icon: PlusCircle, path: '/odf', show: hasPermission('odf') },
    { name: 'Rapports', icon: FileText, path: '/reports', show: hasPermission('reports') },
  ];

  if (user?.role === 'Admin') {
    navItems.push({ name: 'Stock Reports', icon: BarChart3, path: '/stock-reports', show: true });
    navItems.push({ name: 'Audit Logs', icon: Fingerprint, path: '/audit-logs', show: true });
    navItems.push({ name: 'Paramètres', icon: Settings, path: '/settings', show: true });
  }

  const filteredNavItems = navItems.filter(item => item.show);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 bg-slate-900 text-white w-64 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 transition-transform duration-200 ease-in-out z-30 lg:relative`}>
        <div className="flex flex-col h-screen">
          <div className="p-6 flex items-center justify-between shrink-0">
            <Link to="/" className="text-2xl font-bold tracking-tighter text-amber-400">
              HAUJEE
            </Link>
            <button className="lg:hidden" onClick={() => setIsSidebarOpen(false)}>
              <X size={24} />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-4 space-y-1 py-2">
            {filteredNavItems.map((item) => (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  location.pathname === item.path ? 'bg-slate-800 text-amber-400 shadow-sm' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
                onClick={() => setIsSidebarOpen(false)}
              >
                <item.icon size={20} />
                <span className="font-medium">{item.name}</span>
              </Link>
            ))}
          </nav>

          <div className="p-6 border-t border-slate-800 shrink-0">
            {showInstallBtn && (
              <button 
                onClick={handleInstallClick}
                className="flex items-center space-x-3 px-4 py-3 mb-6 w-full bg-amber-500 text-slate-900 rounded-xl font-bold text-sm shadow-lg shadow-amber-500/20 hover:bg-amber-400 transition-all active:scale-95"
              >
                <Download size={18} />
                <span>Installer l'App</span>
              </button>
            )}
            
            <div className="flex items-center space-x-3 mb-4">
              <div className="h-8 w-8 rounded-full bg-amber-500 flex items-center justify-center text-slate-900 font-bold shrink-0">
                {user?.username?.charAt(0).toUpperCase()}
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-semibold truncate">{user?.username}</p>
                <p className="text-xs text-slate-400 capitalize">{user?.role}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="flex items-center space-x-2 text-slate-400 hover:text-red-400 transition-colors w-full"
            >
              <LogOut size={18} />
              <span className="text-sm font-medium">Déconnexion</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-4 lg:px-8 shrink-0">
          <button className="lg:hidden p-2 text-slate-600" onClick={() => setIsSidebarOpen(true)}>
            <Menu size={24} />
          </button>

          <div className="flex-1 max-w-2xl mx-4 relative" ref={searchRef}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Rechercher stock, client, facture..."
                className="w-full bg-slate-100 border-none rounded-full py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-amber-500/20 transition-all outline-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchQuery.length >= 2 && setIsSearchOpen(true)}
              />
            </div>

            <AnimatePresence>
              {isSearchOpen && (searchResults || isSearching) && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute top-full mt-2 left-0 right-0 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 max-h-[70vh] overflow-y-auto"
                >
                  <div className="p-4">
                    {isSearching ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-500 border-t-transparent"></div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {searchResults?.stock?.length > 0 && (
                          <div>
                            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Stock</h3>
                            {searchResults.stock.slice(0, 5).map((item: any) => (
                              <div key={item.id} className="p-2 hover:bg-slate-50 rounded-lg cursor-pointer flex justify-between" onClick={() => { navigate(`/stock/${item.id}`); setIsSearchOpen(false); }}>
                                <div>
                                  <p className="font-medium text-sm text-slate-900">{item.barcode}</p>
                                  <p className="text-xs text-slate-500">{item.subCategory}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs font-semibold text-amber-600">{item.weightGrams}g</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {searchResults?.customers?.length > 0 && (
                          <div>
                            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Clients</h3>
                            {searchResults.customers.slice(0, 5).map((item: any) => (
                              <div key={item.id} className="p-2 hover:bg-slate-50 rounded-lg cursor-pointer" onClick={() => { navigate(`/customers/${item.id}`); setIsSearchOpen(false); }}>
                                <p className="font-medium text-sm text-slate-900">{item.name}</p>
                                <p className="text-xs text-slate-500">{item.idNumber}</p>
                              </div>
                            ))}
                          </div>
                        )}
                        {(!searchResults || (searchResults.stock.length === 0 && searchResults.customers.length === 0)) && (
                          <div className="text-center py-8 text-slate-500 text-sm">
                            Aucun résultat trouvé pour "{searchQuery}"
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center space-x-4">
            <div className="hidden md:flex items-center space-x-2 text-slate-600 border-l border-slate-200 pl-4">
               <User size={18} />
               <span className="text-sm font-medium">{user?.username}</span>
            </div>
          </div>
        </header>

        {/* Dynamic Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
};
