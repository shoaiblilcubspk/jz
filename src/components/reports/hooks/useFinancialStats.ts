import { useMemo } from 'react';
import { getAmountByMethod } from '../../../lib/services';

export function useFinancialStats(filteredSales: any[], filteredExpenses: any[], filteredPayments: any[] = [], appSettings?: any) {
  const walletStats = useMemo(() => {
    const methods = ['cash', 'card', 'online'];
    if (appSettings?.enableCreditSales) {
      methods.push('credit');
    }
    return methods.map(method => {
      const validSales = filteredSales.filter(s => s.status === 'completed' || s.status === 'partially_refunded' || s.status === 'refunded');
      const sales = validSales.reduce((a, x) => a + getAmountByMethod(x, method), 0);
      const retailSales = validSales.filter(s => (!s.saleType || s.saleType === 'retail')).reduce((a, x) => a + getAmountByMethod(x, method), 0);
      const wholesaleSales = validSales.filter(s => s.saleType === 'wholesale').reduce((a, x) => a + getAmountByMethod(x, method), 0);
      const expenses = filteredExpenses.filter(e => e.paymentMethod === method).reduce((a, x) => a + Number(x.amount), 0);
      const refunds = filteredSales.reduce((a, x) => {
        if (x.status === 'refunded') return a + getAmountByMethod(x, method);
        if (x.status === 'partially_refunded') {
          if (x.paymentMethod === 'split') {
            const ratio = getAmountByMethod(x, method) / (x.total || 1);
            return a + (x.refundedAmount || 0) * ratio;
          } else if (x.paymentMethod === method || (!x.paymentMethod && method === 'cash')) {
            return a + (x.refundedAmount || 0);
          }
        }
        return a;
      }, 0);
      const customerPayments = filteredPayments
        .filter(p => p.direction === 'in' && (method === 'credit' || p.payment_type === method || p.paymentMode === method || p.paymentType === method))
        .reduce((a, x) => a + Number(x.amount || 0), 0);
      return { method, sales, expenses, refunds, customerPayments, net: sales + customerPayments - refunds - expenses, retailSales, wholesaleSales };
    });
  }, [filteredSales, filteredExpenses, filteredPayments, appSettings]);

  return { walletStats };
}
