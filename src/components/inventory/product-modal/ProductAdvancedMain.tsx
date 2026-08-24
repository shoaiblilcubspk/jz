import { HelpTooltip } from '../../../shared/ui/HelpTooltip';
import type { ProductFormData } from './useProductForm';
import type { Product, ProductVariant, VariantData, ProductAddon } from '../../../types';
import { VariantsBuilder } from './VariantsBuilder';
import { AddonsBuilder } from './AddonsBuilder';

interface ProductAdvancedProps {
  formData: ProductFormData;
  setFormData: React.Dispatch<React.SetStateAction<ProductFormData>>;
  variants: ProductVariant[];
  setVariants: React.Dispatch<React.SetStateAction<ProductVariant[]>>;
  variantData: VariantData[];
  setVariantData: React.Dispatch<React.SetStateAction<VariantData[]>>;
  productAddons: ProductAddon[];
  setProductAddons: React.Dispatch<React.SetStateAction<ProductAddon[]>>;
  appProducts: Product[];
  product: Product | null;
}

export function ProductAdvanced({
  formData,
  setFormData,
  variants,
  setVariants,
  variantData,
  setVariantData,
  productAddons,
  setProductAddons,
  appProducts,
  product,
}: ProductAdvancedProps) {
  return (
    <div className="space-y-6 pt-4 border-t border-gray-200 dark:border-white/5">
      <h3 className="text-[10px] font-black text-gray-600 dark:text-gray-500 uppercase tracking-widest flex items-center gap-3">
        <span className="w-8 h-px bg-gray-200 dark:bg-white/10"></span>
        {"Universal Pos Enhancements"}
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="flex items-start gap-3 cursor-pointer group p-4 bg-purple-50 dark:bg-purple-900/10 rounded-xl border border-purple-100 dark:border-purple-500/20 transition-all hover:bg-purple-100 dark:hover:bg-purple-900/20">
          <input
            type="checkbox"
            name="isService"
            checked={formData.isService}
            onChange={(e) => setFormData(prev => ({ ...prev, isService: e.target.checked }))}
            className="w-5 h-5 mt-0.5 rounded border-gray-300 text-purple-600"
          />
          <div>
            <div className="text-xs font-black text-purple-900 dark:text-purple-200 uppercase tracking-wide flex items-center">
              {"Service Item"}
              <HelpTooltip content="Flags this item as a non-physical service (e.g. repair fee, labor, consultation). Physical stock tracking will be automatically disabled, and sales will not trigger negative stock warnings." />
            </div>
            <div className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-widest mt-0.5">Labor, Delivery, Consultation (No Stock)</div>
          </div>
        </label>

        <label className="flex items-start gap-3 cursor-pointer group p-4 bg-orange-50 dark:bg-orange-900/10 rounded-xl border border-orange-100 dark:border-orange-500/20 transition-all hover:bg-orange-100 dark:hover:bg-orange-900/20">
          <input
            type="checkbox"
            name="requireSerial"
            checked={formData.requireSerial}
            onChange={(e) => setFormData(prev => ({ ...prev, requireSerial: e.target.checked }))}
            className="w-5 h-5 mt-0.5 rounded border-gray-300 text-orange-600"
          />
          <div>
            <div className="text-xs font-black text-orange-900 dark:text-orange-200 uppercase tracking-wide flex items-center">
              {"Require Serial Imei"}
              <HelpTooltip content="When enabled, cashier will be prompted to enter or scan the device's unique Serial Number / IMEI before adding this item to the POS cart." />
            </div>
            <div className="text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-widest mt-0.5">Force scanner prompt at POS checkout</div>
          </div>
        </label>
      </div>

      {formData.productType === 'variable' && (
        <VariantsBuilder
          formData={formData}
          setFormData={setFormData}
          variants={variants}
          setVariants={setVariants}
          variantData={variantData}
          setVariantData={setVariantData}
        />
      )}

      <AddonsBuilder
        productAddons={productAddons}
        setProductAddons={setProductAddons}
        appProducts={appProducts}
        product={product}
      />
    </div>
  );
}
