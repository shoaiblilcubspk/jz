import { supabase } from '../supabase';
import {
  Supplier,
  SupplierTransaction,
  PurchaseOrder,
} from '../../types';
import { localDb, generateId } from '../localDb';
import { cloudWrite } from '../cloudWrite';
import { toRemoteSupplier, toRemoteSupplierTransaction, mapSupplier } from './mappers';
import { fetchAllPages, normalizePaymentMethod } from './utils';
import { adjustPaymentBalances } from './paymentsService';
import { signAction } from '../actionToken';

export const suppliersService = {
  async getAll(): Promise<Supplier[]> {
    return await localDb.suppliers.toArray();
  },

  async getById(id: string): Promise<Supplier | null> {
    return await localDb.suppliers.get(id) || null;
  },

  async create(data: Omit<Supplier, 'id' | 'createdAt'>): Promise<Supplier> {
    const id = generateId();
    const sup = { ...data, id, createdAt: new Date() } as Supplier;
    await cloudWrite('suppliers', 'create', id, toRemoteSupplier(sup));
    await localDb.suppliers.add(sup);

    // Create opening balance transaction if needed
    if (data.openingBalance && data.openingBalance > 0) {
      await this.recordBill({
        supplierId: id,
        amount: data.openingBalance,
        note: 'Opening Balance'
      });
    }

    return sup;
  },

  async update(id: string, updates: Partial<Supplier>): Promise<Supplier> {
    const existing = await this.getById(id);
    if (!existing) throw new Error('Supplier not found');
    const updated = { ...existing, ...updates, updatedAt: new Date() };
    await cloudWrite('suppliers', 'update', id, { ...toRemoteSupplier({ ...updates, updatedAt: updated.updatedAt }), id });
    await localDb.suppliers.put(updated);
    return updated;
  },

  async delete(id: string): Promise<void> {
    await cloudWrite('suppliers', 'delete', id, {});
    await localDb.suppliers.delete(id);
    // Cleanup transactions?
    await localDb.supplierTransactions.where('supplierId').equals(id).delete();
  },

  async getBalance(supplierId: string): Promise<number> {
    const txs = await localDb.supplierTransactions.where('supplierId').equals(supplierId).toArray();
    return txs.reduce((sum, tx) => {
      if (tx.type === 'payment' || tx.type === 'return') {
        return sum - (tx.amount || 0);
      }
      return sum + (tx.amount || 0);
    }, 0);
  },

  async getLedger(supplierId: string, limit: number = 50, offset: number = 0, _manualOnly: boolean = false) {
    const query = localDb.supplierTransactions.where('supplierId').equals(supplierId);

    let txs = await query.toArray();

    // Sort and paginate manually for now if Dexie query is complex
    txs = txs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const paginated = txs.slice(offset, offset + limit);

    return paginated.map(tx => ({
      id: tx.id,
      date: tx.createdAt,
      type: tx.type,
      sourceType: tx.sourceType || (tx.type === 'opening_balance' ? 'opening_balance' : tx.type === 'payment' ? 'payment' : 'manual_bill'),
      detail: tx.note || tx.referenceType || 'Transaction',
      debit: (tx.type === 'payment' || tx.type === 'return') ? tx.amount : 0,
      credit: (tx.type === 'purchase' || tx.type === 'opening_balance' || tx.type === 'loan') ? tx.amount : 0,
      isManualOverride: tx.isManualOverride || false,
      overrideBy: tx.overrideBy || null,
    }));
  },

  async recordPayment(data: { supplier_id: string; amount: number; payment_type: string; note?: string; isManualOverride?: boolean; overrideBy?: string; expenseId?: string; splitPayments?: Array<{ method: string; amount: number }> }) {
    const split = data.splitPayments && data.splitPayments.length ? data.splitPayments : null;
    const totalAmount = split ? split.reduce((s, sp) => s + Number(sp.amount || 0), 0) : data.amount;
    const id = generateId();
    const tx: any = {
      id,
      supplierId: data.supplier_id,
      type: 'payment',
      sourceType: 'payment' as const,
      amount: totalAmount,
      note: data.note,
      paymentType: data.payment_type,
      splitPayments: split,
      isManualOverride: data.isManualOverride || false,
      overrideBy: data.overrideBy || undefined,
      expenseId: data.expenseId,
      createdAt: new Date()
    };
    
    const token = await signAction('pay_supplier');
    if (!token) {
      throw new Error('Unauthorized: Missing action token for pay_supplier');
    }

    const { data: rpcData, error } = await supabase.rpc('pay_supplier_atomic', {
      p_supplier_id: data.supplier_id,
      p_amount: totalAmount,
      p_payment_type: data.payment_type,
      p_note: data.note || null,
      p_idempotency_key: data.expenseId || id, // Using expenseId as idempotency key if provided
      p_sig: token.p_sig,
    });

    if (error) {
      console.error('pay_supplier_atomic error:', error);
      throw error;
    }

    if (rpcData && rpcData.duplicate) {
      console.warn('pay_supplier_atomic duplicate detected');
      return tx;
    }

    // Now update local cache for SupplierTransaction
    tx.id = rpcData.transaction_id || id;
    await localDb.supplierTransactions.add(tx);
    // Wallet deduction: paying supplier = money OUT of our register (split-aware)
    if (split) {
      await adjustPaymentBalances(split.map(sp => ({
        id: generateId(),
        modeId: normalizePaymentMethod(sp.method || 'cash'),
        delta: -Number(sp.amount || 0),
        referenceId: id,
        note: `Supplier payment: ${data.note || ''}`,
      })), { batchId: id });
    } else {
      await adjustPaymentBalances([{
        id: generateId(),
        modeId: normalizePaymentMethod(data.payment_type || 'cash'),
        delta: -totalAmount,
        referenceId: id,
        note: `Supplier payment: ${data.note || ''}`,
      }], { batchId: id });
    }
    return tx;
  },

  async recordBill(data: { supplierId: string; amount: number; note?: string; referenceId?: string; sourceType?: 'auto_purchase' | 'manual_bill' | 'opening_balance'; isManualOverride?: boolean; overrideBy?: string }) {
    // X9 GUARD: never create a second supplier bill for the same stock-in / purchase record.
    // Both PurchaseOrderSystem & BatchStockInSystem (and ProductDetailHub) funnel through
    // commitStockInToInventory → recordBill with referenceId = purchase record id. Without this
    // guard a re-run / double receive of the same delivery would double-count the payable.
    if (data.referenceId) {
      const existing = (await localDb.supplierTransactions.toArray())
        .find(t => t.referenceId === data.referenceId);
      if (existing) return existing;
    }
    const id = generateId();
    const inferredType = data.note === 'Opening Balance' ? 'opening_balance' : 'purchase';
    const inferredSourceType = data.sourceType || (inferredType === 'opening_balance' ? 'opening_balance' : 'manual_bill');
    const tx: any = {
      id,
      supplierId: data.supplierId,
      type: inferredType,
      sourceType: inferredSourceType,
      amount: data.amount,
      note: data.note,
      referenceId: data.referenceId,
      isManualOverride: data.isManualOverride || false,
      overrideBy: data.overrideBy || undefined,
      createdAt: new Date()
    };
    await cloudWrite('supplier_transactions', 'create', id, toRemoteSupplierTransaction(tx));
    await localDb.supplierTransactions.add(tx);
    return tx;
  },

  async deleteTransaction(id: string) {
    // BUG-C02: reverse the wallet balances BEFORE any delete so money comes back.
    const tx = await localDb.supplierTransactions.get(id);
    if (tx?.type === 'payment' && Number(tx.amount || 0) > 0) {
      if ((tx as any).splitPayments?.length) {
        await adjustPaymentBalances((tx as any).splitPayments.map((sp: any) => ({
          id: generateId(),
          modeId: normalizePaymentMethod(sp.method || 'cash'),
          delta: +Number(sp.amount),
          referenceId: id,
          referenceType: 'supplier_payment_reversal',
          note: 'Supplier payment deleted',
        })), { batchId: id });
      } else {
        await adjustPaymentBalances([{
          id: generateId(),
          modeId: normalizePaymentMethod((tx as any).paymentType || (tx as any).payment_type || 'cash'),
          delta: +Number(tx.amount),
          referenceId: id,
          referenceType: 'supplier_payment_reversal',
          note: 'Supplier payment deleted',
        }], { batchId: id });
      }
    }
    // Cascade: a supplier PAYMENT also creates a linked expense row.
    // Delete the orphaned expense too, otherwise expense totals stay inflated.
    try {
      const tx: any = await localDb.supplierTransactions.get(id);
      if (tx?.expenseId) {
        await cloudWrite('expenses', 'delete', tx.expenseId, {});
        await localDb.expenses.delete(tx.expenseId);
      }
    } catch (e) {
      console.warn('deleteTransaction: failed to cascade expense cleanup', e);
    }
    await cloudWrite('supplier_transactions', 'delete', id, {});
    await localDb.supplierTransactions.delete(id);
  },

  // Update a previously-recorded supplier bill (used when a linked Supplies
  // expense is edited). Keeps the supplier payable in sync with the expense amount.
  async updateBill(id: string, updates: { amount?: number; note?: string }) {
    const tx: any = await localDb.supplierTransactions.get(id);
    if (!tx) return null;
    const updated = { ...tx, ...updates, updatedAt: new Date() };
    await cloudWrite('supplier_transactions', 'update', id, toRemoteSupplierTransaction(updated));
    await localDb.supplierTransactions.put(updated);
    return updated;
  },

  async fetchRemote(lastSyncTime?: Date): Promise<Supplier[]> {
    const queryFn = () => {
      let q = supabase.from('suppliers').select('*');
      if (lastSyncTime) q = q.gte('updated_at', lastSyncTime.toISOString());
      return q;
    };
    const data = await fetchAllPages(queryFn);
    return data.map(mapSupplier);
  }
};


/**
 * Purchase Orders Service
 */
export const purchaseOrdersService = {
  async getAll(): Promise<PurchaseOrder[]> {
    return await localDb.purchaseOrders.toArray();
  },

  async getById(id: string): Promise<PurchaseOrder | null> {
    return await localDb.purchaseOrders.get(id) || null;
  },

  async create(po: Omit<PurchaseOrder, 'id'>): Promise<PurchaseOrder> {
    const id = generateId();
    const now = new Date();
    const newPO = { ...po, id, createdAt: now, updatedAt: now } as PurchaseOrder;
    await cloudWrite('purchase_orders', 'create', id, {
      id,
      po_number: po.poNumber,
      supplier_id: po.supplierId,
      status: po.status || 'draft',
      total_amount: po.totalAmount || 0,
      notes: po.notes,
      received_at: po.receivedAt ? po.receivedAt.toISOString() : null,
      created_at: now.toISOString(),
      updated_at: now.toISOString()
    });
    await localDb.purchaseOrders.add(newPO);
    return newPO;
  }
};

/**
 * Settings Service
 */
export const supplierTransactionsService = {
  async fetchRemote(lastSyncTime?: Date): Promise<SupplierTransaction[]> {
    const queryFn = () => {
      let q = supabase.from('supplier_transactions').select('*');
      if (lastSyncTime) q = q.gte('updated_at', lastSyncTime.toISOString());
      return q;
    };
    let data;
    try {
      data = await fetchAllPages(queryFn);
    } catch {
      // Fallback: fetch all if updated_at column doesn't exist
      console.warn('[supplierTransactions] Delta sync failed, fetching all');
      data = await fetchAllPages(() => supabase.from('supplier_transactions').select('*'));
    }
    return data.map((item: any) => ({
      ...item,
      supplierId: item.supplier_id ?? item.supplierId,
      referenceId: item.reference_id ?? item.referenceId,
      referenceType: item.reference_type ?? item.referenceType,
      balanceAfter: item.balance_after ?? item.balanceAfter,
      paymentMethod: item.payment_method ?? item.paymentMethod,
      createdAt: item.created_at ? new Date(item.created_at) : new Date(item.createdAt),
    }));
  }
};

/**
 * Stock History Service
 */
