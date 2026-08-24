import React from 'react';
import { TrendingUp, Store, Package, Wallet, Banknote, CreditCard, Building2 } from 'lucide-react';
import { formatCurrency } from '../../lib/currencies';

interface Props {
  totalRevenue: number;
  retailSalesTotal: number;
  wholesaleSalesTotal: number;
  totalItemsSold: number;
  walletTotals: { cash: number; card: number; online: number; creditReceived?: number; creditGiven?: number; creditRecovered?: number };
  appSettings: any;
  showRetail: boolean;
  showWholesale: boolean;
  activeCardsCount: number;
}

export function TransactionHeaderCards({
  totalRevenue, retailSalesTotal, wholesaleSalesTotal, totalItemsSold,
  walletTotals, appSettings, showRetail, showWholesale, activeCardsCount
}: Props) {
  return (
    <>
      <div className={`grid grid-cols-2 gap-4 ${activeCardsCount === 5
          ? "sm:grid-cols-3 lg:grid-cols-5"
          : activeCardsCount === 4
            ? "sm:grid-cols-2 lg:grid-cols-4"
            : "sm:grid-cols-3"
        }`}>
        <div className="stat-card bg-gradient-to-br from-[#0EA5E9] to-[#0284C7]">
          <div className="stat-card-inner">
            <span className="stat-card-label">{"Total Revenue"}</span>
            <span className="stat-card-value">{formatCurrency(totalRevenue, appSettings.currency)}</span>
          </div>
          <TrendingUp className="stat-card-icon h-12 w-12 text-white" />
        </div>
        {showRetail && (
          <div className="stat-card bg-gradient-to-br from-[#10B981] to-[#059669]">
            <div className="stat-card-inner">
              <span className="stat-card-label">{"Retail Sales"}</span>
              <span className="stat-card-value">{formatCurrency(retailSalesTotal, appSettings.currency)}</span>
            </div>
            <Store className="stat-card-icon h-12 w-12 text-white" />
          </div>
        )}
        {showWholesale && (
          <div className="stat-card bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8]">
            <div className="stat-card-inner">
              <span className="stat-card-label">{"Wholesale Sales"}</span>
              <span className="stat-card-value">{formatCurrency(wholesaleSalesTotal, appSettings.currency)}</span>
            </div>
            <Package className="stat-card-icon h-12 w-12 text-white" />
          </div>
        )}
        <div className="stat-card bg-gradient-to-br from-[#F97316] to-[#C2410C]">
          <div className="stat-card-inner">
            <span className="stat-card-label">{"Items Sold"}</span>
            <span className="stat-card-value">{totalItemsSold}</span>
          </div>
          <Package className="stat-card-icon h-12 w-12 text-white" />
        </div>
      </div>
      <div className="bg-white/50 dark:bg-black/20 p-4 rounded-[1.75rem] border border-gray-200/50 dark:border-white/5 shadow-xl space-y-3">
        <div className="flex items-center gap-1.5 px-1 py-1 mb-2 text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-gray-700 dark:text-gray-300">
          <Wallet className="h-3.5 w-3.5 text-[#10B981]" />
          <span>{"WALLETS & CASH FLOW BREAKDOWN"}</span>
        </div>
        <div className={`grid grid-cols-1 sm:grid-cols-3 ${(appSettings.enableCreditSales || appSettings.enable_credit_sales) ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-3`}>
          <div className="relative overflow-hidden bg-white dark:bg-[#1C1C1C] border border-gray-200 dark:border-white/5 rounded-2xl p-4 flex items-center justify-between transition-all hover:scale-[1.02] hover:border-primary/30 dark:hover:border-primary/30 shadow-sm">
            <div className="flex flex-col">
              <span className="text-[9px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-widest leading-none">{"Cash Wallet"}</span>
              <span className="text-base font-black text-primary dark:text-primary tabular-nums mt-1.5 leading-none">
                {formatCurrency(walletTotals.cash, appSettings.currency)}
              </span>
            </div>
            <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/10">
              <Banknote className="h-4 w-4 text-primary" />
            </div>
          </div>
          <div className="relative overflow-hidden bg-white dark:bg-[#1C1C1C] border border-gray-200 dark:border-white/5 rounded-2xl p-4 flex items-center justify-between transition-all hover:scale-[1.02] hover:border-blue-500/30 dark:hover:border-blue-500/30 shadow-sm">
            <div className="flex flex flex-col">
              <span className="text-[9px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-widest leading-none">{"Card Wallet"}</span>
              <span className="text-base font-black text-blue-600 dark:text-blue-500 tabular-nums mt-1.5 leading-none">
                {formatCurrency(walletTotals.card, appSettings.currency)}
              </span>
            </div>
            <div className="w-8 h-8 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/10">
              <CreditCard className="h-4 w-4 text-blue-500" />
            </div>
          </div>
          <div className="relative overflow-hidden bg-white dark:bg-[#1C1C1C] border border-gray-200 dark:border-white/5 rounded-2xl p-4 flex items-center justify-between transition-all hover:scale-[1.02] hover:border-cyan-500/30 dark:hover:border-cyan-500/30 shadow-sm">
            <div className="flex flex-col">
              <span className="text-[9px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-widest leading-none">{"Online Wallet"}</span>
              <span className="text-base font-black text-cyan-600 dark:text-cyan-500 tabular-nums mt-1.5 leading-none">
                {formatCurrency(walletTotals.online, appSettings.currency)}
              </span>
            </div>
            <div className="w-8 h-8 bg-cyan-500/10 rounded-xl flex items-center justify-center border border-cyan-500/10">
              <Building2 className="h-4 w-4 text-cyan-500" />
            </div>
          </div>
          {(appSettings.enableCreditSales || appSettings.enable_credit_sales) && (
            <div className="relative overflow-hidden bg-white dark:bg-[#1C1C1C] border border-gray-200 dark:border-white/5 rounded-2xl p-4 flex flex-col justify-between transition-all hover:scale-[1.02] hover:border-amber-500/30 dark:hover:border-amber-500/30 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[9px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest leading-none">{"Credit Wallet"}</span>
                <div className="w-8 h-8 bg-amber-500/10 rounded-xl flex items-center justify-center border border-amber-500/10">
                  <Wallet className="h-4 w-4 text-amber-500" />
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[9px] font-bold text-gray-500 uppercase">
                  <span>Given</span>
                  <span className="text-amber-500">+{formatCurrency(walletTotals.creditGiven || 0, appSettings.currency)}</span>
                </div>
                <div className="flex justify-between items-center text-[9px] font-bold text-gray-500 uppercase">
                  <span>Recovered</span>
                  <span className="text-blue-500">-{formatCurrency(walletTotals.creditRecovered || 0, appSettings.currency)}</span>
                </div>
              </div>
              <div className="pt-2 mt-2 border-t border-gray-100 dark:border-white/5 flex justify-between items-center">
                <span className="text-[9px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-widest">{"Net Pending"}</span>
                <span className="text-base font-black text-amber-600 dark:text-amber-500 tabular-nums leading-none">
                  {formatCurrency((walletTotals.creditGiven || 0) - (walletTotals.creditRecovered || 0), appSettings.currency)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
