import { Camera, Wand2, Plus } from 'lucide-react';
import { SegmentedControl, Button, Select } from '../../../shared/ui';
import { HelpTooltip } from '../../../shared/ui/HelpTooltip';
import { BarcodePreview } from '../../../shared/ui/BarcodePreview';
import type { ProductFormFieldsProps } from './ProductFormFieldsMain';

export function BasicInfoFields(props: ProductFormFieldsProps) {
  const {
    formData,
    setFormData,
    categories,
    suppliers,
    onFieldChange,
    onGenerateSku,
    onGenerateBarcode,
    onAddCategory,
    onAddSupplier,
    onOpenScanner,
  } = props;

  return (
    <div className="space-y-4">
      <h3 className="text-[10px] font-black text-gray-600 dark:text-gray-500 uppercase tracking-widest flex items-center gap-3">
        <span className="w-8 h-px bg-gray-200 dark:bg-white/10"></span>
        {"Identity Origin"}
      </h3>

      <SegmentedControl
        options={[
          { value: 'simple', label: 'Simple Product' },
          { value: 'variable', label: 'Variable Product' },
        ]}
        value={formData.productType}
        onChange={(v) => setFormData(prev => ({ ...prev, productType: v }))}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2 md:col-span-2">
          <label className="text-[10px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-wider flex items-center">
            {"Product Name Req"}
            <HelpTooltip content="The commercial title of the product or service displayed on receipts, invoices, and POS terminal." />
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={onFieldChange}
            placeholder="E.g. Vintage Leather Jacket"
            className="w-full bg-[#f8f9fa] dark:bg-black/75 border-none text-gray-900 dark:text-white text-sm rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 transition-all font-medium placeholder:text-gray-600"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-wider flex items-center">
            {"Category Req"}
            <HelpTooltip content="Organizes items into departments for structured reporting and quick filtering at the POS checkout." />
          </label>
          <div className="flex gap-2">
            <div className="flex-1">
              <Select
                name="category"
                value={formData.category}
                onChange={onFieldChange}
                className="!bg-[#f8f9fa] dark:!bg-black/75 !border-none !text-sm !rounded-xl !px-4 !text-gray-900 dark:!text-white !font-medium"
              >
                <option value="" disabled>{"Select Category"}</option>
                {categories.map(c => <option key={c} value={c} className="dark:bg-surface">{c}</option>)}
              </Select>
            </div>
            <Button type="button" variant="ghost" onClick={onAddCategory} className="!min-h-0 !w-10 !h-10 !p-0 !rounded-xl !bg-[#f8f9fa] dark:!bg-black/75 hover:!bg-gray-200 dark:hover:!bg-white/10 !text-gray-600 dark:!text-gray-400 shrink-0" icon={<Plus className="w-4 h-4" />} />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-wider flex items-center">
            {"supplier"}
            <HelpTooltip content="Links this product to a vendor for automated reordering, purchase history, and supplier ledger calculations." />
          </label>
          <div className="flex gap-2">
            <div className="flex-1">
              <Select
                name="supplier"
                value={formData.supplier}
                onChange={onFieldChange}
                className="!bg-[#f8f9fa] dark:!bg-black/75 !border-none !text-sm !rounded-xl !px-4 !text-gray-900 dark:!text-white !font-medium"
              >
                <option value="">{"Select Supplier Optional"}</option>
                {suppliers.map(s => <option key={s} value={s} className="dark:bg-surface">{s}</option>)}
              </Select>
            </div>
            <Button type="button" variant="ghost" onClick={onAddSupplier} className="!min-h-0 !w-10 !h-10 !p-0 !rounded-xl !bg-[#f8f9fa] dark:!bg-black/75 hover:!bg-gray-200 dark:hover:!bg-white/10 !text-gray-600 dark:!text-gray-400 shrink-0" icon={<Plus className="w-4 h-4" />} />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-wider flex items-center">
            {"sku"}
            <HelpTooltip content="Stock Keeping Unit: Unique internal code used to track inventory items across warehouses or stores." />
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              name="sku"
              value={formData.sku}
              onChange={onFieldChange}
              placeholder="Auto-generated"
              className="flex-1 min-w-0 bg-[#f8f9fa] dark:bg-black/75 border-none text-gray-900 dark:text-white text-sm rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 transition-all uppercase font-medium placeholder:text-gray-600"
            />
            <Button type="button" variant="ghost" onClick={onGenerateSku} className="!min-h-0 !w-11 !h-11 !p-0 !rounded-xl !bg-emerald-50 dark:!bg-emerald-500/10 hover:!bg-emerald-100 dark:hover:!bg-emerald-500/20 !text-emerald-600 dark:!text-emerald-400 shrink-0" icon={<Wand2 className="w-4 h-4" />} />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-wider flex items-center">
            {"barcode"}
            <HelpTooltip content="UPC/EAN standard barcode. Scan with hardware scanner or generate a random sequence for custom retail packaging." />
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              name="barcode"
              value={formData.barcode}
              onChange={onFieldChange}
              placeholder={"Scan Or Generate"}
              className="flex-1 min-w-0 bg-[#f8f9fa] dark:bg-black/75 border-none text-gray-900 dark:text-white text-sm rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 transition-all uppercase font-medium placeholder:text-gray-600"
            />
            <Button type="button" variant="ghost" onClick={onGenerateBarcode} className="!min-h-0 !w-11 !h-11 !p-0 !rounded-xl !bg-emerald-50 dark:!bg-emerald-500/10 hover:!bg-emerald-100 dark:hover:!bg-emerald-500/20 !text-emerald-600 dark:!text-emerald-400 shrink-0" icon={<Wand2 className="w-4 h-4" />} />
            <Button type="button" variant="ghost" onClick={onOpenScanner} className="!min-h-0 !w-11 !h-11 !p-0 !rounded-xl !bg-blue-50 dark:!bg-blue-500/10 hover:!bg-blue-100 dark:hover:!bg-blue-500/20 !text-blue-600 dark:!text-blue-400 shrink-0" icon={<Camera className="w-4 h-4" />} />
          </div>
          {formData.barcode && (
            <BarcodePreview value={formData.barcode} />
          )}
        </div>
      </div>
    </div>
  );
}
