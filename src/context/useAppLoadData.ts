import { useCartStore, useSettingsStore, useUsersStore, useProductsStore, useInventoryStore, useCustomersStore, useSalesStore, useExpensesStore, useAppStore, usePaymentsStore } from '../stores';
import { localDb, SETTINGS_ID } from '../lib/localDb';
import { supabase } from '../lib/supabase';
import { sonner } from '../lib/sonner';
import {
  usersService,
  mapProduct,
  mapCustomer,
  mapSale,
  mapSettings,
  mapSalesman,
  mapExpense,
  mapDiscount,
  mapPurchaseRecord,
  mapPaymentMode,
  mapPurchaseOrder,
  mapPurchaseOrderItem,
  mapSupplierTransaction,
  mapCategory,
  mapTopping,
  mapProductTopping,
  mapBundle,
  mapBundleItem,
  mapProductAddon,
  mapSupplier,
  salesTabsService
} from '../lib/services';
import { mapStockHistory, mapVariantStockHistory } from '../lib/services/stockMappers';
import { mapCustomerLedger } from '../lib/services/customerLedgerService';
import { useAuth } from './AuthContext';

/** Fetch a table from Supabase cloud and map each row. */
async function cloudFetch(table: string, mapper?: (r: any) => any, opts?: { order?: string; limit?: number }) {
  let q: any = supabase.from(table).select('*');
  if (opts?.order) q = q.order(opts.order, { ascending: false });
  if (opts?.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data as any[]) || [];
  return mapper ? rows.map(mapper) : rows;
}

export function useAppLoadData(initialized: boolean, setInitialized: React.Dispatch<React.SetStateAction<boolean>>) {
  const { user } = useAuth();

  const searchSales = async (term: string) => {
    try {
      const q = term.trim().toLowerCase();
      if (!q) {
        const recent = await localDb.sales.orderBy('timestamp').reverse().limit(500).toArray();
        useSalesStore.getState().setSales(recent.map(mapSale));
        return;
      }

      const allSales = await localDb.sales.toArray();
      const filtered = allSales.filter(s =>
        (s.invoiceNumber || '').toLowerCase().includes(q) ||
        (s.customerName || '').toLowerCase().includes(q) ||
        (s.customerPhone || '').includes(q) ||
        (s.notes || '').toLowerCase().includes(q)
      );

      filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      useSalesStore.getState().setSales(filtered.slice(0, 100).map(mapSale));
    } catch (error) {
      console.error('Error searching sales:', error);
    }
  };

  const loadMoreSales = async (offset: number, limit: number = 200) => {
    try {
      const sales = await localDb.sales
        .orderBy('timestamp')
        .reverse()
        .offset(offset)
        .limit(limit)
        .toArray();

      if (sales.length > 0) {
        const currentSales = useSalesStore.getState().sales;
        const mapped = sales.map(mapSale);

        const existingIds = new Set(currentSales.map(s => s.id));
        const newSales = mapped.filter(s => !existingIds.has(s.id));

        if (newSales.length > 0) {
          useSalesStore.getState().setSales([...currentSales, ...newSales]);
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Failed to load more sales:', error);
      return false;
    }
  };

  const loadData = async (silent = false, _forceCloudSync = false) => {
    if (!user) return;
    if (!silent) sonner.loading('Loading POS Data...', { id: 'load-data' });

    try {
      if (!navigator.onLine) {
        throw new Error('Cannot load while offline. Please connect to the internet.');
      }

      console.log('[loadData] Fetching directly from cloud (Supabase)...');
      const [
        cloudProducts,
        cloudCustomers,
        cloudUsers,
        cloudSalesmen,
        cloudDiscounts,
        cloudPaymentModes,
        cloudExpenses,
        cloudPurchaseRecords,
        cloudPurchaseOrders,
        cloudSuppliers,
        cloudSupplierTx,
        cloudCategories,
        cloudBundles,
        cloudSettings,
        cloudSales,
        cloudStockHistory,
        cloudSalesTabs,
        cloudPayments,
        cloudVariantStockHistory,
        cloudToppings,
        cloudBundleItems,
        cloudPurchaseOrderItems,
        cloudProductAddons,
        cloudProductToppings,
        cloudCustomerLedger,
      ] = await Promise.allSettled([
        cloudFetch('products', mapProduct),
        cloudFetch('customers', mapCustomer),
        usersService.fetchRemote().catch(() => []),
        cloudFetch('salesmen', mapSalesman),
        cloudFetch('discounts', mapDiscount),
        cloudFetch('payment_modes', mapPaymentMode),
        cloudFetch('expenses', mapExpense),
        cloudFetch('purchase_records', mapPurchaseRecord),
        cloudFetch('purchase_orders', mapPurchaseOrder),
        cloudFetch('suppliers', mapSupplier),
        cloudFetch('supplier_transactions', mapSupplierTransaction),
        cloudFetch('categories', mapCategory),
        cloudFetch('bundles', mapBundle),
        (async () => {
          const { data, error } = await supabase.from('app_settings').select('*').eq('id', SETTINGS_ID).single();
          if (error) throw error;
          return data;
        })(),
        cloudFetch('sales', mapSale, { order: 'created_at', limit: 500 }),
        cloudFetch('stock_history', mapStockHistory, { order: 'created_at', limit: 2000 }),
        user ? salesTabsService.getByUserId(user.id).catch(() => []) : Promise.resolve([]),
        cloudFetch('payments', (r: any) => r, { order: 'created_at', limit: 1000 }),
        cloudFetch('variant_stock_history', mapVariantStockHistory, { order: 'created_at', limit: 2000 }),
        cloudFetch('toppings', mapTopping),
        cloudFetch('bundle_items', mapBundleItem),
        cloudFetch('purchase_order_items', mapPurchaseOrderItem),
        cloudFetch('product_addons', mapProductAddon),
        cloudFetch('product_toppings', mapProductTopping),
        cloudFetch('customer_ledger', mapCustomerLedger),
      ]);

      const ok = (r: PromiseSettledResult<any>) => (r.status === 'fulfilled' ? r.value : null);

      const products = ok(cloudProducts) || [];
      const customers = ok(cloudCustomers) || [];
      const users = ok(cloudUsers) || [];
      const salesmen = ok(cloudSalesmen) || [];
      const discounts = ok(cloudDiscounts) || [];
      const paymentModes = ok(cloudPaymentModes) || [];
      const expenses = ok(cloudExpenses) || [];
      const purchaseRecords = ok(cloudPurchaseRecords) || [];
      const purchaseOrders = ok(cloudPurchaseOrders) || [];
      const suppliers = ok(cloudSuppliers) || [];
      const supplierTx = ok(cloudSupplierTx) || [];
      const categories = ok(cloudCategories) || [];
      const bundles = ok(cloudBundles) || [];
      const settingsRow = ok(cloudSettings);
      const sales = ok(cloudSales) || [];
      const stockHistory = ok(cloudStockHistory) || [];
      const salesTabs: any[] = ok(cloudSalesTabs) || [];
      const payments = ok(cloudPayments) || [];
      const variantStockHistory = ok(cloudVariantStockHistory) || [];
      const toppings = ok(cloudToppings) || [];
      const bundleItems = ok(cloudBundleItems) || [];
      const purchaseOrderItems = ok(cloudPurchaseOrderItems) || [];
      const productAddons = ok(cloudProductAddons) || [];
      const productToppings = ok(cloudProductToppings) || [];
      const customerLedger = ok(cloudCustomerLedger) || [];

      // Persist into local display cache so search/loadMore keep working offline-of-cache.
      await Promise.allSettled([
        localDb.products.clear().then(() => localDb.products.bulkPut(products.map(p => ({ ...p })))),
        localDb.customers.clear().then(() => localDb.customers.bulkPut(customers)),
        localDb.salesmen.clear().then(() => localDb.salesmen.bulkPut(salesmen)),
        localDb.discounts.clear().then(() => localDb.discounts.bulkPut(discounts)),
        localDb.paymentModes.clear().then(() => localDb.paymentModes.bulkPut(paymentModes)),
        localDb.expenses.clear().then(() => localDb.expenses.bulkPut(expenses)),
        localDb.purchaseRecords.clear().then(() => localDb.purchaseRecords.bulkPut(purchaseRecords)),
        localDb.purchaseOrders.clear().then(() => localDb.purchaseOrders.bulkPut(purchaseOrders)),
        localDb.suppliers.clear().then(() => localDb.suppliers.bulkPut(suppliers)),
        localDb.supplierTransactions.clear().then(() => localDb.supplierTransactions.bulkPut(supplierTx)),
        localDb.categories.clear().then(() => localDb.categories.bulkPut(categories)),
        localDb.bundles.clear().then(() => localDb.bundles.bulkPut(bundles)),
        localDb.sales.clear().then(() => localDb.sales.bulkPut(sales)),
        localDb.stockHistory.clear().then(() => stockHistory.length ? localDb.stockHistory.bulkPut(stockHistory) : Promise.resolve()),
        localDb.payments.clear().then(() => payments.length ? localDb.payments.bulkPut(payments) : Promise.resolve()),
        localDb.variantStockHistory.clear().then(() => variantStockHistory.length ? localDb.variantStockHistory.bulkPut(variantStockHistory) : Promise.resolve()),
        localDb.toppings.clear().then(() => toppings.length ? localDb.toppings.bulkPut(toppings) : Promise.resolve()),
        localDb.bundleItems.clear().then(() => bundleItems.length ? localDb.bundleItems.bulkPut(bundleItems) : Promise.resolve()),
        localDb.purchaseOrderItems.clear().then(() => purchaseOrderItems.length ? localDb.purchaseOrderItems.bulkPut(purchaseOrderItems) : Promise.resolve()),
        localDb.productAddons.clear().then(() => productAddons.length ? localDb.productAddons.bulkPut(productAddons) : Promise.resolve()),
        localDb.customerLedger.clear().then(() => customerLedger.length ? localDb.customerLedger.bulkPut(customerLedger) : Promise.resolve()),
        localDb.appSettings.clear().then(() => settingsRow ? localDb.appSettings.put(mapSettings(settingsRow)) : Promise.resolve()),
        localDb.users.clear().then(() => users.length ? localDb.users.bulkPut(users) : Promise.resolve()),
      ]).catch(() => {});

      // Populate stores (cloud is source of truth)
      if (settingsRow) {
        const dbSettings = mapSettings(settingsRow);
        // Preserve local device UI preferences (theme, grid columns only)
        try {
          const localStr = localStorage.getItem('pos_local_prefs');
          if (localStr) {
            const local = JSON.parse(localStr);
            if (local.posGridColumns !== undefined) dbSettings.posGridColumns = local.posGridColumns;
            if (local.theme !== undefined) dbSettings.theme = local.theme;
            if (local.receiptPrinter !== undefined) dbSettings.receiptPrinter = local.receiptPrinter;
            if (local.enableKotPrinter !== undefined) dbSettings.enableKotPrinter = local.enableKotPrinter;
            if (local.autoSaveReceiptPng !== undefined) dbSettings.autoSaveReceiptPng = local.autoSaveReceiptPng;
          }
        } catch (e) {}
        useSettingsStore.getState().setSettings(dbSettings);
      }
      useProductsStore.getState().setProducts(products);
      useCustomersStore.getState().setCustomers(customers);
      useUsersStore.getState().setUsers(users);
      useUsersStore.getState().setSalesmen(salesmen);
      useAppStore.getState().setDiscounts(discounts);
      useInventoryStore.getState().setCategories(categories);
      useSettingsStore.getState().setPaymentModes(paymentModes);
      useAppStore.getState().setBundles(bundles);
      useSalesStore.getState().setSales(sales);
      useExpensesStore.getState().setExpenses(expenses);
      useInventoryStore.getState().setPurchaseRecords(purchaseRecords);
      useInventoryStore.getState().setPurchaseOrders(purchaseOrders);
      useInventoryStore.getState().setSuppliers(suppliers);
      useInventoryStore.getState().setSupplierTransactions(supplierTx);
      if (payments.length > 0) usePaymentsStore.getState().setPayments(payments);

      // Load sales tabs from cloud into cartStore
      if (salesTabs.length > 0) {
        useCartStore.getState().setSalesTabs(salesTabs);
        // Restore active tab: prefer localStorage (current device selection), else first tab
        const savedActiveTab = localStorage.getItem('pos_active_sales_tab');
        const activeTabId = (savedActiveTab && salesTabs.find((t: any) => t.id === savedActiveTab))
          ? savedActiveTab
          : salesTabs[0].id;
        useCartStore.getState().setActiveSalesTab(activeTabId);
      }

      if (!initialized) setInitialized(true);
      if (!silent) sonner.success('Data loaded successfully', { id: 'load-data' });
    } catch (error: any) {
      console.error('Failed to load data:', error);
      if (!silent) sonner.error(error.message || 'Failed to load data', { id: 'load-data' });
      throw error;
    } finally {
      useSettingsStore.getState().setLoading(false);
      sonner.close();
    }
  };

  return { loadData, loadMoreSales, searchSales };
}
