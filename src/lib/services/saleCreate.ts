import { Sale } from '../../types';
import { localDb, generateId } from '../localDb';
import { cloudWrite } from '../cloudWrite';
import { getDeviceId } from '../deviceId';
import { getActor } from '../actionToken';
import { toRemoteCustomer, toRemoteSale } from './mappers';
import { derivePaymentStatus } from './utils';
import { revertLocalSaleStock } from './atomicOps';
import { collectSaleMovements } from './saleCreate.stock';
import { buildSalePaymentMoves } from './paymentsService';
import { logAuditEvent } from './auditLogService';

export async function createSale(sale: Omit<Sale, 'id'>): Promise<Sale> {
  if (!sale.invoiceNumber || String(sale.invoiceNumber).trim() === '' || sale.invoiceNumber === 'undefined') {
    console.error("[FATAL] Attempted to create a sale without a valid invoiceNumber:", sale);
    throw new Error("Cannot create a sale without a valid invoice number. This prevents ghost records.");
  }
  const id = generateId();
  const now = new Date();
  const actor = getActor();
  // PHASE 27 / 2 / 6: every transaction carries a stable device id + idempotency
  // key for multi-device dedup, plus immutable attribution (who actually rang it
  // up) so edits can never silently reassign the salesman/cashier link.
  const newSale = {
    ...sale,
    id,
    deviceId: getDeviceId(),
    idempotencyKey: id,
    userId: actor?.id ?? null,
    actionPerformedBy: actor?.id ?? null,
    originalCashier: sale.cashier ?? null,
    originalSalesmanId: sale.salesmanId ?? null,
    originalSalesmanName: sale.salesmanName ?? null,
    timestamp: now,
    createdAt: now
  } as Sale;

  // We must process items FIRST to calculate true FIFO cost before saving the sale.
  // DRAFT RULE: pending drafts must NEVER touch stock or revenue.
  // A draft is only a saved cart — it deducts stock ONLY when it is completed.
  const isDraftSale = sale.status === 'pending' || !!sale.notes?.includes('DRAFT_SALE');
  const skipStockEffects = isDraftSale;

  const { movements, anyOversold } = await collectSaleMovements(newSale, id, now, skipStockEffects);

  let paymentMoves: any[] = [];
  if (!isDraftSale) {
    paymentMoves = buildSalePaymentMoves(newSale);
  }

  let customerLedgerPayload: any = null;
  let customerToUpdate: any = null;
  if (newSale.customerId && !isDraftSale && newSale.paymentMethod === 'credit') {
    const customer = await localDb.customers.get(newSale.customerId);
    if (customer) {
      customerToUpdate = customer;
      const ledgerId = generateId();
      customerLedgerPayload = {
        id: ledgerId,
        customer_id: customer.id,
        type: 'sale',
        debit: newSale.total,
        credit: 0,
        balance_after: Number(customer.balance || 0) + newSale.total,
        reference: newSale.invoiceNumber,
        note: 'Sale',
        created_by: actor?.id ?? null,
      };
    }
  }

  (newSale as any).paymentStatus = derivePaymentStatus(newSale);

  // collectSaleMovements() above already adjusted local product stock + wrote local
  // stock_history (optimistic). Persist the sale row locally too, THEN commit to
  // cloud. ALL-OR-NOTHING: if the cloud commit fails we fully REVERT every local
  // write and throw, so local & cloud can never silently diverge.
  await localDb.sales.add(newSale);

  // Cloud is the SINGLE SOURCE OF TRUTH — commit the sale + ALL stock movements +
  // wallet moves + customer ledger in ONE atomic transaction via commit_sale.
  // Idempotent (idempotency_key = sale id); invoice-collision retry lives inside
  // cloudWrite. Drafts carry empty history/moves (commit_sale just inserts the row).
  const megaPayload: any = toRemoteSale(newSale);
  megaPayload.history = skipStockEffects ? [] : movements;
  megaPayload.paymentMoves = paymentMoves.map(p => ({
    id: p.id,
    mode_id: p.modeId,
    delta: p.delta,
    reference_id: p.referenceId,
    note: p.note,
  }));
  megaPayload.customerLedger = customerLedgerPayload;

  try {
    await cloudWrite('sales', 'create', id, megaPayload, { batchId: id });
  } catch (_e) {
    // ALL-OR-NOTHING ROLLBACK: undo the optimistic local writes so nothing is left half-applied.
    if (!skipStockEffects) {
      await revertLocalSaleStock(newSale.id, movements);
      await localDb.stockHistory.where('referenceId').equals(newSale.id).delete();
      await localDb.variantStockHistory.filter((h: any) => h.referenceId === newSale.id).delete();
    }
    await localDb.sales.delete(newSale.id);
    throw new Error('SALE_NOT_SYNCED: Cloud unreachable — the sale was NOT saved (nothing changed locally). Retry when online.');
  }

  // Cloud is authoritative. Mirror the wallet balance changes into the local cache
  // (commit_sale already applied them server-side; realtime pull re-affirms).
  if (!isDraftSale && paymentMoves.length > 0) {
    const nowTime = new Date();
    for (const mv of paymentMoves) {
      const mode = await localDb.paymentModes.get(mv.modeId);
      if (mode) {
        await localDb.paymentModes.update(mv.modeId, { balance: Number(mode.balance || 0) + Number(mv.delta), updatedAt: nowTime });
      }
      await localDb.payment_movements.add({
        id: mv.id,
        modeId: mv.modeId,
        delta: Number(mv.delta),
        referenceId: mv.referenceId,
        referenceType: mv.referenceType,
        note: mv.note,
        createdAt: nowTime,
      }).catch(() => {});
    }
  }

  // Mirror the customer ledger + stats locally. commit_sale already inserted the
  // ledger row and updated the balance server-side; the STATS (totalPurchases /
  // lastPurchase) are a secondary best-effort push.
  if (newSale.customerId && !isDraftSale) {
    const customer = await localDb.customers.get(newSale.customerId);
    if (customer) {
      const balAfter = customerLedgerPayload ? customerLedgerPayload.balance_after : customer.balance;
      const afterCommit = new Date();
      const updatedCustomer = {
        ...customer,
        totalPurchases: (customer.totalPurchases || 0) + newSale.total,
        lastPurchase: newSale.timestamp,
        balance: balAfter,
        updatedAt: afterCommit
      };
      await localDb.customers.put(updatedCustomer);
      try {
        await cloudWrite('customers', 'update', customer.id, { ...toRemoteCustomer(updatedCustomer), id: customer.id }, { batchId: id });
      } catch (err) {
        console.warn('[createSale] customer stats push failed (sale already committed):', err);
      }
    }

    if (customerLedgerPayload) {
      await localDb.customerLedger.add({
        id: customerLedgerPayload.id,
        customerId: customerLedgerPayload.customer_id,
        saleId: newSale.id,
        type: 'sale',
        debit: newSale.total,
        credit: 0,
        balanceAfter: customerLedgerPayload.balance_after,
        reference: newSale.invoiceNumber,
        note: 'Sale',
        createdBy: actor?.id ?? null,
        createdAt: new Date(),
      }).catch(() => {});
    }
  }

  (newSale as any).wasOversold = anyOversold;

  // BUG-C06/C07: audit trail — every sale creation is logged locally + synced.
  await logAuditEvent({
    saleId: newSale.id,
    invoiceNumber: newSale.invoiceNumber,
    action: 'created',
    performedByName: (newSale as any).cashier,
    meta: { total: newSale.total, itemCount: newSale.items.length, deviceId: (newSale as any).deviceId },
  });

  return newSale;
}
