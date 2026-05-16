import React from 'react';
import { motion } from 'motion/react';
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const Unauthorized: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-50 via-white to-slate-50">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="max-w-md w-full text-center"
      >
        <div className="relative inline-block mb-8">
          <div className="absolute inset-0 bg-red-500 blur-3xl opacity-20 animate-pulse"></div>
          <div className="relative h-24 w-24 bg-white rounded-3xl shadow-2xl flex items-center justify-center text-red-500 mx-auto">
            <ShieldAlert size={48} strokeWidth={1.5} />
          </div>
        </div>

        <h1 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">
          ACCÈS REFUSÉ
        </h1>
        
        <div className="bg-white/60 backdrop-blur-md rounded-3xl p-8 shadow-xl border border-white relative overflow-hidden group mb-8">
          <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
          <p className="text-slate-600 font-medium leading-relaxed">
            Désolé, vous n'avez pas les permissions nécessaires pour accéder à ce module système. 
            Veuillez contacter l'administrateur si vous pensez qu'il s'agit d'une erreur.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="flex-1 bg-white border-2 border-slate-100 p-4 rounded-2xl font-bold text-slate-600 flex items-center justify-center gap-2 hover:bg-slate-50 transition-all shadow-sm"
          >
            <ArrowLeft size={18} />
            <span>Retour</span>
          </button>
          <Link 
            to="/" 
            className="flex-1 bg-slate-900 border-2 border-slate-900 p-4 rounded-2xl font-bold text-white flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20"
          >
            <Home size={18} />
            <span>Accueil</span>
          </Link>
        </div>

        <p className="mt-12 text-xs font-black text-slate-300 uppercase tracking-widest italic">
          Haujee Jewellery Security System v2.0
        </p>
      </motion.div>
    </div>
  );
};

export default Unauthorized;
