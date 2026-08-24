import { supabase } from './supabase';
import { withActor, signAction } from './actionToken';
import { localDb, SETTINGS_ID } from './localDb';

/**
 * cloudWrite — the single cloud-direct write path.
 *
 * Cloud (Supabase/Postgres) is the SINGLE SOURCE OF TRUTH. Every mutation goes
 * straight to the cloud and this function AWAITS it, THROWING on any real error
 * so the caller (and the UI) learns immediately when a write did not persist.
 *
 * This deliberately replaces the old offline-first `queueOp` mechanism. There is:
 *   - NO local pendingOps queue, NO background sync engine, NO silent retry.
 *   - NO conflict store / FK auto-heal / schema-blacklist loop (offline cruft).
 * What IS preserved (transaction safety per the decommission plan):
 *   - atomic RPC dispatch (commit_sale / commit_restock / commit_expense /
 *     refund_sale_atomic / delete_sale_atomic / edit_sale_atomic),
 *   - idempotency: a duplicate-key (23505) is treated as success (already done),
 *   - invoice-number collision retry for concurrent sales,
 *   - last-write-wins guard for products/customers/suppliers (skip stale writes),
 *   - withActor() actor/signature stamping for RLS.
 *
 * Signature mirrors the former queueOp(entity, opType, entityId, payload, options)
 * so call sites convert with a one-word rename + import swap.
 */

type CloudOpType = 'create' | 'update' | 'upsert' | 'delete';

const NOT_NULL_COLUMNS = ['id', 'created_at', 'updated_at', 'name', 'price', 'sku', 'category', 'total', 'subtotal', 'quantity', 'invoice_number', 'items'];

/** Drop `undefined` values and nulls for columns that must not be null. */
function clean(payload: any): any {
  if (!payload || typeof payload !== 'object') return payload;
  const out: Record<string, any> = {};
  for (const k in payload) {
    if (payload[k] === undefined) continue;
    if (payload[k] === null && NOT_NULL_COLUMNS.includes(k)) continue;
    out[k] = payload[k];
  }
  return out;
}

function isDuplicate(error: any): boolean {
  if (!error) return false;
  const s = (JSON.stringify(error) + (error.message || '')).toLowerCase();
  return error.code === '23505' || s.includes('duplicate key') || s.includes('unique constraint');
}

export async function cloudWrite(
  entity: string,
  opType: CloudOpType,
  entityId: string,
  payload: any,
  _options?: { batchId?: string }
): Promise<void> {
  // ---- special-case entities -------------------------------------------------
  if (entity === 'payment_movements') {
    const token = await signAction('apply_payment_movements');
    const { error } = await supabase.rpc('apply_payment_movements', { 
      p_moves: payload,
      p_sig: token?.p_sig ?? null
    });
    if (error) throw error;
    return;
  }

  if (entity === 'sale_audit_log' && opType === 'create') {
    const { error } = await supabase.from('sale_audit_log').insert(payload);
    if (error && error.code !== '23505') throw error;
    return;
  }

  if (entity === 'product_toppings') {
    const { error } = opType === 'delete'
      ? await supabase.from('product_toppings').delete().eq('product_id', entityId)
      : await supabase.from('product_toppings').upsert(payload);
    if (error) throw error;
    return;
  }

  if (entity === 'app_settings' || entity === 'settings') {
    // Only admin/manager may write global settings (matches prior RLS behavior).
    const { data: { session } } = await supabase.auth.getSession();
    let role = 'cashier';
    if (session?.user?.id) {
      const profile = await localDb.users.get(session.user.id);
      role = profile?.role ?? 'cashier';
    }
    if (!['admin', 'manager'].includes(role)) throw new Error('Unauthorized: Only Admin or Manager can update settings');
    const body = await withActor({ ...clean(payload), id: SETTINGS_ID, updated_at: new Date().toISOString() }, 'app_settings');
    const { error } = await supabase.from('app_settings').upsert(body, { onConflict: 'id' });
    if (error) throw error;
    return;
  }

  // ---- financial atomic RPCs -------------------------------------------------
  if (entity === 'sales' && opType === 'create') {
    const p = clean(payload);
    let rpcPayload: any = {
      p_sale: p,
      p_history: payload.history || [],
      p_payment_moves: payload.paymentMoves || [],
      p_customer_ledger: payload.customerLedger || null,
    };
    let { error } = await supabase.rpc('commit_sale', rpcPayload);
    // Invoice-number collision (concurrent sale on another device): fetch a fresh
    // number from the authoritative counter and retry once.
    if (error) {
      const s = (JSON.stringify(error) + (error.message || '')).toLowerCase();
      if (s.includes('invoice_number')) {
        const { data, error: rpcErr } = await supabase.rpc('get_next_invoice_number');
        if (!rpcErr && data) {
          const newInv = data as string;
          await localDb.sales.update(entityId, { invoiceNumber: newInv }).catch(() => {});
          rpcPayload = { ...rpcPayload, p_sale: { ...p, invoice_number: newInv } };
          error = (await supabase.rpc('commit_sale', rpcPayload)).error;
        }
      }
    }
    if (error && !isDuplicate(error)) throw error;
    return;
  }

  if (entity === 'sales' && opType === 'update' && payload?.isAtomicEdit) {
    const token = await signAction('edit_sale');
    const { error } = await supabase.rpc('edit_sale_atomic', {
      p_new_sale: payload.newSale,
      p_new_history: payload.newHistory,
      p_old_sale_id: payload.oldSaleId,
      p_old_reverse_history: payload.oldReverseHistory,
      p_user_id: token?.p_user_id ?? null,
      p_role: token?.p_role ?? null,
      p_sig: token?.p_sig ?? null,
    });
    if (error) throw error;
    return;
  }

  if (entity === 'sales' && opType === 'update' && (payload?.status === 'refunded' || payload?.status === 'partially_refunded')) {
    const token = await signAction('refund_sale');
    const base: any = {
      p_sale_id: entityId,
      p_history: payload.history || [],
      p_status: payload.status,
      p_refunded_amount: Number(payload.refunded_amount || 0),
    };
    if (token) { base.p_user_id = token.p_user_id; base.p_role = token.p_role; base.p_sig = token.p_sig; }
    const { error } = await supabase.rpc('refund_sale_atomic', base);
    if (error) throw error;
    return;
  }

  if (entity === 'sales' && opType === 'delete') {
    const token = await signAction('delete_sale');
    const base: any = { p_sale_id: entityId, p_history: payload?.history || [] };
    if (token) { base.p_user_id = token.p_user_id; base.p_role = token.p_role; base.p_sig = token.p_sig; }
    const { error } = await supabase.rpc('delete_sale_atomic', base);
    if (error) throw error;
    return;
  }

  if (entity === 'sales' && opType === 'update') {
    const guarded = await withActor({ ...clean(payload), id: entityId }, 'sales');
    delete (guarded as any).id;
    const { error } = await supabase.from('sales').update(guarded).eq('id', entityId);
    if (error) throw error;
    return;
  }

  if (entity === 'purchase_records' && opType === 'create') {
    if (payload.p_purchase_record || payload.p_stock_history) {
      const rec = payload.p_purchase_record ? payload.p_purchase_record : { ...payload };
      delete rec.p_stock_history;
      delete rec.p_supplier_transaction;
      const { error } = await supabase.rpc('commit_restock', {
        p_purchase_record: rec,
        p_stock_history: payload.p_stock_history || [],
        p_supplier_transaction: payload.p_supplier_transaction || null,
      });
      if (error && !isDuplicate(error)) throw error;
    } else {
      const body = { ...payload };
      ['supplier_id', 'supplierId', 'retailPrice', 'retail_price', 'addedBy', 'batches', 'p_stock_history', 'p_supplier_transaction'].forEach(k => delete (body as any)[k]);
      const { error } = await supabase.from('purchase_records').upsert(body, { onConflict: 'id' });
      if (error && !isDuplicate(error)) throw error;
    }
    return;
  }

  if (entity === 'expenses' && opType === 'create') {
    if (payload.p_payment_moves) {
      const token = await signAction('commit_expense');
      const rpcPayload: any = { 
        p_expense: { ...payload }, 
        p_payment_moves: payload.p_payment_moves,
        p_sig: token?.p_sig ?? null
      };
      delete rpcPayload.p_expense.p_payment_moves;
      const { error } = await supabase.rpc('commit_expense', rpcPayload);
      if (error && !isDuplicate(error)) throw error;
    } else {
      const { error } = await supabase.from('expenses').upsert(clean(payload), { onConflict: 'id' });
      if (error && !isDuplicate(error)) throw error;
    }
    return;
  }

  // ---- generic delete --------------------------------------------------------
  if (opType === 'delete') {
    const { error } = await supabase.from(entity as any).delete().eq('id', entityId);
    if (error) throw error;
    return;
  }

  // ---- generic create / update / upsert -------------------------------------
  // Last-write-wins guard: for these entities, skip a write whose payload is
  // older than what the cloud already has (protects concurrent multi-device edits).
  if ((entity === 'products' || entity === 'customers' || entity === 'suppliers')) {
    const { data: remote } = await supabase.from(entity as any).select('updated_at').eq('id', entityId).maybeSingle();
    const remoteUpdatedAt = (remote as any)?.updated_at;
    const localUpdatedAt = payload?.updated_at || payload?.updatedAt;
    if (remoteUpdatedAt && localUpdatedAt && new Date(localUpdatedAt).getTime() < new Date(remoteUpdatedAt).getTime()) {
      return; // cloud copy is newer — do not clobber it
    }
  }

  const guarded = await withActor(clean(payload), entity);
  const insertOnly = entity === 'stock_history' || entity === 'variant_stock_history';
  const { error } = await (insertOnly
    ? supabase.from(entity as any).insert(guarded)
    : supabase.from(entity as any).upsert(guarded, { onConflict: 'id' }));
  if (error && !isDuplicate(error)) throw error;
}
