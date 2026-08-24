import { HelpTooltip } from '../../../shared/ui/HelpTooltip';
import type { ProductFormFieldsProps } from './ProductFormFieldsMain';

export function PricingStockFields(props: ProductFormFieldsProps) {
  const { formData, onFieldChange } = props;

  return (
    <>
      <div className="space-y-4">
        <h3 className="text-[10px] font-black text-gray-600 dark:text-gray-500 uppercase tracking-widest flex items-center gap-3">
          <span className="w-8 h-px bg-gray-200 dark:bg-white/10"></span>
          {"Financials Inventory"}
        </h3>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-wider flex items-center">
              {"Selling Price"}
              <HelpTooltip content="The retail price charged to customers at checkout. Tax calculations will be applied on top of or inclusive of this figure." />
            </label>
            <input
              type="text"
              name="price"
              value={formData.price}
              onChange={onFieldChange}
              className="w-full bg-white dark:bg-black/75 border border-gray-200 dark:border-white/5 text-gray-900 dark:text-white text-base font-black rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-wider flex items-center">
              {"Cost Price"}
              <HelpTooltip content="The wholesale acquisition cost. Used strictly for calculating Cost of Goods Sold (COGS), gross profit, and valuation." />
            </label>
            <input
              type="text"
              name="cost"
              value={formData.cost}
              onChange={onFieldChange}
              className="w-full bg-white dark:bg-black/75 border border-gray-200 dark:border-white/5 text-gray-900 dark:text-white text-base font-black rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div className="space-y-4">
          <label className={`flex items-start gap-3 cursor-pointer group p-3 rounded-xl border transition-all ${formData.productType === 'variable'
              ? 'bg-gray-100/50 dark:bg-white/5 border-gray-200 dark:border-white/5 opacity-60 cursor-not-allowed'
              : 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/5 hover:bg-gray-100 dark:hover:!bg-white/10'
            }`}>
            <input
              type="checkbox"
              name="trackInventory"
              checked={formData.productType === 'variable' ? true : formData.trackInventory}
              onChange={onFieldChange}
              disabled={formData.productType === 'variable'}
              className="w-5 h-5 mt-0.5 rounded border-gray-300 text-primary disabled:opacity-50"
            />
            <div>
              <div className="text-xs font-black text-gray-700 dark:text-gray-200 uppercase tracking-wide flex items-center">
                {"Enable Active Tracking"}
                <HelpTooltip content="Maintains real-time stock balances across sales and returns. Disabling this treats the item as having infinite supply." />
              </div>
              <div className="text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-widest mt-0.5">
                {formData.productType === 'variable' ? 'MANAGED BY VARIATIONS' : "track_stock_alert"}
              </div>
            </div>
          </label>

          {formData.trackInventory && formData.productType === 'simple' && (
            <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-wider flex items-center">
                  {"Initial Stock"}
                  <HelpTooltip content="The starting physical inventory count available on hand when creating this item." />
                </label>
                <input
                  type="text"
                  name="stock"
                  value={formData.stock}
                  onChange={onFieldChange}
                  className="w-full bg-white dark:bg-black/75 border border-gray-200 dark:border-white/5 text-gray-900 dark:text-white text-base font-black rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-wider flex items-center">
                  {"Low Stock Alert"}
                  <HelpTooltip content="Threshold at which item appears on the Low Stock dashboard widget and reorder reports." />
                </label>
                <input
                  type="text"
                  name="minStock"
                  value={formData.minStock}
                  onChange={onFieldChange}
                  className="w-full bg-white dark:bg-black/75 border border-gray-200 dark:border-white/5 text-gray-900 dark:text-white text-base font-black rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
