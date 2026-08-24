import { Customer } from '../../types';
import { getTimezone, getStartOfDayInTimezone, getEndOfDayInTimezone, getStartOfInputDayInTimezone, getEndOfInputDayInTimezone } from '../../lib/dateUtils';
import { getEffectiveTotal } from '../reports/useReportsData';

export const CURRENCY_DIAL_CODE: Record<string, string> = {
  PKR: '92',   // Pakistan
  INR: '91',   // India
  BDT: '880',  // Bangladesh
  AFN: '93',   // Afghanistan
  AED: '971',  // UAE
  SAR: '966',  // Saudi Arabia
  QAR: '974',  // Qatar
  KWD: '965',  // Kuwait
  BHD: '973',  // Bahrain
  OMR: '968',  // Oman
  USD: '1',    // United States
  EUR: '44',   // Default to UK for Euro (no single code)
  GBP: '44',   // United Kingdom
  CNY: '86',   // China
  JPY: '81',   // Japan
  CAD: '1',    // Canada (same as US +1)
  AUD: '61',   // Australia
  CHF: '41',   // Switzerland
  TRY: '90',   // Turkey
  MYR: '60',   // Malaysia
  SGD: '65',   // Singapore
  IDR: '62',   // Indonesia
  THB: '66',   // Thailand
  NGN: '234',  // Nigeria
  EGP: '20',   // Egypt
  ZAR: '27',   // South Africa
};

export function computeCustomerDateRange(
  dateFilter: string,
  startDateInput: string,
  endDateInput: string,
  country: string
): { validStartDate: Date; validEndDate: Date } {
  const timezone = getTimezone(country);
  const now = new Date();
  let startDate: Date;
  let endDate: Date;

  if (dateFilter === 'custom') {
    startDate = startDateInput
      ? new Date(getStartOfInputDayInTimezone(startDateInput, timezone).getTime())
      : new Date(getStartOfDayInTimezone(now, timezone).getTime());
    endDate = endDateInput
      ? new Date(getEndOfInputDayInTimezone(endDateInput, timezone).getTime())
      : new Date(getEndOfDayInTimezone(now, timezone).getTime());
  } else if (dateFilter === 'today') {
    startDate = getStartOfDayInTimezone(now, timezone);
    endDate = getEndOfDayInTimezone(now, timezone);
  } else if (dateFilter === 'yesterday') {
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    startDate = getStartOfDayInTimezone(yesterday, timezone);
    endDate = getEndOfDayInTimezone(yesterday, timezone);
  } else if (dateFilter === 'last7') {
    const last7 = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
    startDate = getStartOfDayInTimezone(last7, timezone);
    endDate = getEndOfDayInTimezone(now, timezone);
  } else if (dateFilter === 'thisMonth') {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    startDate = getStartOfDayInTimezone(startOfMonth, timezone);
    endDate = getEndOfDayInTimezone(now, timezone);
  } else if (dateFilter === 'lastMonth') {
    const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lmEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    startDate = getStartOfDayInTimezone(lm, timezone);
    endDate = getEndOfDayInTimezone(lmEnd, timezone);
  } else if (dateFilter === 'all') {
    startDate = new Date(Date.UTC(2000, 0, 1));
    endDate = getEndOfDayInTimezone(now, timezone);
  } else {
    startDate = new Date(Date.UTC(2000, 0, 1));
    endDate = getEndOfDayInTimezone(now, timezone);
  }

  return { validStartDate: startDate, validEndDate: endDate };
}

export function filterCustomers(
  appCustomers: Customer[],
  appSales: any[],
  searchTerm: string,
  dateFilter: string,
  validStartDate: Date,
  validEndDate: Date,
  country: string
): Customer[] {
  const timezone = getTimezone(country);
  const effectiveStart = getStartOfDayInTimezone(validStartDate, timezone).getTime();
  const effectiveEnd = getEndOfDayInTimezone(validEndDate, timezone).getTime();

  return appCustomers.filter((customer: Customer) => {
    const matchesSearch = (
      (customer.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (customer.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (customer.phone || '').includes(searchTerm)
    );
    if (!matchesSearch) return false;

    if (dateFilter === 'all') return true;

    const lastPurchaseTs = customer.lastPurchase ? new Date(customer.lastPurchase).getTime() : 0;
    if (lastPurchaseTs >= effectiveStart && lastPurchaseTs <= effectiveEnd) return true;
    if (!customer.lastPurchase) return false;

    const hasSaleInRange = appSales.some(s =>
      (s.customerId === customer.id || s.customerName?.toLowerCase() === customer.name?.toLowerCase()) &&
      new Date(s.timestamp || s.createdAt || 0).getTime() >= effectiveStart &&
      new Date(s.timestamp || s.createdAt || 0).getTime() <= effectiveEnd
    );
    return hasSaleInRange;
  });
}

export function filterSalesByDate(
  appSales: any[],
  validStartDate: Date,
  validEndDate: Date,
  dateFilter: string,
  country: string
): any[] {
  const timezone = getTimezone(country);
  const effectiveStart = getStartOfDayInTimezone(validStartDate, timezone).getTime();
  const effectiveEnd = getEndOfDayInTimezone(validEndDate, timezone).getTime();

  return dateFilter === 'all' ? appSales : appSales.filter(sale => {
    const saleDate = new Date(sale.timestamp || sale.createdAt || 0).getTime();
    return saleDate >= effectiveStart && saleDate <= effectiveEnd;
  });
}

export function computeActiveCustomers(appCustomers: Customer[], country: string): number {
  const timezone = getTimezone(country);
  const now = new Date();
  const thirtyDaysAgo = getStartOfDayInTimezone(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), timezone).getTime();
  return appCustomers.filter((c: Customer) => c.lastPurchase &&
    new Date(c.lastPurchase).getTime() >= thirtyDaysAgo
  ).length;
}

export function getCustomerTotalPurchases(sales: any[], customerId: string, defaultTotal: number | undefined): number {
  const customerSales = sales.filter(s => s.customerId === customerId || s.customerName?.toLowerCase() === customerId.toLowerCase());
  if (customerSales.length > 0) {
    return customerSales.reduce((acc, s) => acc + getEffectiveTotal(s), 0);
  }
  return defaultTotal || 0;
}

export function computeTotalPurchases(appCustomers: Customer[], dateFilter: string, filteredSalesByDate: any[]): number {
  if (dateFilter === 'all') return appCustomers.reduce((sum: number, c: Customer) => sum + Math.max(0, c.totalPurchases || 0), 0);
  return filteredSalesByDate.reduce((sum, s) => sum + getEffectiveTotal(s), 0);
}
