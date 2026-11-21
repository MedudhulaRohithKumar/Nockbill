import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Users,
  Truck,
  Sparkles,
  Clock,
  ShieldCheck,
  Search,
  IndianRupee,
  Share2,
  CheckCircle2,
  AlertCircle,
  Printer,
  Percent,
  PackagePlus,
  X,
} from 'lucide-react';
import { khataApi, productsApi, getErrorMessage } from '../api';
import { useShop } from '../context/ShopContext';
import { useAuth } from '../context/AuthContext';
import { Product } from '../types';
import {
  formatCurrency,
  safeNumber,
  buildWhatsAppKhataReminderUrl,
} from '../utils/formatters';

type KhataTab = 'farmers' | 'suppliers' | 'catalog' | 'handover' | 'compliance';

export const KhataPage: React.FC = () => {
  const { settings } = useShop();
  const { user } = useAuth();
  const isOwner = (user?.role || '').toLowerCase() === 'owner';

  const [activeTab, setActiveTab] = useState<KhataTab>('farmers');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // 1. Farmer Khata State
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyDue, setOnlyDue] = useState(false);
  const [totalOutstandingUdhar, setTotalOutstandingUdhar] = useState(0);
  const [customers, setCustomers] = useState<any[]>([]);

  // 2. Supplier Khata State
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

  // 3. Master Agri Catalog & Expiry Clearance State
  const [catalogTemplates, setCatalogTemplates] = useState<any[]>([]);
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [expiringProducts, setExpiringProducts] = useState<Product[]>([]);
  const [discountPercent, setDiscountPercent] = useState<number>(15);

  // 4. Cashier Shift Handover State
  const [shiftDate, setShiftDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [shiftData, setShiftData] = useState<{
    total_net_cash_in_drawer: number;
    cashiers: any[];
  }>({ total_net_cash_in_drawer: 0, cashiers: [] });

  // 5. Agri Inspector Compliance Register State
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
      setError(getErrorMessage(err, 'Failed to load Farmer Khata ledger.'));
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
      setError(getErrorMessage(err, 'Failed to load Supplier Khata ledger.'));
    } finally {
      setLoading(false);
    }
  };

  const loadCatalogAndExpiring = async () => {
    setLoading(true);
    setError(null);
    try {
      const [tplRes, allProducts] = await Promise.all([
        khataApi.getCatalogTemplates(),
        productsApi.getAll().catch(() => []),
      ]);
      const tpls = tplRes.templates || [];
      setCatalogTemplates(tpls);
      setSelectedCodes(tpls.map((t: any) => t.code));

      const now = Date.now();
      const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
      const nearExp = (Array.isArray(allProducts) ? allProducts : []).filter((p) => {
        if (!p.expiry_date || safeNumber(p.current_stock, 0) <= 0) return false;
        const expTime = new Date(p.expiry_date).getTime();
        return !Number.isNaN(expTime) && expTime - now <= ninetyDaysMs;
      });
      setExpiringProducts(nearExp);
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to load catalog & expiry queue.'));
    } finally {
      setLoading(false);
    }
  };

  const loadShiftHandover = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await khataApi.getShiftHandover(shiftDate || undefined);
      setShiftData({
        total_net_cash_in_drawer: safeNumber(res.total_net_cash_in_drawer, 0),
        cashiers: res.cashiers || [],
      });
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to load Cashier Shift Handover summary.'));
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
    else if (activeTab === 'catalog') void loadCatalogAndExpiring();
    else if (activeTab === 'handover') void loadShiftHandover();
    else if (activeTab === 'compliance') void loadComplianceRegister();
  }, [activeTab, onlyDue, shiftDate]);

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
      setError(getErrorMessage(err, 'Failed to record Khata payment.'));
    } finally {
      setLoading(false);
    }
  };

  const handleImportCatalog = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await khataApi.importCatalog(selectedCodes);
      setSuccessMsg(
        `Imported ${res.imported_count} Agri Products into your inventory (${res.skipped_count} already existed).`,
      );
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to import Master Agri Catalog.'));
    } finally {
      setLoading(false);
    }
  };

  const handleApplyClearance = async (productId: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await khataApi.applyExpiryClearance(productId, discountPercent);
      setSuccessMsg(
        `Applied ${res.discount_percent}% clearance discount on ${res.product_name} → New Selling Price: ₹${formatCurrency(res.new_selling_price)}`,
      );
      setTimeout(() => setSuccessMsg(null), 4000);
      await loadCatalogAndExpiring();
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to apply clearance discount.'));
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
            <span>Khata Ledger, Onboarding &amp; Compliance Hub</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Farmer Udhar credit recovery, WhatsApp payment reminders, 1-click product onboarding, shift handover &amp; Form O compliance
          </p>
        </div>

        {successMsg && (
          <div className="bg-emerald-100 text-emerald-900 text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('farmers')}
          className={`px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
            activeTab === 'farmers'
              ? 'bg-brand-800 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Farmer Khata (Udhar)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('suppliers')}
          className={`px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
            activeTab === 'suppliers'
              ? 'bg-brand-800 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>Supplier Khata (Payables)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('catalog')}
          className={`px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
            activeTab === 'catalog'
              ? 'bg-brand-800 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>1-Click Agri Catalog &amp; Expiry Clearance</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('handover')}
          className={`px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
            activeTab === 'handover'
              ? 'bg-brand-800 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Cashier Shift Handover</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('compliance')}
          className={`px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
            activeTab === 'compliance'
              ? 'bg-brand-800 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Agri Inspector Register (Form O)</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold px-4 py-3 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* =====================================================================
          TAB 1: FARMER KHATA (UDHAR / CREDIT LEDGER)
      ===================================================================== */}
      {activeTab === 'farmers' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-bold uppercase text-slate-400">Total Pending Farmer Udhar</span>
              <p className="text-2xl font-black text-amber-700 mt-1">
                ₹{formatCurrency(totalOutstandingUdhar)}
              </p>
            </div>
            <div className="sm:col-span-2 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  id="khata-farmer-search"
                  aria-label="Search farmers by name, phone, or village"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void loadCustomers();
                  }}
                  placeholder="Search farmer name, mobile, or village..."
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl"
                />
              </div>
              <label htmlFor="khata-only-due" className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                <input
                  id="khata-only-due"
                  type="checkbox"
                  checked={onlyDue}
                  onChange={(e) => setOnlyDue(e.target.checked)}
                  className="rounded text-brand-700"
                />
                <span>Only Pending Udhar</span>
              </label>
              <button
                type="button"
                onClick={() => { void loadCustomers(); }}
                className="px-4 py-2 bg-brand-700 hover:bg-brand-800 text-white rounded-xl text-xs font-bold"
              >
                Search
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
                  <th className="py-3 px-4 text-right">Pending Udhar</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.map((c) => {
                  const due = safeNumber(c.outstanding_balance, 0);
                  const waReminderUrl = buildWhatsAppKhataReminderUrl(
                    c.customer_phone,
                    c.customer_name,
                    due,
                    settings,
                  );
                  return (
                    <tr key={c.customer_key} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {c.customer_name}
                        <span className="block text-[10px] font-normal text-slate-400">
                          {c.bill_count} bills
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        <div className="font-mono font-semibold">{c.customer_phone || '-'}</div>
                        {c.customer_address && (
                          <div className="text-[11px] text-slate-400">{c.customer_address}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono">
                        ₹{formatCurrency(c.total_billed)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-700">
                        ₹{formatCurrency(c.total_credit_billed)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-emerald-700 font-semibold">
                        ₹{formatCurrency(c.total_repaid)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-black">
                        <span className={due > 0 ? 'text-amber-700' : 'text-emerald-700'}>
                          ₹{formatCurrency(due)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setPaymentModal({
                                ledger_type: 'CUSTOMER',
                                party_name: c.customer_name,
                                party_phone: c.customer_phone || undefined,
                                party_gstin: c.customer_gstin || undefined,
                                suggested_amount: due,
                              });
                              setPaymentAmount(due > 0 ? String(due) : '');
                            }}
                            className="px-2.5 py-1.5 bg-brand-700 hover:bg-brand-800 text-white rounded-lg font-bold flex items-center gap-1"
                          >
                            <IndianRupee className="w-3.5 h-3.5" />
                            <span>Collect</span>
                          </button>
                          {due > 0 && (
                            <a
                              href={waReminderUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold inline-flex items-center gap-1"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                              <span>WhatsApp Reminder</span>
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
                      No customer Khata records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2: SUPPLIER KHATA (ACCOUNTS PAYABLE)
      ===================================================================== */}
      {activeTab === 'suppliers' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase text-slate-400">
                Total Distributor / Supplier Payable
              </span>
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
          TAB 3: 1-CLICK AGRI CATALOG ONBOARDING & EXPIRY CLEARANCE
      ===================================================================== */}
      {activeTab === 'catalog' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs">
          {/* Left: 1-Click Master Agri Catalog Import */}
          <div className="lg:col-span-7 bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <PackagePlus className="w-4 h-4 text-brand-700" />
                  <span>1-Click Master Agri Catalog Onboarding ({catalogTemplates.length} SKUs)</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Pre-loaded top Indian Fertilizers, Pesticides, Seeds &amp; Micronutrients with HSN codes &amp; GST rates.
                </p>
              </div>
              {isOwner && (
                <button
                  type="button"
                  disabled={loading || selectedCodes.length === 0}
                  onClick={() => { void handleImportCatalog(); }}
                  className="px-4 py-2.5 bg-brand-700 hover:bg-brand-800 text-white font-bold rounded-xl shadow-sm shrink-0"
                >
                  Import Selected ({selectedCodes.length})
                </button>
              )}
            </div>

            <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
              {catalogTemplates.map((tpl) => {
                const checked = selectedCodes.includes(tpl.code);
                const inputId = `tpl-check-${tpl.code}`;
                return (
                  <label
                    key={tpl.code}
                    htmlFor={inputId}
                    className="py-2.5 px-2 flex items-center justify-between gap-3 hover:bg-slate-50 rounded-lg cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        id={inputId}
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedCodes((prev) => [...prev, tpl.code]);
                          } else {
                            setSelectedCodes((prev) => prev.filter((c) => c !== tpl.code));
                          }
                        }}
                        className="rounded text-brand-700"
                      />
                      <div>
                        <p className="font-bold text-slate-900">{tpl.product_name}</p>
                        <p className="text-[11px] text-slate-500">
                          {tpl.company_name} • {tpl.category} • HSN: {tpl.hsn_code} • GST {tpl.gst_rate}%
                        </p>
                      </div>
                    </div>
                    <div className="text-right font-mono shrink-0">
                      <span className="font-bold text-slate-900">₹{tpl.selling_price}</span>
                      <span className="block text-[10px] text-slate-400">
                        {tpl.initial_stock} {tpl.unit}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Right: Expiry Liquidation & Clearance Discount Center */}
          <div className="lg:col-span-5 bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Percent className="w-4 h-4 text-amber-600" />
                <span>90-Day Expiry Clearance Action Center</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Apply a 1-click clearance discount to fast-liquidate near-expiry stock at POS before it expires.
              </p>
            </div>

            <div className="flex items-center justify-between gap-3 bg-amber-50 p-3 rounded-xl border border-amber-200">
              <label htmlFor="clearance-discount-pct" className="font-bold text-amber-900">
                Clearance Discount (%):
              </label>
              <input
                id="clearance-discount-pct"
                type="number"
                min={5}
                max={75}
                value={discountPercent}
                onChange={(e) => setDiscountPercent(Number.parseInt(e.target.value, 10) || 10)}
                className="w-20 px-2.5 py-1.5 border border-amber-300 rounded-lg font-mono font-bold text-right bg-white"
              />
            </div>

            <div className="divide-y divide-slate-100 max-h-[340px] overflow-y-auto">
              {expiringProducts.map((p) => (
                <div key={p.id} className="py-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-slate-900">{p.product_name || p.name}</p>
                    <p className="text-[11px] text-slate-500 font-mono">
                      Exp: <strong className="text-red-600">{p.expiry_date}</strong> • Stock: {p.current_stock} {p.unit}
                    </p>
                    <p className="text-[11px] text-slate-600">
                      Current Price: <strong>₹{formatCurrency(p.selling_price)}</strong>
                    </p>
                  </div>
                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => { void handleApplyClearance(p.id); }}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-[11px] shrink-0"
                    >
                      Apply -{discountPercent}%
                    </button>
                  )}
                </div>
              ))}
              {expiringProducts.length === 0 && (
                <p className="py-8 text-center text-slate-400">
                  No products expiring within the next 90 days.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 4: CASHIER SHIFT HANDOVER SUMMARY
      ===================================================================== */}
      {activeTab === 'handover' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-bold uppercase text-slate-400">
                Total Net Cash Expected in Drawer (Sales Cash + Khata Cash Collected)
              </span>
              <p className="text-2xl font-black text-emerald-700 mt-1">
                ₹{formatCurrency(shiftData.total_net_cash_in_drawer)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="shift-handover-date" className="text-xs font-bold text-slate-700">
                Shift Date:
              </label>
              <input
                id="shift-handover-date"
                type="date"
                value={shiftDate}
                onChange={(e) => setShiftDate(e.target.value)}
                className="px-3 py-1.5 text-xs border border-slate-300 rounded-xl"
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">IAM User / Cashier</th>
                  <th className="py-3 px-4 text-center">Bills</th>
                  <th className="py-3 px-4 text-right">Cash Sales</th>
                  <th className="py-3 px-4 text-right">UPI Sales</th>
                  <th className="py-3 px-4 text-right">Credit (Udhar)</th>
                  <th className="py-3 px-4 text-right">Khata Cash In</th>
                  <th className="py-3 px-4 text-right">Net Drawer Cash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shiftData.cashiers.map((c) => (
                  <tr key={c.user_id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {c.name}
                      <span className="ml-2 font-mono text-[11px] text-brand-700">({c.username})</span>
                    </td>
                    <td className="py-3 px-4 text-center font-bold">{c.bills_count}</td>
                    <td className="py-3 px-4 text-right font-mono">₹{formatCurrency(c.cash_sales)}</td>
                    <td className="py-3 px-4 text-right font-mono">₹{formatCurrency(c.upi_sales)}</td>
                    <td className="py-3 px-4 text-right font-mono text-amber-700">
                      ₹{formatCurrency(c.credit_sales_issued)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-700">
                      ₹{formatCurrency(c.khata_cash_collected)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-black text-emerald-800">
                      ₹{formatCurrency(c.net_cash_in_drawer)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 5: AGRICULTURE INSPECTOR COMPLIANCE REGISTER (FORM O)
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
          MODAL: RECORD KHATA REPAYMENT / SUPPLIER PAYOUT
      ===================================================================== */}
      {paymentModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {paymentModal.ledger_type === 'CUSTOMER'
                  ? `Collect Farmer Udhar: ${paymentModal.party_name}`
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
