import React from 'react';
import { Store, Globe, Printer, ClipboardList, LayoutGrid } from 'lucide-react';
import { SearchableSelect } from '../../../shared/ui/SearchableSelect';
import { Button } from '../../../shared/ui';
import { LogoUpload } from '../LogoUpload';
import { CURRENCIES } from '../../../lib/currencies';

type ChangeHandler = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
type SetForm = React.Dispatch<React.SetStateAction<any>>;
type InstantUpdater = (name: string, value: any) => Promise<void>;

interface StoreIdentityProps {
  formData: any;
  setFormData: SetForm;
  handleChange: ChangeHandler;
  handleInstantUpdate: InstantUpdater;
}

interface LocalizationProps {
  formData: any;
  setFormData: SetForm;
  handleChange: ChangeHandler;
  handleInstantUpdate: InstantUpdater;
}

interface InvoicingProps {
  formData: any;
  handleChange: ChangeHandler;
  handleRepairCounter: () => Promise<void>;
}

export function GeneralStoreIdentity({ formData, setFormData, handleChange, handleInstantUpdate}: StoreIdentityProps) {
  return (
    <div className="p-4 sm:p-6 bg-gray-50/50 dark:bg-white/[0.02] rounded-[2rem] border border-gray-200 dark:border-white/5 space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-gray-200 dark:border-white/5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-white dark:bg-white/10 rounded-xl shadow-sm">
            <Store className="w-5 h-5 text-[#10B981]" />
          </div>
          <div>
            <h3 className="text-base font-black text-gray-900 dark:text-white uppercase tracking-tight">{"Store Identity"}</h3>
            <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest mt-0.5">{"How your business appears to customers"}</p>
          </div>
        </div>
        <div className="w-full md:w-auto">
          <LogoUpload
            currentLogo={formData.storeLogo}
            onLogoChange={(url: string | undefined) => {
              setFormData((prev: any) => ({ ...prev, storeLogo: url }));
              handleInstantUpdate('storeLogo', url);
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-[9px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-widest ml-1">{"Business Name"}</label>
          <input
            type="text"
            name="storeName"
            value={formData.storeName}
            onChange={handleChange}
            className="w-full bg-white dark:bg-black/20 border-gray-200 dark:border-white/5 rounded-xl py-2 px-3 focus:ring-2 focus:ring-[#10B981]/10 focus:border-[#10B981] transition-all text-[13px] sm:text-sm text-gray-900 dark:text-white font-bold"
            placeholder="My Store"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[9px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-widest ml-1">{"Contact Phone"}</label>
          <input
            type="tel"
            name="storePhone"
            value={formData.storePhone}
            onChange={handleChange}
            className="w-full bg-white dark:bg-black/20 border-gray-200 dark:border-white/5 rounded-xl py-2 px-3 focus:ring-2 focus:ring-[#10B981]/10 focus:border-[#10B981] transition-all text-[13px] sm:text-sm text-gray-900 dark:text-white font-bold"
            placeholder="+92 3XX XXXXXXX"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[9px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-widest ml-1">{"Store Email"}</label>
          <input
            type="email"
            name="storeEmail"
            value={formData.storeEmail}
            onChange={handleChange}
            className="w-full bg-white dark:bg-black/20 border-gray-200 dark:border-white/5 rounded-xl py-2 px-3 focus:ring-2 focus:ring-[#10B981]/10 focus:border-[#10B981] transition-all text-[13px] sm:text-sm text-gray-900 dark:text-white font-bold"
            placeholder="contact@mystore.com"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[9px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-widest ml-1">{"Store Website"}</label>
          <input
            type="text"
            name="storeWebsite"
            value={formData.storeWebsite}
            onChange={handleChange}
            className="w-full bg-white dark:bg-black/20 border-gray-200 dark:border-white/5 rounded-xl py-2 px-3 focus:ring-2 focus:ring-[#10B981]/10 focus:border-[#10B981] transition-all text-[13px] sm:text-sm text-gray-900 dark:text-white font-bold"
            placeholder="www.mystore.com"
          />
        </div>
        <div className="md:col-span-2 space-y-1.5">
          <label className="text-[10px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-widest ml-1">{"Physical Address"}</label>
          <textarea
            name="storeAddress"
            value={formData.storeAddress}
            onChange={handleChange}
            rows={2}
            className="w-full bg-white dark:bg-black/20 border-gray-200 dark:border-white/5 rounded-xl py-2.5 px-3 focus:ring-2 focus:ring-[#10B981]/10 focus:border-[#10B981] transition-all text-sm text-gray-900 dark:text-white font-bold resize-none"
            placeholder="123 Main Street"
          />
        </div>
      </div>
    </div>
  );
}

export function GeneralLocalization({ formData, setFormData, handleChange, handleInstantUpdate}: LocalizationProps) {
  return (
    <div className="p-4 sm:p-6 bg-gray-50/50 dark:bg-white/[0.02] rounded-[2rem] border border-gray-200 dark:border-white/5 space-y-6">
      <div className="flex items-center gap-3 pb-4 border-b border-gray-200 dark:border-white/5">
        <div className="p-2.5 bg-white dark:bg-white/10 rounded-xl shadow-sm">
          <Globe className="w-5 h-5 text-blue-500" />
        </div>
        <div>
          <h3 className="text-base font-black text-gray-900 dark:text-white uppercase tracking-tight">{"Localization & Defaults"}</h3>
          <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest mt-0.5">{"Currencies, languages and system default types"}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2 relative z-30">
          <label className="text-[9px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-widest ml-1">{"Store Currency"}</label>
          <SearchableSelect
            options={CURRENCIES.map(c => ({ id: c.code, label: `${c.code} - ${c.name} (${c.symbol})` }))}
            value={formData.currency}
            onChange={(val) => {
              setFormData((prev: any) => ({ ...prev, currency: val }));
              handleInstantUpdate('currency', val);
            }}
            placeholder="Select currency..."
            icon={Globe}
          />
        </div>
        <div className="space-y-2 relative z-30">
          <label className="text-[9px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-widest ml-1">{"Store Country"}</label>
          <SearchableSelect
            options={[
              { id: 'PK', label: 'Pakistan (🇵🇰)' },
              { id: 'AE', label: 'United Arab Emirates (🇦🇪)' },
              { id: 'SA', label: 'Saudi Arabia (🇸🇦)' },
              { id: 'QR', label: 'Qatar (🇶🇦)' },
              { id: 'KW', label: 'Kuwait (🇰🇼)' },
              { id: 'OM', label: 'Oman (🇴🇲)' },
              { id: 'BH', label: 'Bahrain (🇧🇭)' },
              { id: 'US', label: 'United States (🇺🇸)' },
              { id: 'GB', label: 'United Kingdom (🇬🇧)' },
              { id: 'CA', label: 'Canada (🇨🇦)' },
              { id: 'AU', label: 'Australia (🇦🇺)' },
              { id: 'LK', label: 'Sri Lanka (🇱🇰)' },
              { id: 'BD', label: 'Bangladesh (🇧🇩)' },
              { id: 'IN', label: 'India (🇮🇳)' },
              { id: 'AF', label: 'Afghanistan (🇦🇫)' },
              { id: 'TR', label: 'Turkey (🇹🇷)' },
              { id: 'MY', label: 'Malaysia (🇲🇾)' },
              { id: 'SG', label: 'Singapore (🇸🇬)' },
              { id: 'ID', label: 'Indonesia (🇮🇩)' },
              { id: 'PH', label: 'Philippines (🇵🇭)' },
              { id: 'VN', label: 'Vietnam (🇻🇳)' },
              { id: 'EG', label: 'Egypt (🇪🇬)' },
              { id: 'ZA', label: 'South Africa (🇿🇦)' },
              { id: 'NG', label: 'Nigeria (🇳🇬)' }
            ]}
            value={formData.country || 'PK'}
            onChange={(val) => {
              setFormData((prev: any) => ({ ...prev, country: val }));
              handleInstantUpdate('country', val);
            }}
            placeholder="Select country..."
            icon={Globe}
          />
        </div>
        <div className="space-y-2 relative z-20">
          <label className="text-[9px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-widest ml-1">{"Default POS View"}</label>
          <SearchableSelect
            options={[
              { id: 'retail', label: 'Retail Mode' },
              { id: 'wholesale', label: 'Wholesale Mode' }
            ]}
            value={formData.defaultSaleType || 'retail'}
            onChange={(val) => {
              setFormData((prev: any) => ({ ...prev, defaultSaleType: val as any }));
              handleInstantUpdate('defaultSaleType', val);
            }}
            placeholder="Select mode..."
            icon={LayoutGrid}
          />
        </div>
        <div className="space-y-2 relative z-10">
          <label className="text-[9px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-widest ml-1">{"Standard Paper Size"}</label>
          <SearchableSelect
            options={[
              { id: '80mm', label: '80mm (Standard Thermal)' },
              { id: '58mm', label: '58mm (Compact Thermal)' },
              { id: 'a4', label: 'A4 (Invoice Style)' }
            ]}
            value={formData.receiptPaperSize}
            onChange={(val) => {
              setFormData((prev: any) => ({ ...prev, receiptPaperSize: val as any }));
              handleInstantUpdate('receiptPaperSize', val);
            }}
            placeholder="Select size..."
            icon={Printer}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 relative">
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-widest ml-1">{"Default Tax %"}</label>
            <input
              type="number"
              name="taxRate"
              value={formData.taxRate}
              onChange={handleChange}
              step="0.01"
              className="w-full bg-white dark:bg-black/20 border-gray-200 dark:border-white/5 rounded-xl py-2 px-3 focus:ring-2 focus:ring-[#10B981]/10 focus:border-[#10B981] transition-all text-[13px] sm:text-sm text-gray-900 dark:text-white font-bold"
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-widest ml-1">{"Tax/Business ID"}</label>
            <input
              type="text"
              name="taxId"
              value={formData.taxId}
              onChange={handleChange}
              className="w-full bg-white dark:bg-black/20 border-gray-200 dark:border-white/5 rounded-xl py-2 px-3 focus:ring-2 focus:ring-[#10B981]/10 focus:border-[#10B981] transition-all text-[13px] sm:text-sm text-gray-900 dark:text-white font-bold"
              placeholder="NTN / VAT"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export function GeneralInvoicing({ formData, handleChange, handleRepairCounter}: InvoicingProps) {
  return (
    <div className="p-4 sm:p-6 bg-gray-50/50 dark:bg-white/[0.02] rounded-[2rem] border border-gray-200 dark:border-white/5 space-y-6">
      <div className="flex items-center gap-4 pb-4 border-b border-gray-200 dark:border-white/5">
        <div className="p-3 bg-white dark:bg-white/10 rounded-2xl shadow-sm">
          <ClipboardList className="w-5 h-5 text-amber-500" />
        </div>
        <div>
          <h3 className="text-base font-black text-gray-900 dark:text-white uppercase tracking-tight">{"Business Logic"}</h3>
          <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest mt-0.5">{"Invoicing, prefix, and serialization controls"}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-[9px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-widest ml-1">{"Invoice Prefix"}</label>
          <input
            type="text"
            name="invoicePrefix"
            value={formData.invoicePrefix}
            onChange={handleChange}
            className="w-full bg-white dark:bg-black/20 border-gray-200 dark:border-white/5 rounded-xl py-2 px-3 focus:ring-2 focus:ring-[#10B981]/10 focus:border-[#10B981] transition-all text-gray-900 dark:text-white font-bold"
          />
        </div>
        <div className="space-y-1.5 flex flex-col justify-end">
          <label className="text-[9px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-widest ml-1 mb-1.5">{"Serial Start"}</label>
          <div className="flex gap-2">
            <input
              type="number"
              name="invoiceCounter"
              value={formData.invoiceCounter}
              onChange={handleChange}
              className="flex-1 bg-white dark:bg-black/20 border-gray-200 dark:border-white/5 rounded-xl py-2 px-3 focus:ring-2 focus:ring-[#10B981]/10 focus:border-[#10B981] transition-all text-gray-900 dark:text-white font-bold"
            />
            <Button
              type="button"
              onClick={handleRepairCounter}
              className="!min-h-0 !px-4 !py-2 !rounded-xl !text-[10px] !font-black !bg-indigo-50 dark:!bg-indigo-950/20 !text-indigo-600 dark:!text-indigo-400 !border !border-indigo-200/50 !shadow-none !hover:bg-indigo-100 dark:!hover:bg-indigo-950/20 whitespace-nowrap"
            >
              Repair
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
