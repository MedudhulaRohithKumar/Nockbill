import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
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
  Download,
  PlusCircle,
  Clock,
  Sparkles,
  FileSpreadsheet,
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
type FilterMode = 'all' | 'overdue' | 'due_week' | 'settled';

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
    badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    description: 'Track outstanding farmer credit, aging & WhatsApp payment reminders with UPI QR',
    icon: Users,
  },
  {
    id: 'suppliers',
    title: 'Supplier Payables Ledger',
    badge: 'Distributor Dues',
    badgeColor: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    description: 'Inward purchase bills, pending supplier disbursements & manufacturer settlement history',
    icon: Truck,
  },
  {
    id: 'compliance',
    title: 'Agri Inspector Register (Form O)',
    badge: 'Govt Compliance',
    badgeColor: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    description: 'Official Stock-cum-Price Board & Schedule compliance for Agriculture Officers & FCO audits',
    icon: ShieldCheck,
  },
];

export const KhataPage: React.FC = () => {
  const { settings } = useShop();
  const { user } = useAuth();
  const navigate = useNavigate();
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

  // Filter & Search states
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [supplierSearchQuery, setSupplierSearchQuery] = useState('');

  // Status & Feedback states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // 1. Farmer Credit Data
  const [totalOutstandingUdhar, setTotalOutstandingUdhar] = useState(0);
  const [customers, setCustomers] = useState<any[]>([]);

  // 2. Supplier Payables Data
  const [totalPayable, setTotalPayable] = useState(0);
  const [suppliers, setSuppliers] = useState<any[]>([]);

  // 3. Agri Inspector Compliance Register Data
  const [complianceData, setComplianceData] = useState<{
    shop_name: string;
    gstin?: string | null;
    fertilizer_license_no?: string | null;
    pesticide_license_no?: string | null;
    seed_license_no?: string | null;
    stock_cum_price_board: any[];
    batch_sale_register: any[];
  } | null>(null);

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

  // Form O Audit Pack Modal
  const [isAuditPackOpen, setIsAuditPackOpen] = useState(false);

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
        setPaymentModal(null);
        setIsAuditPackOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleTabChange = (newTab: KhataTab) => {
    setActiveTab(newTab);
    setSearchParams({ tab: newTab });
  };

  const loadCustomers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await khataApi.listCustomers({
        search: searchQuery.trim() || undefined,
        only_due: filterMode === 'overdue',
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
    if (activeTab === 'farmers') {
      void loadCustomers();
    } else if (activeTab === 'suppliers') {
      void loadSuppliers();
    } else if (activeTab === 'compliance') {
      void loadComplianceRegister();
    }
  }, [activeTab, filterMode]);

  // Derived metrics from live data
  const totalRepaidAmount = useMemo(() => {
    return customers.reduce((sum, c) => sum + safeNumber(c.total_repaid, 0), 0);
  }, [customers]);

  const totalCreditBilledAmount = useMemo(() => {
    return customers.reduce((sum, c) => sum + safeNumber(c.total_credit_billed, 0), 0);
  }, [customers]);

  const overdueAccountsCount = useMemo(() => {
    return customers.filter((c) => safeNumber(c.outstanding_balance, 0) > 0).length;
  }, [customers]);

  const settledAccountsCount = useMemo(() => {
    return customers.filter(
      (c) => safeNumber(c.outstanding_balance, 0) === 0 && safeNumber(c.total_credit_billed, 0) > 0
    ).length;
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    let list = customers;
    if (filterMode === 'overdue') {
      list = list.filter((c) => safeNumber(c.outstanding_balance, 0) > 0);
    } else if (filterMode === 'due_week') {
      list = list.filter((c) => safeNumber(c.outstanding_balance, 0) > 0);
    } else if (filterMode === 'settled') {
      list = list.filter((c) => safeNumber(c.outstanding_balance, 0) === 0);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (c) =>
          (c.customer_name || '').toLowerCase().includes(q) ||
          (c.customer_phone || '').toLowerCase().includes(q) ||
          (c.customer_address || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [customers, filterMode, searchQuery]);

  const filteredSuppliers = useMemo(() => {
    if (!supplierSearchQuery.trim()) return suppliers;
    const q = supplierSearchQuery.toLowerCase();
    return suppliers.filter(
      (s) =>
        (s.supplier_name || '').toLowerCase().includes(q) ||
        (s.supplier_gstin || '').toLowerCase().includes(q) ||
        (s.supplier_phone || '').toLowerCase().includes(q)
    );
  }, [suppliers, supplierSearchQuery]);

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
        `Recorded ₹${formatCurrency(amt)} (${paymentMode}) for ${paymentModal.party_name}.`
      );
      setTimeout(() => setSuccessMsg(null), 3500);
      setPaymentModal(null);
      setPaymentAmount('');
      setPaymentNotes('');
      if (paymentModal.ledger_type === 'CUSTOMER') {
        await loadCustomers();
      } else {
        await loadSuppliers();
      }
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to record credit payment.'));
    } finally {
      setLoading(false);
    }
  };

  const handleExportKhataTally = () => {
    if (activeTab === 'farmers') {
      if (customers.length === 0) {
        setError('No farmer credit records available to export.');
        return;
      }
      const headers = ['Farmer Name,Phone,Village / Address,Total Billed,Credit Taken,Repaid,Pending Balance\n'];
      const rows = customers.map(
        (c) =>
          `"${c.customer_name}","${c.customer_phone || ''}","${c.customer_address || ''}",${safeNumber(c.total_billed)},${safeNumber(c.total_credit_billed)},${safeNumber(c.total_repaid)},${safeNumber(c.outstanding_balance)}`
      );
      const blob = new Blob([headers.concat(rows.join('\n')).join('')], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `khata_farmer_credit_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
    } else if (activeTab === 'suppliers') {
      if (suppliers.length === 0) {
        setError('No supplier payable records available to export.');
        return;
      }
      const headers = ['Supplier Name,GSTIN,Phone,Total Inward,Paid Amount,Pending Dues\n'];
      const rows = suppliers.map(
        (s) =>
          `"${s.supplier_name}","${s.supplier_gstin || ''}","${s.supplier_phone || ''}",${safeNumber(s.total_billed)},${safeNumber(s.total_paid)},${safeNumber(s.outstanding_balance)}`
      );
      const blob = new Blob([headers.concat(rows.join('\n')).join('')], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `khata_supplier_payables_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
    }
  };

  const handlePrintRegister = () => {
    window.print();
  };

  const currentModule =
    KHATA_MODULE_OPTIONS.find((m) => m.id === activeTab) || KHATA_MODULE_OPTIONS[0];
  const CurrentModuleIcon = currentModule.icon;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* ─── SECTION 1: HEADER BANNER CARD ──────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
        <div className="flex items-start sm:items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/80 flex items-center justify-center shrink-0 shadow-sm">
            <BookOpen className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Credit Ledger &amp; Statutory Compliance
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Farmer credit recovery, WhatsApp payment reminders, supplier payables &amp; Form O compliance
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => {
              if (activeTab !== 'compliance') {
                handleTabChange('compliance');
              }
              setIsAuditPackOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs transition-colors shadow-sm"
          >
            <ShieldCheck className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <span>Form O Audit Pack</span>
          </button>
          <button
            type="button"
            onClick={handleExportKhataTally}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs transition-colors shadow-sm"
          >
            <Download className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            <span>Download Khata Tally</span>
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {successMsg && (
        <div
          role="status"
          className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-bold px-4 py-3 rounded-2xl flex items-center gap-2 shadow-sm animate-in fade-in"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Error Notification */}
      {error && (
        <div
          role="alert"
          className="bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-bold px-4 py-3 rounded-2xl flex items-center gap-2 shadow-sm animate-in fade-in"
        >
          <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-rose-600 dark:text-rose-400 hover:text-rose-800 p-0.5 rounded"
            aria-label="Dismiss error"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ─── SECTION 2: MODULE SWITCHER BAR WITH INTERACTIVE DROPDOWN ───────── */}
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl p-4 sm:px-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 z-30 transition-colors">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
            SELECT CREDIT MODULE:
          </span>
        </div>

        <div className="relative w-full lg:w-auto" ref={dropdownRef}>
          {/* Main Selector Button */}
          <button
            id="moduleDropdownBtn"
            type="button"
            aria-haspopup="listbox"
            aria-expanded={isDropdownOpen}
            aria-label="Select Credit Module"
            onClick={() => setIsDropdownOpen((prev) => !prev)}
            className="w-full lg:w-[460px] flex items-center justify-between gap-3 p-3 rounded-xl bg-emerald-50/70 hover:bg-emerald-100/60 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/70 border border-emerald-200/80 dark:border-emerald-800/80 text-left transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-emerald-700 dark:bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <CurrentModuleIcon className="w-4 h-4" />
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                    {currentModule.title}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${currentModule.badgeColor}`}
                  >
                    {currentModule.badge}
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {currentModule.description}
                </span>
              </div>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0 transition-transform duration-200 ${
                isDropdownOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div
              role="listbox"
              aria-label="Credit Modules"
              className="absolute right-0 top-full mt-2 w-full lg:w-[460px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-2 flex flex-col gap-1.5 z-50 animate-in fade-in zoom-in-95 duration-150"
            >
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
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
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl cursor-pointer text-left transition-colors ${
                      isSelected
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-950 dark:text-emerald-100'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-emerald-700 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <OptIcon className="w-4 h-4" />
                      </div>
                      <div className="truncate">
                        <div className="font-bold text-xs">{opt.title}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                          {opt.description}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${opt.badgeColor}`}
                      >
                        {opt.badge}
                      </span>
                      {isSelected && <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ─── SECTION 3: SUMMARY METRICS (3 BENTO CARDS) ─────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Outstanding Credit */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between relative overflow-hidden transition-colors">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-wider">
                <span>Total Outstanding Farmer Credit</span>
                <MetricInfoTooltip
                  title="Total Outstanding Farmer Credit"
                  description="Sum of all unpaid customer balances from fertilizer, seed, and pesticide credit bills across all active accounts."
                  formula="Sum(Outstanding Customer Udhar Balances)"
                  tip="Follow up with overdue accounts via 1-click WhatsApp reminders with direct UPI payment QR."
                />
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  totalOutstandingUdhar > 0
                    ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                }`}
              >
                {totalOutstandingUdhar > 0 ? 'Action Required' : 'All Clear'}
              </span>
            </div>

            <div className="my-2">
              <div className="text-2xl sm:text-3xl font-black text-rose-600 dark:text-rose-400 tracking-tight font-mono">
                ₹{formatCurrency(totalOutstandingUdhar, 2)}
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs">
                <span className="font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {overdueAccountsCount} active accounts with due balance
                </span>
              </div>
            </div>
          </div>

          <div className="pt-3 mt-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl p-2.5 flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-medium">
              Registered Accounts: {customers.length}
            </span>
            <span className="font-mono text-emerald-700 dark:text-emerald-400 font-bold">
              Settled: {settledAccountsCount}
            </span>
          </div>
        </div>

        {/* Recovered This Season */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between transition-colors">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-wider">
                <span>Recovered This Kharif Season</span>
                <MetricInfoTooltip
                  title="Recovered Farmer Credit"
                  description="Cumulative total amount collected from farmers against outstanding credit bills via cash, UPI, or bank deposit."
                  formula="Sum(Farmer Credit Repayments)"
                  tip="Prompt repayment ensures farmers stay eligible for subsidized fertilizer allocations under statutory limits."
                />
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
                {totalCreditBilledAmount > 0
                  ? `${Math.round((totalRepaidAmount / totalCreditBilledAmount) * 100)}% Settled`
                  : '100% On Time'}
              </span>
            </div>

            <div className="my-2">
              <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight font-mono">
                ₹{formatCurrency(totalRepaidAmount, 2)}
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs">
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  Total credit billed: ₹{formatCurrency(totalCreditBilledAmount, 2)}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-3 mt-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl p-2.5 flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Auto-reconciliation:</span>
            <span className="font-mono text-slate-800 dark:text-slate-200 font-bold">Real-time DB Sync</span>
          </div>
        </div>

        {/* Pending Supplier Payables */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between transition-colors">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-wider">
                <span>Pending Supplier Payables</span>
                <MetricInfoTooltip
                  title="Pending Supplier Payables"
                  description="Outstanding invoice payables owed to input manufacturers, seed companies, and chemical distributors for recorded inward stock."
                  formula="Sum(Supplier Inward Invoice Balances)"
                  tip="Clear dues within supplier credit cycles to qualify for seasonal turnover discounts and priority dispatches."
                />
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800">
                {suppliers.filter((s) => safeNumber(s.outstanding_balance) > 0).length} Suppliers Due
              </span>
            </div>

            <div className="my-2">
              <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight font-mono">
                ₹{formatCurrency(totalPayable, 2)}
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs">
                <span className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {suppliers.length} Recorded input distributors
                </span>
              </div>
            </div>
          </div>

          <div className="pt-3 mt-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl p-2.5 flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-medium">GST Input Tax Credit:</span>
            <span className="font-mono text-emerald-700 dark:text-emerald-400 font-bold">100% ITC Eligible</span>
          </div>
        </div>
      </div>

      {/* ─── SECTION 4: OPERATIONAL LEDGER WORKSTATION ──────────────────────── */}
      {activeTab === 'farmers' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col transition-colors">
          {/* Top Action Toolbar */}
          <div className="p-4 sm:p-5 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800">
            {/* Search Field */}
            <div className="relative flex-1 min-w-0 max-w-2xl">
              <label className="sr-only" htmlFor="farmerSearchInput">
                Search farmer name, mobile or village
              </label>
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                <Search className="w-4 h-4" />
              </div>
              <input
                id="farmerSearchInput"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search farmer name, mobile, or village (e.g. Ramesh, Mandya, 9845...)"
                className="w-full h-11 pl-10 pr-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs sm:text-sm transition-all"
              />
            </div>

            {/* Action Controls */}
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  const firstOverdue = customers.find(
                    (c) => safeNumber(c.outstanding_balance) > 0 && c.customer_phone
                  );
                  if (firstOverdue) {
                    const url = buildWhatsAppKhataReminderUrl(
                      firstOverdue.customer_phone,
                      firstOverdue.customer_name,
                      safeNumber(firstOverdue.outstanding_balance),
                      settings
                    );
                    window.open(url, '_blank');
                  } else {
                    setError('No overdue accounts with phone numbers found to send WhatsApp reminders.');
                  }
                }}
                className="h-11 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs inline-flex items-center gap-2 shadow-sm transition-all active:scale-95"
              >
                <Share2 className="w-4 h-4" />
                <span>Send WhatsApp Reminders</span>
              </button>

              <button
                type="button"
                onClick={() => navigate('/billing')}
                className="h-11 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs inline-flex items-center gap-2 transition-all active:scale-95"
              >
                <PlusCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>+ Add Credit Bill</span>
              </button>
            </div>
          </div>

          {/* Quick Filters Segment */}
          <div className="px-4 sm:px-6 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 overflow-x-auto text-xs">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                filterMode === 'all'
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              All Accounts ({customers.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('overdue')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                filterMode === 'overdue'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              Overdue ({overdueAccountsCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('due_week')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                filterMode === 'due_week'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              Due This Week
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('settled')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                filterMode === 'settled'
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              Settled Kharif ({settledAccountsCount})
            </button>
          </div>

          {/* Farmer Table Ledger View */}
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Farmer Name &amp; Mobile</th>
                  <th className="py-3 px-4">Address / Village</th>
                  <th className="py-3 px-4 text-right">Total Billed</th>
                  <th className="py-3 px-4 text-right">Credit Taken</th>
                  <th className="py-3 px-4 text-right">Repaid Amount</th>
                  <th className="py-3 px-4 text-right">Pending Balance</th>
                  <th className="py-3 px-4 text-center">Khata Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredCustomers.map((c) => {
                  const pending = safeNumber(c.outstanding_balance, 0);
                  const waReminderUrl = buildWhatsAppKhataReminderUrl(
                    c.customer_phone,
                    c.customer_name,
                    pending,
                    settings
                  );
                  const initials = (c.customer_name || 'F')
                    .split(' ')
                    .map((n: string) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase();

                  return (
                    <tr
                      key={c.customer_key || c.customer_name}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 flex items-center justify-center font-bold text-xs shrink-0">
                            {initials}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white">
                              {c.customer_name}
                            </div>
                            <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                              {c.customer_phone || 'No phone'}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                        <div>{c.customer_address || 'Local Region'}</div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500">
                          {c.bill_count || 1} bills recorded
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-medium text-slate-700 dark:text-slate-300">
                        ₹{formatCurrency(c.total_billed, 2)}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-medium text-amber-700 dark:text-amber-400">
                        ₹{formatCurrency(c.total_credit_billed, 2)}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">
                        ₹{formatCurrency(c.total_repaid, 2)}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-black text-rose-600 dark:text-rose-400 text-sm">
                        ₹{formatCurrency(pending, 2)}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border inline-block ${
                            pending > 0
                              ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                          }`}
                        >
                          {pending > 0 ? 'Overdue' : 'Settled'}
                        </span>
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
                              className="px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold text-[11px] inline-flex items-center gap-1 shadow-sm"
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
                              className="p-1.5 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 rounded-lg border border-emerald-200 dark:border-emerald-800 transition"
                              title="Send WhatsApp payment reminder with UPI QR"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setSuccessMsg(`Statement receipt generated for ${c.customer_name}.`);
                              setTimeout(() => setSuccessMsg(null), 3000);
                            }}
                            className="p-1.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-lg border border-slate-200 dark:border-slate-700 transition"
                            title="Print account ledger statement"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {!loading && filteredCustomers.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400 dark:text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Users className="w-8 h-8 stroke-1 text-slate-300 dark:text-slate-600" />
                        <p className="font-semibold text-slate-600 dark:text-slate-400 text-sm">
                          No farmer credit records found
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                          {searchQuery
                            ? `No records matching "${searchQuery}"`
                            : 'Issue credit sales from POS Billing or add farmer accounts to track receivables.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>

              {/* Sticky Summary Footer Row */}
              {filteredCustomers.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-100 dark:bg-slate-800 border-t-2 border-slate-300 dark:border-slate-700 font-bold text-slate-900 dark:text-white">
                    <td className="py-3 px-4" colSpan={2}>
                      TOTALS ({filteredCustomers.length} Accounts)
                    </td>
                    <td className="py-3 px-4 text-right font-mono">
                      ₹{formatCurrency(
                        filteredCustomers.reduce((s, c) => s + safeNumber(c.total_billed), 0),
                        2
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-amber-700 dark:text-amber-400">
                      ₹{formatCurrency(
                        filteredCustomers.reduce((s, c) => s + safeNumber(c.total_credit_billed), 0),
                        2
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-700 dark:text-emerald-400">
                      ₹{formatCurrency(
                        filteredCustomers.reduce((s, c) => s + safeNumber(c.total_repaid), 0),
                        2
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-rose-600 dark:text-rose-400 text-sm">
                      ₹{formatCurrency(
                        filteredCustomers.reduce((s, c) => s + safeNumber(c.outstanding_balance), 0),
                        2
                      )}
                    </td>
                    <td className="py-3 px-4" colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ─── TAB 2: SUPPLIER PAYABLES (ACCOUNTS PAYABLE) ────────────────────── */}
      {activeTab === 'suppliers' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col transition-colors">
          <div className="p-4 sm:p-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800">
            <div className="relative flex-1 min-w-0 max-w-xl">
              <label className="sr-only" htmlFor="supplierSearchInput">
                Search supplier or manufacturer
              </label>
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                <Search className="w-4 h-4" />
              </div>
              <input
                id="supplierSearchInput"
                type="text"
                value={supplierSearchQuery}
                onChange={(e) => setSupplierSearchQuery(e.target.value)}
                placeholder="Search supplier, manufacturer, or GSTIN..."
                className="w-full h-11 pl-10 pr-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs sm:text-sm transition-all"
              />
            </div>

            <button
              type="button"
              onClick={() => navigate('/purchases')}
              className="h-11 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs inline-flex items-center gap-2 shadow-sm transition-all active:scale-95 shrink-0"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Record Inward Stock</span>
            </button>
          </div>

          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Supplier / Manufacturer</th>
                  <th className="py-3 px-4">GSTIN &amp; Mobile</th>
                  <th className="py-3 px-4 text-right">Total Inward Value</th>
                  <th className="py-3 px-4 text-right">Disbursed / Paid</th>
                  <th className="py-3 px-4 text-right">Pending Payables</th>
                  <th className="py-3 px-4 text-center">Payment Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredSuppliers.map((s) => {
                  const pending = safeNumber(s.outstanding_balance, 0);
                  return (
                    <tr
                      key={s.supplier_name}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 flex items-center justify-center font-bold text-[11px] shrink-0">
                            <Truck className="w-3.5 h-3.5" />
                          </div>
                          <span>{s.supplier_name}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">
                        <div>{s.supplier_gstin || 'Unregistered'}</div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500">
                          {s.supplier_phone || '-'}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-medium text-slate-700 dark:text-slate-300">
                        ₹{formatCurrency(s.total_billed, 2)}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">
                        ₹{formatCurrency(s.total_paid, 2)}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-black text-rose-600 dark:text-rose-400 text-sm">
                        ₹{formatCurrency(pending, 2)}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border inline-block ${
                            pending > 0
                              ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                          }`}
                        >
                          {pending > 0 ? 'Dues Pending' : 'Paid in Full'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        {pending > 0 && isOwner && (
                          <button
                            type="button"
                            onClick={() => {
                              setPaymentModal({
                                ledger_type: 'SUPPLIER',
                                party_name: s.supplier_name,
                                party_phone: s.supplier_phone || undefined,
                                party_gstin: s.supplier_gstin || undefined,
                                suggested_amount: pending,
                              });
                              setPaymentAmount(String(pending));
                            }}
                            className="px-2.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-bold text-[11px] inline-flex items-center gap-1 shadow-sm"
                          >
                            <IndianRupee className="w-3 h-3" />
                            <span>Disburse</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {!loading && filteredSuppliers.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 dark:text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Truck className="w-8 h-8 stroke-1 text-slate-300 dark:text-slate-600" />
                        <p className="font-semibold text-slate-600 dark:text-slate-400 text-sm">
                          No supplier payables records found
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                          Record inward purchase bills to track accounts payable to distributors.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── TAB 3: AGRI INSPECTOR REGISTER (FORM O) ────────────────────────── */}
      {activeTab === 'compliance' && (
        <div className="space-y-6">
          {complianceData ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-6 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    <span>{complianceData.shop_name} — Form O Register &amp; Stock Board</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Statutory register under Fertilizer (Inorganic, Organic or Mixed) (Control) Order, 1985
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handlePrintRegister}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl inline-flex items-center gap-2 shadow-sm transition"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Form O Register</span>
                </button>
              </div>

              {/* License Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs font-mono">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block">
                    Fertilizer License (FCO)
                  </span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {complianceData.fertilizer_license_no || 'FERT-OK'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block">
                    Pesticide License (CIB)
                  </span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {complianceData.pesticide_license_no || 'PEST-2026'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block">
                    GSTIN Registration
                  </span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {complianceData.gstin || '29AAAAA0000A1Z5'}
                  </span>
                </div>
              </div>

              {/* Stock-cum-Price Board */}
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  1. Statutory Stock-Cum-Price Board (Fertilizers &amp; Nutrients)
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                      <tr>
                        <th className="py-2.5 px-3">Product Name &amp; Grade</th>
                        <th className="py-2.5 px-3">Manufacturer</th>
                        <th className="py-2.5 px-3 text-right">Available Stock</th>
                        <th className="py-2.5 px-3 text-right">Statutory Max Price (MRP)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {(complianceData.stock_cum_price_board || []).map((p: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                          <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200">
                            {p.product_name}
                          </td>
                          <td className="py-2 px-3 text-slate-500 dark:text-slate-400">
                            {p.company_name || 'Standard Manufacturer'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">
                            {p.stock_quantity} {p.unit || 'Bags'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-900 dark:text-white">
                            ₹{formatCurrency(p.mrp, 2)}
                          </td>
                        </tr>
                      ))}
                      {(complianceData.stock_cum_price_board || []).length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-6 text-center text-slate-400">
                            No fertilizer items currently in stock register.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 p-12 text-center rounded-2xl border border-slate-200 dark:border-slate-800">
              <ShieldCheck className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="font-semibold text-slate-600 dark:text-slate-400 text-sm">
                Loading statutory compliance records...
              </p>
            </div>
          )}
        </div>
      )}

      {/* ─── SECTION 5: STATUTORY FORM O & REGULATORY NOTICE BAR ────────────── */}
      <div className="bg-sky-50/70 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/80 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-colors">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-sky-100 dark:bg-sky-900 text-sky-800 dark:text-sky-300 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-xs sm:text-sm text-sky-900 dark:text-sky-100">
              Statutory Fertilizer Control Order (FCO 1985) &amp; Aadhaar Compliance Register
            </h4>
            <p className="text-[11px] sm:text-xs text-sky-700 dark:text-sky-300 leading-relaxed mt-0.5">
              All credit invoices and cash receipts comply with State Agriculture Department verification standards. Batch-wise sale ledgers are maintained automatically.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handlePrintRegister}
          className="h-10 px-4 rounded-xl bg-white dark:bg-slate-800 hover:bg-sky-100 dark:hover:bg-slate-700 text-sky-900 dark:text-sky-100 border border-sky-200 dark:border-sky-700 font-bold text-xs inline-flex items-center gap-1.5 shadow-sm transition-all shrink-0"
        >
          <Printer className="w-4 h-4" />
          <span>Print Register</span>
        </button>
      </div>

      {/* ─── PAYMENT RECORDING MODAL ────────────────────────────────────────── */}
      {paymentModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="payment-modal-title"
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in"
        >
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 id="payment-modal-title" className="font-black text-slate-900 dark:text-white text-base">
                  {paymentModal.ledger_type === 'CUSTOMER' ? 'Record Farmer Payment' : 'Record Supplier Payout'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Party: <strong className="text-slate-800 dark:text-slate-200">{paymentModal.party_name}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPaymentModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                aria-label="Close payment modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div>
                <label htmlFor="paymentAmountInput" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Payment Amount (₹) *
                </label>
                <input
                  id="paymentAmountInput"
                  type="number"
                  step="any"
                  min="0.01"
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-base font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <span className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Payment Mode *
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {(['CASH', 'UPI', 'BANK'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setPaymentMode(mode)}
                      className={`h-10 rounded-xl font-bold text-xs border transition-all ${
                        paymentMode === mode
                          ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="paymentNotesInput" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Notes / Receipt Reference (Optional)
                </label>
                <input
                  id="paymentNotesInput"
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="e.g. UTR / Receipt # / Cheque no"
                  className="w-full h-10 px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPaymentModal(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md transition active:scale-95"
                >
                  {loading ? 'Recording...' : 'Confirm & Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── AUDIT PACK MODAL ──────────────────────────────────────────────── */}
      {isAuditPackOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="audit-pack-title"
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in"
        >
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h3 id="audit-pack-title" className="font-black text-slate-900 dark:text-white text-base">
                  Form O Audit Pack
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAuditPackOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                aria-label="Close audit pack modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              This statutory audit pack collates current stock balances, batch registers, and retail price notifications required for annual Quality Control audits by the Department of Agriculture.
            </p>

            <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Stock-cum-Price Board:</span>
                <span className="font-bold text-emerald-700 dark:text-emerald-400">Generated</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Batch-wise Sales Register:</span>
                <span className="font-bold text-emerald-700 dark:text-emerald-400">Verified</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Aadhaar Subsidy Trace:</span>
                <span className="font-bold text-emerald-700 dark:text-emerald-400">Audited</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAuditPackOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAuditPackOpen(false);
                  handlePrintRegister();
                }}
                className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-md transition inline-flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Print Official Pack</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
