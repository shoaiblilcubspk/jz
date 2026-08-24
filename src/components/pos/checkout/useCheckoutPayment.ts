import { useState, useRef } from 'react';
import { Sale } from '../../../types';
import { useProductsStore, useSalesStore, useCartStore, useUsersStore } from '../../../stores';
import { salesService, generateId, adjustPaymentBalances, buildSalePaymentMoves } from '../../../lib/services';
import { localDb } from '../../../lib/localDb';
import { sonner } from '../../../lib/sonner';
import { useAuth } from '../../../context/AuthContext';
import { useInvoiceGeneration } from '../../../hooks/useInvoice';
import { useActionGuard } from '../../../hooks/useActionGuard';

interface UseCheckoutPaymentProps {
  appSettings: any;
  checkoutCartItems: any[];
  appSelectedCustomer: any;
  subtotal: number;
  totalDiscount: number;
  finalTax: number;
  finalTotal: number;
  appBillDiscountValue: number;
  appBillDiscountType: string;
  paymentMethod: string;
  salesmanId: string;
  saleNotes: string;
  appliedDiscounts: any[];
  freeGifts: any[];
  amountPaid: string;
  change: number;
  splitMethodA: string;
  splitAmountA: string;
  splitMethodB: string;
  splitAmountB: string;
  saleType: string;
  extraCharges: any[];
  editingSale: any;
  appEditingSaleId: string | null;
  onComplete: (sale: Sale) => void;
  setShowReceipt: (v: boolean) => void;
  setCompletedSale: (v: Sale | null) => void;
}

export function useCheckoutPayment({
  appSettings,
  checkoutCartItems,
  appSelectedCustomer,
  subtotal,
  totalDiscount,
  finalTax,
  finalTotal,
  appBillDiscountValue,
  appBillDiscountType,
  paymentMethod,
  salesmanId,
  saleNotes,
  appliedDiscounts,
  freeGifts,
  amountPaid,
  change,
  splitMethodA,
  splitAmountA,
  splitMethodB,
  splitAmountB,
  saleType,
  extraCharges,
  editingSale,
  appEditingSaleId,
  onComplete,
  setShowReceipt,
  setCompletedSale,
}: UseCheckoutPaymentProps) {
  const editNewIdRef = useRef<{ oldId: string; newId: string } | null>(null);
  
  const appProducts = useProductsStore(s => s.products);
  const appSalesmen = useUsersStore(s => s.salesmen);
  const appUsers = useUsersStore(s => s.users);
  
  const { user, profile } = useAuth();
  const generateInvoice = useInvoiceGeneration();

  const refreshAffectedProducts = async (sales: (Sale | undefined)[]) => {
    const ids = new Set<string>();
    for (const sale of sales) {
      if (!sale) continue;
      for (const it of sale.items || []) {
        const pid = (it as any).product?.id || (it as any).productId;
        if (pid) ids.add(pid);
        const addons = (it as any).addonItems || [];
        for (const a of addons) {
          const aid = a.addon?.id || a.productId || a.id;
          if (aid) ids.add(aid);
        }
      }
    }
    if (ids.size === 0) return;
    for (const id of ids) {
      try {
        const p = await localDb.products.get(id);
        if (p) useProductsStore.getState().updateProduct(p as any);
      } catch { /* ignore */ }
    }
  };

  const { isProcessing, guardedAction: handlePayment } = useActionGuard(async () => {
    try {
      if (!appSettings.allowNegativeStock) {
        for (const item of checkoutCartItems) {
          if (item.product?.trackInventory && item.quantity > 0) {
            const live = appProducts.find(p => p.id === item.product?.id);
            const avail = live ? live.stock : (item.product?.stock ?? 0);
            if (item.quantity > avail) {
              throw new Error(`Cannot save: ${item.product?.name} has only ${avail} in stock but cart has ${item.quantity}.`);
            }
          }
        }
      }

      const selectedSalesman = salesmanId ?
        (appSalesmen.find(s => s.id === salesmanId)?.name || appUsers.find(u => u.id === salesmanId)?.name)
        : undefined;

      const invoiceNumber = await generateInvoice();
      const sale: Sale = {
        id: generateId(), invoiceNumber,
        customerId: appSelectedCustomer?.id,
        customerName: appSelectedCustomer?.name,
        customerPhone: appSelectedCustomer?.phone,
        items: checkoutCartItems, subtotal,
        discountAmount: totalDiscount, taxAmount: finalTax, total: finalTotal,
        billDiscountValue: appBillDiscountValue,
        billDiscountType: appBillDiscountType,
        paymentMethod: paymentMethod as any,
        cardDetails: undefined,
        status: 'completed',
        cashier: profile?.name || user?.user_metadata?.full_name || user?.email || 'Unknown',
        cashierRole: (profile?.role as string) || 'cashier',
        salesmanId: salesmanId || undefined,
        salesmanName: selectedSalesman,
        timestamp: new Date(), receiptNumber: invoiceNumber,
        notes: saleNotes,
        appliedDiscounts,
        freeGifts: freeGifts.length > 0 ? freeGifts : undefined,
        receivedAmount: paymentMethod === 'cash' ? parseFloat(amountPaid) || undefined
          : paymentMethod === 'split' ? finalTotal
            : undefined,
        changeAmount: paymentMethod === 'cash' ? change || undefined
          : paymentMethod === 'split' ? 0
            : undefined,
        splitPayments: paymentMethod === 'split' ? [
          { method: splitMethodA, amount: parseFloat(splitAmountA) || 0 },
          { method: splitMethodB, amount: parseFloat(splitAmountB) || 0 },
        ] : undefined,
        saleType: (editingSale?.saleType as any) || saleType,
        saleDate: new Date().toLocaleDateString('en-CA'),
        extraCharges: extraCharges.filter(c => parseFloat(c.amount) > 0),
        deliveryFee: editingSale?.deliveryFee ?? undefined,
        deliveryAddress: editingSale?.deliveryAddress || undefined,
        deliveryLocationLat: editingSale?.deliveryLocationLat || undefined,
        deliveryLocationLng: editingSale?.deliveryLocationLng || undefined,
        customerNotes: editingSale?.customerNotes || undefined,
      };

      let savedSale;

      if (appEditingSaleId) {
        const oldSaleId = appEditingSaleId;
        if (editNewIdRef.current?.oldId !== appEditingSaleId) {
          editNewIdRef.current = { oldId: appEditingSaleId, newId: sale.id };
        }
        sale.id = editNewIdRef.current.newId;
        sale.editedFromInvoice = (editingSale as any)?.invoiceNumber ?? undefined;
        try {
          savedSale = await salesService.editSaleAtomic(editingSale, sale, profile?.name || 'Admin');
          useSalesStore.getState().deleteSale(oldSaleId);
        } catch (error) {
          console.error('BILL EDIT FAILED', error);
          sonner.error('⚠️ Bill Edit Failed', 'The original bill is intact. Please retry saving the edited bill.');
          return;
        }
        useCartStore.getState().setEditingSaleId(null);
        editNewIdRef.current = null;
      } else {
        savedSale = await salesService.create(sale);
      }

      if ((savedSale as any).wasOversold) {
        sonner.warning('Stock Oversold', 'Some items were sold beyond available stock. Inventory may show negative quantities.');
      }

      await refreshAffectedProducts([savedSale, editingSale]);

      useSalesStore.getState().addSale(savedSale);
      useCartStore.getState().clearCart();
      setCompletedSale(savedSale);
      onComplete(savedSale);
      setShowReceipt(true);
    } catch (error: any) {
      sonner.error(error.message || 'Payment processing failed. Please try again.');
    }
  });

  return { handlePayment, isProcessing };
}
