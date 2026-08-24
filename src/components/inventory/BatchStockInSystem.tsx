import { useInventoryStore, useProductsStore, useSettingsStore } from '../../stores';
import { useState, useMemo } from 'react';
import { Save, RefreshCw } from 'lucide-react';
import { Button } from '../../shared/ui';
import { useAuth } from '../../context/AuthContext';
import { SharedSearchBar, SharedProductList } from '../../shared/modules/search-and-list';
import { productsService } from '../../lib/services';
import { sonner } from '../../lib/sonner';
import { Product } from '../../types';
import { formatCurrency } from '../../lib/currencies';
import { commitStockInToInventory } from '../../lib/stockInCommit';
import { Modal } from '../../shared/ui/Modal';

import { StockInMetadata } from './StockIn/StockInMetadata';
import { SelectedItemsGrid } from './StockIn/SelectedItemsGrid';

interface BatchStockInSystemProps {
  onClose: () => void;
  initialProduct?: Product | null;
}

export function BatchStockInSystem({ onClose, initialProduct }: BatchStockInSystemProps) {
  const appProducts = useProductsStore(s => s.products);
  const appSuppliers = useInventoryStore(s => s.suppliers);
  const appSettings = useSettingsStore(s => s.settings);

  const { profile } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItems, setSelectedItems] = useState<any[]>(initialProduct ? [{
    ...initialProduct,
    quantity: 1,
    costPrice: initialProduct.cost || 0,
    retailPrice: initialProduct.price || 0,
    batchSupplier: initialProduct.supplier || ''
  }] : []);
  const [isCommitting, setIsCommitting] = useState(false);
  const [recordAsSupplierBill, setRecordAsSupplierBill] = useState(true);

  const [batchData, setBatchData] = useState({
    date: new Date().toLocaleDateString('en-CA'),
    notes: '',
    paidAmount: 0,
    paymentMethod: 'cash'
  });

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return (appProducts as Product[])
      .filter((p: Product) => p.active && (
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.barcode && p.barcode.toLowerCase().includes(searchQuery.toLowerCase()))
      ))
      .slice(0, 5);
  }, [appProducts, searchQuery]);

  const addToBatch = (product: Product) => {
    if (selectedItems.find(p => p.id === product.id)) {
      sonner.warning('Product already in the list');
      return;
    }
    setSelectedItems(prev => [...prev, {
      ...product,
      quantity: 1,
      costPrice: product.cost || 0,
      retailPrice: product.price || 0,
      batchSupplier: product.supplier || ''
    }]);
    setSearchQuery('');
  };

  const removeItem = (id: string) => {
    setSelectedItems(prev => prev.filter(p => p.id !== id));
  };

  const updateItem = (id: string, field: string, value: any) => {
    setSelectedItems(prev => prev.map((p: any) =>
      p.id === id ? { ...p, [field]: value } : p
    ));
  };

  const totalInvoiceCost = selectedItems.reduce((sum: number, item: any) => sum + (Number(item.quantity) * Number(item.costPrice)), 0);
  const totalItemsCount = selectedItems.reduce((sum: number, item: any) => sum + Number(item.quantity), 0);

  const handleCommit = async () => {
    if (selectedItems.length === 0) {
      sonner.error('Please add at least one product to the invoice.');
      return;
    }

    const result = await sonner.confirm(
      "confirm_stock_in_title",
      "confirm_stock_in_desc".replace('{count}', selectedItems.length.toString()),
      "yes_confirm"
    );

    if (!result.isConfirmed) return;

    setIsCommitting(true);
    sonner.loading('Updating inventory...');

    try {
      const now = new Date();
      const dateOnly = batchData.date;
      const timestamp = new Date(dateOnly);

      if (dateOnly === now.toLocaleDateString('en-CA')) {
        timestamp.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
      } else {
        timestamp.setHours(12, 0, 0);
      }

      for (const item of selectedItems) {
        const qty = Number(item.quantity);
        const cost = Number(item.costPrice);
        const supplier = item.batchSupplier || item.supplier || 'DIRECT ENTRY';

        const currentProduct = appProducts.find(p => p.id === item.id);

        if (currentProduct && (currentProduct.stock >= 990000 || currentProduct.trackInventory === false)) {
          const qtyToRemove = currentProduct.stock;
          if (qtyToRemove > 0) {
            const histId = `adj-${Date.now()}-${item.id}`;
            const localEntry = {
              id: histId,
              productId: currentProduct.id,
              changeQty: -qtyToRemove,
              type: 'adjustment_out' as const,
              referenceId: `RESET-${Date.now()}`,
              note: `System: Reset infinite baseline to start tracking`,
              balanceAfter: 0,
              cashierName: 'System',
              createdAt: new Date(),
            };
            const remoteEntry = {
              id: histId,
              product_id: currentProduct.id,
              change_qty: -qtyToRemove,
              type: 'adjustment_out',
              reference_id: `RESET-${Date.now()}`,
              note: `System: Reset infinite baseline to start tracking`,
              balance_after: 0,
              cashier_name: 'System',
              created_at: new Date().toISOString(),
            };
            
            const { localDb } = await import('../../lib/localDb');
            const { cloudWrite } = await import('../../lib/cloudWrite');
            await cloudWrite('stock_history', 'create', histId, remoteEntry);
            await localDb.stockHistory.add(localEntry);

            // stock:0 is already achieved by the stock_history insert above (DB trigger).
            // Do NOT write products.stock directly (AGENTS.md hard limit / plan PART O).
            await productsService.update(item.id, { trackInventory: true });
          }
        }

        await commitStockInToInventory({
          items: [{
            id: item.id,
            name: item.name,
            sku: item.sku || '',
            quantity: qty,
            costPrice: cost,
            supplier,
            type: 'Stock IN',
            notes: batchData.notes ? `${batchData.notes} | Batch Record` : 'Inventory Re-stock',
            variantId: item.variantId,
            variantLabel: item.variantLabel
          }],
          recordAsSupplierBill,
          suppliers: appSuppliers,
          profile,
          date: timestamp
        });
      }

      sonner.success('Batch stock-in completed successfully.');
      setSelectedItems([]);
      onClose();
    } catch (error) {
      console.error('Batch Stock In failed:', error);
      sonner.error('Failed to update inventory. Please try again.');
    } finally {
      setIsCommitting(false);
    }
  };

  const footer = (
    <div className="flex items-center justify-between w-full">
      <div className="hidden sm:flex items-center gap-6">
        <div className="flex flex-col">
          <span className="text-[9px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-widest">{"Total Sourced Cost"}</span>
          <span className="text-xl font-black text-primary tabular-nums leading-none mt-1">{formatCurrency(totalInvoiceCost, appSettings.currency)}</span>
        </div>
        <div className="w-px h-8 bg-gray-100 dark:bg-white/10" />
        <div className="flex flex-col">
          <span className="text-[9px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-widest">{"Unit Count"}</span>
          <span className="text-xl font-black text-gray-900 dark:text-white tabular-nums leading-none mt-1">{totalItemsCount}</span>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 sm:gap-3 flex-1">
        <Button
          onClick={onClose}
          variant="danger"
          className="flex-1 sm:flex-none !min-h-0 !px-4 sm:!px-6 !py-2.5 sm:!py-3.5 !rounded-2xl !bg-transparent !text-[#ff4b6e] hover:!bg-rose-50 dark:hover:!bg-rose-500/10 !text-[9px] sm:!text-[11px] !font-black !shadow-none hover:!opacity-100 shrink-0 !border !border-rose-200 dark:!border-rose-900/30"
        >
          {"Abort Inflow"}
        </Button>
        <Button
          onClick={handleCommit}
          disabled={selectedItems.length === 0 || isCommitting}
          variant="primary"
          size="md"
          className="flex-1 sm:flex-none sm:min-w-[280px] !py-2.5 sm:!py-3.5 !text-[9px] sm:!text-[11px]"
        >
          {isCommitting ? <RefreshCw className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" /> : <Save className="h-4 w-4 sm:h-5 sm:w-5" />}
          <span>{"Commit Inventory"}</span>
        </Button>
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={"Stock Inflow Protocol"}
      maxWidth="max"
      footer={footer}
    >
      <div className="space-y-8 pb-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <h3 className="text-[11px] font-black text-gray-600 dark:text-gray-500 uppercase tracking-widest flex items-center gap-3">
              <span className="w-8 h-px bg-gray-200 dark:bg-white/10"></span>
              {"Identity Matching Buffer"}
            </h3>
            <div className="relative">
              <SharedSearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder={"Scan Or Type Product Identity"}
              />
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-3 z-50">
                  <SharedProductList
                    items={searchResults}
                    selectedIds={selectedItems.map(m => m.id)}
                    onItemAdd={(id) => {
                      const p = searchResults.find(x => x.id === id);
                      if (p) addToBatch(p);
                    }}
                    maxHeight={300}
                    className="rounded-2xl shadow-2xl"
                  />
                </div>
              )}
            </div>
          </div>

          <StockInMetadata
            batchData={batchData}
            setBatchData={setBatchData}
            recordAsSupplierBill={recordAsSupplierBill}
            setRecordAsSupplierBill={setRecordAsSupplierBill}
          />
        </div>

        <SelectedItemsGrid
          selectedItems={selectedItems}
          updateItem={updateItem}
          removeItem={removeItem}
        />
      </div>
    </Modal>
  );
}
