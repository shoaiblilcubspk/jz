import { Camera } from 'lucide-react';
import { Button } from '../../../shared/ui';
import type { ProductFormFieldsProps } from './ProductFormFieldsMain';

export function MediaConfigFields(props: ProductFormFieldsProps) {
  const {
    formData,
    setFormData,
    onOpenMediaLibrary,
    onFieldChange,
  } = props;

  return (
    <>
      <div className="space-y-4">
        <h3 className="text-[10px] font-black text-gray-600 dark:text-gray-500 uppercase tracking-widest flex items-center gap-3">
          <span className="w-8 h-px bg-gray-200 dark:bg-white/10"></span>
          {"Visual Assets"}
        </h3>

        <div className="flex flex-col sm:flex-row gap-4 items-start">
          <div className="w-24 h-24 rounded-2xl bg-gray-100 dark:bg-black/75 border-2 border-dashed border-gray-200 dark:border-white/10 flex items-center justify-center overflow-hidden shrink-0">
            {formData.image ? (
              <img src={formData.image} className="w-full h-full object-cover" />
            ) : (
              <Camera className="w-6 h-6 text-gray-600" />
            )}
          </div>

          <div className="flex-1 space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="primary"
                onClick={onOpenMediaLibrary}
                className="!px-5 !py-2.5 !rounded-lg !text-[9px] !font-black !shadow-lg !shadow-emerald-500/20"
              >
                Choose / Upload Image
              </Button>
              {formData.image && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setFormData(prev => ({ ...prev, image: '' }))}
                  className="!min-h-0 !px-4 !py-2.5 !rounded-lg !text-[9px] !font-black !bg-rose-500/10 !text-rose-500 hover:!bg-rose-500/20"
                >
                  {"remove"}
                </Button>
              )}
            </div>
            <p className="text-[8px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-widest">Supports WebP, JPG, PNG · Max 50KB</p>
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-gray-200 dark:border-white/5 flex flex-wrap gap-4 sm:gap-6">
        {['taxable', 'active'].map((field) => (
          <label key={field} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              name={field}
              checked={(formData as any)[field]}
              onChange={onFieldChange}
              className="w-4 h-4 rounded border-gray-300 text-primary"
            />
            <span className="text-[10px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-widest">
              {field === 'taxable' ? "taxable" : "active"}
            </span>
          </label>
        ))}
      </div>
    </>
  );
}
