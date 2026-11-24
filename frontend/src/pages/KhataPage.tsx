import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  BookOpen,
  Users,
  Truck,
  ShieldCheck,
  Search,
  IndianRupee,
  Share2,
  CheckCircle2,
  AlertCircle,
  Printer,
  X,
  ChevronDown,
  Check,
} from 'lucide-react';
import { khataApi, getErrorMessage } from '../api';
import { useShop } from '../context/ShopContext';
import { useAuth } from '../context/AuthContext';
import { MetricInfoTooltip } from '../components/common/MetricInfoTooltip';
import {
  formatCurrency,
  safeNumber,
  buildWhatsAppKhataReminderUrl,
} from '../utils/formatters';

type KhataTab = 'farmers' | 'suppliers' | 'compliance';

interface KhataModuleOption {
  id: KhataTab;
  title: string;
  badge: string;
  badgeColor: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const KHATA_MODULE_OPTIONS: KhataModuleOption[] = [
  {
    id: 'farmers',
    title: 'Farmer Credit Ledger',
    badge: 'Farmer Credit',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    description: 'Track outstanding farmer credit, payment collections & send WhatsApp payment reminders with UPI QR',
    icon: Users,
  },
  {
    id: 'suppliers',
    title: 'Supplier Payables Ledger',
    badge: 'Distributor Dues',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
    description: 'Inward purchase bills, pending supplier payables, payout history & ledger receipts',
    icon: Truck,
  },
  {
    id: 'compliance',
    title: 'Agri Inspector Register (Form O)',
    badge: 'Govt Compliance',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
    description: 'Official Stock-cum-Price Board and Batch Sale Register for Agriculture Officers & Quality Control inspections',
    icon: ShieldCheck,
  },
];

export const KhataPage: React.FC = () => {
  const { settings } = useShop();
  const { user } = useAuth();
  const isOwner = (user?.role || '').toLowerCase() === 'owner';

  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as KhataTab) || 'farmers';
  const [activeTab, setActiveTab] = useState<KhataTab>(
    ['farmers', 'suppliers', 'compliance'].includes(initialTab)
      ? initialTab
      : 'farmers'
  );
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tabParam = searchParams.get('tab') as KhataTab | null;
    if (tabParam && ['farmers', 'suppliers', 'compliance'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDropdownOpen]);

  const handleTabChange = (newTab: KhataTab) => {
    setActiveTab(newTab);
    setSearchParams({ tab: newTab });
  };
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // 1. Farmer Credit State
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyDue, setOnlyDue] = useState(false);
  const [totalOutstandingUdhar, setTotalOutstandingUdhar] = useState(0);
  const [customers, setCustomers] = useState<any[]>([]);

  // 2. Supplier Payables State
  const [totalPayable, setTotalPayable] = useState(0);
  const [suppliers, setSuppliers] = useState<any[]>([]);

  // Payment Collection / Payout Modal
  const [paymentModal, setPaymentModal] = useState<{
    ledger_type: 'CUSTOMER' | 'SUPPLIER';
    party_name: string;
    party_phone?: string;
    party_gstin?: string;
    suggested_amount: number;
  } | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'UPI' | 'BANK'>('CASH');
  const [paymentNotes, setPaymentNotes] = useState('');

  // 3. Agri Inspector Compliance Register State
  const [complianceData, setComplianceData] = useState<{
    shop_name: string;
    gstin?: string | null;
    fertilizer_license_no?: string | null;
    pesticide_license_no?: string | null;
    seed_license_no?: string | null;
    stock_cum_price_board: any[];
    batch_sale_register: any[];
  } | null>(null);

  const loadCustomers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await khataApi.listCustomers({
        search: searchQuery.trim() || undefined,
        only_due: onlyDue,
      });
      setCustomers(data.customers || []);
      setTotalOutstandingUdhar(safeNumber(data.total_outstanding_udhar, 0));
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to load Farmer Credit ledger.'));
    } finally {
      setLoading(false);
    }
  };

  const loadSuppliers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await khataApi.listSuppliers();
      setSuppliers(data.suppliers || []);
      setTotalPayable(safeNumber(data.total_outstanding_payable, 0));
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to load Supplier Payables ledger.'));
    } finally {
      setLoading(false);
    }
  };

  const loadComplianceRegister = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await khataApi.getComplianceRegister();
      setComplianceData(res);
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to load Agriculture Compliance Register.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'farmers') void loadCustomers();
    else if (activeTab === 'suppliers') void loadSuppliers();
    else if (activeTab === 'compliance') void loadComplianceRegister();
  }, [activeTab, onlyDue]);

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModal) return;
    const amt = Number.parseFloat(paymentAmount);
    if (Number.isNaN(amt) || amt <= 0) {
      setError('Please enter a valid payment amount greater than 0.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await khataApi.recordPayment({
        ledger_type: paymentModal.ledger_type,
        party_name: paymentModal.party_name,
        party_phone: paymentModal.party_phone || undefined,
        party_gstin: paymentModal.party_gstin || undefined,
        amount: amt,
        payment_mode: paymentMode,
        notes: paymentNotes.trim() || undefined,
      });
      setSuccessMsg(
        `Recorded ₹${formatCurrency(amt)} (${paymentMode}) for ${paymentModal.party_name}.`,
      );
      setTimeout(() => setSuccessMsg(null), 3500);
      setPaymentModal(null);
      setPaymentAmount('');
      setPaymentNotes('');
      if (paymentModal.ledger_type === 'CUSTOMER') await loadCustomers();
      else await loadSuppliers();
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to record credit payment.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-brand-700" />
            <span>Credit Ledger &amp; Statutory Compliance</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Farmer credit recovery, WhatsApp payment reminders, supplier payables &amp; Form O compliance
          </p>
        </div>

        {successMsg && (
          <div className="bg-emerald-100 text-emerald-900 text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
      </div>

      {/* Credit Module Dropdown Selector */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-brand-600 animate-pulse" />
            <label
              htmlFor="credit-module-dropdown-btn"
              className="text-xs font-black uppercase tracking-wider text-slate-500"
            >
              Select Credit Module:
            </label>
          </div>

          {/* Unified Dropdown Controller */}
          <div className="relative w-full md:w-96" ref={dropdownRef}>
            {(() => {
              const current =
                KHATA_MODULE_OPTIONS.find((m) => m.id === activeTab) ||
                KHATA_MODULE_OPTIONS[0];
              const CurrentIcon = current.icon;
              return (
                <button
                  id="credit-module-dropdown-btn"
                  type="button"
                  aria-haspopup="listbox"
                  aria-expanded={isDropdownOpen}
                  aria-label="Select Credit Module"
                  onClick={() => setIsDropdownOpen((prev) => !prev)}
                  className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-xl transition text-left focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-1.5 bg-brand-700 text-white rounded-lg shrink-0">
                      <CurrentIcon className="w-4 h-4" />
                    </div>
                    <div className="truncate">
                      <p className="font-bold text-xs text-slate-900 truncate">
                        {current.title}
                      </p>
                      <p className="text-[10px] text-slate-500 truncate">
                        {current.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${current.badgeColor}`}
                    >
                      {current.badge}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-500 transition-transform ${
                        isDropdownOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </button>
              );
            })()}

            {isDropdownOpen && (
              <div
                role="listbox"
                aria-label="Credit Modules"
                className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl border border-slate-200 shadow-2xl p-2 z-30 space-y-1 animate-in fade-in slide-in-from-top-1"
              >
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Switch Module
                </div>
                {KHATA_MODULE_OPTIONS.map((opt) => {
                  const OptIcon = opt.icon;
                  const isSelected = activeTab === opt.id;
                  return (
                    <button
                      key={opt.id}
                      role="option"
                      aria-selected={isSelected}
                      type="button"
                      onClick={() => {
                        handleTabChange(opt.id);
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left transition ${
                        isSelected
                          ? 'bg-brand-50 border border-brand-200 text-brand-900'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`p-2 rounded-lg shrink-0 ${
                            isSelected
                              ? 'bg-brand-700 text-white'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          <OptIcon className="w-4 h-4" />
                        </div>
                        <div className="truncate">
                          <p className="font-bold text-xs">{opt.title}</p>
                          <p className="text-[10px] text-slate-500 truncate">
                            {opt.description}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${opt.badgeColor}`}
                        >
                          {opt.badge}
                        </span>
                        {isSelected && <Check className="w-4 h-4 text-brand-700 shrink-0" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="p-3 bg-red-50 text-red-800 border border-red-200 rounded-xl text-xs flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* =====================================================================
          TAB 1: FARMER CREDIT LEDGER
      ===================================================================== */}
      {activeTab === 'farmers' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm md:col-span-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold uppercase text-slate-400">
                  Total Outstanding Farmer Credit
                </span>
                <MetricInfoTooltip
                  title="Total Outstanding Farmer Credit"
                  description="Aggregate sum of all unpaid credit balances across all active farmers in your khata register."
                  formula="Sum(Farmer Credit Udhar Balances)"
                  tip="Send 1-click WhatsApp payment reminders with UPI QR to collect debts faster."
                />
              </div>
              <p className="text-2xl font-black text-rose-700 mt-1">
                ₹{formatCurrency(totalOutstandingUdhar)}
              </p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm md:col-span-2 flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search farmer name, mobile, or village..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void loadCustomers();
                  }}
                  className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <label htmlFor="only-due-checkbox" className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold shrink-0 cursor-pointer">
                <input
                  id="only-due-checkbox"
                  type="checkbox"
                  checked={onlyDue}
                  onChange={(e) => setOnlyDue(e.target.checked)}
                  className="rounded text-brand-700"
                />
                <span>Only Pending Credit</span>
              </label>
              <button
                type="button"
                onClick={() => { void loadCustomers(); }}
                disabled={loading}
                className="w-full sm:w-auto px-4 py-2 bg-brand-700 hover:bg-brand-800 text-white rounded-xl text-xs font-bold"
              >
                {loading ? 'Searching...' : 'Search'}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Farmer / Customer</th>
                  <th className="py-3 px-4">Mobile &amp; Village</th>
                  <th className="py-3 px-4 text-right">Total Billed</th>
                  <th className="py-3 px-4 text-right">Credit Issued</th>
                  <th className="py-3 px-4 text-right">Repaid</th>
                  <th className="py-3 px-4 text-right">Pending Credit</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.map((c) => {
                  const pending = safeNumber(c.outstanding_balance, 0);
                  const waReminderUrl = buildWhatsAppKhataReminderUrl(
                    c.customer_phone,
                    c.customer_name,
                    pending,
                    settings,
                  );
                  return (
                    <tr key={c.customer_key} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {c.customer_name}
                        <span className="block text-[10px] font-normal text-slate-400">
                          {c.bill_count} invoices billed
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        <div>{c.customer_phone || '-'}</div>
                        <div className="text-[10px] text-slate-400">{c.customer_address || '-'}</div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono">
                        ₹{formatCurrency(c.total_billed)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-amber-700">
                        ₹{formatCurrency(c.total_credit_billed)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-emerald-700 font-semibold">
                        ₹{formatCurrency(c.total_repaid)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-black text-rose-700">
                        ₹{formatCurrency(pending)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {pending > 0 && isOwner && (
                            <button
                              type="button"
                              onClick={() => {
                                setPaymentModal({
                                  ledger_type: 'CUSTOMER',
                                  party_name: c.customer_name,
                                  party_phone: c.customer_phone || undefined,
                                  suggested_amount: pending,
                                });
                                setPaymentAmount(String(pending));
                              }}
                              className="px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold text-[11px] inline-flex items-center gap-1"
                            >
                              <IndianRupee className="w-3 h-3" />
                              <span>Collect</span>
                            </button>
                          )}
                          {pending > 0 && c.customer_phone && (
                            <a
                              href={waReminderUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg border border-emerald-200"
                              title="Send WhatsApp payment reminder with UPI QR"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!loading && customers.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No customer credit records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2: SUPPLIER PAYABLES (ACCOUNTS PAYABLE)
      ===================================================================== */}
      {activeTab === 'suppliers' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold uppercase text-slate-400">
                  Total Distributor / Supplier Payable
                </span>
                <MetricInfoTooltip
                  title="Total Supplier Payable"
                  description="Total pending accounts payable owed to fertilizer manufacturers, pesticide distributors, and seed suppliers for inward stock deliveries."
                  formula="Sum(Supplier Purchase Inward Invoices - Payments Made)"
                  tip="Settle distributor invoices within the cash discount credit window (e.g. 15-30 days) to earn manufacturer rebates."
                />
              </div>
              <p className="text-2xl font-black text-rose-700 mt-1">
                ₹{formatCurrency(totalPayable)}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Supplier / Distributor</th>
                  <th className="py-3 px-4">Phone &amp; GSTIN</th>
                  <th className="py-3 px-4 text-right">Total Purchased</th>
                  <th className="py-3 px-4 text-right">Total Paid</th>
                  <th className="py-3 px-4 text-right">Balance Payable</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {suppliers.map((s, idx) => {
                  const payable = safeNumber(s.outstanding_payable, 0);
                  return (
                    <tr key={idx} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {s.supplier_name}
                        <span className="block text-[10px] font-normal text-slate-400">
                          {s.bill_count} inward bills
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        <div>{s.supplier_phone || '-'}</div>
                        {s.supplier_gstin && (
                          <div className="text-[10px] text-slate-400">GST: {s.supplier_gstin}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono">
                        ₹{formatCurrency(s.total_purchased)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-emerald-700 font-semibold">
                        ₹{formatCurrency(s.total_paid)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-black text-rose-700">
                        ₹{formatCurrency(payable)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentModal({
                              ledger_type: 'SUPPLIER',
                              party_name: s.supplier_name,
                              party_phone: s.supplier_phone || undefined,
                              party_gstin: s.supplier_gstin || undefined,
                              suggested_amount: payable,
                            });
                            setPaymentAmount(payable > 0 ? String(payable) : '');
                          }}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold inline-flex items-center gap-1"
                        >
                          <IndianRupee className="w-3.5 h-3.5" />
                          <span>Record Payout</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!loading && suppliers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No inward purchase suppliers recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 3: AGRICULTURE INSPECTOR COMPLIANCE REGISTER (FORM O)
      ===================================================================== */}
      {activeTab === 'compliance' && complianceData && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-black text-slate-900">
                {complianceData.shop_name} — Form O Stock-Cum-Price Board &amp; Sale Register
              </h3>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                GSTIN: {complianceData.gstin || 'N/A'} | Fert Lic: {complianceData.fertilizer_license_no || 'N/A'} | Pest Lic: {complianceData.pesticide_license_no || 'N/A'} | Seed Lic: {complianceData.seed_license_no || 'N/A'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" />
              <span>Print Inspector Register</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-800">
              Part A: Daily Stock-Cum-Price Display Board ({complianceData.stock_cum_price_board.length} Active SKUs)
            </div>
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 text-[11px] uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Product &amp; Company</th>
                    <th className="py-2.5 px-3">Batch No.</th>
                    <th className="py-2.5 px-3">Expiry</th>
                    <th className="py-2.5 px-3 text-right">Available Stock</th>
                    <th className="py-2.5 px-3 text-right">Selling Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {complianceData.stock_cum_price_board.map((row) => (
                    <tr key={row.product_id}>
                      <td className="py-2 px-3 font-semibold">{row.category}</td>
                      <td className="py-2 px-3">
                        <span className="font-bold text-slate-900">{row.product_name}</span>
                        {row.company_name && (
                          <span className="text-slate-500 ml-1">({row.company_name})</span>
                        )}
                      </td>
                      <td className="py-2 px-3 font-mono">{row.batch_number}</td>
                      <td className="py-2 px-3 font-mono">{row.expiry_date || '-'}</td>
                      <td className="py-2 px-3 text-right font-bold">
                        {row.current_stock} {row.unit}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold">
                        ₹{formatCurrency(row.selling_price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-800">
              Part B: Batch-Wise Farmer Sale &amp; Aadhaar DBT Register
            </div>
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 text-[11px] uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Invoice</th>
                    <th className="py-2.5 px-3">Farmer &amp; Mobile</th>
                    <th className="py-2.5 px-3">Village &amp; Aadhaar</th>
                    <th className="py-2.5 px-3">Product</th>
                    <th className="py-2.5 px-3">Batch No.</th>
                    <th className="py-2.5 px-3 text-right">Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {complianceData.batch_sale_register.map((r, i) => (
                    <tr key={i}>
                      <td className="py-2 px-3 font-mono font-bold">{r.invoice_number}</td>
                      <td className="py-2 px-3">
                        <div className="font-bold">{r.farmer_name}</div>
                        <div className="font-mono text-[11px] text-slate-500">{r.farmer_phone}</div>
                      </td>
                      <td className="py-2 px-3 text-[11px]">
                        <div>{r.farmer_village}</div>
                        <div className="font-mono text-slate-500">UID: {r.farmer_aadhar}</div>
                      </td>
                      <td className="py-2 px-3 font-semibold">{r.product_name}</td>
                      <td className="py-2 px-3 font-mono">{r.batch_number}</td>
                      <td className="py-2 px-3 text-right font-bold">
                        {r.quantity} {r.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: RECORD CREDIT REPAYMENT / SUPPLIER PAYOUT
      ===================================================================== */}
      {paymentModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {paymentModal.ledger_type === 'CUSTOMER'
                  ? `Collect Farmer Payment: ${paymentModal.party_name}`
                  : `Record Supplier Payout: ${paymentModal.party_name}`}
              </h3>
              <button
                type="button"
                onClick={() => setPaymentModal(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={(e) => { void handleRecordPayment(e); }} className="space-y-3.5">
              <div>
                <label htmlFor="khata-pay-amount" className="block font-bold text-slate-700 mb-1">
                  Amount (₹) *
                </label>
                <input
                  id="khata-pay-amount"
                  type="number"
                  step="0.01"
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-sm"
                />
              </div>

              <div>
                <label htmlFor="khata-pay-mode" className="block font-bold text-slate-700 mb-1">
                  Payment Mode *
                </label>
                <select
                  id="khata-pay-mode"
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value as 'CASH' | 'UPI' | 'BANK')}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="CASH">CASH</option>
                  <option value="UPI">UPI</option>
                  <option value="BANK">BANK / NEFT / RTGS</option>
                </select>
              </div>

              <div>
                <label htmlFor="khata-pay-notes" className="block font-bold text-slate-700 mb-1">
                  Notes / Reference (Optional)
                </label>
                <input
                  id="khata-pay-notes"
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="e.g. Harvest settlement / UPI Ref"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentModal(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-brand-700 hover:bg-brand-800 text-white rounded-xl font-bold"
                >
                  {loading ? 'Saving...' : 'Confirm Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
