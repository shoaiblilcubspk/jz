import { useState, useMemo, useRef, useEffect } from 'react';
import { Product } from '../../../types';
import { InventoryToolbar } from '../InventoryToolbar';
import { InventoryTable } from '../InventoryTable';
import { BulkEditModal } from '../BulkEditModal';
import { BarcodeGenerator, clearPersistedBarcodeState } from '../BarcodeGenerator';
import { sonner } from '../../../lib/sonner';
import { useSettingsStore } from '../../../stores';
import { useBarcodeScanner } from '../../../hooks/useBarcodeScanner';
import { normalizeBarcodeValue } from '../../../utils/barcode';
import { formatCurrency } from '../../../lib/currencies';
import { Package, AlertTriangle, TrendingUp, TrendingDown, ChevronLeft } from 'lucide-react';
import { Button } from '../../../shared/ui';
import { useProductsListHandlers } from '../useProductsListHandlers';

interface Props {
  appProducts: Product[];
  categories: string[];
  suppliers: string[];
  isAdmin: boolean;
  canManageStock: boolean;
  canEditProduct: boolean;
  profile: any;
  setEditingProduct: (p: Product | null) => void;
  setShowProductModal: (val: boolean) => void;
  handleEditProduct: (p: Product) => void;
  setShowBarcodeGenerator: (val: boolean) => void;
  showBarcodeGenerator: boolean;
}

export function ProductsList({
  appProducts, categories, suppliers, isAdmin, canManageStock, canEditProduct, profile,
  setEditingProduct, setShowProductModal, handleEditProduct,
  setShowBarcodeGenerator, showBarcodeGenerator
}: Props) {
  const appSettings = useSettingsStore(s => s.settings);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedType, setSelectedType] = useState('All');
  const [selectedSupplier, _setSelectedSupplier] = useState('All');
  const [sortBy, setSortBy] = useState<'name' | 'stock' | 'price'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const [selectedProductIds, setSelectedProductIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('barcode_selected_product_ids');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [barcodeProducts, setBarcodeProducts] = useState<Product[]>([]);
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [_showScannerInInventory, setShowScannerInInventory] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [ITEMS_PER_PAGE, setPageSize] = useState(25);

  useEffect(() => {
    localStorage.setItem('barcode_selected_product_ids', JSON.stringify(selectedProductIds));
  }, [selectedProductIds]);

  useEffect(() => {
    if (showBarcodeGenerator && selectedProductIds.length > 0) {
      const filtered = appProducts.filter(p => selectedProductIds.includes(p.id));
      setBarcodeProducts(prev => {
        const prevIds = prev.map(x => x.id).join(',');
        const nextIds = filtered.map(x => x.id).join(',');
        if (prevIds !== nextIds) {
          return filtered;
        }
        return prev;
      });
    } else if (!showBarcodeGenerator) {
      setBarcodeProducts([]);
    }
  }, [appProducts, showBarcodeGenerator, selectedProductIds]);

  const filteredProducts = useMemo(() => {
    return appProducts
      .filter(product => {
        const matchesSearch = (product.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (product.sku && product.sku.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (product.barcode && product.barcode.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
        const matchesSupplier = selectedSupplier === 'All' || product.supplier === selectedSupplier;
        const matchesType = selectedType === 'All' ||
          (selectedType === 'services' && product.isService) ||
          (selectedType === 'serialized' && product.requireSerial) ||
          (selectedType === 'standard' && !product.isService && !product.requireSerial);
        const matchesVariation = product.productType !== 'variation';
        return matchesSearch && matchesCategory && matchesSupplier && matchesType && matchesVariation;
      })
      .sort((a, b) => {
        let aValue: string | number;
        let bValue: string | number;
        switch (sortBy) {
          case 'name': aValue = (a.name || '').toLowerCase(); bValue = (b.name || '').toLowerCase(); break;
          case 'stock': aValue = a.stock; bValue = b.stock; break;
          case 'price': aValue = a.price; bValue = b.price; break;
          default: aValue = (a.name || '').toLowerCase(); bValue = (b.name || '').toLowerCase();
        }
        if (sortOrder === 'asc') return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        else return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      });
  }, [appProducts, searchTerm, selectedCategory, selectedSupplier, selectedType, sortBy, sortOrder]);

  const totalPages = useMemo(() => Math.ceil(filteredProducts.length / ITEMS_PER_PAGE), [filteredProducts.length, ITEMS_PER_PAGE]);
  const paginatedProducts = useMemo(() => filteredProducts.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE), [filteredProducts, currentPage, ITEMS_PER_PAGE]);

  useBarcodeScanner((barcode: string) => {
    if (!appProducts) return;
    const term = barcode.trim();
    const normalizedTerm = normalizeBarcodeValue(term);
    let found = appProducts.find(p => p.barcode === term || p.sku === term);
    if (!found) {
      found = appProducts.find(p => {
        const pBarcode = normalizeBarcodeValue(p.barcode || '');
        const pSku = normalizeBarcodeValue(p.sku || '');
        return pBarcode === normalizedTerm || pSku === normalizedTerm;
      });
    }
    if (found) {
      setSearchTerm(found.barcode || found.sku || '');
      setCurrentPage(1);
      sonner.success(`Found: ${found.name}`);
    } else {
      sonner.error(`Product not found: ${term}`);
    }
  });

  const {
    handleDeleteProduct,
    handleSelectAll,
    handleSelectProduct,
    handleBulkDelete,
    handleExportSelected,
    handleImportJSON,
    handleFileChange
  } = useProductsListHandlers({
    appProducts,
    selectedProductIds,
    setSelectedProductIds,
    filteredProducts,
    fileInputRef,
    setShowBarcodeGenerator,
    setBarcodeProducts
  });

  const lowStockProducts = appProducts.filter(p => p.trackInventory !== false && p.stock < 990000 && p.stock >= 0 && p.stock <= (p.minStock || 5));
  const totalValue = appProducts.reduce((sum, p) => sum + ((p.trackInventory === false || p.stock >= 990000) ? 0 : (p.stock || 0) * (p.cost || 0)), 0);
  const outOfStockProducts = appProducts.filter(p => p.trackInventory !== false && p.stock < 990000 && p.stock <= 0);

  if (showBarcodeGenerator) {
    return (
      <div className="fixed inset-0 z-[450] bg-white dark:bg-surface animate-in fade-in zoom-in-95 duration-300 flex flex-col">
        <div className="flex-shrink-0 flex items-center gap-4 px-4 py-2.5 border-b border-gray-200 dark:border-white/10 bg-white dark:bg-app">
          <Button variant="ghost" onClick={() => {
            setShowBarcodeGenerator(false);
            setBarcodeProducts([]);
            setSelectedProductIds([]);
            clearPersistedBarcodeState();
            localStorage.removeItem('barcode_selected_product_ids');
            localStorage.removeItem('barcode_selected_quantities');
            localStorage.removeItem('barcode_show_generator');
          }} className="!min-h-0 !p-2 !rounded-xl !bg-transparent !text-gray-600 dark:!text-gray-400 hover:!bg-gray-100 dark:hover:!bg-white/5">
            <ChevronLeft className="h-5 w-5" />
            <span className="text-[10px] font-black uppercase tracking-widest">{"Back"}</span>
          </Button>
          <div className="h-6 w-px bg-gray-200 dark:bg-white/10 mx-1" />
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest opacity-60">Management / Barcode Print Engine</p>
        </div>
        <div className="flex-1 min-h-0">
          <BarcodeGenerator
            products={barcodeProducts}
            onClose={() => {
              setShowBarcodeGenerator(false);
              setBarcodeProducts([]);
              setSelectedProductIds([]);
              clearPersistedBarcodeState();
            }}
            onProductsChange={(next) => setSelectedProductIds(next.map(p => p.id))}
          />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 mt-2">
        {[
          { label: "Active Items", value: appProducts.filter(p => p.active !== false && p.productType !== 'variation').length, icon: Package, color: 'from-blue-600 to-indigo-700' },
          { label: "Low Stock", value: lowStockProducts.length, icon: AlertTriangle, color: 'from-amber-500 to-orange-700' },
          { label: "Stock Value", value: formatCurrency(totalValue, appSettings.currency), icon: TrendingUp, color: 'from-emerald-500 to-teal-700' },
          { label: "Out of Stock", value: outOfStockProducts.length, icon: TrendingDown, color: 'from-rose-500 to-red-700' },
        ].map((stat, i) => (
          <div key={i} className={`stat-card bg-gradient-to-br ${stat.color} shadow-lg shadow-black/5`}>
            <div className="stat-card-inner">
              <span className="stat-card-label">{stat.label}</span>
              <span className="stat-card-value">{stat.value}</span>
            </div>
            <stat.icon className="stat-card-icon h-12 w-12 text-white" />
          </div>
        ))}
      </div>

      <InventoryToolbar
        searchTerm={searchTerm}
        onSearchChange={(val) => { setSearchTerm(val); setCurrentPage(1); }}
        handleImportJSON={handleImportJSON}
        handleExportSelected={handleExportSelected}
        categories={categories}
        selectedCategory={selectedCategory}
        onCategoryChange={(val) => { setSelectedCategory(val); setCurrentPage(1); }}
        selectedType={selectedType}
        onTypeChange={(val) => { setSelectedType(val); setCurrentPage(1); }}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={(by, order) => { setSortBy(by); setSortOrder(order); }}
        canManageStock={canEditProduct}
        selectedCount={selectedProductIds.length}
        handleBulkDelete={handleBulkDelete}
        onBulkEdit={() => setShowBulkEditModal(true)}
        onPrintBarcodes={() => { setBarcodeProducts(appProducts.filter(p => selectedProductIds.includes(p.id))); setShowBarcodeGenerator(true); }}
        onAddProduct={() => { setEditingProduct(null); setShowProductModal(true); }}
        onScanClick={() => setShowScannerInInventory(true)}
      />

      <InventoryTable
        paginatedProducts={paginatedProducts}
        selectedProductIds={selectedProductIds}
        filteredProducts={filteredProducts}
        handleSelectAll={handleSelectAll}
        handleSelectProduct={handleSelectProduct}
        handleEditProduct={handleEditProduct}
        handleDeleteProduct={handleDeleteProduct}
        currentPage={currentPage}
        totalPages={totalPages}
        ITEMS_PER_PAGE={ITEMS_PER_PAGE}
        onPageChange={(p) => { setCurrentPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
        onPageSizeChange={setPageSize}
        isAdmin={isAdmin}
        profile={profile}
        canManageStock={canManageStock}
        canEditProduct={canEditProduct}
      />

      <BulkEditModal selectedIds={selectedProductIds} isOpen={showBulkEditModal} onClose={() => setShowBulkEditModal(false)} categories={categories} suppliers={suppliers} />
      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json" style={{ display: 'none' }} />
    </>
  );
}
