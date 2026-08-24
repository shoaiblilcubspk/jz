import { useCustomersStore, useExpensesStore, useInventoryStore, usePaymentsStore, useProductsStore, useSalesStore, useSettingsStore, useUsersStore } from '../../stores';
import { useState, useMemo } from 'react';
import { getEffectiveTotal } from '../../lib/reportsUtils';
import { useReportFilters } from './hooks/useReportFilters';
import { useSalesStats } from './hooks/useSalesStats';
import { useExpenseStats } from './hooks/useExpenseStats';
import { usePeopleStats } from './hooks/usePeopleStats';
import { useFinancialStats } from './hooks/useFinancialStats';
import { useInventoryStats } from './hooks/useInventoryStats';
import { sonner } from '../../lib/sonner';
import { salesService } from '../../lib/services';
import { EXPENSE_CATEGORIES } from '../../types';

export { getItemCOGS, getEffectiveTotal, netItemQty, getItemRevenue, isDraftSale } from '../../lib/reportsUtils';

export function useReportsData(subTab: string | undefined) {
  const appCurrentUser = useUsersStore(s => s.currentUser);
  const appSales = useSalesStore(s => s.sales);
  const appExpenses = useExpensesStore(s => s.expenses);
  const appPayments = usePaymentsStore(s => s.payments);
  const appUsers = useUsersStore(s => s.users);
  const appSalesmen = useUsersStore(s => s.salesmen);
  const appSuppliers = useInventoryStore(s => s.suppliers);
  const appProducts = useProductsStore(s => s.products);
  const appSettings = useSettingsStore(s => s.settings);
  const appCustomers = useCustomersStore(s => s.customers);

  const validReportTypes = ['sales', 'inventory', 'customers', 'expenses', 'financial', 'suppliers', 'salesmen'] as const;
  const reportType = (validReportTypes.includes(subTab as any) ? subTab : 'sales') as any;

  const [repairing, setRepairing] = useState(false);
  const [repairProgress, setRepairProgress] = useState<number | null>(null);

  const handleRepairData = async () => {
    const confirmed = await sonner.confirm('Repair Legacy Data?', 'This will audit all legacy sales and backfill missing cost data.', 'YES, REPAIR');
    if (!confirmed.isConfirmed) return;
    setRepairing(true); setRepairProgress(0); sonner.loading('Auditing Data... 0%');
    try {
      const count = await salesService.patchLegacySales((percent) => {
        setRepairProgress(percent); sonner.update('Auditing Data...', `${percent}% Complete`);
      });
      sonner.close(); await sonner.alert('Data Audit Complete', `Patched ${count} legacy sales records.`); window.location.reload();
    } catch (_error) { sonner.close(); await sonner.alert('Repair Failed', 'Failed to repair data.'); } finally { setRepairing(false); setRepairProgress(null); }
  };

  const filterProps = useReportFilters(appSettings, appSales, appExpenses, appPayments, appProducts);
  const { validStartDate, validEndDate, filteredSales, filteredExpenses, filteredPayments, reportSales, reportExpenses, dateRange } = filterProps;

  const salesStats = useSalesStats(filteredSales, appSettings);
  const expenseStats = useExpenseStats(filteredExpenses, validStartDate, validEndDate, dateRange, appSettings);
  const peopleStats = usePeopleStats(filteredSales, appCustomers, appSalesmen);
  const financialStats = useFinancialStats(filteredSales, filteredExpenses, filteredPayments, appSettings);
  const inventoryStats = useInventoryStats(appProducts, filteredSales, reportType);

  const cashiers = useMemo(() => {
    const userNames = appUsers.map(u => u.name).filter(c => c && c.toUpperCase() !== 'UNKNOWN');
    const saleCashiers = reportSales.map(s => s.cashier).filter(c => c && c.toUpperCase() !== 'UNKNOWN');
    const combined = new Set([...userNames, ...saleCashiers]);
    if (appCurrentUser?.name && appCurrentUser.name.toUpperCase() !== 'UNKNOWN') combined.add(appCurrentUser.name);
    return ['All', ...Array.from(combined).sort()];
  }, [reportSales, appUsers, appCurrentUser]);

  const salesmenList = useMemo(() => {
    const activeNames = appSalesmen?.map(s => s.name).filter(Boolean) || [];
    const userNames = appUsers.map(u => u.name).filter(Boolean);
    const saleSalesmen = reportSales.map(s => s.salesmanName).filter(Boolean);
    const combined = new Set([...activeNames, ...userNames, ...saleSalesmen]);
    return ['All', ...Array.from(combined).sort()];
  }, [reportSales, appSalesmen, appUsers]);

  const suppliers = useMemo(() => {
    const registeredSuppliers = appSuppliers.map(s => s.name).filter(Boolean);
    const productSuppliers = appProducts.map(p => p.supplier).filter(Boolean);
    return ['All', ...Array.from(new Set([...registeredSuppliers, ...productSuppliers])).sort()];
  }, [appSuppliers, appProducts]);

  const categories = useMemo(() => {
    if (reportType === 'expenses') return ['All', ...EXPENSE_CATEGORIES];
    if (reportType === 'sales') {
      const soldCategories = new Set<string>();
      reportSales.forEach(sale => { sale.items?.forEach((item: any) => { if (item.product?.category) soldCategories.add(item.product.category); }); });
      return ['All', ...Array.from(soldCategories).sort()];
    }
    const activeProductCategories = new Set(appProducts.map(p => p.category).filter(Boolean));
    return ['All', ...Array.from(activeProductCategories).sort()];
  }, [appProducts, reportSales, reportType]);

  const paymentMethods = useMemo(() => {
    const methods = new Set<string>(['cash', 'card', 'online']);
    reportSales.forEach(s => { if (s.paymentMethod) methods.add(s.paymentMethod); });
    reportExpenses.forEach(e => { if (e.paymentMethod) methods.add(e.paymentMethod); });
    return ['All', ...Array.from(methods).sort()];
  }, [reportSales, reportExpenses]);

  const totalRevenue = filteredSales.reduce((sum, s) => {
    const eff = getEffectiveTotal(s); const tax = Number(s.taxAmount) || 0; return sum + (eff - tax);
  }, 0);
  const totalTransactions = filteredSales.filter(s => s.status === 'completed' || s.status === 'partially_refunded').length;
  const averageTransaction = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
  
  const grossProfit = totalRevenue - salesStats.totalCostOfGoods;
  const totalExpenseAmount = filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const netProfit = grossProfit - totalExpenseAmount;

  return {
    ...filterProps,
    ...salesStats,
    ...expenseStats,
    ...peopleStats,
    ...financialStats,
    ...inventoryStats,
    reportType,
    totalRevenue,
    totalTransactions,
    averageTransaction,
    grossProfit,
    totalExpenseAmount,
    netProfit,
    cashiers,
    salesmenList,
    suppliers,
    categories,
    paymentMethods,
    appSettings,
    appUsers,
    appCurrentUser,
    handleRepairData,
    repairing,
    repairProgress
  };
}
