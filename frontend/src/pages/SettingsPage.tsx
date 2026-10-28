import React, { useState, useEffect } from 'react';
import { Settings, Building, FileText, Landmark, ShieldCheck, Check, Save, AlertCircle } from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { ShopSettings } from '../types';
import {
  sanitizeTextInput,
  sanitizeCodeInput,
  sanitizePhoneInput,
  sanitizePincodeInput,
  isValidPhone,
  isValidPincode,
  isValidGstin,
  isValidIfsc,
} from '../utils/formatters';
import { getErrorMessage } from '../api';

export const SettingsPage: React.FC = () => {
  const { settings, updateSettings } = useShop();
  const [form, setForm] = useState<ShopSettings>(settings);
  const [isSaved, setIsSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    let cleaned = value;
    if (name === 'phone') {
      cleaned = sanitizePhoneInput(value);
    } else if (name === 'pincode') {
      cleaned = sanitizePincodeInput(value);
    } else if (name === 'gstin' || name === 'bank_ifsc' || name === 'invoice_prefix') {
      cleaned = sanitizeCodeInput(value, 25, true);
    } else if (name === 'terms_conditions') {
      cleaned = value.slice(0, 1500);
    } else {
      cleaned = sanitizeTextInput(value, 200);
    }
    setForm({
      ...form,
      [name]: cleaned
    });
    setIsSaved(false);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.shop_name || form.shop_name.trim().length < 2) {
      setError('Shop / Firm Name must be at least 2 characters.');
      return;
    }
    if (form.phone && !isValidPhone(form.phone)) {
      setError('Please enter a valid 10-digit Indian mobile number starting with 6-9.');
      return;
    }
    if (form.pincode && !isValidPincode(form.pincode)) {
      setError('Please enter a valid 6-digit Indian Pincode.');
      return;
    }
    if (form.gstin && !isValidGstin(form.gstin)) {
      setError('Please enter a valid alphanumeric GSTIN.');
      return;
    }
    if (form.bank_ifsc && !isValidIfsc(form.bank_ifsc)) {
      setError('IFSC code must be 11 characters (e.g., SBIN0001234).');
      return;
    }
    try {
      await updateSettings(form);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to save shop settings'));
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Fertilizer Store Settings
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            GSTIN, pesticide & fertilizer licenses, bank details, and invoice formatting
          </p>
        </div>

        {isSaved && (
          <div className="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 animate-in fade-in">
            <Check className="w-4 h-4" />
            <span>Settings Saved!</span>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold px-4 py-3 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 text-xs">
        {/* Shop & Proprietor Info */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Building className="w-4 h-4 text-brand-700" />
            Shop & License Details
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Shop / Firm Name *</label>
              <input
                type="text"
                required
                name="shop_name"
                value={form.shop_name}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Proprietor / Owner Name *</label>
              <input
                type="text"
                required
                name="proprietor_name"
                value={form.proprietor_name}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">GSTIN (15 Digits) *</label>
              <input
                type="text"
                required
                name="gstin"
                value={form.gstin}
                onChange={handleChange}
                className="w-full px-3 py-2 font-mono uppercase border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Phone Number *</label>
              <input
                type="tel"
                required
                name="phone"
                value={form.phone}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Fertilizer License No.</label>
              <input
                type="text"
                name="fertilizer_license_no"
                value={form.fertilizer_license_no || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                placeholder="FL/2023/..."
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Pesticide License No.</label>
              <input
                type="text"
                name="pesticide_license_no"
                value={form.pesticide_license_no || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                placeholder="PL/2023/..."
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Seed License No.</label>
              <input
                type="text"
                name="seed_license_no"
                value={form.seed_license_no || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                placeholder="SL/2023/..."
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Address *</label>
              <input
                type="text"
                required
                name="address_line1"
                value={form.address_line1}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Pincode *</label>
              <input
                type="text"
                required
                name="pincode"
                value={form.pincode}
                onChange={handleChange}
                className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Bank & Payment Details */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Landmark className="w-4 h-4 text-brand-700" />
            Bank & UPI Information
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Bank Name</label>
              <input
                type="text"
                name="bank_name"
                value={form.bank_name || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Account Number</label>
              <input
                type="text"
                name="bank_account_no"
                value={form.bank_account_no || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">IFSC Code</label>
              <input
                type="text"
                name="bank_ifsc"
                value={form.bank_ifsc || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 font-mono uppercase border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">UPI ID (VPA)</label>
              <input
                type="text"
                name="upi_id"
                value={form.upi_id || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Invoice Prefix & Terms */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <FileText className="w-4 h-4 text-brand-700" />
            Invoice Numbering & Terms
          </h3>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Invoice Number Prefix</label>
            <input
              type="text"
              name="invoice_prefix"
              value={form.invoice_prefix}
              onChange={handleChange}
              className="w-full sm:w-64 px-3 py-2 font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
            <p className="text-[10px] text-slate-400 mt-1">Example: KSK/24-25/ will generate KSK/24-25/0001</p>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Default Terms & Conditions on Bill</label>
            <textarea
              rows={3}
              name="terms_conditions"
              value={form.terms_conditions || ''}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none font-sans"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="w-full sm:w-auto bg-brand-700 hover:bg-brand-600 text-white font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-brand-900/20 active:scale-95 transition-all text-sm"
          >
            <Save className="w-4 h-4" />
            <span>Save Store Settings</span>
          </button>
        </div>
      </form>
    </div>
  );
};
