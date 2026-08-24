import {
  Supplier,
  SupplierTransaction,
  PurchaseOrder,
  PurchaseOrderItem,
} from '../../types';

export const mapSupplier = (item: any): Supplier => ({
  id: item.id,
  name: item.name || '',
  email: item.email || '',
  phone: item.phone || '',
  address: item.address || '',
  businessType: item.business_type || item.businessType || '',
  paymentTerms: item.payment_terms || item.paymentTerms || '',
  openingBalance: Number(item.opening_balance ?? item.openingBalance ?? 0),
  rating: Number(item.rating ?? 0),
  createdAt: item.created_at ? new Date(item.created_at) : (item.createdAt ? new Date(item.createdAt) : new Date()),
  updatedAt: item.updated_at ? new Date(item.updated_at) : (item.updatedAt ? new Date(item.updatedAt) : undefined)
});

export const toRemoteSupplier = (s: Partial<Supplier>) => {
  const remote: any = { ...s };
  if ('paymentTerms' in s) { remote.payment_terms = s.paymentTerms; delete remote.paymentTerms; }
  if ('openingBalance' in s) { remote.opening_balance = s.openingBalance; delete remote.openingBalance; }
  if ('businessType' in s) { remote.business_type = s.businessType; delete remote.businessType; }
  if ('createdAt' in s) { remote.created_at = s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt; delete remote.createdAt; }
  if ('updatedAt' in s) { remote.updated_at = s.updatedAt instanceof Date ? s.updatedAt.toISOString() : s.updatedAt; delete remote.updatedAt; }
  return remote;
};

export const mapSupplierTransaction = (item: any): SupplierTransaction => ({
  id: item.id,
  supplierId: item.supplier_id ?? item.supplierId,
  type: item.type,
  sourceType: item.source_type ?? item.sourceType,
  amount: Number(item.amount || 0),
  referenceId: item.reference_id ?? item.referenceId,
  referenceType: item.reference_type ?? item.referenceType,
  note: item.note,
  balanceAfter: Number(item.balance_after ?? item.balanceAfter ?? 0),
  isManualOverride: item.is_manual_override ?? item.isManualOverride,
  overrideBy: item.override_by ?? item.overrideBy,
  paymentType: item.payment_type ?? item.paymentType,
  splitPayments: item.split_payments ?? item.splitPayments,
  createdAt: item.created_at ? new Date(item.created_at) : new Date(item.createdAt),
  updatedAt: item.updated_at ? new Date(item.updated_at) : new Date(item.updatedAt),
});

export const mapPurchaseOrder = (item: any): PurchaseOrder => ({
  id: item.id,
  poNumber: item.po_number ?? item.poNumber,
  supplierId: item.supplier_id ?? item.supplierId,
  status: item.status,
  totalAmount: Number(item.total_amount ?? item.totalAmount ?? 0),
  notes: item.notes,
  receivedAt: item.received_at ? new Date(item.received_at) : (item.receivedAt ? new Date(item.receivedAt) : undefined),
  createdAt: item.created_at ? new Date(item.created_at) : new Date(item.createdAt),
  updatedAt: item.updated_at ? new Date(item.updated_at) : new Date(item.updatedAt),
});

export const mapPurchaseOrderItem = (item: any): PurchaseOrderItem => ({
  id: item.id,
  purchaseOrderId: item.purchase_order_id ?? item.purchaseOrderId,
  productId: item.product_id ?? item.productId,
  quantity: Number(item.quantity || 0),
  unitPrice: Number(item.unit_price ?? item.unitPrice ?? 0),
  receivedQty: Number(item.received_qty ?? item.receivedQty ?? 0),
  isReceived: item.is_received ?? item.isReceived ?? false,
  createdAt: item.created_at ? new Date(item.created_at) : new Date(item.createdAt),
});


export const toRemoteSupplierTransaction = (t: any) => {
  const remote: any = { ...t };
  if ('id' in t && t.id) remote.id = t.id;
  if ('supplierId' in t && t.supplierId !== undefined) { remote.supplier_id = t.supplierId; delete remote.supplierId; }
  if ('type' in t && t.type !== undefined) remote.type = t.type;
  if ('sourceType' in t && t.sourceType !== undefined) { remote.source_type = t.sourceType; delete remote.sourceType; }
  if ('amount' in t && t.amount !== undefined) remote.amount = t.amount;
  if ('referenceId' in t && t.referenceId !== undefined) { remote.reference_id = t.referenceId; delete remote.referenceId; }
  if ('referenceType' in t && t.referenceType !== undefined) { remote.reference_type = t.referenceType; delete remote.referenceType; }
  if ('note' in t && t.note !== undefined) remote.note = t.note;
  if ('balanceAfter' in t && t.balanceAfter !== undefined) { remote.balance_after = t.balanceAfter; delete remote.balanceAfter; }
  if ('isManualOverride' in t && t.isManualOverride !== undefined) { remote.is_manual_override = t.isManualOverride; delete remote.isManualOverride; }
  if ('overrideBy' in t && t.overrideBy !== undefined) { remote.override_by = t.overrideBy; delete remote.overrideBy; }
  if ('paymentType' in t && t.paymentType !== undefined) { remote.payment_type = t.paymentType; delete remote.paymentType; }
  if ('splitPayments' in t && t.splitPayments !== undefined) { remote.split_payments = t.splitPayments; delete remote.splitPayments; }
  if ('createdAt' in t && t.createdAt !== undefined) { remote.created_at = t.createdAt instanceof Date ? t.createdAt.toISOString() : t.createdAt; delete remote.createdAt; }
  if ('updatedAt' in t && t.updatedAt !== undefined) { remote.updated_at = t.updatedAt instanceof Date ? t.updatedAt.toISOString() : t.updatedAt; delete remote.updatedAt; }
  if ('expenseId' in remote) delete remote.expenseId;
  return remote;
};
