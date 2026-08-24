import { useAppStore, useCartStore, useProductsStore, useSalesStore, useSettingsStore, useUsersStore } from '../../../stores';
import { useState, useEffect, useMemo, useRef } from 'react';
import { Store, Package, CreditCard, Banknote, Building2, Layers } from 'lucide-react';
import { Sale } from '../../../types';
import { useInvoiceGeneration } from '../../../hooks/useInvoice';
import { useCartCalculations } from '../../../hooks/useCartCalculations';
import { useAuth } from '../../../context/AuthContext';
import { usePOSKeyboard } from '../../../hooks/usePOSKeyboard';
import { useCheckoutPayment } from './useCheckoutPayment';
import { computeQuickAmounts } from './checkoutUtils';

export function useCheckoutData(onClose: () => void, onComplete: (sale: Sale) => void) {
  const appSettings = useSettingsStore(s => s.settings);
  const appCart = useCartStore(s => s.cart);
  const appEditingSaleId = useCartStore(s => s.editingSaleId);
  const appSales = useSalesStore(s => s.sales);
  const appNotes = useCartStore(s => s.notes);
  const _appProducts = useProductsStore(s => s.products);
  const appSalesmen = useUsersStore(s => s.salesmen);
  const appUsers = useUsersStore(s => s.users);
  const appSelectedCustomer = useCartStore(s => s.selectedCustomer);
  const appBillDiscountValue = useCartStore(s => s.billDiscountValue);
  const appBillDiscountType = useCartStore(s => s.billDiscountType);
  const appActiveSalesTab = useCartStore(s => s.activeSalesTab);
  const appBundles = useAppStore(s => s.bundles);

  const { profile } = useAuth();
  const _generateInvoice = useInvoiceGeneration();

  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [amountPaid, setAmountPaid] = useState('');
  const [showReceipt, setShowReceipt] = useState(false);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [saleNotes, setSaleNotes] = useState('');
  const [saleType, setSaleType] = useState<'retail' | 'wholesale'>('retail');
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [salesmanId, setSalesmanId] = useState<string>('');

  // Split payment state (two parts across cash/card/digital)
  const [splitMethodA, setSplitMethodA] = useState<'cash' | 'card' | 'online'>('cash');
  const [splitMethodB, setSplitMethodB] = useState<'cash' | 'card' | 'online'>('card');
  const [splitAmountA, setSplitAmountA] = useState('');
  const [splitAmountB, setSplitAmountB] = useState('');

  const handleSelectMethod = (m: string) => {
    setPaymentMethod(m as any);
    if (m === 'split') {
      // Default to an even 50/50 split so a bill is never accidentally booked
      // to a single method (prevents the "whole amount landed on one method" bug).
      const half = (finalTotal / 2).toString();
      setSplitAmountA(half);
      setSplitAmountB(half);
    } else if (m !== 'cash') {
      setAmountPaid(finalTotal.toString());
    }
  };

  // New Fields
  const [extraCharges, setExtraCharges] = useState<{ name: string; amount: string }[]>([
    { name: 'DC', amount: '' }
  ]);

  const { retailEnabled, wholesaleEnabled } = appSettings;
  const { subtotal, totalDiscount, taxAmount, total: baseTotal, activePromotions: appliedDiscounts, freeGifts } = useCartCalculations(paymentMethod);

  const checkoutCartItems = useMemo(() => {
    return appCart.filter(item => item.quantity !== 0);
  }, [appCart]);

  const totalQty = useMemo(() =>
    checkoutCartItems.reduce((sum, item) => sum + (item.quantity || 1), 0)
  , [checkoutCartItems]);

  const extraChargesTotal = useMemo(() =>
    extraCharges.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0)
    , [extraCharges]);

  // Delivery/service extra charges are included in the tax base (not merely added
  // to the total post-tax), so a delivered order is taxed consistently. Do not move
  // these out of the tax base.
  const taxRate = appSettings.taxRate || 0;
  const extraChargesTax = Math.round(extraChargesTotal * (taxRate / 100) * 100) / 100;
  const finalTax = Math.round((taxAmount + extraChargesTax) * 100) / 100;

  const finalTotal = Number(Math.round(Number((baseTotal + extraChargesTotal + extraChargesTax) + 'e2')) + 'e-2');

  useEffect(() => {
    if (paymentMethod !== 'cash' && paymentMethod !== 'split') {
      setAmountPaid(finalTotal.toString());
    }
  }, [finalTotal, paymentMethod]);

  const showDiscount = appSettings.receiptShowDiscount !== false &&
    !checkoutCartItems.some(item => item.bundleHideItemPrices === true || item.bundle_hide_item_prices === true);

  useEffect(() => {
    document.body.classList.add('overflow-hidden');
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.classList.remove('overflow-hidden');
      document.body.style.overflow = originalStyle;
    };
  }, []);

  const quickAmounts = useMemo(() => computeQuickAmounts(finalTotal), [finalTotal]);

  const editingSale = useMemo(() => {
    if (!appEditingSaleId) return null;
    return appSales.find(s => s.id === appEditingSaleId) || null;
  }, [appEditingSaleId, appSales]);

  useEffect(() => {
    // If a sale has been completed, do not reset the state or form fields
    if (completedSale || showReceipt) return;

    setAmountPaid('');
    setIsProcessing(false);
    setShowReceipt(false);
    setCompletedSale(null);
    setPaymentMethod('cash');

    // If editing, load notes and extra charges
    if (appEditingSaleId) {
      if (editingSale) {
        setSaleNotes(appNotes || editingSale.notes || '');
        setSaleType(editingSale.saleType as any);
        if (editingSale.extraCharges && editingSale.extraCharges.length > 0) {
          setExtraCharges(editingSale.extraCharges.map(c => ({ name: c.name, amount: String(c.amount) })));
        } else if (editingSale.deliveryFee && editingSale.deliveryFee > 0) {
          setExtraCharges([{ name: 'DC', amount: String(editingSale.deliveryFee) }]);
        } else {
          setExtraCharges([{ name: 'DC', amount: '' }]);
        }
        if (editingSale.paymentMethod) setPaymentMethod((editingSale.paymentMethod === 'split') ? 'cash' : editingSale.paymentMethod);
        if (editingSale.salesmanId) setSalesmanId(editingSale.salesmanId);
      }
    } else {
      setSaleNotes(appNotes || '');
      setExtraCharges([{ name: 'DC', amount: '' }]);
      const preferredMode = appSettings.defaultSaleType || 'retail';
      if (preferredMode === 'retail' && retailEnabled) setSaleType('retail');
      else if (preferredMode === 'wholesale' && wholesaleEnabled) setSaleType('wholesale');
      else if (retailEnabled) setSaleType('retail');
      else if (wholesaleEnabled) setSaleType('wholesale');
    }
  }, [retailEnabled, wholesaleEnabled, appEditingSaleId, editingSale, appSettings.defaultSaleType, completedSale, showReceipt]);

  // canProcessPayment is declared below — usePOSKeyboard is called after it

  const change = (parseFloat(amountPaid) || 0) - finalTotal;
  const canProcessPayment = () => {
    if (isProcessing) return false;
    const paid = parseFloat(amountPaid) || 0;
    switch (paymentMethod) {
      case 'cash': return paid >= finalTotal;
      case 'card': case 'online': case 'credit': return true;
      case 'split': {
        const a = parseFloat(splitAmountA) || 0;
        const b = parseFloat(splitAmountB) || 0;
        return a !== 0 && Math.abs((a + b) - finalTotal) < 0.01;
      }
      default: return false;
    }
  };

  const { handlePayment, isProcessing } = useCheckoutPayment({
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
  });

  const handlePaymentRef = useRef<() => Promise<void>>(async () => { });
  handlePaymentRef.current = handlePayment;

  // ── Keyboard Shortcuts (must come after canProcessPayment is defined) ──
  usePOSKeyboard({
    isCheckoutOpen: true,
    canProcessPayment: canProcessPayment(),
    isProcessing,
    onPaymentMethod: (method) => {
      handleSelectMethod(method);
    },
    onExactAmount: () => setAmountPaid(finalTotal.toString()),
    onProcessPayment: () => handlePaymentRef.current(),
    onClose,
  });

  const saleTypes = [
    { id: 'retail', label: 'Retail', icon: Store, enabled: retailEnabled },
    { id: 'wholesale', label: 'Wholesale', icon: Package, enabled: wholesaleEnabled },
  ].filter(st => st.enabled);

  const isCreditAllowed = useMemo(() => {
    if (!appSettings.enableCreditSales) return false;
    if (!appSelectedCustomer) return false;
    if (appSelectedCustomer.allow_credit === false || appSelectedCustomer.allowCredit === false) return false;
    const role = profile?.role || 'cashier';
    if (role === 'cashier' && !appSettings.cashierCanCredit) return false;
    return true;
  }, [appSettings.enableCreditSales, appSettings.cashierCanCredit, appSelectedCustomer, profile]);

  const payMethods = [
    { id: 'cash', label: 'Cash', icon: Banknote },
    { id: 'card', label: 'Card', icon: CreditCard },
    { id: 'online', label: 'Online Wallet', icon: Building2 },
    ...(isCreditAllowed ? [{ id: 'credit', label: 'Credit (Udhar)', icon: Store }] : []),
    { id: 'split', label: 'Split', icon: Layers },
  ];


  return {
    appSettings,
    paymentMethod,
    handleSelectMethod,
    amountPaid,
    setAmountPaid,
    splitMethodA,
    setSplitMethodA,
    splitMethodB,
    setSplitMethodB,
    splitAmountA,
    setSplitAmountA,
    splitAmountB,
    setSplitAmountB,
    finalTotal,
    change,
    quickAmounts,
    extraCharges,
    setExtraCharges,
    saleType,
    setSaleType,
    saleTypes,
    payMethods,
    salesmanId,
    setSalesmanId,
    appUsers,
    appSalesmen,
    saleNotes,
    setSaleNotes,
    appActiveSalesTab,
    checkoutCartItems,
    appBundles,
    showDiscount,
    subtotal,
    totalDiscount,
    taxAmount,
    totalQty,
    showReceipt,
    completedSale,
    setShowReceipt,
    setCompletedSale,
    isShortcutsModalOpen,
    setIsShortcutsModalOpen,
    handlePayment,
    canProcessPayment,
    isProcessing,
  };
}
