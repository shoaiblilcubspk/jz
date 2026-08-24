import React, { useState, useEffect } from 'react';
import { Save, RefreshCw } from 'lucide-react';
import { Supplier } from '../../../types';
import { Modal } from '../../../shared/ui/Modal';
import { Button, Select } from '../../../shared/ui';
import { useActionGuard } from '../../../hooks/useActionGuard';

interface SupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (supplier: Partial<Supplier>) => Promise<void>;
  supplier?: Supplier | null;
}

export function SupplierModal({ isOpen, onClose, onSave, supplier }: SupplierModalProps) {
  const [formData, setFormData] = useState<Partial<Supplier>>({
    name: '',
    phone: '',
    email: '',
    businessType: '',
    paymentTerms: '',
    address: '',
    openingBalance: 0,
    rating: 5,
    contactPerson: '',
    ntn: ''
  });

  useEffect(() => {
    if (supplier) {
      setFormData(supplier);
    } else {
      setFormData({
        name: '',
        phone: '',
        email: '',
        businessType: '',
        paymentTerms: '',
        address: '',
        openingBalance: 0,
        rating: 5,
        contactPerson: '',
        ntn: ''
      });
    }
  }, [supplier, isOpen]);

  const { isProcessing: isSubmitting, guardedAction: handleSubmit } = useActionGuard(async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Failed to save supplier:', error);
    }
  });

  if (!isOpen) return null;

  const footer = (
    <div className="flex items-center justify-end gap-2 sm:gap-3 w-full">
      <Button
        variant="danger"
        onClick={onClose}
        className="!bg-transparent !border-rose-200 dark:!border-rose-900/30 !text-[#ff4b6e] hover:!bg-rose-50 dark:hover:!bg-rose-500/10 !px-4 sm:!px-6 !py-2.5 sm:!py-3.5 !text-[9px] sm:!text-[10px] !font-black !rounded-2xl shrink-0"
      >
        {"DISCARD"}
      </Button>
      <Button
        type="submit"
        form="supplier-form"
        loading={isSubmitting}
        icon={<Save className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />}
        className="flex-1 sm:flex-none sm:min-w-[240px] !py-2.5 sm:!py-3.5 !text-[9px] sm:!text-[11px]"
      >
        <span className="leading-none ml-2">
          {supplier ? "UPDATE PARTNER" : "REGISTER PARTNER"}
        </span>
      </Button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={supplier ? "EDIT SUPPLIER ACCOUNT" : "REGISTER NEW PARTNER"}
      maxWidth="lg"
      footer={footer}
    >
      <form id="supplier-form" onSubmit={handleSubmit} className="space-y-10">
        {/* Business Profile */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          <h3 className="text-[10px] font-black text-gray-600 dark:text-gray-500 uppercase tracking-widest flex items-center gap-3">
            <span className="w-8 h-px bg-gray-200 dark:bg-white/10"></span>
            {"Business Profile"}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-wider">{"Legal Entity *"}</label>
              <input
                type="text"
                required
                className="w-full bg-[#f8f9fa] dark:bg-black/75 border-none text-gray-900 dark:text-white text-sm rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 transition-all font-medium"
                placeholder="e.g. Acme Corp"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-wider">{"Lead Contact"}</label>
              <input
                type="text"
                className="w-full bg-[#f8f9fa] dark:bg-black/75 border-none text-gray-900 dark:text-white text-sm rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 transition-all font-medium"
                placeholder="Point of contact"
                value={formData.contactPerson}
                onChange={e => setFormData({ ...formData, contactPerson: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-wider">{"Business Mobile *"}</label>
              <input
                type="text"
                required
                className="w-full bg-[#f8f9fa] dark:bg-black/75 border-none text-gray-900 dark:text-white text-sm rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 transition-all font-medium"
                placeholder="+92 3xx xxxxxxx"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Operational Data */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          <h3 className="text-[10px] font-black text-gray-600 dark:text-gray-500 uppercase tracking-widest flex items-center gap-3">
            <span className="w-8 h-px bg-gray-200 dark:bg-white/10"></span>
            {"Operational Data"}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-wider">{"Operational Email"}</label>
              <input
                type="email"
                className="w-full bg-[#f8f9fa] dark:bg-black/75 border-none text-gray-900 dark:text-white text-sm rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 transition-all font-medium"
                placeholder="orders@partner.com"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
             <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-wider">{"Tax Identity (NTN)"}</label>
              <input
                type="text"
                className="w-full bg-[#f8f9fa] dark:bg-black/75 border-none text-gray-900 dark:text-white text-sm rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 transition-all font-medium"
                placeholder="Tax registration number"
                value={formData.ntn}
                onChange={e => setFormData({ ...formData, ntn: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Classification & Terms */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          <h3 className="text-[10px] font-black text-gray-600 dark:text-gray-500 uppercase tracking-widest flex items-center gap-3">
            <span className="w-8 h-px bg-gray-200 dark:bg-white/10"></span>
            {"Classification & Terms"}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-wider">{"Business Type"}</label>
              <Select
                value={formData.businessType || ''}
                onChange={e => setFormData({ ...formData, businessType: e.target.value })}
              >
                <option value="">{"Select type"}</option>
                <option value="Manufacturer">{"Manufacturer"}</option>
                <option value="Distributor">{"Distributor"}</option>
                <option value="Wholesaler">{"Wholesaler"}</option>
                <option value="Retailer">{"Retailer"}</option>
                <option value="Agent">{"Agent"}</option>
                <option value="Other">{"Other"}</option>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-wider">{"Payment Terms"}</label>
              <input
                type="text"
                className="w-full bg-[#f8f9fa] dark:bg-black/75 border-none text-gray-900 dark:text-white text-sm rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 transition-all font-medium"
                placeholder="e.g. Net 30, COD"
                value={formData.paymentTerms || ''}
                onChange={e => setFormData({ ...formData, paymentTerms: e.target.value })}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-[10px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-wider">{"Rating"}</label>
              <Select
                value={String(formData.rating ?? 5)}
                onChange={e => setFormData({ ...formData, rating: Number(e.target.value) })}
              >
                <option value="5">{"5 — Excellent"}</option>
                <option value="4">{"4 — Good"}</option>
                <option value="3">{"3 — Average"}</option>
                <option value="2">{"2 — Poor"}</option>
                <option value="1">{"1 — Bad"}</option>
              </Select>
            </div>
          </div>
        </div>

        {/* Logistics & Financials */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          <h3 className="text-[10px] font-black text-gray-600 dark:text-gray-500 uppercase tracking-widest flex items-center gap-3">
            <span className="w-8 h-px bg-gray-200 dark:bg-white/10"></span>
            {"Logistics & Initial State"}
          </h3>
          
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-wider">{"Distribution Hub Address"}</label>
              <textarea
                className="w-full bg-[#f8f9fa] dark:bg-black/75 border-none text-gray-900 dark:text-white text-sm rounded-xl p-4 focus:ring-2 focus:ring-emerald-500 transition-all font-medium min-h-[80px] resize-none"
                placeholder="Complete location for logistics..."
                value={formData.address}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
              />
            </div>

            {!supplier && (
              <div className="space-y-2">
                <label className="text-[10px] font-black text-rose-500 uppercase tracking-wider">{"Initial Debt Balance"}</label>
                <div className="relative">
                  <input
                    type="number"
                    value={formData.openingBalance}
                    onChange={(e) => setFormData({ ...formData, openingBalance: Number(e.target.value) })}
                    className="w-full bg-[#f8f9fa] dark:bg-black/75 border-none text-rose-600 dark:text-rose-400 text-3xl font-black rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 transition-all"
                    placeholder="0.00"
                    inputMode="decimal"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-rose-600/50 dark:text-rose-400/50 font-bold text-[10px] uppercase tracking-widest">{"Opening Debt"}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </form>
    </Modal>
  );
}
