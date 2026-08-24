import { useState, useMemo, useEffect, useRef } from 'react';
import { getTimezone, getStartOfDayInTimezone, getEndOfDayInTimezone, getStartOfInputDayInTimezone, getEndOfInputDayInTimezone } from '../../../lib/dateUtils';
import { isDraftSale } from '../../../lib/reportsUtils';
import { salesService, expensesService } from '../../../lib/services';
import { Sale, Expense } from '../../../types';

export function useReportFilters(appSettings: any, appSales: any, appExpenses: any, appPayments: any, appProducts: any) {
  const [dateRange, setDateRange] = useState('today');
  const [startDateInput, setStartDateInput] = useState('');
  const [endDateInput, setEndDateInput] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedCashier, setSelectedCashier] = useState('All');
  const [selectedSalesman, setSelectedSalesman] = useState('All');
  const [selectedSaleType, setSelectedSaleType] = useState<'all' | 'retail' | 'wholesale'>('all');
  const [selectedPayment, setSelectedPayment] = useState('All');

  const { validStartDate, validEndDate } = useMemo(() => {
    const timezone = getTimezone(appSettings?.country ?? 'US');
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    if (dateRange === 'custom') {
      startDate = startDateInput
        ? new Date(getStartOfInputDayInTimezone(startDateInput, timezone).getTime())
        : new Date(getStartOfDayInTimezone(now, timezone).getTime());
      endDate = endDateInput
        ? new Date(getEndOfInputDayInTimezone(endDateInput, timezone).getTime())
        : new Date(getEndOfDayInTimezone(now, timezone).getTime());
    } else if (dateRange === 'today') {
      startDate = getStartOfDayInTimezone(now, timezone);
      endDate = getEndOfDayInTimezone(now, timezone);
    } else if (dateRange === 'yesterday') {
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      startDate = getStartOfDayInTimezone(yesterday, timezone);
      endDate = getEndOfDayInTimezone(yesterday, timezone);
    } else if (dateRange === 'last7') {
      const last7 = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
      startDate = getStartOfDayInTimezone(last7, timezone);
      endDate = getEndOfDayInTimezone(now, timezone);
    } else if (dateRange === 'thisMonth') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      startDate = getStartOfDayInTimezone(startOfMonth, timezone);
      endDate = getEndOfDayInTimezone(now, timezone);
    } else if (dateRange === 'lastMonth') {
      const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lmEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      startDate = getStartOfDayInTimezone(lm, timezone);
      endDate = getEndOfDayInTimezone(lmEnd, timezone);
    } else if (dateRange === 'all') {
      startDate = new Date(Date.UTC(2000, 0, 1));
      endDate = getEndOfDayInTimezone(now, timezone);
    } else {
      startDate = getStartOfDayInTimezone(now, timezone);
      endDate = getEndOfDayInTimezone(now, timezone);
    }
    return { validStartDate: startDate, validEndDate: endDate };
  }, [dateRange, startDateInput, endDateInput, appSettings?.country]);

  const [reportSales, setReportSales] = useState<Sale[]>([]);
  const [reportRefunds, setReportRefunds] = useState<Sale[]>([]);
  const [reportExpenses, setReportExpenses] = useState<Expense[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(false);

  const reportCache = useRef<Record<string, { sales: any[], refunds: any[], expenses: any[], timestamp: number }>>({});
  const [reportRefreshKey, setReportRefreshKey] = useState(0);

  useEffect(() => {
    const handleFocus = () => { reportCache.current = {}; setReportRefreshKey(k => k + 1); };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') handleFocus(); });
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  useEffect(() => { reportCache.current = {}; }, [appSales, appExpenses, appPayments]);

  useEffect(() => {
    const fetchReportData = async () => {
      const cacheKey = `${validStartDate.toISOString()}-${validEndDate.toISOString()}`;
      if (reportCache.current[cacheKey] && Date.now() - reportCache.current[cacheKey].timestamp < 10000) {
        setReportSales(reportCache.current[cacheKey].sales);
        setReportRefunds(reportCache.current[cacheKey].refunds);
        setReportExpenses(reportCache.current[cacheKey].expenses);
        return;
      }
      try {
        const [lSales, lRefunds, lExpenses] = await Promise.all([
          salesService.getReportSalesLocal(validStartDate, validEndDate),
          salesService.getReportRefundsLocal(validStartDate, validEndDate),
          expensesService.getReportExpensesLocal(validStartDate, validEndDate)
        ]);
        setReportSales(lSales); setReportRefunds(lRefunds); setReportExpenses(lExpenses);
      } catch (e) { console.warn('[Reports] Local fetch failed:', e); }

      setIsDataLoading(true);
      try {
        const [sales, refunds, expenses] = await Promise.all([
          salesService.getReportSales(validStartDate, validEndDate),
          salesService.getReportRefunds(validStartDate, validEndDate),
          expensesService.getReportExpenses(validStartDate, validEndDate)
        ]);
        reportCache.current[cacheKey] = { sales, refunds, expenses, timestamp: Date.now() };
        setReportSales(sales); setReportRefunds(refunds); setReportExpenses(expenses);
      } catch (e) { console.error("Report data fetch failed:", e); } finally { setIsDataLoading(false); }
    };
    fetchReportData();
  }, [validStartDate, validEndDate, appSales, appExpenses, reportRefreshKey]);

  const filteredSales = useMemo(() => {
    const salesById = new Map<string, any>();
    reportSales.forEach(s => { if (s && s.id) salesById.set(s.id, s); });
    reportRefunds.forEach(s => { if (s && s.id && !salesById.has(s.id)) salesById.set(s.id, s); });
    const allSalesRaw = Array.from(salesById.values());

    const allSales = allSalesRaw.map(sale => {
      if (!sale || !sale.items) return sale;
      let hasAddons = false;
      const unrolledItems = sale.items.flatMap(item => {
        if (!item.addonItems || item.addonItems.length === 0) return [item];
        hasAddons = true;
        let addonSubtotalSum = 0; let addonCostSum = 0;
        const parentQty = Math.abs(Number(item.weight || item.quantity) || 0);
        const addonsAsItems = item.addonItems.map(addon => {
          const addonSubtotal = (addon.price || 0) * (addon.quantity || 1) * parentQty;
          addonSubtotalSum += addonSubtotal;
          const actualAddonProd = appProducts.find((p: any) => p.id === addon.addon.addonProductId);
          const addonCost = (actualAddonProd?.cost || 0) * (addon.quantity || 1) * parentQty;
          addonCostSum += addonCost;
          return {
            id: `${item.id}-addon-${addon.addon.id}`,
            product: actualAddonProd || { id: addon.addon.addonProductId, name: addon.name, category: 'Add-ons' },
            quantity: (addon.quantity || 1) * parentQty,
            refundedQuantity: (addon.quantity || 1) * (item.refundedQuantity || 0),
            subtotal: addonSubtotal,
            purchaseCost: addonCost,
            isAddon: true
          };
        });
        return [
          { ...item, subtotal: (item.subtotal || 0) - addonSubtotalSum, purchaseCost: (item.purchaseCost || 0) - addonCostSum },
          ...addonsAsItems
        ];
      });
      if (hasAddons) return { ...sale, items: unrolledItems };
      return sale;
    });

    return allSales.filter(sale => {
      if (!sale || !sale.items || isDraftSale(sale)) return false;
      if (selectedSupplier !== 'All') { if (!sale.items.some(item => item.product?.supplier === selectedSupplier)) return false; }
      if (selectedCategory !== 'All') { if (!sale.items.some(item => item.product?.category === selectedCategory)) return false; }
      if (selectedCashier !== 'All') { if (sale.cashier !== selectedCashier) return false; }
      if (selectedSalesman !== 'All') { if (sale.salesmanName !== selectedSalesman) return false; }
      if (selectedSaleType !== 'all') { if ((sale.saleType || 'retail') !== selectedSaleType) return false; }
      if (selectedPayment !== 'All') { if (sale.paymentMethod !== selectedPayment.toLowerCase()) return false; }
      return true;
    });
  }, [reportSales, reportRefunds, selectedSupplier, selectedCategory, selectedCashier, selectedSalesman, selectedSaleType, selectedPayment, appProducts]);

  const filteredExpenses = useMemo(() => {
    return reportExpenses.filter(expense => {
      if (selectedCategory !== 'All' && expense.category !== selectedCategory) return false;
      if (selectedPayment !== 'All' && expense.paymentMethod !== selectedPayment.toLowerCase()) return false;
      return true;
    });
  }, [reportExpenses, selectedCategory, selectedPayment]);

  const filteredPayments = useMemo(() => {
    return appPayments.filter((p: any) => {
      const pDate = new Date(p.createdAt || p.created_at || p.timestamp);
      return pDate >= validStartDate && pDate <= validEndDate;
    });
  }, [appPayments, validStartDate, validEndDate]);

  return {
    dateRange, setDateRange,
    startDateInput, setStartDateInput,
    endDateInput, setEndDateInput,
    selectedSupplier, setSelectedSupplier,
    selectedCategory, setSelectedCategory,
    selectedCashier, setSelectedCashier,
    selectedSalesman, setSelectedSalesman,
    selectedSaleType, setSelectedSaleType,
    selectedPayment, setSelectedPayment,
    validStartDate, validEndDate,
    isDataLoading,
    reportSales, reportExpenses,
    filteredSales, filteredExpenses, filteredPayments
  };
}
