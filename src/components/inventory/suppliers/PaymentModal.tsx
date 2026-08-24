import React from 'react';
import { Button, Select } from '../../../shared/ui';
import { ToggleSwitch } from '../../../shared/ui/ToggleSwitch';
import { HelpTooltip } from '../../../shared/ui/HelpTooltip';
import { Modal } from '../../../shared/ui/Modal';
import { formatCurrency } from '../../../lib/currencies';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  supplierName: string;
  balance: number;
  appSettings: any;
  paymentAmount: string;
  setPaymentAmount: (v: string) => void;
  paymentMethod: string;
  setPaymentMethod: (v: string) => void;
  paymentNote: string;
  setPaymentNote: (v: string) => void;
  isPaymentManualOverride: boolean;
  setIsPaymentManualOverride: (v: boolean) => void;
  submitPayment: () => void;
  formLoading: boolean;
  t: (key: string, fallback?: string) => string;
}

export function PaymentModal({
  isOpen, onClose, supplierName, balance, appSettings,
  paymentAmount, setPaymentAmount, paymentMethod, setPaymentMethod,
  paymentNote, setPaymentNote, isPaymentManualOverride, setIsPaymentManualOverride,
  submitPayment, formLoading}: Props) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={'RECORD PAYMENT'}
      subtitle={`${'SETTLE DEBT FOR'} ${supplierName.toUpperCase()}`}
      maxWidth="sm"
      footer={
        <div className="flex items-center justify-end gap-2 sm:gap-3 w-full">
          <Button
            variant="danger"
            onClick={onClose}
            className="flex-1 sm:flex-none !bg-transparent !border-rose-100 dark:!border-rose-900/30 !text-rose-500 hover:!bg-rose-50 dark:hover:!bg-rose-500/10 !px-4 sm:!px-6 !py-2.5 sm:!py-3.5 !text-[9px] sm:!text-[10px] !font-black !rounded-2xl shrink-0"
          >
            {'Cancel'}
          </Button>
          <Button
            variant="primary"
            onClick={submitPayment}
            disabled={formLoading}
            className="flex-1 sm:flex-none sm:min-w-[200px] !py-2.5 sm:!py-3.5 !text-[9px] sm:!text-[11px]"
          >
            {formLoading ? 'Recording...' : 'Confirm Payment'}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="bg-emerald-50 dark:bg-primary/10 border border-emerald-100 dark:border-primary/20 p-4 rounded-2xl">
          <p className="text-[9px] text-primary font-black uppercase tracking-widest text-center mb-1">{'Outstanding Balance'}</p>
          <p className="text-2xl font-black text-primary dark:text-emerald-400 text-center">{formatCurrency(balance, appSettings.currency)}</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-black text-gray-600 dark:text-gray-500 uppercase tracking-widest mb-1.5 block ml-1">{'Amount Paid *'}</label>
            <input
              type="number"
              step="0.01"
              className="w-full bg-gray-50 dark:bg-black/75 border-none text-gray-900 dark:text-white text-sm rounded-xl px-5 py-3.5 focus:ring-2 focus:ring-emerald-500 outline-none font-bold"
              placeholder="0.00"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-gray-600 dark:text-gray-500 uppercase tracking-widest mb-1.5 block ml-1">{'Payment Method *'}</label>
            <Select
              className="!bg-gray-50 dark:!bg-black/75 !border-none !text-sm !rounded-xl !px-5 !text-gray-900 dark:!text-white !font-bold"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              <option value="cash">{'Cash'}</option>
              <option value="card">{'Credit/Debit Card'}</option>
              <option value="online">{'Online Wallet'}</option>
            </Select>
          </div>
          <div>
            <label className="text-[10px] font-black text-gray-600 dark:text-gray-500 uppercase tracking-widest mb-1.5 block ml-1">{'Note / Reference'}</label>
            <input
              type="text"
              className="w-full bg-gray-50 dark:bg-black/75 border-none text-gray-900 dark:text-white text-sm rounded-xl px-5 py-3.5 focus:ring-2 focus:ring-emerald-500 outline-none font-bold"
              placeholder="e.g. Cleared invoice #1234"
              value={paymentNote}
              onChange={(e) => setPaymentNote(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 p-3.5 rounded-xl">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest">{'Manual Override'}</p>
                <HelpTooltip content="Forces the system to accept irregular amounts (e.g., paying more than the outstanding debt). Logs this action as an admin correction." />
              </div>
              <p className="text-[9px] text-amber-600/70 dark:text-amber-500/60 mt-0.5">{'Admin amount correction — logged'}</p>
            </div>
            <ToggleSwitch checked={isPaymentManualOverride} onChange={setIsPaymentManualOverride} color="bg-amber-500" />
          </div>
        </div>
      </div>
    </Modal>
  );
}
