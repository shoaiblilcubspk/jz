import { useAppStore, useCustomersStore, useProductsStore, useSalesStore, useSettingsStore } from '../../stores';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Printer, MessageCircle, RotateCcw, Edit, Trash2, MapPin } from 'lucide-react';
import { formatAppDate } from '../../lib/dateUtils';
import { formatCurrency } from '../../lib/currencies';
import { Sale } from '../../types';
import { sonner } from '../../lib/sonner';
import { getDealCountBreakdown } from '../../lib/utils';
import { Modal } from '../../shared/ui/Modal';
import { Badge, Button } from '../../shared/ui';
import RefundSaleModal from './RefundSaleModal';
import { SupervisorPinModal } from './SupervisorPinModal';
import { TransactionItemsTable } from './TransactionItemsTable';
import { TransactionSummary } from './TransactionSummary';
import { useTransactionDetailActions } from './TransactionDetailModal.actions';
import { useAuth } from '../../context/AuthContext';
import { can } from '../../lib/permissions';

interface TransactionDetailModalProps {
  transaction: Sale;
  allTransactions: Sale[];
  onNavigate: (sale: Sale) => void;
  onClose: () => void;
  onReprint: (sale: Sale) => void;
  onBack?: () => void;
}

export function TransactionDetailModal({ transaction, allTransactions, onNavigate, onClose, onReprint, onBack }: TransactionDetailModalProps) {
  const detailNavigate = useNavigate();
  const appSettings = useSettingsStore(s => s.settings);
  const appSales = useSalesStore(s => s.sales);
  const appCustomers = useCustomersStore(s => s.customers);
  const appBundles = useAppStore(s => s.bundles);
  const appProducts = useProductsStore(s => s.products);
  const { profile: userProfile } = useAuth();
  // RBAC matrix: refund = admin|manager|cashier(limited); edit/delete = admin|manager
  const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'manager';
  const canRefund = can(userProfile?.role, 'refund_sale');
  const profile = {
    canEditSale: !!userProfile?.canEditSale,
    canDeleteSale: !!userProfile?.canDeleteSale,
  };

  const showDiscount = appSettings.receiptShowDiscount !== false &&
    !(transaction.items || []).some((item: any) => item.bundleHideItemPrices === true || item.bundle_hide_item_prices === true);

  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);

  const {
    isProcessingAction,
    handleEditSale,
    executeRefund,
    handleWhatsAppShare,
    handleDeleteSale,
    sourceTag,
    supervisorGate,
    isVerifyingSupervisor,
    retryWithSupervisor,
    clearSupervisorGate,
  } = useTransactionDetailActions({
    transaction,
    appCustomers,
    appSales,
    onClose,
    onNavigate,
    detailNavigate,
    setIsRefundModalOpen,
    profile,
    currency: appSettings.currency,
  });

  const handleRefundSale = () => {
    if (!canRefund) {
      sonner.error('You do not have permission to refund sales.');
      return;
    }
    if (transaction.total < 0) {
      sonner.error('Cannot refund a return receipt.');
      return;
    }
    if (transaction.status === 'refunded') {
      sonner.error('Sale is already fully refunded.');
      return;
    }
    setIsRefundModalOpen(true);
  };

  const editFromInvoice = transaction.editedFromInvoice ?? null;
  const oldSale = editFromInvoice ? (appSales || []).find(s => s.invoiceNumber === editFromInvoice) ?? null : null;
  const replacedSale = !editFromInvoice ? (appSales || []).find(s => s.editedFromInvoice === transaction.invoiceNumber) ?? null : null;

  const currentIndex = allTransactions.findIndex(tx => tx.id === transaction.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < allTransactions.length - 1;

  const handlePrev = () => hasPrev && onNavigate(allTransactions[currentIndex - 1]);
  const handleNext = () => hasNext && onNavigate(allTransactions[currentIndex + 1]);

  return (
    <>
      <Modal
        isOpen={true}
        onClose={onClose}
        title={"Sale Breakdown"}
        showClose={true}
        maxWidth="lg"
        footer={
          <div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Button variant="secondary" onClick={handlePrev} disabled={!hasPrev} className="flex-1 !gap-1.5 !px-3 !py-2.5 sm:!py-3 !rounded-2xl !text-[9px] sm:!text-[10px] !font-black !text-gray-900 dark:!text-white hover:!bg-gray-200 dark:hover:!bg-white/10 disabled:!opacity-30">
                <ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> <span>{"Prev"}</span>
              </Button>
              <Button variant="secondary" onClick={handleNext} disabled={!hasNext} className="flex-1 !gap-1.5 !px-3 !py-2.5 sm:!py-3 !rounded-2xl !text-[9px] sm:!text-[10px] !font-black !text-gray-900 dark:!text-white hover:!bg-gray-200 dark:hover:!bg-white/10 disabled:!opacity-30">
                <span>{"Next Sale"}</span> <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 w-full mt-1.5 sm:mt-2">
              <Button
                variant="primary"
                onClick={() => onReprint(transaction)}
                className="flex-1 min-w-[calc(50%-4px)] sm:min-w-0 sm:flex-1 !gap-1.5 !px-2.5 sm:!px-3 md:!px-5 !py-2.5 sm:!py-3 !rounded-2xl !text-[9px] sm:!text-[10px] !font-black !tracking-wider md:!tracking-widest"
              >
                <Printer className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" /> <span className="truncate">{"Print"}</span>
              </Button>
              <Button
                variant="secondary"
                onClick={handleWhatsAppShare}
                className="flex-1 min-w-[calc(50%-4px)] sm:min-w-0 sm:flex-1 !gap-1.5 !px-2.5 sm:!px-3 md:!px-5 !py-2.5 sm:!py-3 !rounded-2xl !text-[9px] sm:!text-[10px] !font-black !tracking-wider md:!tracking-widest !bg-emerald-50 dark:!bg-emerald-900/10 !text-primary !border-transparent"
              >
                <MessageCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" /> <span className="truncate">{"WhatsApp"}</span>
              </Button>
              {canRefund && (
              <Button
                variant="danger"
                onClick={handleRefundSale}
                disabled={isProcessingAction || transaction.status === 'refunded'}
                className="flex-1 min-w-[calc(50%-4px)] sm:min-w-0 sm:flex-1 !gap-1.5 !px-2.5 sm:!px-3 md:!px-5 !py-2.5 sm:!py-3 !rounded-2xl !text-[9px] sm:!text-[10px] !font-black !tracking-wider md:!tracking-widest !bg-rose-50 dark:!bg-rose-900/10 !text-rose-600 !border-transparent disabled:!opacity-50"
              >
                <RotateCcw className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" /> <span className="truncate">{"Refund"}</span>
              </Button>
              )}
              {profile.canEditSale && (
              <Button
                variant="secondary"
                onClick={handleEditSale}
                disabled={isProcessingAction}
                className="flex-1 min-w-[calc(50%-4px)] sm:min-w-0 sm:flex-1 !gap-1.5 !px-2.5 sm:!px-3 md:!px-5 !py-2.5 sm:!py-3 !rounded-2xl !text-[9px] sm:!text-[10px] !font-black !tracking-wider md:!tracking-widest !bg-amber-50 dark:!bg-amber-900/10 !text-amber-600 !border-transparent disabled:!opacity-50"
              >
                <Edit className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" /> <span className="truncate">{"Edit"}</span>
              </Button>
              )}
              {profile.canDeleteSale && (
              <Button
                variant="danger"
                onClick={handleDeleteSale}
                disabled={isProcessingAction}
                className="flex-1 min-w-full sm:min-w-0 sm:flex-1 !gap-1.5 !px-2.5 sm:!px-3 md:!px-5 !py-2.5 sm:!py-3 !rounded-2xl !text-[9px] sm:!text-[10px] !font-black !tracking-wider md:!tracking-widest !bg-rose-500 !shadow-lg !shadow-rose-500/20 disabled:!opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" /> <span className="truncate">{"Delete"}</span>
              </Button>
              )}
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          {(onBack || transaction.saleType) && (
            <div className="flex items-center justify-between gap-2 flex-wrap">
              {onBack && (
                <Button
                  variant="secondary"
                  onClick={onBack}
                  className="!min-h-0 !gap-1.5 !px-3 !py-1.5 !rounded-lg !text-[9px] !font-black !text-gray-700 dark:!text-gray-300 !bg-gray-100 dark:!bg-white/5 hover:!bg-gray-200 dark:hover:!bg-white/10"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>Back to Customer</span>
                </Button>
              )}
              <Badge tone={sourceTag.tone} size="sm" className={`${sourceTag.cls} !text-[8px] !px-2 !py-0.5 ml-auto`}>
                {sourceTag.label}
              </Badge>
            </div>
          )}

          {transaction.status === 'refunded' && (
            <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 p-3 rounded-2xl text-xs font-black text-center uppercase tracking-widest flex items-center justify-center gap-2">
              <RotateCcw className="h-4 w-4 shrink-0" />
              <span>This sale is fully refunded</span>
            </div>
          )}
          {transaction.status === 'partially_refunded' && (
            <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-400 p-3 rounded-2xl text-xs font-black text-center uppercase tracking-widest flex items-center justify-center gap-2">
              <RotateCcw className="h-4 w-4 shrink-0" />
              <span>This sale is partially refunded</span>
            </div>
          )}

          {onBack && (
            <div className="flex items-center justify-center mb-0">
              <Badge tone="success" size="sm" className="!bg-primary/10 !text-primary dark:!text-emerald-400">
                {getDealCountBreakdown(transaction.items, appBundles).label}
              </Badge>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 dark:bg-white/[0.02] rounded-2xl border border-gray-200 dark:border-white/5">
            <div><p className="text-[8px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-widest">{"Receipt"}</p><p className="text-[11px] font-black text-gray-900 dark:text-white uppercase">#{transaction.invoiceNumber || transaction.receiptNumber}</p></div>
            <div><p className="text-[8px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-widest">{"Date"}</p><p className="text-[11px] font-black text-gray-900 dark:text-white uppercase">{formatAppDate(transaction.timestamp, appSettings.country)}</p></div>
            <div><p className="text-[8px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-widest">{"Customer"}</p><p className="text-[11px] font-black text-gray-900 dark:text-white uppercase">{transaction.customerName || "Walk-in"}</p></div>
            <div><p className="text-[8px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-widest">{"Cashier"}</p><p className="text-[11px] font-black text-gray-900 dark:text-white uppercase">{transaction.cashier || 'System'}</p></div>
            {transaction.salesmanName && (
              <div><p className="text-[8px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-widest">{"Salesman"}</p><p className="text-[11px] font-black text-teal-600 uppercase">{transaction.salesmanName}</p></div>
            )}
            {transaction.dcNumber && (
              <div className="col-span-2"><p className="text-[8px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">{"DC Number"}</p><p className="text-[11px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-tight tabular-nums">#{transaction.dcNumber}</p></div>
            )}
            {transaction.deliveryLocationLat && transaction.deliveryLocationLng && (
              <div className="col-span-2 mt-1">
                <a
                  href={`https://maps.google.com/?q=${transaction.deliveryLocationLat},${transaction.deliveryLocationLng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2.5 bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors border border-emerald-100 dark:border-emerald-900/30"
                >
                  <MapPin className="w-3.5 h-3.5 shrink-0" /> {"View Delivery Location"}
                </a>
              </div>
            )}
          </div>

          {editFromInvoice && (
            <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20">
              <Edit className="w-3.5 h-3.5 text-purple-600 shrink-0" />
              {oldSale ? (
                <button onClick={() => onNavigate(oldSale)} className="text-[10px] font-black text-purple-700 dark:text-purple-300 uppercase tracking-wide hover:underline">
                  {"Edited from"} #{editFromInvoice}
                </button>
              ) : (
                <span className="text-[10px] font-black text-purple-700 dark:text-purple-300 uppercase tracking-wide">
                  {"Edited from"} #{editFromInvoice}
                </span>
              )}
            </div>
          )}
          {!editFromInvoice && replacedSale && (
            <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20">
              <Edit className="w-3.5 h-3.5 text-purple-600 shrink-0" />
              <button onClick={() => onNavigate(replacedSale)} className="text-[10px] font-black text-purple-700 dark:text-purple-300 uppercase tracking-wide hover:underline">
                {"This bill was edited →"} #{replacedSale.invoiceNumber}
              </button>
            </div>
          )}

          <TransactionItemsTable
            items={transaction.items}
            appBundles={appBundles}
            appProducts={appProducts}
            appSettings={appSettings}
            showDiscount={showDiscount}
            isAdmin={isAdmin}
            profile={profile}
            transactionId={transaction.id}
            onNavigateToProduct={(productId, fromSale) => {
              detailNavigate('/inventory/products', { state: { productId, fromSale } });
              onClose();
            }}
          />

          <TransactionSummary
            transaction={transaction}
            appSettings={appSettings}
            showDiscount={showDiscount}
          />
        </div>
      </Modal>

      {isRefundModalOpen && (
        <RefundSaleModal
          isOpen={isRefundModalOpen}
          onClose={() => setIsRefundModalOpen(false)}
          sale={transaction}
          onConfirmRefund={executeRefund}
          isProcessing={isProcessingAction}
        />
      )}

      <SupervisorPinModal
        isOpen={!!supervisorGate}
        title={supervisorGate?.action === 'delete' ? 'Admin Approval — Delete Sale' : 'Admin Approval — Refund'}
        description={
          supervisorGate?.action === 'delete'
            ? 'Sale reverse/delete sirf admin approve kar sakta hai. Admin credentials enter karein.'
            : `Ye refund admin threshold se zyada hai. Admin approval zaroori hai. Amount: ${formatCurrency(transaction.total - (transaction.refundedAmount || 0), appSettings.currency)}`
        }
        isProcessing={isVerifyingSupervisor || isProcessingAction}
        onSubmit={retryWithSupervisor}
        onClose={clearSupervisorGate}
      />
    </>
  );
}
