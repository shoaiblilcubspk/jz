import { useState } from 'react';
import { CreditCard, DollarSign, FileText } from 'lucide-react';
import { Modal } from '../../shared/ui/Modal';
import { Button } from '../../shared/ui';
import { Customer } from '../../types';
import { receiveCustomerPayment, fetchCustomerLedger } from '../../lib/services/customerLedgerService';
import { useSettingsStore, useCustomersStore } from '../../stores';
import { formatCurrency } from '../../lib/currencies';
import { sonner } from '../../lib/sonner';

interface Props {
  customer: Customer;
  onClose: () => void;
  onSuccess?: (newBalance: number) => void;
}

import { useEffect, useRef } from 'react';

export function ReceivePaymentModal({ customer, onClose, onSuccess }: Props) {
  const settings = useSettingsStore(s => s.settings);
  const updateCustomer = useCustomersStore(s => s.updateCustomer);
  const currency = settings?.currency || 'PKR';

  const paymentModes = useSettingsStore(s => s.paymentModes) || [];
  const activeModes = paymentModes.filter(m => m.enabled !== false);

  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState(activeModes.length > 0 ? activeModes[0].id : 'cash');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [liveBalance, setLiveBalance] = useState<number | null>(null);
  
  // Stable idempotency key for this payment session
  const idempotencyKey = useRef(`rcv_${customer.id}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);

  useEffect(() => {
    fetchCustomerLedger(customer.id).then(data => {
      data.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      if (data.length > 0) setLiveBalance(data[0].balanceAfter);
    }).catch(() => {});
  }, [customer.id]);

  const balance = liveBalance !== null ? liveBalance : (customer.balance || 0);
  const amountNum = parseFloat(amount) || 0;

  const processingLock = useRef(false);

  const handleSubmit = async () => {
    if (processingLock.current) return;
    if (amountNum <= 0) { sonner.error('Amount must be greater than 0'); return; }
    
    processingLock.current = true;
    setLoading(true);
    try {
      const result = await receiveCustomerPayment({
        customerId: customer.id,
        amount: amountNum,
        paymentMode: mode,
        paymentModeId: mode,
        reference: reference || undefined,
        note: note || undefined,
        idempotencyKey: idempotencyKey.current,
      });

      // Update customer in store
      updateCustomer?.({ ...customer, balance: result.balanceAfter });

      sonner.success(`Payment received! New balance: ${formatCurrency(result.balanceAfter, currency)}`);
      onSuccess?.(result.balanceAfter);
      onClose();
    } catch (e: any) {
      sonner.error(e?.message || 'Failed to receive payment');
    } finally {
      processingLock.current = false;
      setLoading(false);
    }
  };

  const balanceAfterPreview = balance - amountNum;

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Receive Payment"
      maxWidth="sm"
      footer={
        <div className="flex gap-2 justify-end w-full">
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={loading || amountNum <= 0}>
            {loading ? 'Processing...' : 'Confirm Payment'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 p-1">
        {/* Customer + current balance */}
        <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 p-3 flex items-center gap-3">
          <CreditCard className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <div>
            <div className="text-xs text-amber-700 dark:text-amber-400 font-medium">{customer.name} — Outstanding</div>
            <div className={`text-lg font-bold ${balance > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
              {formatCurrency(balance, currency)}
            </div>
          </div>
        </div>

        {/* Amount */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Amount Received *</label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              autoFocus
            />
          </div>
          {amountNum > 0 && (
            <div className="mt-1 text-xs text-gray-500">
              Balance after: <span className={`font-semibold ${balanceAfterPreview <= 0 ? 'text-green-600' : 'text-amber-600'}`}>
                {formatCurrency(balanceAfterPreview, currency)}
              </span>
            </div>
          )}
        </div>

        {/* Payment Mode */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Payment Method</label>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
            {activeModes.map(m => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`py-2 rounded-lg text-xs font-semibold border transition-all ${
                  mode === m.id
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white dark:bg-white/5 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-white/10 hover:border-indigo-400'
                }`}
              >
                {m.name || m.label || m.id}
              </button>
            ))}
          </div>
        </div>

        {/* Reference */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Reference # (optional)</label>
          <input
            type="text"
            value={reference}
            onChange={e => setReference(e.target.value)}
            placeholder="Cheque no. / Transfer ID"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>

        {/* Note */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
            <FileText className="inline h-3.5 w-3.5 mr-1" />Note (optional)
          </label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Add a note..."
            rows={2}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
          />
        </div>
      </div>
    </Modal>
  );
}
