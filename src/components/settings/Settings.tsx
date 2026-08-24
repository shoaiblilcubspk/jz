// Standardized Settings Layout - Thin Tab Router
import {
  Sliders,
  Globe,
  Printer,
  Shield,
  Database,
  ChevronLeft,
  Cloud,
  Smartphone,
  Lock,
  BookOpen
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { ReceiptPrint } from '../pos/ReceiptPrint';
import { Button } from '../../shared/ui';
import { StickyFormFooter } from '../../shared/ui/StickyFormFooter';

import { GeneralSettings } from './tabs/GeneralSettings';
import { ReceiptSettings } from './tabs/ReceiptSettings';
import { SecuritySettings } from './tabs/SecuritySettings';
import { SystemSettings } from './tabs/SystemSettings';
import { HowToUse } from './tabs/HowToUse';
import type { SettingsTabProps } from './tabs/types';
import { useSettingsForm } from './useSettingsForm';

type TabType = 'general' | 'receipt' | 'backup' | 'security' | 'how-to';

export function Settings() {
  const navigate = useNavigate();
  const { subTab } = useParams();
  
  const form = useSettingsForm();
  const {
    formData, setFormData, handleChange, handleInstantUpdate, handleSubmit, 
    handleRepairCounter, handleResetCalibration, appSettings, profile,
    canEditSettings, isOnline, play, isSaving, showReceipt, setShowReceipt, 
    completedSale, setCompletedSale, syncStatus
  } = form;

  const activeTab = (subTab as TabType) || 'general';
  


  const tabs: { id: TabType; label: string; icon: any }[] = [
    { id: 'general', label: 'General Settings', icon: Sliders },
    { id: 'receipt', label: 'Receipt Design', icon: Printer },
    { id: 'security', label: 'Security & Account', icon: Shield },
    { id: 'backup', label: 'Backup & Restore', icon: Database },
    { id: 'how-to', label: 'How To Use Guide', icon: BookOpen },
  ];

  const tabProps: SettingsTabProps = {
    formData, setFormData, handleChange, handleInstantUpdate, handleRepairCounter,
    handleResetCalibration, appSettings, profile, canEditSettings, isOnline, play,
    setCompletedSale, setShowReceipt,
  };

  return (
    <div className="main-content-scroll p-1 sm:p-4 lg:p-6 py-4 sm:py-6 bg-gray-50/50 dark:bg-app max-w-[1400px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-6 pb-2">
        <div className="flex items-center gap-4 shrink-0">
          <Button variant="ghost" type="button" onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'pos' }))} icon={<ChevronLeft className="h-5 w-5" />} className="!min-h-0 !p-2 !rounded-xl !gap-1 !text-gray-600 dark:!text-gray-400 mr-1 !hover:bg-gray-100 dark:!hover:bg-white/5">
            <span className="hidden sm:inline text-[10px] font-black uppercase tracking-widest">{"Back"}</span>
          </Button>
          <div className="h-10 w-px bg-gray-200 dark:bg-white/10 mx-1 hidden sm:block" />
          <div className="h-14 w-14 bg-primary/10 rounded-2xl flex items-center justify-center shadow-inner border border-primary/10">
            <Sliders className="h-7 w-7 text-primary" />
          </div>
          <div className="shrink-0 flex flex-col">
            <h1 className="text-2xl xl:text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tighter leading-none">{"Settings"}</h1>
            <p className="text-gray-600 dark:text-gray-400 text-[9px] font-black uppercase tracking-[0.2em] mt-2 opacity-60">{"Control Center"} • {formData.storeName?.trim() || 'POS'}</p>
          </div>
        </div>

        {!canEditSettings && (
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-900/20 rounded-2xl flex items-center space-x-3 max-w-sm">
            <Lock className="h-4 w-4 text-yellow-600" />
            <p className="text-yellow-800 dark:text-yellow-400 text-[10px] font-black uppercase tracking-widest leading-tight">
              Access Restricted: Admin or Manager only
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 items-start min-h-full pb-48">
        <div className="w-full lg:w-64 xl:w-72 shrink-0 relative z-20">
          <div className="hidden lg:flex flex-col gap-2 p-2 bg-white dark:bg-surface rounded-[2rem] border border-gray-200 dark:border-white/5 shadow-xl shadow-gray-200/20 dark:shadow-none">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const tabColors: Record<string, string> = { general: '!bg-primary', receipt: '!bg-cyan-600', security: '!bg-blue-600', backup: '!bg-indigo-600', 'how-to': '!bg-purple-600' };
              const activeColor = tabColors[tab.id] || '!bg-primary';

              return (
                <Button key={tab.id} variant="ghost" onClick={() => navigate('/settings/' + tab.id)} className={`!min-h-0 !flex !justify-start !gap-3 !px-6 !py-4 !rounded-[1.5rem] !text-[10px] !tracking-widest !duration-300 !whitespace-nowrap !shadow-none ${isActive ? `${activeColor} !text-white !shadow-lg !shadow-emerald-500/20 translate-x-1` : `!text-gray-600 hover:!text-gray-900 dark:hover:!text-white hover:!bg-gray-50 dark:hover:!bg-white/5`}`}>
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-gray-600'}`} />
                  {tab.label}
                </Button>
              );
            })}
          </div>

          <div className="lg:hidden sticky top-0 z-40 -mx-1 sm:-mx-4 px-1 sm:px-4 py-2 bg-gray-50/95 dark:bg-app/95 border-b border-gray-200 dark:border-white/5">
            <div className="chip-nav-container w-full max-w-full overflow-x-auto justify-start">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                const tabColors: Record<string, string> = { general: '!bg-primary', receipt: '!bg-cyan-600', security: '!bg-blue-600', database: '!bg-indigo-600' };
                const activeColor = tabColors[tab.id] || '!bg-primary';

                return (
                  <Button key={tab.id} variant="ghost" onClick={() => navigate('/settings/' + tab.id)} className={`chip-nav-item !min-h-0 !shadow-none ${isActive ? `${activeColor} !text-white !shadow-lg` : '!text-gray-600'}`}>
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </Button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex-1 w-full bg-white dark:bg-surface rounded-[2rem] sm:rounded-3xl border border-gray-200 dark:border-white/5 shadow-xl shadow-gray-200/40 dark:shadow-none transition-colors relative z-10">
          <form id="settings-form" onSubmit={handleSubmit} className="p-3.5 sm:p-8 space-y-6 sm:space-y-8">
            {activeTab === 'general' && <GeneralSettings {...tabProps} />}
            {activeTab === 'backup' && <SystemSettings />}
            {activeTab === 'receipt' && <ReceiptSettings {...tabProps} />}
            {activeTab === 'security' && <SecuritySettings />}
            {activeTab === 'how-to' && <HowToUse />}
          </form>
        </div>
      </div>

      <StickyFormFooter
        isSaving={isSaving}
        onDiscard={() => window.history.back()}
        saveLabel={"Update System"}
        formId="settings-form"
        disabled={!canEditSettings}
        statusBadge={
          <div className="hidden sm:flex items-center gap-4">
            {syncStatus === 'saving' && (
              <div className="flex items-center gap-3 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-full border border-blue-100 dark:border-blue-900/30">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                <span className="text-xs font-black text-blue-700 dark:text-blue-400">Saving...</span>
              </div>
            )}
            {syncStatus === 'syncing' && (
              <div className="flex items-center gap-3 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-full border border-emerald-100 dark:border-emerald-900/30">
                <Cloud className="w-4 h-4 text-primary animate-bounce" />
                <span className="text-xs font-black text-emerald-700 dark:text-emerald-400">Cloud Sync...</span>
              </div>
            )}
            {syncStatus === 'idle' && (
              <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 dark:bg-white/5 rounded-full border border-gray-200 dark:border-white/5">
                <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-[#10B981]' : 'bg-gray-300'}`} />
                <span className="text-[10px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-widest">{isOnline ? 'Online' : 'Offline'}</span>
              </div>
            )}
          </div>
        }
      />

      <div className="mt-12 pb-32 text-center space-y-4">
        <div className="flex flex-col sm:flex-row justify-center items-center gap-4 sm:gap-8">
          {formData.storeWebsite?.trim() && (
            <Button variant="ghost" onClick={() => window.open(formData.storeWebsite, '_blank')} className="!min-h-0 !p-0 !rounded-none !gap-2 !text-primary hover:!text-emerald-700 !font-bold underline underline-offset-4 decoration-2 decoration-emerald-100 !shadow-none !hover:bg-transparent dark:!hover:bg-transparent">
              <Globe className="w-4 h-4" />
              <span className="text-xs uppercase tracking-widest whitespace-nowrap">{formData.storeWebsite}</span>
            </Button>
          )}
          {formData.storeEmail?.trim() && (
            <Button variant="ghost" onClick={() => window.location.href = `mailto:${formData.storeEmail}`} className="!min-h-0 !p-0 !rounded-none !gap-2 !text-blue-600 hover:!text-blue-700 !font-bold underline underline-offset-4 decoration-2 decoration-blue-100 !shadow-none !hover:bg-transparent dark:!hover:bg-transparent">
              <Smartphone className="w-4 h-4" />
              <span className="text-xs uppercase tracking-widest whitespace-nowrap">{formData.storeEmail}</span>
            </Button>
          )}
        </div>
        <p className="text-[10px] text-gray-600 font-bold uppercase tracking-[0.2em]">Crafted for peak performance & enterprise reliability</p>
      </div>
      {showReceipt && completedSale && (
        <ReceiptPrint sale={completedSale} onClose={() => setShowReceipt(false)} />
      )}
    </div>
  );
}
