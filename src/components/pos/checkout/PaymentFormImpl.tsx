import { Check, AlertCircle, FileText, Wallet, PlusCircle, UserCircle, Info } from 'lucide-react';
import { formatCurrency } from '../../../lib/currencies';
import { HelpTooltip } from '../../../shared/ui/HelpTooltip';
import { SearchableSelect } from '../../../shared/ui/SearchableSelect';
import { cn } from '../../../lib/utils';
import { useCartStore, useSettingsStore } from '../../../stores';
import { WalletStrip } from './WalletStrip';

type AppSettings = ReturnType<typeof useSettingsStore.getState>['settings'];

interface ExtraCharge {
  name: string;
  amount: string;
}

interface PaymentFormProps {
  appSettings: AppSettings;
  paymentMethod: string;
  handleSelectMethod: (m: string) => void;
  amountPaid: string;
  setAmountPaid: (v: string) => void;
  splitMethodA: 'cash' | 'card' | 'online';
  setSplitMethodA: (v: 'cash' | 'card' | 'online') => void;
  splitMethodB: 'cash' | 'card' | 'online';
  setSplitMethodB: (v: 'cash' | 'card' | 'online') => void;
  splitAmountA: string;
  setSplitAmountA: (v: string) => void;
  splitAmountB: string;
  setSplitAmountB: (v: string) => void;
  finalTotal: number;
  change: number;
  totalQty: number;
  quickAmounts: number[];
  extraCharges: ExtraCharge[];
  setExtraCharges: (v: ExtraCharge[]) => void;
  saleType: 'retail' | 'wholesale';
  setSaleType: (v: any) => void;
  saleTypes: { id: string; label: string; icon: any; enabled: boolean }[];
  payMethods: { id: string; label: string; icon: any }[];
  salesmanId: string;
  setSalesmanId: (v: string) => void;
  appUsers: any[];
  appSalesmen: any[];
  saleNotes: string;
  setSaleNotes: (v: string) => void;
  appActiveSalesTab: string;
}

export function PaymentForm({
  appSettings,
  paymentMethod,
  handleSelectMethod,
  amountPaid,
  setAmountPaid,
  splitMethodA,
  setSplitMethodA,
  splitMethodB,
  setSplitMethodB,
  splitAmountA,
  setSplitAmountA,
  splitAmountB,
  setSplitAmountB,
  finalTotal,
  change,
  totalQty,
  quickAmounts,
  extraCharges,
  setExtraCharges,
  saleType,
  setSaleType,
  saleTypes,
  payMethods,
  salesmanId,
  setSalesmanId,
  appUsers,
  appSalesmen,
  saleNotes,
  setSaleNotes,
  appActiveSalesTab,
}: PaymentFormProps) {
  return (
    <div className="p-4 space-y-4 order-1 md:order-2 bg-gray-50/50 dark:bg-app">

      {/* Net Payable card — mobile only */}
      <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/20 relative overflow-hidden md:hidden mb-1">
        <div className="absolute right-3 top-3 opacity-10"><Wallet className="w-10 h-10 sm:w-14 sm:h-14 text-white rotate-12" /></div>
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <p className="text-[7px] sm:text-[8px] font-black text-white/60 uppercase tracking-[0.25em]">{"Net Payable"}</p>
            <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight tabular-nums mt-0.5">{formatCurrency(finalTotal, appSettings.currency)}</h3>
          </div>
          <div className="px-2 py-0.5 sm:px-3 sm:py-1 rounded-full bg-white/20 border border-white/10">
            <p className="text-[8px] sm:text-[9px] font-black text-white uppercase tracking-widest">{totalQty} {"QTY"}</p>
          </div>
        </div>
      </div>

      {/* Sale Type Selector (Mobile) */}
      {saleTypes.length > 0 && (
        <div className="md:hidden grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(saleTypes.length, 3)}, minmax(0, 1fr))` }}>
          {saleTypes.map(st => {
            const Icon = st.icon;
            return (
              <button key={st.id} onClick={() => setSaleType(st.id as any)}
                className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-[9px] font-black uppercase tracking-wide transition-all active:scale-95 touch-manipulation ${saleType === st.id ? 'bg-primary text-white border-primary shadow-sm shadow-emerald-500/20' : 'bg-gray-50 dark:bg-white/[0.03] text-gray-600 border-gray-200 dark:border-white/5 hover:text-gray-600 dark:hover:text-gray-200'}`}>
                <Icon className="w-3.5 h-3.5" />
                {st.label}
              </button>
            );
          })}
        </div>
      )}
      {/* Payment Method */}
      <WalletStrip currency={appSettings.currency} timezone={appSettings.timezone} />

      <div>
        <p className="text-[8px] sm:text-[9px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-widest mb-1.5 sm:mb-2 flex items-center">
          {"Payment Method"}
          <HelpTooltip content="Select how the bill is being paid." />
        </p>
        <div className={cn("grid gap-1 sm:gap-1.5", "grid-cols-2 sm:grid-cols-4")}>
          {payMethods.map(m => {
            const isActive = paymentMethod === m.id;
            return (
              <button key={m.id} onClick={() => handleSelectMethod(m.id)}
                className={`flex flex-col items-center justify-center gap-1.5 py-2.5 sm:py-3.5 rounded-2xl border transition-all active:scale-95 touch-manipulation ${isActive ? 'bg-primary border-primary shadow-lg shadow-emerald-500/20' : 'bg-white dark:bg-white/[0.03] border-gray-200 dark:border-white/10 hover:border-primary/30'}`}>
                <m.icon className={`w-4.5 h-4.5 sm:w-5.5 sm:h-5.5 ${isActive ? 'text-white' : 'text-gray-600 dark:text-gray-400'}`} />
                <span className={`text-[7px] sm:text-[8px] font-black uppercase tracking-widest ${isActive ? 'text-white' : 'text-gray-600 dark:text-gray-400'}`}>{m.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Amount Input */}
      <div className="min-h-[200px]">
        {paymentMethod === 'split' ? (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {[
              { m: splitMethodA, setM: setSplitMethodA, amt: splitAmountA, setAmt: setSplitAmountA, label: "Part 1" },
              { m: splitMethodB, setM: setSplitMethodB, amt: splitAmountB, setAmt: setSplitAmountB, label: "Part 2" },
            ].map((p, i) => (
              <div key={i} className="p-3 rounded-2xl bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase tracking-widest text-gray-600">{p.label}</span>
                  <div className="flex gap-1">
                    {(['cash', 'card', 'online'] as const).map(mm => (
                      <button key={mm} type="button" onClick={() => p.setM(mm)}
                        className={`px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-widest transition-all ${p.m === mm ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400'}`}>
                        {mm}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[9px] font-black text-gray-600">{appSettings.currency || 'PKR'}</span>
                  <input
                    type="text" inputMode="decimal"
                    value={p.amt}
                    onChange={e => p.setAmt(e.target.value.replace(/[^0-9.]/g, ''))}
                    className="w-full h-12 pl-12 pr-4 bg-gray-50 dark:bg-surface border border-gray-200 dark:border-white/10 rounded-full text-lg font-black text-gray-900 dark:text-white focus:border-primary outline-none transition-all [appearance:textfield] text-center"
                    placeholder="0"
                  />
                </div>
              </div>
            ))}
            <div className={`p-4 rounded-2xl flex items-center justify-between border transition-all duration-300 animate-in fade-in ${Math.abs(((parseFloat(splitAmountA) || 0) + (parseFloat(splitAmountB) || 0)) - finalTotal) < 0.01 ? 'bg-primary/10 border-transparent text-primary dark:text-emerald-400' : 'bg-amber-500/10 border-transparent text-amber-600 dark:text-amber-400'}`}>
              <div>
                <p className="text-[8px] font-black uppercase tracking-widest mb-1">{"Split Total"}</p>
                <p className="text-xl font-black tabular-nums tracking-tighter">
                  {formatCurrency((parseFloat(splitAmountA) || 0) + (parseFloat(splitAmountB) || 0), appSettings.currency)}
                  <span className="text-[10px] font-bold opacity-60"> / {formatCurrency(finalTotal, appSettings.currency)}</span>
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex justify-between items-center">
              <label className="text-[9px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-widest">{"Received Amount"}</label>
              <button onClick={() => setAmountPaid(finalTotal.toString())} className="text-[8px] font-black text-primary bg-primary/10 px-3 py-1 rounded-full hover:bg-primary/20 active:scale-95 transition-all">{"Exact Amount"}</button>
            </div>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[9px] font-black text-gray-600">{appSettings.currency || 'PKR'}</span>
              <input
                type="text" inputMode="decimal"
                value={amountPaid}
                onChange={e => setAmountPaid(e.target.value.replace(/[^0-9.]/g, ''))}
                className="w-full h-14 pl-12 pr-12 py-3 bg-white dark:bg-surface border border-gray-200 dark:border-white/10 rounded-full text-xl font-black text-gray-900 dark:text-white focus:border-primary outline-none transition-all [appearance:textfield] text-center disabled:opacity-50 disabled:bg-gray-100 dark:disabled:bg-white/5"
                placeholder="0"
                disabled={paymentMethod !== 'cash'}
              />
            </div>
            <div className="grid grid-cols-4 gap-1.5 min-h-[32px]">
              {paymentMethod === 'cash' && quickAmounts.map((amt, idx) => (
                <button key={`${amt}-${idx}`} onClick={() => setAmountPaid(amt.toString())}
                  className="py-1.5 sm:py-2 bg-white dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 text-[8px] sm:text-[9px] font-black border border-gray-200 dark:border-white/10 rounded-full active:scale-95 touch-manipulation transition-all tabular-nums hover:border-transparent">
                  {appSettings.currency || 'Rs'} {Math.round(amt)}
                </button>
              ))}
            </div>
            {paymentMethod === 'credit' && (
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl flex items-start gap-2 animate-in fade-in slide-in-from-top-2">
                <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                <p className="text-[9.5px] font-bold text-blue-800 dark:text-blue-200 leading-snug">
                  <span className="uppercase tracking-wide opacity-80 block mb-0.5">Partial Udhar / Half Pay?</span>
                  Is system mein Cash Drawer ko safe rakhne ke liye partial udhar ka direct option nahi. <br/><br/>
                  <span className="text-blue-900 dark:text-blue-100">Tareeqa:</span> Pehle yeh bill poora <b>Credit</b> pe save karein. Phir <b>Customers</b> page par ja kar <b>Receive Payment</b> dabayen aur cash amount enter kar dein.
                </p>
              </div>
            )}
            {/* Change / Due Display (Always visible, solves blank area issue) */}
            <div className={`p-4 rounded-2xl flex items-center justify-between border transition-all duration-300 animate-in fade-in zoom-in-95 ${change >= 0 ? 'bg-primary/10 border-transparent text-primary dark:text-emerald-400' : 'bg-amber-500/10 border-transparent text-amber-600 dark:text-amber-400'
              }`}>
              <div>
                <p className="text-[8px] font-black uppercase tracking-widest mb-1">
                  {change >= 0 ? "Change" : "Balance Due"}
                </p>
                <p className="text-xl font-black tabular-nums tracking-tighter">
                  {formatCurrency(Math.abs(change), appSettings.currency)}
                </p>
              </div>
              {change >= 0 ? (
                <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <Check className="w-4.5 h-4.5" />
                </div>
              ) : (
                <div className="w-8 h-8 bg-amber-500/10 text-amber-500 dark:text-amber-400 rounded-full flex items-center justify-center">
                  <AlertCircle className="w-4.5 h-4.5" />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Extra Info: Custom Extra Charges - ONLY IF ENABLED IN SETTINGS */}
      {appSettings.enableExtraCharges && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest px-1 flex items-center gap-2">
            <PlusCircle className="w-3 h-3" /> {"Extra Charges"}
          </p>
          <div className="grid grid-cols-1 gap-2 sm:gap-3">
            {extraCharges.map((charge, idx) => (
              <div key={idx} className="flex gap-1.5 p-2 bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/5 rounded-xl transition-all hover:border-primary/30">
                <div className="flex-1 flex items-center px-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">{"Delivery Charges (DC)"}</span>
                </div>
                <input
                  type="text"
                  inputMode="decimal"
                  value={charge.amount}
                  onChange={(e) => {
                    const newCharges = [...extraCharges];
                    newCharges[idx].amount = e.target.value.replace(/[^0-9.]/g, '');
                    setExtraCharges(newCharges);
                  }}
                  placeholder="0"
                  className="w-32 bg-primary/5 dark:bg-primary/10 border border-transparent rounded-lg px-3 py-2 text-[12px] font-black text-primary dark:text-emerald-400 text-center focus:border-primary focus:ring-0 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Salesman Selection */}
      <div className="mb-4">
        <SearchableSelect
          label={"SALESMAN (OPTIONAL)"}
          options={[
            { id: '', label: 'None' },
            ...appUsers.filter(u => u.active).map(u => ({ id: u.id, label: u.name })),
            ...appSalesmen.filter(s => s.active).map(s => ({ id: s.id, label: s.name }))
          ]}
          value={salesmanId}
          onChange={setSalesmanId}
          icon={UserCircle}
        />
      </div>

      {/* Notes */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <FileText className="w-3.5 h-3.5 text-primary" />
          <span className="text-[9px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-widest flex items-center">
            {"Internal Memo"}
            <HelpTooltip content="Special remarks or shipping notes printed on dispatch notes and saved in transaction history." />
          </span>
        </div>
        <textarea
          value={saleNotes}
          onChange={e => {
            setSaleNotes(e.target.value);
            useCartStore.getState().setNotes(e.target.value);
            useCartStore.getState().updateSalesTab({ id: appActiveSalesTab, updates: { notes: e.target.value } });
          }}
          placeholder={"Add notes or memo..."}
          className="w-full px-3 py-2.5 bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/5 rounded-xl text-[10px] font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-primary outline-none resize-none min-h-[60px] placeholder:text-gray-600 dark:placeholder:text-gray-600 transition-all"
        />
      </div>
    </div>
  );
}
