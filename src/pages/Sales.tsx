import React, { useState } from 'react';
import axios from 'axios';
import { AnimatePresence } from 'motion/react';
import { User, CreditCard, Tag } from 'lucide-react';
import CustomerModal from '../components/CustomerModal';
import { useCart } from './sales/useCart';
import { ItemStep } from './sales/ItemStep';
import { CustomerStep } from './sales/CustomerStep';
import { PaymentStep } from './sales/PaymentStep';
import { CompletedStep } from './sales/CompletedStep';

type Step = 'item' | 'customer' | 'payment' | 'completed';

const STEPS = [
  { id: 'item', label: 'Article', icon: Tag },
  { id: 'customer', label: 'Client', icon: User },
  { id: 'payment', label: 'Paiement', icon: CreditCard },
] as const;

/** Point of sale: item -> customer -> payment -> completed. */
const Sales = () => {
  const [step, setStep] = useState<Step>('item');
  const cart = useCart();
  const [customer, setCustomer] = useState<any>(null);
  const [linkedOdf, setLinkedOdf] = useState<any>(null);
  const [linkedCommande, setLinkedCommande] = useState<any>(null);
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [chequeNumber, setChequeNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [completedSale, setCompletedSale] = useState<any>(null);
  const [newCustomerName, setNewCustomerName] = useState<string | null>(null);

  const resetSale = () => {
    cart.clear();
    setCustomer(null);
    setLinkedOdf(null);
    setLinkedCommande(null);
    setPaymentMode('Cash');
    setChequeNumber('');
    setSubmitError('');
    setCompletedSale(null);
    setStep('item');
  };

  const handleFinalize = async () => {
    if (cart.items.length === 0 || !customer || cart.error) return;
    setIsSubmitting(true);
    setSubmitError('');
    try {
      const res = await axios.post('/api/sales', {
        customerId: customer.id,
        paymentMode,
        chequeNumber: paymentMode === 'Cheque' ? chequeNumber : null,
        // The server prices each item from stock; only the discount is sent.
        items: cart.items.map((item, i) => ({
          stockId: item.stockItem.id,
          discountAmount: (cart.lines[i].discountCents / 100).toFixed(2),
        })),
        linkedOdfId: linkedOdf?.id || null,
        linkedCommandeId: linkedCommande?.id || null,
      });
      setCompletedSale({ ...res.data.sale, receiptNo: res.data.receipt?.receiptSerialNumber });
      setStep('completed');
    } catch (err: any) {
      setSubmitError(err.response?.data?.error || 'Échec de la vente');
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepIndex = step === 'completed' ? STEPS.length : STEPS.findIndex(s => s.id === step);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Stepper */}
      <div className="mb-10 flex items-center justify-center">
        <ol className="flex items-center w-full max-w-2xl" aria-label="Étapes de la vente">
          {STEPS.map((s, i) => (
            <React.Fragment key={s.id}>
              <li className="flex flex-col items-center relative" aria-current={step === s.id ? 'step' : undefined}>
                <div className={`h-12 w-12 rounded-2xl flex items-center justify-center transition-all ${
                  step === s.id ? 'bg-amber-500 text-slate-900 shadow-lg scale-110'
                    : i < stepIndex ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'
                }`}>
                  <s.icon size={20} aria-hidden="true" />
                </div>
                <span className={`absolute top-full mt-2 text-xs font-bold whitespace-nowrap ${step === s.id ? 'text-slate-900' : 'text-slate-400'}`}>
                  {s.label}
                </span>
              </li>
              {i < STEPS.length - 1 && (
                <li aria-hidden="true" className={`flex-1 h-1 mx-4 rounded-full ${i < stepIndex ? 'bg-emerald-500' : 'bg-slate-200'}`} />
              )}
            </React.Fragment>
          ))}
        </ol>
      </div>

      <AnimatePresence mode="wait">
        {step === 'item' && <ItemStep key="item" cart={cart} onContinue={() => setStep('customer')} />}

        {step === 'customer' && (
          <CustomerStep
            key="customer"
            selectedCustomer={customer}
            onSelectCustomer={setCustomer}
            linkedOdf={linkedOdf}
            onLinkOdf={setLinkedOdf}
            linkedCommande={linkedCommande}
            onLinkCommande={setLinkedCommande}
            onNewCustomer={setNewCustomerName}
            onBack={() => setStep('item')}
            onNext={() => setStep('payment')}
          />
        )}

        {step === 'payment' && (
          <PaymentStep
            key="payment"
            cart={cart}
            customer={customer}
            linkedOdf={linkedOdf}
            linkedCommande={linkedCommande}
            paymentMode={paymentMode}
            onPaymentMode={setPaymentMode}
            chequeNumber={chequeNumber}
            onChequeNumber={setChequeNumber}
            isSubmitting={isSubmitting}
            error={submitError}
            onFinalize={handleFinalize}
            onBack={() => setStep('item')}
          />
        )}

        {step === 'completed' && completedSale && (
          <CompletedStep key="completed" sale={completedSale} onNewSale={resetSale} />
        )}
      </AnimatePresence>

      <CustomerModal
        isOpen={newCustomerName !== null}
        onClose={() => setNewCustomerName(null)}
        onSuccess={(created) => {
          setCustomer(created);
          setNewCustomerName(null);
          setStep('payment');
        }}
        initialName={newCustomerName || ''}
      />
    </div>
  );
};

export default Sales;
