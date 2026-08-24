import { supabase } from '../supabase';
import { localDb, generateId } from '../localDb';
import { CustomerLedger } from '../../types';

/** Map DB row → CustomerLedger */
export const mapCustomerLedger = (row: any): CustomerLedger => ({
  id: row.id,
  customerId: row.customer_id ?? row.customerId,
  saleId: row.sale_id ?? row.saleId,
  type: row.type,
  debit: parseFloat(row.debit) || 0,
  credit: parseFloat(row.credit) || 0,
  balanceAfter: parseFloat(row.balance_after ?? row.balanceAfter) || 0,
  reference: row.reference,
  note: row.note,
  createdBy: row.created_by ?? row.createdBy,
  createdAt: row.created_at ? new Date(row.created_at) : new Date(row.createdAt),
});

/** Fetch ledger for one customer from cloud */
export async function fetchCustomerLedger(customerId: string): Promise<CustomerLedger[]> {
  const { data, error } = await supabase
    .from('customer_ledger')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(mapCustomerLedger);
}

/** Receive payment from customer via RPC (atomic) */
export async function receiveCustomerPayment(params: {
  customerId: string;
  amount: number;
  paymentMode?: string;
  reference?: string;
  note?: string;
  createdBy?: string;
}): Promise<{ balanceBefore: number; balanceAfter: number; ledgerId: string }> {
  const idempotencyKey = `rcv_${params.customerId}_${Date.now()}_${generateId().slice(0, 8)}`;

  const { data, error } = await supabase.rpc('receive_customer_payment', {
    p_customer_id: params.customerId,
    p_amount: params.amount,
    p_payment_mode: params.paymentMode || 'cash',
    p_reference: params.reference || null,
    p_note: params.note || null,
    p_created_by: params.createdBy || null,
    p_idempotency_key: idempotencyKey,
  });

  if (error) throw error;
  if (!data?.ok) throw new Error('receive_customer_payment RPC returned not ok');

  // Update local cache
  await localDb.customers.where('id').equals(params.customerId).modify({ balance: data.balance_after });

  return {
    balanceBefore: data.balance_before,
    balanceAfter: data.balance_after,
    ledgerId: data.ledger_id,
  };
}

/** Refund payment to customer via RPC (atomic) */
export async function refundCustomerPayment(params: {
  customerId: string;
  amount: number;
  paymentMode?: string;
  paymentModeId?: string;
  reference?: string;
  note?: string;
  createdBy?: string;
}): Promise<{ balanceBefore: number; balanceAfter: number; ledgerId: string }> {
  const idempotencyKey = `ref_${params.customerId}_${Date.now()}_${generateId().slice(0, 8)}`;

  const { data, error } = await supabase.rpc('refund_customer_payment', {
    p_customer_id: params.customerId,
    p_amount: params.amount,
    p_payment_mode: params.paymentMode || 'cash',
    p_payment_mode_id: params.paymentModeId || null,
    p_reference: params.reference || null,
    p_note: params.note || null,
    p_created_by: params.createdBy || null,
    p_idempotency_key: idempotencyKey,
  });

  if (error) throw error;
  if (!data?.ok) throw new Error('refund_customer_payment RPC returned not ok');

  // Update local cache
  await localDb.customers.where('id').equals(params.customerId).modify({ balance: data.balance_after });

  return {
    balanceBefore: data.balance_before,
    balanceAfter: data.balance_after,
    ledgerId: data.ledger_id,
  };
}

/** Manual ledger adjustment (Admin/Manager only) */
export async function adjustCustomerLedger(params: {
  customerId: string;
  debit?: number;
  credit?: number;
  note: string;
  createdBy?: string;
}): Promise<void> {
  const id = generateId();
  const prevRows = await localDb.customerLedger.where('customerId').equals(params.customerId)
    .sortBy('createdAt');
  const prev = prevRows.length ? Number(prevRows[prevRows.length - 1].balanceAfter || 0) : 0;
  const balanceAfter = prev + (params.debit || 0) - (params.credit || 0);

  const { error } = await supabase.from('customer_ledger').insert({
    id,
    customer_id: params.customerId,
    type: 'adjustment',
    debit: params.debit || 0,
    credit: params.credit || 0,
    balance_after: balanceAfter,
    note: params.note,
    created_by: params.createdBy || null,
    created_at: new Date().toISOString(),
  });
  if (error) throw error;

  // Update local cache
  await localDb.customerLedger.add({
    id, customerId: params.customerId, saleId: undefined,
    type: 'adjustment', debit: params.debit || 0, credit: params.credit || 0,
    balanceAfter, note: params.note, createdBy: params.createdBy, createdAt: new Date(),
  } as any);
  await localDb.customers.where('id').equals(params.customerId).modify({ balance: balanceAfter });
}
