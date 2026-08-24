import {
  Bundle,
  BundleItem,
} from '../../types';

export const mapBundle = (row: any): Bundle => ({
  id: row.id,
  name: row.name || '',
  description: row.description || '',
  discountValue: Number(row.discount_value) || 0,
  discountType: row.discount_type || 'percentage',
  active: row.active !== false,
  hideItemPrices: row.hide_item_prices === true,
  image: row.image,
  items: (row.bundle_items || []).map((bi: any): BundleItem => ({
    id: bi.id,
    bundleId: bi.bundle_id,
    productId: bi.product_id,
    quantity: Number(bi.quantity) || 1,
    createdAt: bi.created_at ? new Date(bi.created_at) : new Date(),
  })),
  overridePrice: row.override_price ? Number(row.override_price) : undefined,
  createdAt: row.created_at ? new Date(row.created_at) : new Date(),
  updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
});

export const mapBundleItem = (bi: any): BundleItem => ({
  id: bi.id,
  bundleId: bi.bundle_id ?? bi.bundleId,
  productId: bi.product_id ?? bi.productId,
  quantity: Number(bi.quantity) || 1,
  createdAt: bi.created_at ? new Date(bi.created_at) : (bi.createdAt ? new Date(bi.createdAt) : new Date()),
});
