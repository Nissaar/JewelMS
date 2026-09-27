import React from 'react';
import { motion } from 'motion/react';
import { ShoppingCart, Banknote, Loader2, ArrowLeft, AlertCircle, PlusCircle } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';
import { toCents } from '../../shared/money';
import { CartTable } from './CartTable';
import type { Cart } from './useCart';

export const PAYMENT_MODES = ['Cash', 'Juice', 'Card', 'Bank Transfer', 'Cheque'] as const;

interface PaymentStepProps {
  cart: Cart;
  customer: any;
  linkedOdf: any;
  linkedCommande: any;
  paymentMode: string;
  onPaymentMode: (mode: string) => void;
  chequeNumber: string;
  onChequeNumber: (value: string) => void;
  isSubmitting: boolean;
  error: string;
  onFinalize: () => void;
  onBack: () => void;
}

/** Step 3: review the amounts due and take payment. */
export const PaymentStep: React.FC<PaymentStepProps> = ({
  cart, customer, linkedOdf, linkedCommande, paymentMode, onPaymentMode, chequeNumber, onChequeNumber, isSubmitting, error, onFinalize, onBack,
}) => {
  const { netCents, vatCents, grossCents } = cart.totals;
  // Trade-in value and deposit are deducted from the VAT-inclusive total, as on the invoice.
  const dueCents = Math.max(0, grossCents - toCents(linkedOdf?.amount) - toCents(linkedCommande?.deposit));
  const itemCount = cart.items.length;

  return (
    <motion.div
      key="step3"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="grid grid-cols-1 lg:grid-cols-2 gap-8"
    >
      {/* Left: summary */}
      <div className="space-y-6">
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100">
          <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
            <ShoppingCart className="text-amber-500" size={20} aria-hidden="true" /> Panier d'Achat ({itemCount} article{itemCount > 1 ? 's' : ''})
          </h3>
          <CartTable cart={cart} />
          {cart.error && <p role="alert" className="mt-4 text-sm font-bold text-red-600">{cart.error}</p>}

          <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-center text-sm font-medium">
            <span className="text-slate-500">Client Facturé:</span>
            <span className="font-extrabold text-slate-900">{customer?.name}</span>
          </div>
        </div>

        <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-xl">
          <dl className="space-y-3">
            <div className="flex justify-between items-center">
              <dt className="text-slate-400 font-bold uppercase text-xs tracking-widest">Sous-Total (Excl. TVA)</dt>
              <dd className="text-xl font-bold">{formatCurrency(netCents / 100)}</dd>
            </div>
            <div className="flex justify-between items-center text-amber-400">
              <dt className="font-bold uppercase text-xs tracking-widest">TVA (15%)</dt>
              <dd className="text-xl font-bold">{formatCurrency(vatCents / 100)}</dd>
            </div>
            <div className="flex justify-between items-center text-slate-300 border-t border-slate-800/60 pt-2">
              <dt className="font-bold uppercase text-xs tracking-widest">Total Brut TTC</dt>
              <dd className="text-xl font-bold">{formatCurrency(grossCents / 100)}</dd>
            </div>
            {linkedOdf && (
              <div className="flex justify-between items-center text-rose-400">
                <dt className="font-bold uppercase tracking-widest font-mono text-xs">Reprise Trade-In (ODF #{linkedOdf.id})</dt>
                <dd className="text-xl font-bold">-{formatCurrency(parseFloat(linkedOdf.amount || '0'))}</dd>
              </div>
            )}
            {linkedCommande && (
              <div className="flex justify-between items-center text-rose-400">
                <dt className="font-bold uppercase tracking-widest font-mono text-xs">Acompte Reçu (N° {linkedCommande.orderNumber})</dt>
                <dd className="text-xl font-bold">-{formatCurrency(parseFloat(linkedCommande.deposit || '0'))}</dd>
              </div>
            )}
            <div className="pt-4 border-t border-slate-800 flex justify-between items-center">
              <dt className="text-slate-200 font-black uppercase text-sm tracking-widest">Net À Payer</dt>
              <dd className="text-4xl font-black text-white tracking-tighter">{formatCurrency(dueCents / 100)}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Right: payment */}
      <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100">
        <h2 className="text-2xl font-black text-slate-900 mb-8">Détails du Paiement</h2>
        <div className="space-y-6">
          <div>
            <label htmlFor="payment-net" className="block text-sm font-bold text-slate-700 mb-2">Montant HT Total</label>
            <div className="relative">
              <Banknote className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={24} aria-hidden="true" />
              <input
                id="payment-net"
                type="text"
                disabled
                className="w-full bg-slate-100 border-2 border-slate-100 rounded-2xl py-4 pl-14 pr-4 text-2xl font-black text-slate-900 outline-none font-mono"
                value={formatCurrency(netCents / 100)}
              />
            </div>
          </div>

          <div>
            <span className="block text-sm font-bold text-slate-700 mb-2">Mode de Paiement</span>
            <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Mode de paiement">
              {PAYMENT_MODES.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={paymentMode === mode}
                  onClick={() => onPaymentMode(mode)}
                  className={`py-3 px-4 rounded-xl text-sm font-bold transition-all border-2 ${
                    paymentMode === mode ? 'bg-slate-900 border-slate-900 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-600 hover:border-amber-200'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {paymentMode === 'Cheque' && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
              <label htmlFor="cheque-number" className="block text-sm font-bold text-slate-700 mb-2">N° de Chèque</label>
              <input
                id="cheque-number"
                type="text"
                placeholder="Entrez le numéro du chèque..."
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-4 font-bold outline-none focus:border-amber-400 transition-all"
                value={chequeNumber}
                onChange={(e) => onChequeNumber(e.target.value)}
              />
            </motion.div>
          )}

          {error && (
            <div role="alert" className="p-4 rounded-2xl bg-red-50 text-red-600 font-bold flex items-center gap-2">
              <AlertCircle size={20} aria-hidden="true" /> {error}
            </div>
          )}

          <div className="pt-8 flex flex-col gap-3">
            <button
              type="button"
              onClick={onFinalize}
              disabled={isSubmitting || itemCount === 0 || !!cart.error}
              className="w-full bg-emerald-600 text-white py-5 rounded-2xl font-black text-xl shadow-2xl flex items-center justify-center gap-3 hover:bg-emerald-700 transition-all disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="animate-spin" /> : <>Finaliser & Facturer <PlusCircle size={24} strokeWidth={3} aria-hidden="true" /></>}
            </button>
            <button
              type="button"
              onClick={onBack}
              className="w-full bg-slate-100 text-slate-600 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-200 transition-all"
            >
              <ArrowLeft size={18} aria-hidden="true" /> Retour / Modifier le panier
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
