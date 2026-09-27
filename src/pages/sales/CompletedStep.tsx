import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Check, AlertCircle, Loader2, Smartphone, Mail, Download, History, FileText } from 'lucide-react';
import { sendErrorMessage } from '../../lib/sendErrors';
import { sendDocumentAndWait } from '../../lib/sendDocument';
import { openAuthenticatedFile } from '../../lib/openFile';

const Tile: React.FC<{ icon: React.ReactNode; title: string; subtitle: string; onClick: () => void; disabled?: boolean }> = ({ icon, title, subtitle, onClick, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="p-6 bg-slate-50 rounded-3xl hover:bg-emerald-50 focus:bg-emerald-50 transition-colors group disabled:opacity-60"
  >
    {icon}
    <p className="font-black text-slate-900">{title}</p>
    <p className="text-xs text-slate-500 font-medium">{subtitle}</p>
  </button>
);

/** Step 4: the sale is recorded; print, send or start a new one. */
export const CompletedStep: React.FC<{ sale: any; onNewSale: () => void }> = ({ sale, onNewSale }) => {
  const navigate = useNavigate();
  const [busy, setBusy] = useState<'pdf' | 'declaration' | 'send' | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const open = async (kind: 'pdf' | 'declaration') => {
    setBusy(kind);
    try {
      await openAuthenticatedFile(`/api/receipts/${sale.id}/${kind === 'pdf' ? 'pdf' : 'declaration-pdf'}`);
    } catch {
      setMessage({ type: 'error', text: kind === 'pdf' ? 'Échec de la génération du PDF' : 'Échec de la génération de la Déclaration PDF' });
    } finally {
      setBusy(null);
    }
  };

  const send = async (method: 'whatsapp' | 'email') => {
    setBusy('send');
    setMessage({ type: 'success', text: 'Envoi en cours…' });
    try {
      const result = await sendDocumentAndWait('receipt', sale.id, method);
      setMessage({ type: result.ok ? 'success' : 'error', text: result.text });
    } catch (err) {
      setMessage({ type: 'error', text: sendErrorMessage(err) });
    } finally {
      setBusy(null);
    }
  };

  const iconClass = 'mx-auto text-slate-400 mb-4 group-hover:text-emerald-600';
  const spinner = <Loader2 className="mx-auto text-emerald-600 mb-4 animate-spin" size={32} aria-hidden="true" />;

  return (
    <motion.div
      key="step4"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-[3rem] shadow-2xl overflow-hidden border border-slate-100"
    >
      <div className="bg-emerald-600 p-12 text-center text-white relative">
        <div className="absolute top-8 left-1/2 -translate-x-1/2 h-20 w-20 bg-white rounded-full flex items-center justify-center text-emerald-600 shadow-xl">
          <Check size={48} strokeWidth={4} aria-hidden="true" />
        </div>
        <div className="mt-20">
          <h2 className="text-4xl font-black tracking-tight mb-2">Vente Réussie !</h2>
          <p className="text-emerald-100 font-bold opacity-80 uppercase tracking-widest text-sm">Facture N° {sale.receiptNo ?? sale.id}</p>
        </div>
      </div>

      <div className="p-12 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-center">
          <Tile
            icon={busy === 'pdf' ? spinner : <Download className={iconClass} size={32} aria-hidden="true" />}
            title={busy === 'pdf' ? 'Génération...' : 'Télécharger PDF'}
            subtitle={busy === 'pdf' ? 'Veuillez patienter' : 'Impression directe'}
            onClick={() => open('pdf')}
            disabled={busy === 'pdf'}
          />
          {sale.linkedOdfId && (
            <Tile
              icon={busy === 'declaration' ? spinner : <FileText className={iconClass} size={32} aria-hidden="true" />}
              title={busy === 'declaration' ? 'Génération...' : 'Imprimer Déclaration (Trade-in)'}
              subtitle={busy === 'declaration' ? 'Veuillez patienter' : 'Trade-in PDF'}
              onClick={() => open('declaration')}
              disabled={busy === 'declaration'}
            />
          )}
          <Tile icon={<Smartphone className={iconClass} size={32} aria-hidden="true" />} title="WhatsApp" subtitle="Envoyer au client" onClick={() => send('whatsapp')} disabled={busy === 'send'} />
          <Tile icon={<Mail className={iconClass} size={32} aria-hidden="true" />} title="Email" subtitle="Envoi automatique" onClick={() => send('email')} disabled={busy === 'send'} />
        </div>

        {message && (
          <div role="status" className={`p-4 rounded-2xl text-center font-bold flex items-center justify-center gap-2 ${
            message.type === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
          }`}>
            {busy === 'send' ? <Loader2 className="animate-spin" size={20} aria-hidden="true" />
              : message.type === 'success' ? <Check size={20} aria-hidden="true" /> : <AlertCircle size={20} aria-hidden="true" />}
            {message.text}
          </div>
        )}

        <div className="pt-8 border-t border-slate-100 flex gap-4">
          <button
            type="button"
            onClick={onNewSale}
            className="flex-1 bg-slate-900 text-white py-4 rounded-2xl font-black text-lg hover:shadow-xl transition-all"
          >
            Nouvelle Vente
          </button>
          <button
            type="button"
            onClick={() => navigate('/sales-history')}
            className="px-8 bg-slate-100 text-slate-600 py-4 rounded-2xl font-bold flex items-center gap-2 hover:bg-slate-200 transition-all"
          >
            <History size={20} aria-hidden="true" /> Historique
          </button>
        </div>
      </div>
    </motion.div>
  );
};
