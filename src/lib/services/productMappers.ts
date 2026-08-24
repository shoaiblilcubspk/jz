import {
  Product,
  ProductAddon,
  Category,
  Topping,
  ProductTopping,
} from '../../types';

export const mapProduct = (item: any): Product => ({
  ...item,
  barcodeValue: item.barcode_value ?? item.barcodeValue ?? item.barcode,
  barcode: item.barcode ?? item.barcode_value ?? item.barcodeValue,
  isWeightBased: item.is_weight_based ?? item.isWeightBased,
  pricePerUnit: item.price_per_unit ?? item.pricePerUnit,
  trackInventory: item.track_inventory ?? item.trackInventory,
  minStock: item.min_stock ?? item.minStock,
  targetStock: item.target_stock ?? item.targetStock,
  cost: item.cost ? Number(item.cost) : 0,
  price: item.price ? Number(item.price) : 0,
  variants: item.variants ?? [],
  variantData: item.variant_data ?? item.variantData ?? [],
  modifiers: item.modifiers ?? [],
  productType: item.product_type ?? item.productType ?? 'simple',
  parentId: item.parent_id ?? item.parentId,
  isService: item.is_service ?? item.isService ?? false,
  requireSerial: item.require_serial ?? item.requireSerial ?? false,
  menuNumber: item.menu_number ?? item.menuNumber,
  highlightTag: item.highlight_tag ?? item.highlightTag,
  createdAt: item.created_at ? new Date(item.created_at) : new Date(item.createdAt),
  updatedAt: item.updated_at ? new Date(item.updated_at) : new Date(item.updatedAt)
});

export const mapProductAddon = (item: any): ProductAddon => ({
  ...item,
  productId: item.product_id ?? item.productId,
  addonProductId: item.addon_product_id ?? item.addonProductId,
  maxQty: item.max_qty ?? item.maxQty,
  createdAt: item.created_at ? new Date(item.created_at) : new Date(item.createdAt),
});

export const toRemoteProductAddon = (a: any) => {
  const remote: any = { ...a };
  if ('productId' in a) { remote.product_id = a.productId; delete remote.productId; }
  if ('addonProductId' in a) { remote.addon_product_id = a.addonProductId; delete remote.addonProductId; }
  if ('maxQty' in a) { remote.max_qty = a.maxQty; delete remote.maxQty; }
  if ('createdAt' in a) { remote.created_at = a.createdAt instanceof Date ? a.createdAt.toISOString() : a.createdAt; delete remote.createdAt; }
  return remote;
};

export const toRemoteProduct = (p: Partial<Product>) => {
  const remote: any = { ...p };
  if ('barcodeValue' in p) { remote.barcode_value = p.barcodeValue; delete remote.barcodeValue; }
  if ('isWeightBased' in p) { remote.is_weight_based = p.isWeightBased; delete remote.isWeightBased; }
  if ('pricePerUnit' in p) { remote.price_per_unit = p.pricePerUnit; delete remote.pricePerUnit; }
  if ('trackInventory' in p) { remote.track_inventory = p.trackInventory; delete remote.trackInventory; }
  if ('minStock' in p) { remote.min_stock = p.minStock; delete remote.minStock; }
  if ('targetStock' in p) { remote.target_stock = p.targetStock; delete remote.targetStock; }
  if ('parentCategoryId' in p) { remote.parent_category_id = p.parentCategoryId; delete remote.parentCategoryId; }
  if ('productAddons' in p) { delete remote.productAddons; }
  if ('createdAt' in p) { remote.created_at = p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt; delete remote.createdAt; }
  if ('updatedAt' in p) { remote.updated_at = p.updatedAt instanceof Date ? p.updatedAt.toISOString() : p.updatedAt; delete remote.updatedAt; }
  if ('isService' in p) { remote.is_service = p.isService; delete remote.isService; }
  if ('requireSerial' in p) { remote.require_serial = p.requireSerial; delete remote.requireSerial; }
  if ('variantData' in p) { remote.variant_data = p.variantData; delete remote.variantData; }
  if ('menuNumber' in p) { remote.menu_number = p.menuNumber; delete remote.menuNumber; }
  if ('productType' in p) { remote.product_type = p.productType; delete remote.productType; }
  if ('parentId' in p) { remote.parent_id = p.parentId; delete remote.parentId; }
  if ('highlightTag' in p) { remote.highlight_tag = p.highlightTag; delete remote.highlightTag; }

  // Enforce NOT NULL constraint for sku
  if (!remote.sku) {
    remote.sku = p.id || remote.id || remote.barcode_value || `SKU-${Date.now()}`;
  }

  return remote;
};



export const mapProductTopping = (item: any): ProductTopping => ({
  id: item.id,
  productId: item.product_id ?? item.productId,
  toppingId: item.topping_id ?? item.toppingId,
  isDefault: item.is_default ?? item.isDefault ?? false,
  maxAllowed: item.max_allowed ?? item.maxAllowed ?? 1,
  createdAt: item.created_at ? new Date(item.created_at) : (item.createdAt ? new Date(item.createdAt) : new Date()),
});

