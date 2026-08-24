import { Sliders } from 'lucide-react';
import { GeneralModules } from './GeneralModules';
import { GeneralStoreIdentity, GeneralLocalization, GeneralInvoicing } from './generalCards';
import type { SettingsTabProps } from './types';

export function GeneralSettings(props: SettingsTabProps) {
  const { formData, setFormData, handleChange, handleInstantUpdate, handleRepairCounter } = props;
  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3 pb-4 border-b border-gray-50 dark:border-white/5">
        <div className="w-10 h-10 bg-[#10B981]/10 rounded-xl flex items-center justify-center">
          <Sliders className="w-5 h-5 text-[#10B981]" />
        </div>
        <div>
          <h2 className="text-lg sm:text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">{"General Settings"}</h2>
          <p className="text-[10px] text-gray-600 font-bold tracking-widest uppercase mt-0.5">{"Main Dashboard • Common Configuration"}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        <div className="lg:col-span-8 space-y-6">
          <GeneralStoreIdentity
            formData={formData}
            setFormData={setFormData}
            handleChange={handleChange}
            handleInstantUpdate={handleInstantUpdate}
          />

          <GeneralLocalization
            formData={formData}
            setFormData={setFormData}
            handleChange={handleChange}
            handleInstantUpdate={handleInstantUpdate}
          />

          <GeneralInvoicing
            formData={formData}
            handleChange={handleChange}
            handleRepairCounter={handleRepairCounter}
          />
        </div>

        <GeneralModules {...props} />
      </div>
    </section>
  );
}
