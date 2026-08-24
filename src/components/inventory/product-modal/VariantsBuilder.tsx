import { X, Wand2 } from 'lucide-react';
import { Button } from '../../../shared/ui';
import type { ProductFormData } from './useProductForm';
import type { ProductVariant, VariantData } from '../../../types';

interface VariantsBuilderProps {
  formData: ProductFormData;
  setFormData: React.Dispatch<React.SetStateAction<ProductFormData>>;
  variants: ProductVariant[];
  setVariants: React.Dispatch<React.SetStateAction<ProductVariant[]>>;
  variantData: VariantData[];
  setVariantData: React.Dispatch<React.SetStateAction<VariantData[]>>;
}

export function VariantsBuilder({ formData, _setFormData, variants, setVariants, variantData, setVariantData }: VariantsBuilderProps) {
  return (
    <div className="space-y-3 p-4 bg-gray-50 dark:bg-surface rounded-2xl border border-gray-200 dark:border-white/5 animate-in fade-in zoom-in-95">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-black text-gray-900 dark:text-white uppercase">{"Product Variants"}</h4>
          <p className="text-[9px] text-gray-600 uppercase font-bold tracking-widest">Size, Color, Material (e.g. Garments, Shoes)</p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setVariants([...variants, { name: '', options: [], optionsRaw: '' }])}
          className="!min-h-0 !px-3 !py-1.5 !rounded-lg !text-[10px] !font-black !bg-white dark:!bg-black !border-gray-200 dark:!border-white/10 !text-primary hover:!border-primary"
        >
          {"Add Variant Option"}
        </Button>
      </div>

      {variants.map((variant, index) => {
        const addTag = (text: string) => {
          const trimmed = text.trim();
          if (!trimmed) return;
          const parts = trimmed.split(/[,;]+/).map(p => p.trim()).filter(p => p && !variant.options.includes(p));
          if (parts.length > 0) {
            const newVariants = [...variants];
            newVariants[index].options = [...variant.options, ...parts];
            newVariants[index].optionsRaw = '';
            setVariants(newVariants);
          } else {
            const newVariants = [...variants];
            newVariants[index].optionsRaw = '';
            setVariants(newVariants);
          }
        };

        const removeTag = (optIndex: number) => {
          const newVariants = [...variants];
          newVariants[index].options = variant.options.filter((_, i) => i !== optIndex);
          setVariants(newVariants);
        };

        return (
          <div key={index} className="flex gap-2 items-start p-3 bg-white dark:bg-black/40 rounded-xl border border-gray-200 dark:border-white/5">
            <input
              type="text"
              placeholder="Variant Name (e.g. Size)"
              value={variant.name}
              onChange={(e) => {
                const newVariants = [...variants];
                newVariants[index].name = e.target.value;
                setVariants(newVariants);
              }}
              className="w-1/3 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 text-xs rounded-lg px-3 py-2 focus:ring-1 focus:ring-emerald-500"
            />

            <div
              className="flex-1 flex flex-wrap items-center gap-1.5 min-h-[38px] bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 focus-within:ring-1 focus-within:ring-emerald-500 focus-within:border-primary transition-all cursor-text"
              onClick={(e) => {
                const inputEl = e.currentTarget.querySelector('input[type="text"]');
                if (inputEl) (inputEl as HTMLInputElement).focus();
              }}
            >
              {variant.options.map((opt, optIndex) => (
                <span
                  key={optIndex}
                  className="bg-emerald-50 dark:bg-primary/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-primary/20 px-2 py-0.5 rounded-md text-[11px] font-bold flex items-center gap-1 animate-fadeIn select-none"
                >
                  {opt}
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeTag(optIndex);
                    }}
                    className="!min-h-0 !p-0 !bg-transparent !text-primary hover:!text-emerald-700 dark:hover:!text-emerald-300 !font-bold"
                  >
                    &times;
                  </Button>
                </span>
              ))}
              <input
                type="text"
                placeholder={variant.options.length === 0 ? "Options (Comma/Enter)" : ""}
                value={variant.optionsRaw || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val.includes(',') || val.includes(';')) {
                    addTag(val);
                  } else {
                    const newVariants = [...variants];
                    newVariants[index].optionsRaw = val;
                    setVariants(newVariants);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    addTag(e.currentTarget.value);
                  } else if (e.key === 'Backspace' && !variant.optionsRaw && variant.options.length > 0) {
                    removeTag(variant.options.length - 1);
                  }
                }}
                onBlur={(e) => {
                  addTag(e.target.value);
                }}
                className="flex-1 min-w-[60px] bg-transparent border-0 outline-none p-0 text-xs text-gray-900 dark:text-white focus:ring-0 placeholder-gray-400 dark:placeholder-gray-500 font-medium"
              />
            </div>

            <Button type="button" variant="ghost" onClick={() => setVariants(variants.filter((_, i) => i !== index))} className="!min-h-0 !p-2 !rounded-lg !bg-transparent !text-rose-500 hover:!bg-rose-50 dark:hover:!bg-rose-500/10" icon={<X className="w-4 h-4" />} />
          </div>
        );
      })}

      {variants.length > 0 && variants.some(v => v.options.length > 0) && (
        <div className="pt-2 flex justify-end">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              if (variants.length === 0) return;
              const newVariantData: VariantData[] = [];
              const v1 = variants[0];
              const v2 = variants.length > 1 ? variants[1] : null;

              v1.options.forEach(opt1 => {
                if (v2 && v2.options.length > 0) {
                  v2.options.forEach(opt2 => {
                    const option1Label = `${v1.name}: ${opt1}`;
                    const option2Label = `${v2.name}: ${opt2}`;
                    const existing = variantData.find(vd => vd.option1 === option1Label && vd.option2 === option2Label);
                    newVariantData.push(existing || {
                      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                      option1: option1Label,
                      option2: option2Label
                    });
                  });
                } else {
                  const option1Label = `${v1.name}: ${opt1}`;
                  const existing = variantData.find(vd => vd.option1 === option1Label && !vd.option2);
                  newVariantData.push(existing || {
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                    option1: option1Label
                  });
                }
              });
              setVariantData(newVariantData);
            }}
            className="!min-h-0 !px-4 !py-2 !rounded-lg !text-[10px] !font-black !bg-emerald-50 dark:!bg-primary/10 !text-emerald-600 dark:!text-primary !border-emerald-200 dark:!border-primary/20 hover:!border-primary !shadow-sm"
            icon={<Wand2 className="w-3.5 h-3.5" />}
          >
            {"Generate Price/Stock Matrix"}
          </Button>
        </div>
      )}

      {variantData.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200 dark:border-white/10">
          <table className="w-full text-left text-[10px] uppercase font-bold text-gray-600 dark:text-gray-400">
            <thead className="bg-gray-100 dark:bg-black/60 border-b border-gray-200 dark:border-white/10">
              <tr>
                <th className="px-3 py-2">Variant</th>
                <th className="px-3 py-2 w-24">Cost</th>
                <th className="px-3 py-2 w-24">Exact Price</th>
                <th className="px-3 py-2 w-20">Stock</th>
                <th className="px-3 py-2 w-28">Barcode</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-black/20 divide-y divide-gray-100 dark:divide-white/5">
              {variantData.map((vd, idx) => (
                <tr key={vd.id}>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-900 dark:text-white">
                    {vd.option1} {vd.option2 ? ` / ${vd.option2}` : ''}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={vd.cost || ''}
                      onChange={(e) => {
                        const newData = [...variantData];
                        newData[idx].cost = e.target.value ? parseFloat(e.target.value) : undefined;
                        setVariantData(newData);
                      }}
                      placeholder={formData.cost}
                      className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 text-xs rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-emerald-500"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={vd.priceOverride || ''}
                      onChange={(e) => {
                        const newData = [...variantData];
                        newData[idx].priceOverride = e.target.value ? parseFloat(e.target.value) : undefined;
                        setVariantData(newData);
                      }}
                      placeholder={formData.price}
                      className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 text-xs rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-emerald-500"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={vd.stock || ''}
                      onChange={(e) => {
                        const newData = [...variantData];
                        newData[idx].stock = e.target.value ? parseInt(e.target.value, 10) : undefined;
                        setVariantData(newData);
                      }}
                      placeholder="0"
                      className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 text-xs rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-emerald-500"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={vd.barcode || ''}
                      onChange={(e) => {
                        const newData = [...variantData];
                        newData[idx].barcode = e.target.value;
                        setVariantData(newData);
                      }}
                      placeholder="Auto"
                      className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 text-xs rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-emerald-500 uppercase"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
