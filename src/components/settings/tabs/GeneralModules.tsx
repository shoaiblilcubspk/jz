import {
  Sliders,
  Store,
  ShoppingBag,
  Keyboard,
  Volume2,
  VolumeX,
  PlusCircle,
  AlertCircle,
  Layout,
  ShieldCheck,
  CreditCard,
} from 'lucide-react';
import { Button, ToggleSwitch, Select } from '../../../shared/ui';
import type { SettingsTabProps } from './types';

export function GeneralModules({
  formData,
  setFormData,
  handleChange,
  handleInstantUpdate,
  t,
  play,
}: SettingsTabProps) {
  return (
    <div className="lg:col-span-4 space-y-6">
      {/* User Experience Theme */}
      <div className="p-4 sm:p-6 bg-gray-50/50 dark:bg-white/[0.02] rounded-[2rem] border border-gray-200 dark:border-white/5 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-gray-200 dark:border-white/5">
          <div className="p-2.5 bg-white dark:bg-white/10 rounded-xl shadow-sm">
            <Layout className="w-5 h-5 text-violet-500" />
          </div>
          <div>
            <h3 className="text-base font-black text-gray-900 dark:text-white uppercase tracking-tight">{"Experience"}</h3>
            <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest mt-0.5">{"Personalize your workspace"}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-widest ml-1">{"App Theme"}</label>
            <div className="grid grid-cols-3 gap-2 bg-white dark:bg-black/25 p-1 rounded-xl border border-gray-200 dark:border-white/5">
              {(['light', 'dark', 'auto'] as const).map((tVal) => (
                <Button
                  key={tVal}
                  variant="ghost"
                  type="button"
                  onClick={() => {
                    setFormData(prev => ({ ...prev, theme: tVal }));
                    handleInstantUpdate('theme', tVal);
                  }}
                  className={`!min-h-0 !gap-0 !py-2 !text-[9px] !tracking-widest !rounded-lg !shadow-none ${formData.theme === tVal
                    ? '!bg-[#10B981] !text-white !shadow-md'
                    : '!text-gray-500 hover:!text-gray-900 dark:hover:!text-white'
                    }`}
                >
                  {tVal === 'light' ? "Light" : (tVal === 'dark' ? "Dark" : tVal)}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-widest ml-1">{"Interface Mode"}</label>
            <Select
              name="interfaceMode"
              value={formData.interfaceMode || 'touch'}
              onChange={(e) => {
                handleChange(e);
                handleInstantUpdate('interfaceMode', e.target.value);
              }}
              className="!text-xs !font-bold !py-2"
            >
              <option value="touch">{"Touch Friendly (POS Optimized)"}</option>
              <option value="traditional">{"Traditional (Keyboard Focused)"}</option>
            </Select>
          </div>
        </div>
      </div>

      {/* System Modules Toggles */}
      <div className="p-4 sm:p-6 bg-gradient-to-br from-violet-50/40 to-emerald-50/30 dark:from-violet-900/5 dark:to-emerald-900/5 rounded-[2rem] border border-violet-200/30 dark:border-violet-900/20 space-y-6">
        <div className="flex items-center gap-4 pb-4 border-b border-violet-200/40 dark:border-violet-900/20">
          <div className="w-10 h-10 bg-violet-100 dark:bg-violet-900/20 rounded-xl flex items-center justify-center">
            <Sliders className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h3 className="text-base font-black text-gray-900 dark:text-white uppercase tracking-tight">{"System Modules"}</h3>
            <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest mt-0.5">{"Enable or disable advanced features"}</p>
          </div>
        </div>

        <div className="space-y-3">
          {/* Retail Mode Toggle */}
          <label className="flex items-center justify-between p-3 bg-white dark:bg-black/20 border border-gray-200 dark:border-white/5 rounded-xl cursor-pointer group transition-all">
            <div className="flex items-center gap-3">
              <Store className="w-4 h-4 text-gray-500 group-hover:text-violet-500 transition-colors" />
              <div>
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300 block leading-none">{"Retail Sales"}</span>
                <span className="text-[8px] text-gray-500 uppercase tracking-wider block mt-1">{"B2C direct sales"}</span>
              </div>
            </div>
            <ToggleSwitch
              size="sm"
              color="bg-violet-500"
              checked={formData.retailEnabled}
              onChange={(v) => handleInstantUpdate('retailEnabled', v)}
            />
          </label>

          {/* Wholesale Mode Toggle */}
          <label className="flex items-center justify-between p-3 bg-white dark:bg-black/20 border border-gray-200 dark:border-white/5 rounded-xl cursor-pointer group transition-all">
            <div className="flex items-center gap-3">
              <ShoppingBag className="w-4 h-4 text-gray-500 group-hover:text-violet-500 transition-colors" />
              <div>
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300 block leading-none">{"Wholesale Mode"}</span>
                <span className="text-[8px] text-gray-500 uppercase tracking-wider block mt-1">{"Allow wholesale price tiers"}</span>
              </div>
            </div>
            <ToggleSwitch
              size="sm"
              color="bg-violet-500"
              checked={formData.wholesaleEnabled}
              onChange={(v) => handleInstantUpdate('wholesaleEnabled', v)}
            />
          </label>

          {/* Touch Keyboard Toggle */}
          <label className="flex items-center justify-between p-3 bg-white dark:bg-black/20 border border-gray-200 dark:border-white/5 rounded-xl cursor-pointer group transition-all">
            <div className="flex items-center gap-3">
              <Keyboard className="w-4 h-4 text-gray-500 group-hover:text-violet-500 transition-colors" />
              <div>
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300 block leading-none">{"Touch Keyboard"}</span>
                <span className="text-[8px] text-gray-500 uppercase tracking-wider block mt-1">{"On-screen layout inputs"}</span>
              </div>
            </div>
            <ToggleSwitch
              size="sm"
              color="bg-violet-500"
              checked={formData.touchKeyboardEnabled}
              onChange={(v) => {
                setFormData(p => ({ ...p, touchKeyboardEnabled: v }));
                handleInstantUpdate('touchKeyboardEnabled', v);
              }}
            />
          </label>

          {/* Sound Feedback Toggle */}
          <label className="flex items-center justify-between p-3 bg-white dark:bg-black/20 border border-gray-200 dark:border-white/5 rounded-xl cursor-pointer group transition-all">
            <div className="flex items-center gap-3">
              {formData.soundEnabled
                ? <Volume2 className="w-4 h-4 text-violet-500 transition-colors" />
                : <VolumeX className="w-4 h-4 text-gray-500 group-hover:text-violet-500 transition-colors" />
              }
              <div>
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300 block leading-none">{"Sound Feedback"}</span>
                <span className="text-[8px] text-gray-500 uppercase tracking-wider block mt-1">{"Keyboard UI feedback sounds"}</span>
              </div>
            </div>
            <ToggleSwitch
              size="sm"
              color="bg-violet-500"
              checked={formData.soundEnabled}
              onChange={(v) => {
                setFormData(p => ({ ...p, soundEnabled: v }));
                handleInstantUpdate('soundEnabled', v);
                if (v) setTimeout(() => play('success'), 100);
              }}
            />
          </label>

          {/* Delivery Charges Toggle */}
          <label className="flex items-center justify-between p-3 bg-white dark:bg-black/20 border border-gray-200 dark:border-white/5 rounded-xl cursor-pointer group transition-all">
            <div className="flex items-center gap-3">
              <PlusCircle className="w-4 h-4 text-gray-500 group-hover:text-violet-500 transition-colors" />
              <div>
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300 block leading-none">{"Enable DC Charges"}</span>
                <span className="text-[8px] text-gray-500 uppercase tracking-wider block mt-1">{"Extra packaging & delivery fees"}</span>
              </div>
            </div>
            <ToggleSwitch
              size="sm"
              color="bg-[#10B981]"
              checked={formData.enableExtraCharges}
              onChange={(v) => handleInstantUpdate('enableExtraCharges', v)}
            />
          </label>

          {/* Allow Negative Stock Toggle — §4.2 MASTER */}
          <label className="flex items-center justify-between p-3 bg-white dark:bg-black/20 border border-gray-200 dark:border-white/5 rounded-xl cursor-pointer group transition-all">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-4 h-4 text-gray-500 group-hover:text-amber-500 transition-colors" />
              <div>
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300 block leading-none">{"Allow Negative Stock"}</span>
                <span className="text-[8px] text-gray-500 uppercase tracking-wider block mt-1">{"Let sales proceed when stock is zero"}</span>
              </div>
            </div>
            <ToggleSwitch
              size="sm"
              color="bg-amber-500"
              checked={formData.allowNegativeStock ?? false}
              onChange={(v) => handleInstantUpdate('allowNegativeStock', v)}
            />
          </label>

          {/* RBAC: Refund Approval Threshold */}
          <label className="flex items-center justify-between p-3 bg-white dark:bg-black/20 border border-gray-200 dark:border-white/5 rounded-xl group transition-all">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-4 h-4 text-gray-500 group-hover:text-emerald-500 transition-colors" />
              <div className="min-w-0">
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300 block leading-none">{"Refund Approval Threshold"}</span>
                <span className="text-[8px] text-gray-500 uppercase tracking-wider block mt-1">{"Refunds above this need admin approval (0 = off)"}</span>
              </div>
            </div>
            <input
              type="number"
              min={0}
              value={formData.refundApprovalThreshold ?? 5000}
              onChange={(e) => {
                const val = Number(e.target.value) || 0;
                setFormData((p: any) => ({ ...p, refundApprovalThreshold: val }));
                handleInstantUpdate('refundApprovalThreshold', val);
              }}
              className="w-24 shrink-0 px-2 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-xs font-bold text-gray-900 dark:text-white text-right focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>

          {/* Credit Sales System */}
          <label className="flex items-center justify-between p-3 bg-white dark:bg-black/20 border border-gray-200 dark:border-white/5 rounded-xl group transition-all cursor-pointer">
            <div className="flex items-center gap-3">
              <CreditCard className="w-4 h-4 text-gray-500 group-hover:text-indigo-500 transition-colors" />
              <div>
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300 block leading-none">Enable Credit Sales</span>
                <span className="text-[8px] text-gray-500 uppercase tracking-wider block mt-1">Allow udhar / credit sales globally</span>
              </div>
            </div>
            <ToggleSwitch
              size="sm"
              color="bg-indigo-500"
              checked={formData.enableCreditSales ?? true}
              onChange={(v) => handleInstantUpdate('enableCreditSales', v)}
            />
          </label>

          {(formData.enableCreditSales ?? true) && (
            <label className="flex items-center justify-between p-3 bg-white dark:bg-black/20 border border-gray-200 dark:border-white/5 rounded-xl group transition-all cursor-pointer">
              <div className="flex items-center gap-3">
                <CreditCard className="w-4 h-4 text-gray-500 group-hover:text-amber-500 transition-colors" />
                <div>
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300 block leading-none">Cashier Can Give Credit</span>
                  <span className="text-[8px] text-gray-500 uppercase tracking-wider block mt-1">If off, only Admin/Manager can create credit sales</span>
                </div>
              </div>
              <ToggleSwitch
                size="sm"
                color="bg-amber-500"
                checked={formData.cashierCanCredit ?? true}
                onChange={(v) => handleInstantUpdate('cashierCanCredit', v)}
              />
            </label>
          )}

        </div>
      </div>
    </div>
  );
}
