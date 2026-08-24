import { useState, useEffect } from 'react';
import { CreditCard, DollarSign, FileText } from 'lucide-react';
import { Modal } from '../../shared/ui/Modal';
import { Button } from '../../shared/ui';
import { Customer } from '../../types';
import { refundCustomerPayment, fetchCustomerLedger } from '../../lib/services/customerLedgerService';
import { useSettingsStore, useCustomersStore } from '../../stores';
import { formatCurrency } from '../../lib/currencies';
import { sonner } from '../../lib/sonner';

interface Props {
  customer: Customer;
  onClose: () => void;
  onSuccess?: (newBalance: number) => void;
  initialAmount?: number;
}

export function RefundCustomerModal({ customer, onClose, onSuccess, initialAmount }: Props) {
  const settings = useSettingsStore(s => s.settings);
  const updateCustomer = useCustomersStore(s => s.updateCustomer);
  const currency = settings?.currency || 'PKR';

  const paymentModes = useSettingsStore(s => s.paymentModes) || [];
  const activeModes = paymentModes.filter(m => m.enabled !== false);

  const [amount, setAmount] = useState(initialAmount ? initialAmount.toString() : '');
  const [mode, setMode] = useState(activeModes.length > 0 ? activeModes[0].id : 'cash');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('Clear Khata (Refund)');
  const [loading, setLoading] = useState(false);
  const [liveBalance, setLiveBalance] = useState<number | null>(null);

  useEffect(() => {
    fetchCustomerLedger(customer.id).then(data => {
      data.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      if (data.length > 0) setLiveBalance(data[0].balanceAfter);
    }).catch(() => {});
  }, [customer.id]);

  const balance = liveBalance !== null ? liveBalance : (customer.balance || 0);
  const amountNum = parseFloat(amount) || 0;

  const handleSubmit = async () => {
    if (amountNum <= 0) { sonner.error('Amount must be greater than 0'); return; }
    setLoading(true);
    try {
      const result = await refundCustomerPayment({
        customerId: customer.id,
        amount: amountNum,
        paymentMode: mode,
        paymentModeId: mode,
        reference: reference || undefined,
        note: note || undefined,
      });

      // Update customer in store
      updateCustomer?.({ ...customer, balance: result.balanceAfter });

      sonner.success(`Refund processed! New balance: ${formatCurrency(result.balanceAfter, currency)}`);
      onSuccess?.(result.balanceAfter);
      onClose();
    } catch (e: any) {
      sonner.error(e?.message || 'Failed to process refund');
    } finally {
      setLoading(false);
    }
  };

  const balanceAfterPreview = balance + amountNum;

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Refund / Pay Customer"
      maxWidth="sm"
      footer={
        <div className="flex gap-2 justify-end w-full">
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit} loading={loading} disabled={loading || amountNum <= 0}>
            Confirm Payment Out
          </Button>
        </div>
      }
    >
      <div className="space-y-4 p-1">
        {/* Customer + current balance */}
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/40 p-3 flex items-center gap-3">
          <CreditCard className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <div>
            <div className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">{customer.name} — We Owe</div>
            <div className={`text-lg font-bold text-emerald-600 dark:text-emerald-400`}>
              {formatCurrency(Math.abs(balance), currency)}
            </div>
          </div>
        </div>

        {/* Amount */}
        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-tight">Amount to Pay Out</label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="number"
              min="0"
              step="any"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full pl-10 pr-3 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-surface focus:ring-2 focus:ring-primary/50 text-xl font-bold"
              autoFocus
            />
          </div>
          {amountNum > 0 && (
            <div className="text-xs text-gray-500 mt-2 flex justify-between">
              <span>Balance After:</span>
              <span className={`font-bold ${balanceAfterPreview > 0 ? 'text-red-500' : 'text-green-500'}`}>
                {formatCurrency(Math.abs(balanceAfterPreview), currency)} {balanceAfterPreview > 0 ? 'DR' : 'CR'}
              </span>
            </div>
          )}
        </div>

        {/* Mode */}
        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-tight">Payment Mode / Wallet</label>
          <div className="grid grid-cols-2 gap-2">
            {activeModes.map(m => (
              <label
                key={m.id}
                className={`flex items-center justify-center py-2.5 px-3 border rounded-xl cursor-pointer transition-colors ${
                  mode === m.id
                    ? 'border-primary bg-primary/10 text-primary font-bold'
                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-white/5'
                }`}
              >
                <input
                  type="radio"
                  name="refund_mode"
                  value={m.id}
                  checked={mode === m.id}
                  onChange={() => setMode(m.id)}
                  className="sr-only"
                />
                <span className="text-xs capitalize">{m.name}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Reference & Note */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-tight">Reference (Optional)</label>
            <input
              type="text"
              value={reference}
              onChange={e => setReference(e.target.value)}
              placeholder="Txn ID, Cheque No..."
              className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-surface focus:ring-2 focus:ring-primary/50 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-tight">Note (Optional)</label>
            <div className="relative">
              <FileText className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <textarea
                rows={2}
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Reason for payment..."
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-surface focus:ring-2 focus:ring-primary/50 text-sm resize-none"
              />
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
