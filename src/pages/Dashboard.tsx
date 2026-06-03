import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { 
  TrendingUp, 
  Users, 
  Package, 
  Clock, 
  ArrowUpRight, 
  Loader2,
  DollarSign,
  ShoppingCart,
  Scale
} from 'lucide-react';
import { motion } from 'motion/react';
import { formatCurrency, formatItemDetails, formatWeight, getItemFullDescription } from '../lib/utils';

const Dashboard = () => {
  const { token } = useAuth();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const response = await axios.get('/api/reports/dashboard-summary', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setData(response.data);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (token) {
      fetchDashboardData();
    }
  }, [token]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="animate-spin text-amber-500" size={48} />
        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Chargement des données...</p>
      </div>
    );
  }

  const stats = [
    { 
      label: 'Ventes du jour', 
      value: `${formatCurrency(data?.todaySales || 0)}`, 
      icon: DollarSign, 
      color: 'text-emerald-600', 
      bgColor: 'bg-emerald-50' 
    },
    { 
      label: 'Nouveaux clients', 
      value: data?.newClients?.toString() || '0', 
      icon: Users, 
      color: 'text-blue-600', 
      bgColor: 'bg-blue-50' 
    },
    { 
      label: 'Stock total', 
      value: `${data?.stockCount?.toString() || '0'} articles`, 
      icon: Package, 
      color: 'text-amber-600', 
      bgColor: 'bg-amber-50' 
    },
    { 
      label: 'Poids Total Stock', 
      value: formatWeight(data?.totalWeight || 0), 
      icon: Scale, 
      color: 'text-indigo-600', 
      bgColor: 'bg-indigo-50' 
    },
    { 
      label: 'Commandes en cours', 
      value: data?.pendingOrders?.toString() || '0', 
      icon: Clock, 
      color: 'text-purple-600', 
      bgColor: 'bg-purple-50' 
    },
  ];

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <header>
        <h1 className="text-3xl font-black text-slate-900">Tableau de Bord</h1>
        <p className="text-slate-500 font-bold">Bienvenue chez Haujee Jewellery</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            key={i} 
            className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex items-center gap-6"
          >
            <div className={`h-14 w-14 ${stat.bgColor} ${stat.color} rounded-2xl flex items-center justify-center`}>
              <stat.icon size={28} />
            </div>
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
              <p className="text-2xl font-black text-slate-900">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Transactions */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-100"
        >
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-3">
              <TrendingUp className="text-amber-500" /> Ventes Récentes
            </h2>
          </div>
          <div className="space-y-4">
            {data?.recentSales?.length === 0 ? (
              <p className="text-slate-400 font-bold italic text-center py-8">Aucune vente récente</p>
            ) : (
              data?.recentSales?.map((sale: any) => (
                <div key={sale.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-3xl hover:bg-slate-100 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 bg-white rounded-2xl flex items-center justify-center text-amber-500 shadow-sm">
                      <ShoppingCart size={20} />
                    </div>
                    <div>
                      <p className="font-black text-slate-900 truncate max-w-[150px]" title={getItemFullDescription(sale)}>{getItemFullDescription(sale) || 'Article'}</p>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{sale.customerName || 'Client anonyme'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-slate-900">{formatCurrency(sale.amount)}</p>
                    <p className="text-[10px] font-bold text-slate-400">{new Date(sale.datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>

        {/* Quick Actions or some other info */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-amber-50 p-8 rounded-[3rem] border border-amber-100 flex flex-col justify-center items-center text-center space-y-6"
        >
          <div className="h-20 w-20 bg-white rounded-[2rem] flex items-center justify-center text-amber-500 shadow-lg">
            <Package size={40} />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-black text-amber-900">Inventaire à Jour?</h3>
            <p className="text-amber-700 font-bold max-w-xs">
              Assurez-vous de scanner chaque nouvel article dès sa réception pour une traçabilité parfaite.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;
