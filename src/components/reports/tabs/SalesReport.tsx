import React, { useMemo } from 'react';
import { ShoppingBag, ShoppingCart } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { formatCurrency } from '../../../lib/currencies';
import { Sale } from '../../../types';

import { SalesHistoryTable } from './sales/SalesHistoryTable';
import { SalesSummaryStats } from './sales/SalesSummaryStats';
import { SalesCharts } from './sales/SalesCharts';

interface SalesReportProps {
  filteredSales: Sale[];
  salesData: { date: string; sales: number; transactions: number }[];
  categoryData: { name: string; value: number }[];
  saleTypeData: { name: string; value: number }[];
  topProducts: { name: string; quantity: number; revenue: number }[];
  featureAnalytics: {
    serviceRevenue: number;
    productRevenue: number;
    modifiersRevenue: number;
    topVariants: { name: string; quantity: number; revenue: number }[];
  };
  totalRevenue: number;
  totalTransactions: number;
  averageTransaction: number;
  totalCostOfGoods: number;
  grossProfit: number;
  totalExpenseAmount: number;
  netProfit: number;
  walletStats: {
    method: string;
    sales: number;
    expenses: number;
    net: number;
    retailSales: number;
    wholesaleSales: number;
  }[];
  currency: string;
  theme: string;
  country: string;
  users: any[];
  retailEnabled?: boolean;
  wholesaleEnabled: boolean;
}

export function SalesReport({
  filteredSales, salesData, categoryData, saleTypeData, topProducts, featureAnalytics, totalRevenue, totalTransactions, averageTransaction, totalCostOfGoods, grossProfit, totalExpenseAmount, netProfit, walletStats, currency, theme, country, users, retailEnabled = true, wholesaleEnabled
}: SalesReportProps) {
  const netTotal = (s: any) =>
    s.status === 'refunded' || s.status === 'deleted' ? 0 :
    s.status === 'partially_refunded' ? (Number(s.total) || 0) - (Number(s.refundedAmount) || 0) :
    (Number(s.total) || 0);

  const { retailVol, retailCount, wholesaleVol, wholesaleCount } = useMemo(() => {
    let rVol = 0, rCount = 0;
    let wVol = 0, wCount = 0;

    filteredSales.forEach(s => {
      if (s.status === 'refunded' || s.status === 'deleted') return;
      const net = netTotal(s);
      const type = s.saleType || 'retail';
      if (type === 'retail') {
        rVol += net;
        rCount++;
      } else if (type === 'wholesale') {
        wVol += net;
        wCount++;
      }
    });

    return {
      retailVol: rVol,
      retailCount: rCount,
      wholesaleVol: wVol,
      wholesaleCount: wCount
    };
  }, [filteredSales]);

  return (
    <>
      <SalesSummaryStats
        totalRevenue={totalRevenue}
        totalTransactions={totalTransactions}
        averageTransaction={averageTransaction}
        totalCostOfGoods={totalCostOfGoods}
        grossProfit={grossProfit}
        totalExpenseAmount={totalExpenseAmount}
        netProfit={netProfit}
        currency={currency}
      />

      {(wholesaleEnabled) && (
        <div className="mt-6">
          <h3 className="text-[10px] font-black text-gray-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
            {"Sale Mode Performance"}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {(retailEnabled ?? true) && (
              <div className="p-5 rounded-3xl border border-blue-500/20 bg-blue-500/5 shadow-sm relative overflow-hidden group hover:border-blue-500/40 transition-all">
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 opacity-10 rounded-bl-full group-hover:scale-110 transition-transform duration-500" />
                <div className="relative z-10 space-y-1">
                  <span className="text-[10px] font-black text-blue-600/70 uppercase tracking-widest">{"Retail Sales"} ({retailCount})</span>
                  <p className="text-2xl font-black text-blue-600">{formatCurrency(retailVol, currency)}</p>
                  <p className="text-[9px] font-bold text-gray-500 mt-2">{"Direct sales to walk-in or retail customers"}</p>
                </div>
              </div>
            )}
            {wholesaleEnabled && (
              <div className="p-5 rounded-3xl border border-purple-500/20 bg-purple-500/5 shadow-sm relative overflow-hidden group hover:border-purple-500/40 transition-all">
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-purple-500 to-pink-600 opacity-10 rounded-bl-full group-hover:scale-110 transition-transform duration-500" />
                <div className="relative z-10 space-y-1">
                  <span className="text-[10px] font-black text-purple-600/70 uppercase tracking-widest">{"Wholesale Sales"} ({wholesaleCount})</span>
                  <p className="text-2xl font-black text-purple-600">{formatCurrency(wholesaleVol, currency)}</p>
                  <p className="text-[9px] font-bold text-gray-500 mt-2">{"Bulk orders to businesses and vendors"}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mt-8">
        <h3 className="text-[10px] font-black text-gray-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
          {"Expected Wallet Balances (Sales − Expenses)"}
        </h3>
        <div className={`grid grid-cols-1 sm:grid-cols-3 ${walletStats.length === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4 lg:gap-6`}>
          {walletStats.map(wallet => (
            <div key={wallet.method} className={`p-5 rounded-3xl border border-white/10 shadow-xl transition-all group overflow-hidden relative ${
                wallet.method === 'cash' ? 'bg-gradient-to-br from-emerald-500 to-teal-700' :
                wallet.method === 'card' ? 'bg-gradient-to-br from-blue-500 to-indigo-700' :
                wallet.method === 'credit' ? 'bg-gradient-to-br from-amber-600 to-orange-800' :
                'bg-gradient-to-br from-cyan-600 to-blue-800'
              }`}>
              <div className="absolute top-0 right-0 w-24 h-24 opacity-20 transition-opacity group-hover:opacity-40 bg-white"></div>
              <div className="space-y-3 relative z-10 text-white">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-white uppercase tracking-wider">{wallet.method.replace('_', ' ')}</span>
                  <span className="text-[8px] font-black uppercase tracking-widest bg-white/20 px-1.5 py-0.5 rounded-md">Wallet</span>
                </div>
                
                <div className="space-y-1.5">
                  <div className="flex justify-between items-end">
                    <span className="text-[9px] font-black text-white/60 uppercase tracking-widest">{"Sales"}</span>
                    <span className="text-xs font-black text-white">+{formatCurrency(wallet.sales, currency)}</span>
                  </div>
                  
                  <div className="pl-2 border-l border-white/10 space-y-0.5 text-[8px] text-white/70 font-bold">
                    {(retailEnabled ?? true) && (wallet.retailSales > 0 || (wallet.retailSales === 0 && wallet.wholesaleSales === 0)) && (
                      <div className="flex justify-between items-center">
                        <span>Retail</span>
                        <span>{formatCurrency(wallet.retailSales, currency)}</span>
                      </div>
                    )}
                    {wholesaleEnabled && wallet.wholesaleSales > 0 && (
                      <div className="flex justify-between items-center">
                        <span>Wholesale</span>
                        <span>{formatCurrency(wallet.wholesaleSales, currency)}</span>
                      </div>
                    )}
                  </div>
                  
                  {wallet.method !== 'credit' && (
                    <div className="flex justify-between items-end pt-1">
                      <span className="text-[9px] font-black text-white/60 uppercase tracking-widest">{"Expenses"}</span>
                      <span className="text-xs font-black text-white">-{formatCurrency(wallet.expenses + wallet.refunds, currency)}</span>
                    </div>
                  )}
                  {wallet.method === 'credit' && (
                    <div className="flex justify-between items-end pt-1">
                      <span className="text-[9px] font-black text-white/60 uppercase tracking-widest">{"Recovered"}</span>
                      <span className="text-xs font-black text-white">-{formatCurrency(wallet.customerPayments || 0, currency)}</span>
                    </div>
                  )}
                </div>
                
                <div className="pt-3 mt-1 border-t border-white/20">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-white/90 uppercase tracking-widest">{wallet.method === 'credit' ? "Pending Debt" : "Expected"}</span>
                    <span className="text-lg font-black text-white">{formatCurrency(wallet.net, currency)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <SalesCharts
        salesData={salesData}
        featureAnalytics={featureAnalytics}
        categoryData={categoryData}
        currency={currency}
        theme={theme}
      />

      {(wholesaleEnabled) && saleTypeData.length > 0 && (
        <div className="card p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center">
            <ShoppingBag className="h-5 w-5 mr-2 text-blue-600" />{"Sale Type Breakdown"}
          </h3>
          <div className="flex flex-col lg:flex-row items-center gap-8">
            <div className="w-full lg:w-1/2 h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={saleTypeData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {saleTypeData.map((_, index) => (<Cell key={`cell-${index}`} fill={['#3b82f6', '#8b5cf6', '#ec4899'][index % 3]} />))}
                  </Pie>
                  <Tooltip formatter={(val: number) => formatCurrency(val, currency)} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', backgroundColor: theme === 'dark' ? '#171717' : 'white', color: theme === 'dark' ? '#fff' : '#000' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full lg:w-1/2 space-y-3">
              {saleTypeData.map((type, index) => (
                <div key={type.name} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-transparent hover:border-gray-200 dark:hover:border-white/10 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ['#3b82f6', '#8b5cf6', '#ec4899'][index % 3] }} />
                    <span className="text-sm font-bold text-gray-700 dark:text-gray-300 capitalize">{type.name}</span>
                  </div>
                  <span className="font-black text-gray-900 dark:text-white">{formatCurrency(type.value, currency)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <SalesHistoryTable
        filteredSales={filteredSales}
        currency={currency}
        country={country}
        users={users}
      />

      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-white/10">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
            <ShoppingCart className="h-5 w-5 mr-2 text-green-600" />{"Top Selling Products"}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead className="table-header">
              <tr>
                <th className="table-header-cell hidden sm:table-cell">{"Rank"}</th>
                <th className="table-header-cell">{"Product"}</th>
                <th className="table-header-cell">{"Quantity Sold"}</th>
                <th className="table-header-cell">{"Revenue"}</th>
                <th className="table-header-cell hidden sm:table-cell">{"Avg. Price"}</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-surface divide-y divide-gray-200 dark:divide-white/5">
              {topProducts.map((product, index) => (
                <tr key={index} className="table-row">
                  <td className="table-cell hidden sm:table-cell">
                    <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-full font-bold text-sm">{index + 1}</div>
                  </td>
                  <td className="table-cell font-semibold text-gray-900 dark:text-white">{product.name}</td>
                  <td className="table-cell"><span className="badge badge-emerald-light">{product.quantity}</span></td>
                  <td className="table-cell font-semibold text-green-600">{formatCurrency(product.revenue, currency)}</td>
                  <td className="table-cell text-gray-600 dark:text-gray-400 hidden sm:table-cell">{formatCurrency(product.revenue / product.quantity, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
