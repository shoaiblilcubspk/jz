import { Printer, LayoutGrid } from 'lucide-react';
import { SearchableSelect } from '../../../shared/ui/SearchableSelect';
import type { ReceiptSettingsFormProps } from './ReceiptSettingsForm.types';
import { useSettingsStore } from '../../../stores';
import { sonner } from '../../../lib/sonner';

export function ReceiptLayoutTemplateSection(props: ReceiptSettingsFormProps) {
  const { formData, setFormData, handleChange, handleInstantUpdate, canEditSettings } = props;
  return (
    <div className="p-4 sm:p-5 bg-gray-50/50 dark:bg-white/[0.02] rounded-[2rem] border border-gray-200 dark:border-white/5 space-y-4">
      <div className="space-y-2 relative z-30">
        <label className="block text-[9px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-widest ml-1">Paper Size</label>
        <SearchableSelect
          options={[
            { id: '80mm', label: 'Thermal 80mm (Standard)' },
            { id: '58mm', label: 'Thermal 58mm (Compact)' },
            { id: 'A4', label: 'Office A4 Sheet' }
          ]}
          value={formData.receiptPaperSize}
          onChange={(val) => {
            setFormData(p => ({ ...p, receiptPaperSize: val }));
            handleInstantUpdate('receiptPaperSize', val);
          }}
          placeholder="Select paper size..."
          icon={Printer}
        />
      </div>

      <div className="space-y-2 relative z-30">
        <label className="block text-[9px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-widest ml-1">Visual Template</label>
        <SearchableSelect
          options={[
            { id: 'modern', label: 'Modern Clean' },
            { id: 'minimal', label: 'Minimalist' },
            { id: 'professional', label: 'Enterprise Pro' },
            { id: 'compact', label: 'Ultra Compact' },
            { id: 'classic', label: 'Legacy System' },
            { id: 'horizontal_header', label: 'Horizontal Header' },
            { id: 'centered_flow', label: 'Centered Flow' },
            { id: 'left_grid', label: 'Left-Aligned Grid' },
            { id: 'split_columns', label: 'Split Columns' },
            { id: 'floating_totals', label: 'Floating Totals' },
            { id: 'offset_logo', label: 'Offset Logo' },
            { id: 'boxed_sections', label: 'Boxed Sections' },
            { id: 'tear_off', label: 'Tear-Off Slip' },
            { id: 'vertical_line', label: 'Vertical Line Header' },
            { id: 'emphasized_total', label: 'Emphasized Total' }
          ]}
          value={formData.receiptTemplate}
          onChange={(val) => {
            setFormData(p => ({ ...p, receiptTemplate: val }));
            handleInstantUpdate('receiptTemplate', val);
          }}
          placeholder="Select template..."
          icon={LayoutGrid}
        />
      </div>

      <div className="space-y-1.5 p-3 bg-white dark:bg-black/20 rounded-xl border border-gray-200 dark:border-white/5">
        <label className="text-[10px] font-bold text-gray-600 dark:text-gray-400 ml-1 uppercase tracking-wider flex justify-between">
          Global Font Weight
          <span className="text-[#10B981] font-black">{formData.receiptFontWeight || 600}</span>
        </label>
        <input
          type="range"
          min="100"
          max="900"
          step="100"
          name="receiptFontWeight"
          value={formData.receiptFontWeight || 600}
          onChange={(e) => setFormData(p => ({ ...p, receiptFontWeight: parseInt(e.target.value) }))}
          onMouseUp={(e: any) => handleInstantUpdate('receiptFontWeight', parseInt(e.target.value))}
          onTouchEnd={(e: any) => handleInstantUpdate('receiptFontWeight', parseInt(e.target.value))}
          disabled={!canEditSettings}
          className="w-full h-1.5 bg-gray-200 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-600 my-2"
        />
      </div>

      <div className="space-y-1.5 p-3 bg-white dark:bg-black/20 rounded-xl border border-gray-200 dark:border-white/5">
        <label className="text-[10px] font-bold text-gray-600 dark:text-gray-400 ml-1 uppercase tracking-wider flex justify-between">
          Zoom Scale
          <span className="text-[#10B981] font-black">{formData.receiptFontScale}x</span>
        </label>
        <input
          type="range"
          min="0.5"
          max="1.5"
          step="0.1"
          name="receiptFontScale"
          value={formData.receiptFontScale}
          onChange={(e) => setFormData(p => ({ ...p, receiptFontScale: parseFloat(e.target.value) }))}
          onMouseUp={(e: any) => handleInstantUpdate('receiptFontScale', parseFloat(e.target.value))}
          onTouchEnd={(e: any) => handleInstantUpdate('receiptFontScale', parseFloat(e.target.value))}
          disabled={!canEditSettings}
          className="w-full h-1.5 bg-gray-200 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-600 my-2"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex items-center justify-between p-3 bg-white dark:bg-black/20 border border-gray-200 dark:border-white/5 rounded-xl cursor-pointer group hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
          <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300">Auto Print</span>
          <input
            type="checkbox"
            name="receiptPrinter"
            checked={formData.receiptPrinter}
            onChange={(e) => {
              const val = e.target.checked;
              setFormData(p => ({ ...p, receiptPrinter: val }));
              useSettingsStore.getState().setSettings({ receiptPrinter: val });
              try {
                const existing = JSON.parse(localStorage.getItem('pos_local_prefs') || '{}');
                localStorage.setItem('pos_local_prefs', JSON.stringify({ ...existing, receiptPrinter: val }));
              } catch (err) {}
              sonner.success(`Auto Print ${val ? 'Enabled' : 'Disabled'} (This Device Only)`);
            }}
            className="w-4 h-4 rounded text-primary focus:ring-emerald-500"
          />
        </label>

        <label className="flex items-center justify-between p-3 bg-white dark:bg-black/20 border border-gray-200 dark:border-white/5 rounded-xl cursor-pointer group hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
          <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300">Enable KOT</span>
          <input
            type="checkbox"
            name="enableKotPrinter"
            checked={!!formData.enableKotPrinter}
            onChange={(e) => {
              const val = e.target.checked;
              setFormData(p => ({ ...p, enableKotPrinter: val }));
              useSettingsStore.getState().setSettings({ enableKotPrinter: val });
              try {
                const existing = JSON.parse(localStorage.getItem('pos_local_prefs') || '{}');
                localStorage.setItem('pos_local_prefs', JSON.stringify({ ...existing, enableKotPrinter: val }));
              } catch (err) {}
              sonner.success(`KOT ${val ? 'Enabled' : 'Disabled'} (This Device Only)`);
            }}
            className="w-4 h-4 rounded text-primary focus:ring-emerald-500"
          />
        </label>

        <label className="flex items-center justify-between p-3 bg-white dark:bg-black/20 border border-gray-200 dark:border-white/5 rounded-xl cursor-pointer group hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
          <div>
            <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300">Auto-Save Receipt PNG</span>
            <p className="text-[9px] text-gray-400 mt-0.5">Saves PNG to device, organized by date</p>
          </div>
          <input
            type="checkbox"
            name="autoSaveReceiptPng"
            checked={!!formData.autoSaveReceiptPng}
            onChange={(e) => {
              const val = e.target.checked;
              setFormData(p => ({ ...p, autoSaveReceiptPng: val }));
              useSettingsStore.getState().setSettings({ autoSaveReceiptPng: val });
              try {
                const existing = JSON.parse(localStorage.getItem('pos_local_prefs') || '{}');
                localStorage.setItem('pos_local_prefs', JSON.stringify({ ...existing, autoSaveReceiptPng: val }));
              } catch (err) {}
              sonner.success(`Auto-Save PNG ${val ? 'Enabled' : 'Disabled'} (This Device Only)`);
            }}
            className="w-4 h-4 rounded text-primary focus:ring-emerald-500"
          />
        </label>
      </div>
    </div>
  );
}
