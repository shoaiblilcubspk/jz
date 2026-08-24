import { useState, useEffect } from 'react';
import Dexie from 'dexie';
import { formatCurrency } from '../../../lib/currencies';
import { HelpTooltip } from '../../../shared/ui/HelpTooltip';
import { localDb } from '../../../lib/localDb';
import { getStartOfDayInTimezone, getEndOfDayInTimezone } from '../../../lib/dateUtils';
import { getAmountByMethod } from '../../../lib/services';
import { useSettingsStore } from '../../../stores';

export function WalletStrip({ currency, timezone }: { currency: string, timezone?: string }) {
  const appSettings = useSettingsStore(s => s.settings);
  const [modes, setModes] = useState<any[]>([]);
  const [creditReceived, setCreditReceived] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      Dexie.ignoreTransaction(async () => {
        // 1. Get mode structures
      const m = await localDb.paymentModes.toArray();
      const order = ['cash', 'card', 'online'];
      m.sort((a: any, b: any) => order.indexOf(a.id) - order.indexOf(b.id));

      // 2. Fetch today's sales
      const tz = timezone || 'Asia/Karachi';
      const start = getStartOfDayInTimezone(new Date(), tz);
      const end = getEndOfDayInTimezone(new Date(), tz);
      const todaySales = await localDb.sales
        .where('timestamp')
        .between(start, end)
        .toArray();

      // 3. Compute totals
      const totals = { cash: 0, card: 0, online: 0 };
      let creditGivenTotal = 0;
      let creditReceivedTotal = 0;
      todaySales.forEach(t => {
        const addToWallet = (method: 'cash' | 'card' | 'online', amt: number) => {
          totals[method] = Math.round((totals[method] + amt) * 100) / 100;
        };

        if (t.status !== 'pending') {
          addToWallet('cash', getAmountByMethod(t, 'cash'));
          addToWallet('card', getAmountByMethod(t, 'card'));
          addToWallet('online', getAmountByMethod(t, 'online'));
          if (t.status !== 'refunded') {
            creditGivenTotal = Math.round((creditGivenTotal + getAmountByMethod(t, 'credit')) * 100) / 100;
          }
        }

        if (t.status === 'refunded') {
          addToWallet('cash', -getAmountByMethod(t, 'cash'));
          addToWallet('card', -getAmountByMethod(t, 'card'));
          addToWallet('online', -getAmountByMethod(t, 'online'));
        } else if (t.status === 'partially_refunded') {
          const refundedAmt = t.refundedAmount || 0;
          addToWallet('cash', -(t.paymentMethod === 'split'
            ? refundedAmt * (getAmountByMethod(t, 'cash') / (t.total || 1))
            : (t.paymentMethod === 'cash' || !t.paymentMethod ? refundedAmt : 0)));
          addToWallet('card', -(t.paymentMethod === 'split'
            ? refundedAmt * (getAmountByMethod(t, 'card') / (t.total || 1))
            : (t.paymentMethod === 'card' ? refundedAmt : 0)));
          addToWallet('online', -(t.paymentMethod === 'split'
            ? refundedAmt * (getAmountByMethod(t, 'online') / (t.total || 1))
            : (t.paymentMethod === 'online' ? refundedAmt : 0)));
        }
      });

      // 4. Fetch today's payments & expenses
      const todayPayments = await localDb.payments
        .filter((p: any) => {
          const t = new Date(p.createdAt || p.created_at || p.timestamp).getTime();
          return t >= start.getTime() && t <= end.getTime();
        })
        .toArray();
        
      const todayExpenses = await localDb.expenses
        .filter((e: any) => {
          const t = new Date(e.createdAt || e.created_at || e.timestamp).getTime();
          return t >= start.getTime() && t <= end.getTime();
        })
        .toArray();

      todayPayments.forEach(p => {
        const amt = Number(p.amount);
        const method = (p.paymentMethod || p.paymentType || p.method || 'cash') as 'cash' | 'card' | 'online';
        if (p.direction === 'in') {
          totals[method] = Math.round((totals[method] + amt) * 100) / 100;
          creditReceivedTotal = Math.round((creditReceivedTotal + amt) * 100) / 100;
        } else if (p.direction === 'out') {
          totals[method] = Math.round((totals[method] - amt) * 100) / 100;
        }
      });

      todayExpenses.forEach(e => {
        const amt = Number(e.amount);
        const method = (e.paymentMethod || 'cash') as 'cash' | 'card' | 'online';
        totals[method] = Math.round((totals[method] - amt) * 100) / 100;
      });

      // 5. Merge
      const finalModes = m.map(mode => ({
        ...mode,
        balance: totals[mode.id as 'cash' | 'card' | 'online'] || 0
      }));

      if (appSettings?.enableCreditSales || appSettings?.enable_credit_sales) {
        finalModes.push({
          id: 'credit',
          name: 'Credit',
          icon: 'wallet',
          color: '#f59e0b',
          balance: creditGivenTotal - creditReceivedTotal,
          creditGiven: creditGivenTotal,
          creditRecovered: creditReceivedTotal
        });
      }

      if (alive) {
        setModes(finalModes);
        setCreditReceived(creditReceivedTotal);
      }
      });
    };
    load();
    const subs: any[] = [];
    try {
      subs.push(localDb.sales.hook('creating').subscribe(() => load()));
      subs.push(localDb.sales.hook('updating').subscribe(() => load()));
      subs.push(localDb.sales.hook('deleting').subscribe(() => load()));
      subs.push(localDb.payments.hook('creating').subscribe(() => load()));
      subs.push(localDb.payments.hook('updating').subscribe(() => load()));
      subs.push(localDb.payments.hook('deleting').subscribe(() => load()));
    } catch { /* hooks unsupported */ }
    return () => { alive = false; subs.forEach(s => s?.unsubscribe?.()); };
  }, [timezone, appSettings]);

  if (!modes.length) return null;
  return (
    <div className="mb-3">
      <div className="flex items-center gap-1.5 mb-2">
        <p className="text-[8px] sm:text-[9px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-widest flex items-center">
          Today's Drawer
          <HelpTooltip content="Shows total collected today for each method (Cash Flow). This is not the all-time absolute balance." />
        </p>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {modes.map((mode: any) => (
          <div key={mode.id} className="relative overflow-hidden bg-white dark:bg-[#1C1C1C] border border-gray-200 dark:border-white/5 rounded-2xl p-4 flex items-center justify-between transition-all hover:scale-[1.02] shadow-sm">
            <div className="flex flex-col">
              <span className="text-[9px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-widest leading-none">
                {mode.id === 'credit' ? "Credit Wallet" : `${mode.name} Wallet`}
              </span>
              <span className={`text-base font-black tabular-nums mt-1.5 leading-none`} style={{ color: mode.color }}>
                {mode.id === 'credit' ? `${formatCurrency(mode.creditGiven || 0, currency)} Given` : formatCurrency(mode.balance, currency)}
              </span>
              {mode.id === 'credit' && (
                <span className="text-[9px] font-bold text-gray-500 mt-1 uppercase tracking-widest">
                  Recovered: {formatCurrency(mode.creditRecovered || 0, currency)}
                </span>
              )}
            </div>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center opacity-80" style={{ backgroundColor: `${mode.color}15`, border: `1px solid ${mode.color}25` }}>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
