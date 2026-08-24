import { localDb, isPendingDelete, SETTINGS_ID } from '../../lib/localDb';
import {
  useCustomersStore,
  useExpensesStore,
  useProductsStore,
  useSalesStore,
  useSettingsStore,
} from '../../stores';
import {
  mapProduct,
  mapCustomer,
  mapSale,
  mapSettings,
  mapExpense,
  mapPaymentMode,
} from '../../lib/services';
import { RealtimeCtx } from './types';

export function attachCoreHandlers(channel: any, ctx: RealtimeCtx) {
  const { appSales, timers } = ctx;

  channel
    .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, async (payload) => {
      if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
        if (await isPendingDelete('products', payload.new.id)) return;
        const mapped = mapProduct(payload.new);
        await localDb.products.put(mapped);
        {
          const store = useProductsStore.getState();
          if (payload.eventType === 'INSERT') store.addProduct(mapped); else store.updateProduct(mapped);
        }
      } else if (payload.eventType === 'DELETE') {
        await localDb.products.delete(payload.old.id);
        useProductsStore.getState().deleteProduct(payload.old.id);
      }
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_modes' }, async (payload) => {
      if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
        const mapped = mapPaymentMode(payload.new);
        await localDb.paymentModes.put(mapped);
      } else if (payload.eventType === 'DELETE') {
        await localDb.paymentModes.delete((payload.new && payload.new.id) || payload.old?.id);
      }
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, async (payload) => {
      if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
        if (await isPendingDelete('customers', payload.new.id)) return;
        const mapped = mapCustomer(payload.new);
        await localDb.customers.put(mapped);
        {
          const store = useCustomersStore.getState();
          if (payload.eventType === 'INSERT') store.addCustomer(mapped); else store.updateCustomer(mapped);
        }
      } else if (payload.eventType === 'DELETE') {
        await localDb.customers.delete(payload.old.id);
        useCustomersStore.getState().deleteCustomer(payload.old.id);
      }
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, async (payload) => {
      if (payload.eventType === 'INSERT') {
        if (await isPendingDelete('sales', payload.new.id)) return;
        const mapped = mapSale(payload.new);
        await localDb.sales.put(mapped);
        const exists = appSales.some(s => s.id === mapped.id);
        if (!exists) useSalesStore.getState().addSale(mapped);
      } else if (payload.eventType === 'UPDATE') {
        if (await isPendingDelete('sales', payload.new.id)) return;
        const mapped = mapSale(payload.new);
        await localDb.sales.put(mapped);
        useSalesStore.getState().updateSale(mapped);
      } else if (payload.eventType === 'DELETE') {
        await localDb.sales.delete(payload.old.id);
        useSalesStore.getState().deleteSale(payload.old.id);
      }
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, async (payload) => {
      if (payload.eventType === 'UPDATE') {
        if (payload.new.id !== SETTINGS_ID) return; 
        if (timers.settingsDebounce) clearTimeout(timers.settingsDebounce);
        timers.settingsDebounce = setTimeout(async () => {
          const mapped = mapSettings(payload.new);
          const localSettings = await localDb.appSettings.get(SETTINGS_ID);
          let isRealChange = true;
          if (localSettings) {
            const { updatedAt: _, ...localContent } = localSettings as any;
            const { updatedAt: _r, ...remoteContent } = mapped as any;
            isRealChange = JSON.stringify(localContent) !== JSON.stringify(remoteContent);
          }
          await localDb.appSettings.put(mapped);
          if (isRealChange) {
            try {
              const localStr = localStorage.getItem('pos_local_prefs');
              if (localStr) {
                const local = JSON.parse(localStr);
                if (local.posGridColumns !== undefined) mapped.posGridColumns = local.posGridColumns;
                if (local.theme !== undefined) mapped.theme = local.theme;
                if (local.receiptPrinter !== undefined) mapped.receiptPrinter = local.receiptPrinter;
                if (local.enableKotPrinter !== undefined) mapped.enableKotPrinter = local.enableKotPrinter;
                if (local.autoSaveReceiptPng !== undefined) mapped.autoSaveReceiptPng = local.autoSaveReceiptPng;
              }
            } catch (e) {}
            useSettingsStore.getState().setSettings(mapped);
          }
        }, 2000);
      }
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, async (payload) => {
      if (payload.eventType === 'INSERT') {
        if (await isPendingDelete('expenses', payload.new.id)) return;
        const mapped = mapExpense(payload.new);
        await localDb.expenses.put(mapped);
        useExpensesStore.getState().addExpense(mapped);
      } else if (payload.eventType === 'UPDATE') {
        if (await isPendingDelete('expenses', payload.new.id)) return;
        const mapped = mapExpense(payload.new);
        await localDb.expenses.put(mapped);
        useExpensesStore.getState().updateExpense(mapped);
      } else if (payload.eventType === 'DELETE') {
        await localDb.expenses.delete(payload.old.id);
        useExpensesStore.getState().deleteExpense(payload.old.id);
      }
    });
}
