import { Sale } from '../../types';
import { getAmountByMethod } from '../../lib/services';
import { formatAppDate, formatAppTime } from '../../lib/dateUtils';
import { formatNumberWithPrecision } from '../../lib/currencies';
import { BadgeTone } from '../../shared/ui';

export const getStatusTone = (status: string): BadgeTone => {
  switch (status) {
    case 'completed':
    case 'draft': return 'success';
    case 'pending':
    case 'partially_refunded': return 'warning';
    case 'refunded': return 'danger';
    default: return 'neutral';
  }
};

const getSaleTypeLabel = (type?: string) => {
  switch (type) {
    case 'wholesale': return 'Wholesale';
    default: return 'Retail';
  }
};

export const computeWalletTotals = (
  filteredTransactions: Sale[],
  appExpenses: any[],
  appPayments: any[],
  startTs: number,
  endTs: number,
) => {
  const totals = {
    cash: 0,
    card: 0,
    online: 0,
    creditReceived: 0,
    creditGiven: 0,
    creditRecovered: 0,
  };

  filteredTransactions.forEach(t => {
    const addToWallet = (method: 'cash' | 'card' | 'online', amt: number) => {
      totals[method] = Math.round((totals[method] + amt) * 100) / 100;
    };

    if (t.status !== 'pending') {
      addToWallet('cash', getAmountByMethod(t, 'cash'));
      addToWallet('card', getAmountByMethod(t, 'card'));
      addToWallet('online', getAmountByMethod(t, 'online'));
      if (t.status !== 'refunded') {
        totals.creditGiven += getAmountByMethod(t, 'credit');
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

  appExpenses?.forEach(e => {
    const eTs = new Date(e.createdAt).getTime();
    if (eTs >= startTs && eTs <= endTs) {
      if (e.paymentMethod === 'cash') totals.cash -= Number(e.amount);
      if (e.paymentMethod === 'card') totals.card -= Number(e.amount);
      if (e.paymentMethod === 'online') totals.online -= Number(e.amount);
    }
  });

  appPayments?.forEach(p => {
    const pTs = new Date(p.createdAt || p.created_at || p.timestamp).getTime();
    if (pTs >= startTs && pTs <= endTs) {
      const amt = Number(p.amount);
      const method = (p.paymentMethod || p.paymentType || p.method || 'cash') as 'cash' | 'card' | 'online';
      
      if (p.direction === 'in') {
        if (method === 'cash') totals.cash += amt;
        if (method === 'card') totals.card += amt;
        if (method === 'online') totals.online += amt;
        
        totals.creditReceived += amt; // legacy tracker
        totals.creditRecovered += amt; // any incoming payment is a recovery (since payments are against ledger)
      } else if (p.direction === 'out') {
        if (method === 'cash') totals.cash -= amt;
        if (method === 'card') totals.card -= amt;
        if (method === 'online') totals.online -= amt;
      }
    }
  });

  return totals;
};

export const buildExportColumns = (isAdmin: boolean) => {
  const cols: any[] = [
    { key: 'date', label: "Date" },
    { key: 'time', label: "Time" },
    { key: 'invoiceNumber', label: "Invoice Number" },
    { key: 'receiptNumber', label: "Receipt Number" },
    { key: 'customerName', label: "Customer Name" },
    { key: 'customerPhone', label: "Customer Phone" },
    { key: 'cashier', label: "Cashier" },
    { key: 'cashierAt', label: "Cashier @Username" },
    { key: 'salesmanName', label: "Salesman" },
    { key: 'itemsList', label: "Items List" },
    { key: 'totalItemsQty', label: "Items Qty", format: 'number' as const },
    { key: 'saleType', label: "Sale Type" },
    { key: 'paymentMethod', label: "Payment Method" },
    { key: 'subtotal', label: "Subtotal", format: 'currency' as const },
    { key: 'discountAmount', label: "Discount", format: 'currency' as const },
    { key: 'taxAmount', label: "Tax", format: 'currency' as const },
    { key: 'total', label: "Total Revenue", format: 'currency' as const },
  ];
  if (isAdmin) {
    cols.push(
      { key: 'costOfGoods', label: "Cost of Goods", format: 'currency' as const },
      { key: 'grossProfit', label: "Gross Profit", format: 'currency' as const },
    );
  }
  return cols;
};

export const buildExportRows = (
  filteredTransactions: Sale[],
  appCustomers: any[],
  appUsers: any[],
  isAdmin: boolean,
  country: string,
  timezone: string,
) => {
  return filteredTransactions.map(sale => {
    const customer = sale.customerId ? appCustomers.find(c => c.id === sale.customerId) : null;
    const customerName = customer?.name || sale.customerName || 'Walk-in';
    const customerPhone = customer?.phone || '';
    const cashierUser = appUsers.find(u => u.name === sale.cashier || u.email === sale.cashier);
    const cashierName = sale.cashier || 'System';
    const cashierAt = cashierUser?.username ? `@${cashierUser.username}` : '';

    const itemsList = sale.items.map(item => {
      const sku = item.product?.sku ? ` [${item.product.sku}]` : '';
      return `${item.product?.name || 'Item'}${sku} x ${item.quantity} @ ${formatNumberWithPrecision(item.price || 0)}`;
    }).join('; ');

    const totalItemsQty = sale.items.reduce((sum, item) => sum + item.quantity, 0);
    const dateObj = new Date(sale.timestamp);

    const totalCostLocal = sale.items.reduce((sum, item) => {
      return sum + (item.purchaseCost ?? (item.product?.cost || 0) * item.quantity);
    }, 0);

    return {
      date: formatAppDate(dateObj, country),
      time: formatAppTime(dateObj, timezone),
      invoiceNumber: sale.invoiceNumber || '',
      receiptNumber: sale.receiptNumber || '',
      customerName,
      customerPhone,
      cashier: cashierName,
      cashierAt,
      salesmanName: sale.salesmanName || '',
      itemsList,
      totalItemsQty,
      saleType: getSaleTypeLabel(sale.saleType),
      paymentMethod: sale.paymentMethod || '',
      subtotal: sale.subtotal,
      discountAmount: sale.discountAmount,
      taxAmount: sale.taxAmount,
      total: sale.total,
      ...(isAdmin ? { costOfGoods: totalCostLocal, grossProfit: sale.total - totalCostLocal } : {}),
    };
  });
};
