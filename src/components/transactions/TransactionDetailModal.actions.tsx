import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sale, RefundRequest } from '../../types';
import { salesService } from '../../lib/services';
import { ApprovalRequiredError } from '../../lib/services/atomicOps';
import { signWithSupervisor } from '../../lib/actionToken';
import { sonner } from '../../lib/sonner';
import { formatCurrency } from '../../lib/currencies';
import { useSalesStore, useCustomersStore, useCartStore } from '../../stores';
import { useActionGuard } from '../../hooks/useActionGuard';

type SupervisorGate = { action: 'delete' } | { action: 'refund'; request: RefundRequest } | null;

interface TransactionDetailActionsParams {
  transaction: Sale;
  appCustomers: ReturnType<typeof useCustomersStore.getState>['customers'];
  appSales: Sale[];
  onClose: () => void;
  onNavigate: (sale: Sale) => void;
  detailNavigate: ReturnType<typeof useNavigate>;
  setIsRefundModalOpen: (open: boolean) => void;
  profile: { canEditSale: boolean; canDeleteSale: boolean };
  currency: string;
}

export function useTransactionDetailActions({
  transaction,
  appCustomers,
  appSales: _appSales,
  onClose,
  onNavigate,
  detailNavigate,
  setIsRefundModalOpen,
  profile,
  currency,
}: TransactionDetailActionsParams) {
  const [supervisorGate, setSupervisorGate] = useState<SupervisorGate>(null);
  const [isVerifyingSupervisor, setIsVerifyingSupervisor] = useState(false);

  const { isProcessing: isProcessingEdit, guardedAction: handleEditSale } = useActionGuard(async () => {
    const result = await sonner.confirm('Edit Sale?', 'Load items and notes to cart for editing?', 'Yes');
    if (!result.isConfirmed) return;
    try {
      useCartStore.getState().clearCart();
      transaction.items.forEach(item => useCartStore.getState().addToCart(item));
      useCartStore.getState().setNotes(transaction.notes || '');
      useCartStore.getState().setEditingSaleId(transaction.id);

      if (transaction.customerId) {
        const customer = appCustomers.find(c => c.id === transaction.customerId);
        if (customer) useCartStore.getState().setSelectedCustomer(customer);
      }

      sonner.success('Loaded to POS for editing.');
      onClose();
      detailNavigate('/pos');
    } catch {
      sonner.error('Error editing sale.');
    }
  });

  const { isProcessing: isProcessingRefund, guardedAction: executeRefund } = useActionGuard(async (request: RefundRequest, overrideToken?: { p_user_id: string; p_role: string; p_sig: string } | null) => {
    try {
      await salesService.returnSale(transaction.id, request, profile?.name || 'Cashier', overrideToken);

      const updatedTx: Sale = {
        ...transaction,
        status: request.type === 'full' ? 'refunded' : 'partially_refunded',
        refundedAmount: (transaction.refundedAmount || 0) + request.totalRefundAmount,
        items: transaction.items.map((item: any, idx: number) => {
          if (request.type === 'full') {
            return { ...item, refundedQuantity: item.quantity };
          } else {
            const reqItem = request.items.find((ri: any) => ri.index === idx);
            if (reqItem) {
              return { ...item, refundedQuantity: (item.refundedQuantity || 0) + reqItem.qty };
            }
          }
          return item;
        })
      };

      useSalesStore.getState().updateSale(updatedTx);
      onNavigate(updatedTx);
      sonner.success('Sale successfully refunded.');
      setIsRefundModalOpen(false);
    } catch (error) {
      console.error('[RefundError]', error);
      // RBAC: refund above admin threshold → offer supervisor (admin PIN) override
      if (error instanceof ApprovalRequiredError || /APPROVAL_REQUIRED|FORBIDDEN/i.test(String((error as any)?.message))) {
        setSupervisorGate({ action: 'refund', request });
        setIsRefundModalOpen(false);
        sonner.info('Admin approval required for this refund.');
        return;
      }
      sonner.error('Error refunding sale.');
    }
  });

  const handleWhatsAppShare = () => {
    const customer = appCustomers.find(c => c.id === transaction.customerId);
    const phone = customer?.phone || '';
    if (!phone) { sonner.error('No phone number.'); return; }
    let fp = phone.replace(/\D/g, '');
    if (fp.startsWith('0')) fp = '92' + fp.substring(1);
    const msg = `🧾 *Invoice*\nTotal: ${formatCurrency(transaction.total, currency)}`;
    window.open(`https://wa.me/${fp}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const { isProcessing: isProcessingDelete, guardedAction: handleDeleteSale } = useActionGuard(async () => {
    const result = await sonner.confirm(
      'PERMANENT DELETE?',
      'All records (Stock, Reports, Inventory) will be REVERTED. This cannot be undone!',
      'Yes, Delete'
    );
    if (!result.isConfirmed) return;

    try {
      await salesService.delete(transaction.id, profile?.name || 'Admin');
      useSalesStore.getState().deleteSale(transaction.id);
      sonner.success('Sale permanently deleted and records reverted.');
      onClose();
    } catch (err) {
      console.error('[DeleteError]', err);
      // RBAC: sale reverse/delete is admin-only → offer supervisor override
      if (err instanceof ApprovalRequiredError || /APPROVAL_REQUIRED|FORBIDDEN/i.test(String((err as any)?.message))) {
        setSupervisorGate({ action: 'delete' });
        sonner.info('Admin approval required to delete a sale.');
        return;
      }
      sonner.error('Error deleting sale.');
    }
  });

  /**
   * RBAC SUPERVISOR OVERRIDE: verify admin credentials (server-side signed
   * token) then retry the gated operation with the admin proof. Returns true
   * when the gate is satisfied (modal may close).
   */
  const retryWithSupervisor = async (email: string, password: string): Promise<boolean> => {
    if (!supervisorGate) return true;
    setIsVerifyingSupervisor(true);
    try {
      const action = supervisorGate.action === 'delete' ? 'delete_sale' : 'refund_sale';
      const token = await signWithSupervisor(action, email, password);
      if (!token) return false;
      if (supervisorGate.action === 'delete') {
        await salesService.delete(transaction.id, profile?.name || 'Admin', undefined, token);
        useSalesStore.getState().deleteSale(transaction.id);
        sonner.success('Admin approved. Sale permanently deleted.');
        onClose();
      } else {
        await executeRefund(supervisorGate.request, token);
        setSupervisorGate(null);
      }
      return true;
    } catch (error) {
      console.error('[SupervisorOverride]', error);
      sonner.error('Override failed. Check admin credentials and retry.');
      return false;
    } finally {
      setIsVerifyingSupervisor(false);
    }
  };

  const clearSupervisorGate = () => setSupervisorGate(null);

  const getSaleTypeTag = () => {
    const type = transaction.saleType || 'retail';
    switch (type) {
      case 'wholesale':
        return { label: 'WHOLESALE', tone: 'info' as const, cls: '!bg-blue-100 dark:!bg-blue-500/10 !text-blue-700 dark:!text-blue-400 !border-blue-200 dark:!border-blue-500/20 !rounded-lg' };
      default:
        return { label: 'RETAIL', tone: 'success' as const, cls: '!bg-primary/10 !text-primary dark:!text-emerald-400 !border-primary/20 !rounded-lg' };
    }
  };

  const sourceTag = getSaleTypeTag();

  const isProcessingAction = isProcessingEdit || isProcessingRefund || isProcessingDelete;

  return {
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
  };
}
