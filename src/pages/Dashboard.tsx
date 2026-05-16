import React from 'react';

const Dashboard = () => (
  <div>
    <h1 className="text-2xl font-bold text-slate-800 mb-6">Tableau de Bord</h1>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {[
        { label: 'Ventes du jour', value: '45,200 Rs', trend: '+12%', color: 'bg-emerald-50 text-emerald-600' },
        { label: 'Nouveaux clients', value: '12', trend: '+5%', color: 'bg-blue-50 text-blue-600' },
        { label: 'Stock total', value: '842 articles', trend: '-2%', color: 'bg-amber-50 text-amber-600' },
        { label: 'Commandes en cours', value: '18', trend: '+20%', color: 'bg-purple-50 text-purple-600' },
      ].map((stat, i) => (
        <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
          <p className="text-sm font-medium text-slate-500 mb-1">{stat.label}</p>
          <p className="text-2xl font-bold text-slate-900 mb-2">{stat.value}</p>
          <span className={`text-xs font-bold px-2 py-1 rounded-full ${stat.color}`}>{stat.trend}</span>
        </div>
      ))}
    </div>
  </div>
);

export default Dashboard;
