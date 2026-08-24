import { useMemo } from 'react';
import { getItemCOGS, getItemRevenue, netItemQty } from '../reports/useReportsData';
import type { InventoryReportRow, SortField, SortDir } from './inventoryReportManager.types';

interface UseInventoryReportDataArgs {
  appProducts: any[];
  appSales: any[];
  appStockHistory: any[];
  appSettings: any;
  startDate: Date;
  endDate: Date;
  globalSupplier: string;
  globalCategory: string;
  globalStore: string;
  sales: any[] | undefined;
  search: string;
  statusFilter: 'all' | 'in' | 'low' | 'out';
  categoryFilter: string;
  supplierFilter: string;
  sortField: SortField;
  sortDir: SortDir;
}

export function useInventoryReportData({
  appProducts,
  appSales,
  appStockHistory,
  appSettings,
  startDate,
  endDate,
  globalSupplier,
  globalCategory,
  globalStore,
  sales,
  search,
  statusFilter,
  categoryFilter,
  supplierFilter,
  sortField,
  sortDir
}: UseInventoryReportDataArgs) {
  const inventoryData = useMemo(() => {
    let productsToProcess = appProducts.filter(p => p.active !== false);

    const effectiveCategory = categoryFilter || globalCategory || 'All';
    const effectiveSupplier = supplierFilter || globalSupplier || 'All';

    if (effectiveCategory.toLowerCase() !== 'all') {
      productsToProcess = productsToProcess.filter(p => p.category === effectiveCategory);
    }

    if (effectiveSupplier.toLowerCase() !== 'all') {
      productsToProcess = productsToProcess.filter(p =>
        (p.supplier || '').toLowerCase().trim() === effectiveSupplier.toLowerCase().trim()
      );
    }

    if (search) {
      const q = search.toLowerCase();
      productsToProcess = productsToProcess.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.supplier && p.supplier.toLowerCase().includes(q))
      );
    }

    const reportEnd = new Date(endDate);
    if (reportEnd.getHours() === 0 && reportEnd.getMinutes() === 0) reportEnd.setHours(23, 59, 59, 999);
    const reportStartMs = startDate.getTime();
    const reportEndMs = reportEnd.getTime();

    const saleById = new Map<string, any>();
    for (const s of (appSales || [])) saleById.set(s.id, s);
    const productCostById = new Map<string, number>();
    for (const p of appProducts) productCostById.set(p.id, p.cost || 0);

    const kpiByProduct = new Map<string, { sold: number; revenue: number; cogs: number }>();
    for (const h of (appStockHistory || [])) {
      const hTs = new Date(h.createdAt).getTime();
      if (hTs < reportStartMs || hTs > reportEndMs) continue;
      if (!h.productId) continue;
      const qty = Math.abs(Number(h.changeQty) || 0);
      if (!qty) continue;
      if (h.type !== 'sale' && h.type !== 'return') continue;
      const sale = saleById.get(h.referenceId || '');
      let item: any = sale?.items?.find((i: any) => (i.product?.id || i.productId) === h.productId);
      if (!item && sale) {
        for (const it of sale.items || []) {
          const a = (it.addonItems || []).find((ad: any) => ad.addon?.addonProductId === h.productId);
          if (a) { item = a; break; }
        }
      }
      const itemQty = item ? Math.abs(Number(item.weight ? item.weight : item.quantity) || 0) : 0;
      const scale = itemQty > 0 ? qty / itemQty : 1;
      // PHASE 4A-i: revenue magnitude is always positive; the +/- sign is applied
      // by the sale/return branch below so a minus sale shows NEGATIVE revenue
      // (not clamped to a wrong positive value).
      const revenue = item ? Math.abs(Number(item.subtotal) || 0) * scale : 0;
      const cogs = (productCostById.get(h.productId) || 0) * qty;
      const cur = kpiByProduct.get(h.productId) || { sold: 0, revenue: 0, cogs: 0 };

      // Retroactive fix for old data where deleted POS returns were saved as 'return' type instead of 'sale'.
      let effectiveType = h.type;
      const hNote = (h.note || '').toLowerCase();
      if (hNote.includes('deleted')) {
          const rawChange = Number(h.changeQty) || 0;
          effectiveType = rawChange < 0 ? 'sale' : 'return';
      }

      if (effectiveType === 'sale') { cur.sold += qty; cur.revenue += revenue; cur.cogs += cogs; }
      else if (effectiveType === 'return') { cur.sold -= qty; cur.revenue -= revenue; cur.cogs -= cogs; }
      kpiByProduct.set(h.productId, cur);
    }

    const stats = productsToProcess.map(product => {
      const isInfinite = product.trackInventory === false || product.stock >= 990000;

      const stockValue = isInfinite ? 0 : (product.stock * (product.cost || 0));

      const sellingPrice = product.isWeightBased ? (product.pricePerUnit || 0) : product.price;
      const potentialRevenue = isInfinite ? 0 : (product.stock * sellingPrice);
      const profitMargin = (product.cost && product.cost > 0 && sellingPrice > 0)
        ? ((sellingPrice - product.cost) / sellingPrice * 100)
        : 0;
      const stockStatus: 'Out of Stock' | 'Low Stock' | 'In Stock' | 'Infinity Mode' =
        isInfinite ? 'Infinity Mode' : (product.stock <= 0 ? 'Out of Stock' :
          product.stock <= (product.minStock || 5) ? 'Low Stock' : 'In Stock');

      const salesSource = sales || [];
      const filteredSales = salesSource.filter(s => {
        const sStatus = (s.status || 'completed').toLowerCase();
        const isOfficial = !['draft', 'pending', 'refunded', 'cancelled'].includes(sStatus);

        const saleDate = new Date(s.timestamp);
        const effectiveEndDate = new Date(endDate);
        if (effectiveEndDate.getHours() === 0 && effectiveEndDate.getMinutes() === 0) {
          effectiveEndDate.setHours(23, 59, 59, 999);
        }

        const inDateRange = saleDate >= startDate && saleDate <= effectiveEndDate;

        const effectiveStore = (globalStore || 'all').toLowerCase();
        const saleTypeVal = (s.saleType || 'retail').toLowerCase();
        const storeMatch = effectiveStore === 'all' || saleTypeVal === effectiveStore;

        return isOfficial && inDateRange && storeMatch;
      });

      const kpi = kpiByProduct.get(product.id) || { sold: 0, revenue: 0, cogs: 0 };
      const soldQty = kpi.sold;
      const revenue = kpi.revenue;
      const cogs = kpi.cogs;

      const grossProfit = revenue - cogs;

      const recentSales = filteredSales.flatMap(sale => {
        const productItems = (sale.items || []).filter(item => {
          const itemProdId = item.product?.id || (item as any).productId;
          return itemProdId === product.id;
        });

        return productItems.map(item => ({
          saleId: sale.id,
          invoiceNumber: sale.invoiceNumber,
          timestamp: sale.timestamp,
          quantity: netItemQty(item),
          revenue: getItemRevenue(item, sale),
          cogs: getItemCOGS(item).cost,
          customerName: sale.customerName,
          selectedVariant: item.selectedVariant,
          selectedModifiers: item.selectedModifiers,
          serialNumber: item.serialNumber
        }));
      }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return {
        id: product.id,
        name: product.name,
        sku: product.sku || '—',
        category: product.category,
        supplier: product.supplier || '—',
        stock: product.stock,
        minStock: product.minStock,
        costPrice: product.cost || 0,
        sellingPrice,
        stockValue,
        potentialRevenue,
        profitMargin,
        stockStatus,
        soldQty,
        revenue,
        cogs,
        grossProfit,
        isInfinite,
        recentSales
      } as InventoryReportRow;
    });

    let filtered = stats;
    if (statusFilter === 'in') filtered = filtered.filter(p => p.stockStatus === 'In Stock');
    if (statusFilter === 'low') filtered = filtered.filter(p => p.stockStatus === 'Low Stock');
    if (statusFilter === 'out') filtered = filtered.filter(p => p.stockStatus === 'Out of Stock');

    const statusOrder = { 'Out of Stock': 0, 'Low Stock': 1, 'In Stock': 2, 'Infinity Mode': 3 };
    filtered.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name': cmp = a.name.localeCompare(b.name); break;
        case 'stock': cmp = a.stock - b.stock; break;
        case 'stockValue': cmp = a.stockValue - b.stockValue; break;
        case 'profitMargin': cmp = a.profitMargin - b.profitMargin; break;
        case 'status': cmp = statusOrder[a.stockStatus] - statusOrder[b.stockStatus]; break;
        case 'soldQty': cmp = a.soldQty - b.soldQty; break;
        case 'revenue': cmp = a.revenue - b.revenue; break;
        case 'cogs': cmp = a.cogs - b.cogs; break;
        case 'grossProfit': cmp = a.grossProfit - b.grossProfit; break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return filtered;
  }, [appProducts, appSales, appStockHistory, sales, search, statusFilter, categoryFilter, supplierFilter, globalCategory, globalSupplier, globalStore, startDate, endDate, sortField, sortDir]);

  const totalStockValue = inventoryData.reduce((s, p) => s + p.stockValue, 0);
  const totalPotentialRevenue = inventoryData.reduce((s, p) => s + p.potentialRevenue, 0);
  const totalActualRevenue = inventoryData.reduce((s, p) => s + p.revenue, 0);
  const totalCOGS = inventoryData.reduce((s, p) => s + p.cogs, 0);
  const totalGrossProfit = inventoryData.reduce((s, p) => s + p.grossProfit, 0);

  const exportColumns = [
    { key: 'name', label: "Product" },
    { key: 'sku', label: "SKU" },
    { key: 'category', label: "Category" },
    { key: 'supplier', label: "Supplier" },
    { key: 'stock', label: "Stock", format: 'number' as const },
    { key: 'stockStatus', label: "Status" },
    { key: 'stockValue', label: `Stock Value (${appSettings.currency})`, format: 'currency' as const },
    { key: 'soldQty', label: "Sold Qty", format: 'number' as const },
    { key: 'revenue', label: `Revenue (${appSettings.currency})`, format: 'currency' as const },
    { key: 'grossProfit', label: `Gross Profit (${appSettings.currency})`, format: 'currency' as const },
  ];

  const exportRows = useMemo(() => inventoryData.map(p => ({
    name: p.name,
    sku: p.sku || '',
    category: p.category || '',
    supplier: p.supplier || '',
    stock: p.stock,
    stockStatus: p.stockStatus,
    stockValue: p.stockValue,
    soldQty: p.soldQty,
    revenue: p.revenue,
    grossProfit: p.grossProfit,
  })), [inventoryData]);

  return {
    inventoryData,
    totalStockValue,
    totalPotentialRevenue,
    totalActualRevenue,
    totalCOGS,
    totalGrossProfit,
    exportColumns,
    exportRows,
  };
}
