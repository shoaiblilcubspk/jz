import { useEffect, useState, useMemo } from 'react';
import { ArrowDownCircle, ArrowUpCircle, RefreshCw, TrendingUp, CheckCircle, Download, FileText, Send } from 'lucide-react';
import { Customer, CustomerLedger } from '../../types';
import { fetchCustomerLedger } from '../../lib/services/customerLedgerService';
import { useSettingsStore, useUsersStore } from '../../stores';
import { formatCurrency } from '../../lib/currencies';
import { formatAppDateTime } from '../../lib/dateUtils';
import { Badge, Button, EmptyState, Pagination, usePagination, Select } from '../../shared/ui';
import { SkeletonLoader } from '../../shared/ui/SkeletonLoader';
import { ExportButton } from '../../shared/export';
import { sonner } from '../../lib/sonner';
import { DateRangePicker, DateRangePreset } from '../../shared/ui/DateRangePicker';
import { computeCustomerDateRange } from './customerManagerUtils';
import { ReceivePaymentModal } from './ReceivePaymentModal';
import { RefundCustomerModal } from './RefundCustomerModal';

interface Props {
  customer: Customer;
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  sale_credit: { label: 'Credit Sale', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  sale: { label: 'Credit Sale', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  payment_received: { label: 'Payment', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  payment: { label: 'Payment', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  refund: { label: 'Refund', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  adjustment: { label: 'Adjustment', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  opening: { label: 'Opening', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300' },
};

const DATE_PRESETS: DateRangePreset[] = [
  { id: 'all', label: 'All Time' },
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'last7', label: 'Last 7 Days' },
  { id: 'thisMonth', label: 'This Month' },
  { id: 'custom', label: 'Custom Range' },
];

export function CustomerLedgerTab({ customer }: Props) {
  const settings = useSettingsStore(s => s.settings);
  const currency = settings?.currency || 'PKR';
  const [entries, setEntries] = useState<CustomerLedger[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [preset, setPreset] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  // Modals
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCustomerLedger(customer.id);
      setEntries(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (e: any) {
      setError(e?.message || 'Failed to load ledger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [customer.id]);

  const { validStartDate, validEndDate } = useMemo(() =>
    computeCustomerDateRange(preset, startDate, endDate, settings?.country || ''),
    [preset, startDate, endDate, settings?.country]);

  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      // Date filter
      if (preset !== 'all') {
        const entryTime = new Date(entry.createdAt).getTime();
        if (entryTime < validStartDate.getTime()) return false;
        if (entryTime > validEndDate.getTime()) return false;
      }
      
      // Type filter
      if (typeFilter !== 'all') {
        if (typeFilter === 'payment' && !['payment', 'payment_received'].includes(entry.type)) return false;
        if (typeFilter === 'sale' && !['sale', 'sale_credit'].includes(entry.type)) return false;
        if (typeFilter === 'refund' && entry.type !== 'refund') return false;
        if (typeFilter === 'adjustment' && entry.type !== 'adjustment') return false;
      }
      return true;
    });
  }, [entries, preset, validStartDate, validEndDate, typeFilter]);

  const { pageItems, page, totalPages, goToPage, pageSize, setPageSize } = usePagination(filteredEntries, 15);
  const totalDebit = filteredEntries.reduce((s, e) => s + e.debit, 0);
  const totalCredit = filteredEntries.reduce((s, e) => s + e.credit, 0);
  // Use live balance from the most recent ledger entry if available (ignoring filters for overall balance)
  const balance = entries.length > 0 ? entries[0].balanceAfter : (customer.balance || 0);

  const handleClearKhata = () => {
    if (balance === 0) return;
    if (balance > 0) {
      setIsReceiveModalOpen(true);
    } else {
      setIsRefundModalOpen(true);
    }
  };

  const handleWhatsApp = () => {
    let msg = `*Ledger Summary for ${customer.name}*\n\n`;
    if (balance > 0) {
      msg += `You have to pay us: *${formatCurrency(balance, currency)}*\n`;
    } else if (balance < 0) {
      msg += `We have to pay you: *${formatCurrency(Math.abs(balance), currency)}*\n`;
    } else {
      msg += `Your balance is completely settled (Nil).\n`;
    }
    msg += `\nThank you!`;
    const phone = customer.phone ? customer.phone.replace(/\D/g, '') : '';
    if (!phone) {
      sonner.error('Customer has no phone number saved.');
      return;
    }
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const exportColumns = [
    { header: 'Date', key: 'date' },
    { header: 'Type', key: 'type' },
    { header: 'Note/Ref', key: 'note' },
    { header: 'Debit (Pay)', key: 'debit' },
    { header: 'Credit (Receive)', key: 'credit' },
    { header: 'Balance', key: 'balance' }
  ];

  const exportRows = filteredEntries.map(e => ({
    date: formatAppDateTime(e.createdAt),
    type: TYPE_LABELS[e.type]?.label || e.type,
    note: e.note || e.reference || '',
    debit: e.debit,
    credit: e.credit,
    balance: e.balanceAfter
  }));

  if (loading) return <SkeletonLoader rows={6} />;
  if (error) return (
    <div className="text-center py-8 text-red-500 text-sm">{error}
      <button onClick={load} className="ml-2 underline">Retry</button>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Filters & Actions Header */}
      <div className="flex flex-col md:flex-row gap-3 md:items-center p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-200 dark:border-white/10">
        <div className="flex-1 flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <DateRangePicker
            preset={preset}
            presets={DATE_PRESETS}
            onPresetChange={setPreset}
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
            className="flex-1 md:max-w-md"
          />
          <div className="w-full md:w-48">
            <Select 
              value={typeFilter} 
              onChange={e => setTypeFilter(e.target.value)} 
              className="!w-full !bg-white dark:!bg-surface !border-gray-200 dark:!border-white/10 !rounded-xl"
            >
              <option value="all">All Types</option>
              <option value="sale">Credit Sales</option>
              <option value="payment">Payments</option>
              <option value="refund">Refunds</option>
              <option value="adjustment">Adjustments</option>
            </Select>
          </div>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          {filteredEntries.length > 0 && (
            <ExportButton data={exportRows} columns={exportColumns} filename={`Ledger_${customer.name}_${Date.now()}`} className="flex-1 md:flex-none justify-center" />
          )}
          <Button variant="secondary" onClick={handleWhatsApp} className="flex-1 md:flex-none justify-center !min-h-0 !py-2 !px-4 !rounded-xl !bg-[#25D366]/10 !text-[#25D366] !border-[#25D366]/20 hover:!bg-[#25D366]/20">
            <Send className="w-4 h-4 mr-2" /> Share
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/30 p-4">
          <div className="text-[11px] text-red-600 dark:text-red-400 font-black mb-1 uppercase tracking-tight">Total Credit Given (Sales)</div>
          <div className="text-2xl font-black text-red-700 dark:text-red-300">{formatCurrency(totalDebit, currency)}</div>
        </div>
        <div className="rounded-2xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700/30 p-4">
          <div className="text-[11px] text-green-600 dark:text-green-400 font-black mb-1 uppercase tracking-tight">Total Received (Payments)</div>
          <div className="text-2xl font-black text-green-700 dark:text-green-300">{formatCurrency(totalCredit, currency)}</div>
        </div>
        <div className={`rounded-2xl border p-4 relative overflow-hidden group ${balance === 0 ? 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700' : balance > 0
          ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700/50'
          : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700/50'}`}>
          <div className="flex justify-between items-start z-10 relative">
            <div>
              <div className={`text-[11px] font-black uppercase tracking-tight mb-1 ${balance === 0 ? 'text-gray-500' : balance > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {balance === 0 ? 'Balance Clear' : balance > 0 ? 'Aapne Lene Hain (Receive)' : 'Aapne Dene Hain (Pay)'}
              </div>
              <div className={`text-2xl font-black ${balance === 0 ? 'text-gray-900 dark:text-white' : balance > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
                {formatCurrency(Math.abs(balance), currency)}
              </div>
            </div>
            {balance !== 0 && (
              <Button onClick={handleClearKhata} variant="primary" className="!min-h-0 !py-1.5 !px-3 !text-[10px] !rounded-xl shadow-sm">
                Clear Khata
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Refresh & Count */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-bold text-gray-500">{filteredEntries.length} entries found</span>
        <button onClick={load} className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:opacity-70 transition-opacity">
          <RefreshCw className="h-3.5 w-3.5" /> REFRESH
        </button>
      </div>

      {/* Ledger table */}
      {filteredEntries.length === 0 ? (
        <EmptyState icon={<TrendingUp className="w-12 h-12 text-gray-400" />} title="No ledger entries found" description="Try adjusting your filters" className="!py-10" />
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-white/10">
                  <th className="text-left px-4 py-3 font-bold uppercase text-[10px] tracking-wider">Date</th>
                  <th className="text-left px-4 py-3 font-bold uppercase text-[10px] tracking-wider">Type</th>
                  <th className="text-left px-4 py-3 font-bold uppercase text-[10px] tracking-wider">Note / Ref</th>
                  <th className="text-right px-4 py-3 font-bold uppercase text-[10px] tracking-wider text-red-600 dark:text-red-400">Debit (Advance)</th>
                  <th className="text-right px-4 py-3 font-bold uppercase text-[10px] tracking-wider text-green-600 dark:text-green-400">Credit (Debt)</th>
                  <th className="text-right px-4 py-3 font-bold uppercase text-[10px] tracking-wider">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5 bg-white dark:bg-surface">
                {pageItems.map(entry => {
                  const meta = TYPE_LABELS[entry.type] || { label: entry.type, color: 'bg-gray-100 text-gray-600' };
                  return (
                    <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3.5 text-gray-600 dark:text-gray-400 whitespace-nowrap font-medium">
                        {formatAppDateTime(entry.createdAt)}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${meta.color}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-gray-500 dark:text-gray-400 max-w-[150px] truncate">
                        {entry.note || entry.reference || '—'}
                      </td>
                      <td className="px-4 py-3.5 text-right font-black">
                        {entry.debit > 0
                          ? <span className="text-red-600 dark:text-red-400">{formatCurrency(entry.debit, currency)}</span>
                          : <span className="text-gray-300 dark:text-gray-700">—</span>}
                      </td>
                      <td className="px-4 py-3.5 text-right font-black">
                        {entry.credit > 0
                          ? <span className="text-green-600 dark:text-green-400">{formatCurrency(entry.credit, currency)}</span>
                          : <span className="text-gray-300 dark:text-gray-700">—</span>}
                      </td>
                      <td className={`px-4 py-3.5 text-right font-black text-sm ${entry.balanceAfter > 0 ? 'text-amber-600 dark:text-amber-400' : entry.balanceAfter < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'}`}>
                        {formatCurrency(Math.abs(entry.balanceAfter), currency)}
                        {entry.balanceAfter !== 0 && (
                          <span className="text-[9px] ml-1 opacity-70 uppercase tracking-tighter">
                            {entry.balanceAfter > 0 ? 'DR' : 'CR'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="pt-2">
              <Pagination page={page} totalPages={totalPages} onPageChange={goToPage}
                pageSize={pageSize} onPageSizeChange={setPageSize} totalItems={filteredEntries.length} />
            </div>
          )}
        </>
      )}

      {isReceiveModalOpen && (
        <ReceivePaymentModal 
          customer={customer} 
          onClose={() => setIsReceiveModalOpen(false)} 
          onSuccess={() => load()} 
        />
      )}
      {isRefundModalOpen && (
        <RefundCustomerModal 
          customer={customer} 
          onClose={() => setIsRefundModalOpen(false)} 
          onSuccess={() => load()} 
          initialAmount={Math.abs(balance)}
        />
      )}
    </div>
  );
}
