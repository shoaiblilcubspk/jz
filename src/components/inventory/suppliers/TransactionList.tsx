import React from 'react';
import { Clock, Trash2 } from 'lucide-react';
import { formatAppDate, formatAppTime } from '../../../lib/dateUtils';
import { formatCurrency } from '../../../lib/currencies';
import { Badge, EmptyState, Pagination, Button } from '../../../shared/ui';

interface Props {
  loading: boolean;
  filteredLedger: any[];
  pageItems: any[];
  page: number;
  totalPages: number;
  goToPage: (p: number) => void;
  pageSize: number;
  setPageSize: (size: number) => void;
  handleDeleteTransaction: (id: string) => void;
  appSettings: any;
}

export function TransactionList({
  loading, filteredLedger, pageItems, page, totalPages, goToPage,
  pageSize, setPageSize, handleDeleteTransaction, appSettings
}: Props) {
  
  const getBadge = (type: string, sourceType?: string) => {
    if (sourceType === 'auto_purchase') {
      return { label: 'AUTO-PURCHASE', tone: 'info' as const, cls: '!bg-blue-500/10 !text-blue-400 !border-blue-500/20' };
    }
    switch (type) {
      case 'payment':
        return { label: 'PAID', tone: 'success' as const, cls: '!bg-primary/10 !text-emerald-400 !border-primary/20' };
      case 'opening_balance':
        return { label: 'OPENING', tone: 'info' as const, cls: '!bg-violet-500/10 !text-violet-400 !border-violet-500/20' };
      default:
        return { label: 'MANUAL BILL', tone: 'danger' as const, cls: '!bg-red-500/10 !text-red-400 !border-red-500/20' };
    }
  };

  return (
    <>
      <div className="hidden md:block overflow-x-auto scrollbar-hide">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 dark:bg-white/[0.02]">
              <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-600 dark:text-gray-400 tracking-widest">{'Date'}</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-600 dark:text-gray-400 tracking-widest">{'Type'}</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-600 dark:text-gray-400 tracking-widest">{'Description'}</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-600 dark:text-gray-400 tracking-widest text-right">{'Paid'}</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-600 dark:text-gray-400 tracking-widest text-right">{'Bill'}</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-600 dark:text-gray-400 tracking-widest text-center">{'Actions'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-white/5">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-600 font-bold italic animate-pulse">{'Loading ledger data...'}</td>
              </tr>
            ) : filteredLedger.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center">
                  <EmptyState
                    icon={<Clock className="h-10 w-10 text-gray-600 dark:text-gray-500" />}
                    title={'No transactions yet'}
                    className="py-6"
                  />
                </td>
              </tr>
            ) : (
              pageItems.map((tx, idx) => {
                const badge = getBadge(tx.type, tx.sourceType);
                return (
                  <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-white/[0.01] transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-[11px] font-black text-gray-900 dark:text-white uppercase tracking-tighter">{formatAppDate(tx.date, appSettings.country)}</p>
                      <p className="text-[9px] uppercase font-bold tracking-widest text-gray-600 mt-0.5">{formatAppTime(tx.date, appSettings.country)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <Badge tone={badge.tone} size="sm" className={`${badge.cls} !text-[8px] !px-2 !py-1 !rounded-md`}>
                        {badge.label}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-[11px] font-bold text-gray-900 dark:text-white truncate max-w-[200px]" title={tx.detail}>{tx.detail}</p>
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      {tx.type === 'payment' && tx.debit > 0 ? (
                        <span className="text-xs font-black text-primary tracking-tighter">
                          {formatCurrency(tx.debit, appSettings.currency)}
                        </span>
                      ) : <span className="text-gray-600 dark:text-gray-500 opacity-20">—</span>}
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      {tx.type !== 'payment' && tx.credit > 0 ? (
                        <span className="text-xs font-black text-rose-500 tracking-tighter">
                          {formatCurrency(tx.credit, appSettings.currency)}
                        </span>
                      ) : <span className="text-gray-600 dark:text-gray-500 opacity-20">—</span>}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Button variant="ghost" onClick={() => handleDeleteTransaction(tx.id)} className="!min-h-0 !p-1.5 !rounded-lg !text-gray-600 hover:!text-red-500 active:scale-90">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="md:hidden divide-y divide-gray-50 dark:divide-white/5">
        {loading ? (
          <div className="p-8 text-center text-gray-600 font-bold animate-pulse uppercase text-[10px] tracking-widest">{'Loading transactions...'}</div>
        ) : filteredLedger.length === 0 ? (
          <EmptyState
            icon={<Clock className="h-8 w-8 text-gray-600 dark:text-gray-500" />}
            title={'No entries found'}
            className="p-10"
          />
        ) : (
          pageItems.map((tx, idx) => {
            const badge = getBadge(tx.type, tx.sourceType);
            return (
              <div key={idx} className="p-4 flex flex-col gap-2 hover:bg-gray-50 dark:hover:bg-white/[0.01]">
                <div className="flex justify-between items-start">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-gray-900 dark:text-white uppercase tracking-tight">
                      {formatAppDate(tx.date, appSettings.country)}
                    </span>
                    <span className="text-[9px] text-gray-600 font-bold uppercase">
                      {formatAppTime(tx.date, appSettings.country)}
                    </span>
                  </div>
                  <Badge tone={badge.tone} size="sm" className={`${badge.cls} !text-[8px] !px-2 !py-0.5 !rounded-md`}>
                    {badge.label}
                  </Badge>
                </div>

                <div className="flex justify-between items-center bg-gray-50 dark:bg-white/5 p-2.5 rounded-xl border border-gray-200 dark:border-white/5">
                  <div className="flex flex-col max-w-[60%]">
                    <span className="text-[9px] font-black uppercase tracking-widest text-gray-600 mb-0.5">{'Description'}</span>
                    <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300 truncate">{tx.detail}</span>
                  </div>
                  <div className="text-right">
                    {tx.type === 'payment' ? (
                      <div className="flex flex-col items-end">
                        <span className="text-[9px] font-black uppercase tracking-widest text-primary/50 mb-0.5">{'Paid'} (Dr)</span>
                        <span className="text-xs font-black text-primary tracking-tighter">{formatCurrency(tx.debit, appSettings.currency)}</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-end">
                        <span className="text-[9px] font-black uppercase tracking-widest text-rose-500/50 mb-0.5">{'Bill'} (Cr)</span>
                        <span className="text-xs font-black text-rose-500 tracking-tighter">{formatCurrency(tx.credit, appSettings.currency)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <Button
                    variant="danger"
                    onClick={() => handleDeleteTransaction(tx.id)}
                    className="!min-h-0 !bg-rose-500/10 !text-rose-500 hover:!bg-rose-500/10 !px-3 !py-1.5 !rounded-lg !text-[9px] !font-black"
                  >
                    <Trash2 className="w-3 h-3" /> {'Delete Entry'}
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="p-4 sm:p-6 bg-gray-50/50 dark:bg-white/[0.02] border-t border-gray-200 dark:border-white/5 flex justify-center">
        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={goToPage}
          totalItems={filteredLedger.length}
          mode="prevNext"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
        />
      </div>
    </>
  );
}
