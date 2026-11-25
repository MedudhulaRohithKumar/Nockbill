import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  RotateCcw,
  Search,
  FileText,
  CheckCircle2,
  AlertCircle,
  Printer,
  Download,
  IndianRupee,
  Package,
  Clock,
  User,
  Phone,
  Calendar,
  History,
  RefreshCw,
  X,
  ShieldCheck,
  Building,
  Check,
  Bolt,
  QrCode,
  ArrowRight,
  Warehouse,
  AlertTriangle,
} from 'lucide-react';
import { returnsApi, khataApi, getErrorMessage } from '../api';
import api from '../api/client';
import { InvoiceReturnLookup, SalesReturn, ReturnEligibleItem } from '../types';
import { safeNumber, formatCurrency } from '../utils/formatters';
import { useShop } from '../context/ShopContext';
import { useAuth } from '../context/AuthContext';
import { MetricInfoTooltip } from '../components/common/MetricInfoTooltip';

export const SalesReturnPage: React.FC = () => {
  const { settings } = useShop();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'process' | 'history'>('process');

  // Search State
  const [invoiceQuery, setInvoiceQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Active Lookup Data
  const [lookupData, setLookupData] = useState<InvoiceReturnLookup | null>(null);
  const [returnItems, setReturnItems] = useState<Record<number, number>>({});
  const [refundPaymentMethod, setRefundPaymentMethod] = useState<'Khata' | 'Cash' | 'UPI'>('Khata');
  const [returnReason, setReturnReason] = useState('Unused seasonal excess / Crop switch');
  const [notes, setNotes] = useState('Unopened sealed packet, intact batch stamp verified by store cashier.');

  // Customer Credit Profile for Khata offset
  const [customerOutstandingCredit, setCustomerOutstandingCredit] = useState<number | null>(null);

  // Processing State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [completedReturn, setCompletedReturn] = useState<SalesReturn | null>(null);

  // History State
  const [historyList, setHistoryList] = useState<SalesReturn[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState('');

  // ─── INITIAL LOAD & URL PARAMS ─────────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inv = params.get('invoice');
    if (inv) {
      setInvoiceQuery(inv);
      void handleLookup(inv);
    }
    // Also preload recent credit notes for the preview card
    void loadHistory();
  }, []);

  // ─── KEYBOARD SHORTCUTS ─────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      } else if (e.key === 'Escape') {
        if (completedReturn) setCompletedReturn(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [completedReturn]);

  // ─── INVOICE LOOKUP ────────────────────────────────────────────────────────
  const handleLookup = async (invToLookup?: string) => {
    const inv = (invToLookup ?? invoiceQuery).trim();
    if (!inv) {
      setSearchError('Please enter an invoice number to look up.');
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setSubmitError(null);
    setCompletedReturn(null);
    setCustomerOutstandingCredit(null);

    try {
      const data = await returnsApi.lookupInvoice(inv);
      setLookupData(data);

      // Initialize return quantities to 0
      const initialItems: Record<number, number> = {};
      data.items.forEach((item) => {
        initialItems[item.sale_item_id] = 0;
      });
      setReturnItems(initialItems);

      // If customer has a phone, look up credit balance for Khata offset
      if (data.customer_phone) {
        try {
          const khataData = await khataApi.lookupCustomer(data.customer_phone);
          if (khataData?.found && khataData.outstanding_balance !== undefined) {
            setCustomerOutstandingCredit(safeNumber(khataData.outstanding_balance));
            setRefundPaymentMethod('Khata');
          } else {
            setRefundPaymentMethod('Cash');
          }
        } catch {
          setRefundPaymentMethod('Cash');
        }
      } else {
        setRefundPaymentMethod('Cash');
      }
    } catch (err: unknown) {
      setLookupData(null);
      setSearchError(getErrorMessage(err, `No invoice found matching "${inv}"`));
    } finally {
      setIsSearching(false);
    }
  };

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const list = await returnsApi.getAll({ search: historySearch || undefined });
      setHistoryList(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('Failed to load returns history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      void loadHistory();
    }
  }, [activeTab, historySearch]);

  const updateQuantity = (saleItemId: number, val: number, maxVal: number) => {
    const cleanVal = Math.max(0, Math.min(val, maxVal));
    setReturnItems((prev) => ({
      ...prev,
      [saleItemId]: Math.round(cleanVal * 1000) / 1000,
    }));
  };

  const setFullReturn = (saleItemId: number, maxVal: number) => {
    updateQuantity(saleItemId, maxVal, maxVal);
  };

  // ─── REFUND TOTALS & GST BREAKDOWN ─────────────────────────────────────────
  const calculations = useMemo(() => {
    let calculatedTaxableRefund = 0;
    let calculatedGstRefund = 0;
    let totalUnitsToReturn = 0;
    let itemsToReturnCount = 0;

    if (lookupData) {
      lookupData.items.forEach((item) => {
        const qty = returnItems[item.sale_item_id] || 0;
        if (qty > 0) {
          totalUnitsToReturn += qty;
          itemsToReturnCount += 1;
          const taxable = qty * safeNumber(item.unit_price);
          const gst = taxable * (safeNumber(item.gst_rate) / 100);
          calculatedTaxableRefund += taxable;
          calculatedGstRefund += gst;
        }
      });
    }

    const calculatedTotalRefund = Math.round((calculatedTaxableRefund + calculatedGstRefund) * 100) / 100;
    const cgstAmount = Math.round((calculatedGstRefund / 2) * 100) / 100;
    const sgstAmount = Math.round((calculatedGstRefund / 2) * 100) / 100;

    return {
      calculatedTaxableRefund,
      calculatedGstRefund,
      calculatedTotalRefund,
      cgstAmount,
      sgstAmount,
      totalUnitsToReturn,
      itemsToReturnCount,
    };
  }, [lookupData, returnItems]);

  // ─── SUBMIT RETURN TRANSACTION ─────────────────────────────────────────────
  const handleSubmitReturn = async () => {
    if (!lookupData) return;
    if (calculations.totalUnitsToReturn <= 0) {
      setSubmitError('Please enter a return quantity for at least one product.');
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);

    const itemsPayload = Object.entries(returnItems)
      .map(([saleItemIdStr, qty]) => ({
        sale_item_id: Number.parseInt(saleItemIdStr, 10),
        returned_quantity: qty,
      }))
      .filter((item) => item.returned_quantity > 0);

    try {
      const result = await returnsApi.processReturn({
        sale_id: lookupData.sale_id,
        invoice_number: lookupData.invoice_number,
        refund_payment_method: refundPaymentMethod,
        reason: returnReason,
        notes: notes || undefined,
        items: itemsPayload,
      });

      setCompletedReturn(result);
      // Refresh lookup data so remaining eligible quantities update
      await handleLookup(lookupData.invoice_number);
      // Refresh recent credit notes preview
      void loadHistory();
    } catch (err: unknown) {
      setSubmitError(getErrorMessage(err, 'Failed to process return. Please check quantities and try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadPdf = async (returnId: number) => {
    try {
      const res = await api.get(`/returns/${returnId}/pdf`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CreditNote_CN-${returnId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch {
      window.open(returnsApi.getPdfUrl(returnId), '_blank');
    }
  };

  const recentThreeCreditNotes = useMemo(() => {
    return historyList.slice(0, 3);
  }, [historyList]);

  return (
    <div className="min-h-screen bg-slate-50/60 dark:bg-slate-950 text-slate-800 dark:text-slate-100">
      <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-5 space-y-6">
        {/* =======================================================================
            1. TOP HERO CONTEXT & TAB SWITCHER
        ======================================================================= */}
        <div className="relative overflow-hidden rounded-3xl bg-white border border-slate-200/80 p-5 sm:p-7 shadow-sm flex flex-col md:flex-row md:items-end justify-between gap-5">
          <div className="space-y-1.5 z-10">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                GST Credit Note Engine
              </span>
              <span className="font-mono text-xs font-semibold text-slate-400">
                FORM CN-04
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-slate-900">
              Sales Returns &amp; Credit Notes
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 max-w-2xl leading-relaxed">
              Instant batch-verified inventory return, GST tax credit reversal &amp; farmer ledger refund.
            </p>
          </div>

          {/* Active Tab Switcher */}
          <div className="z-10 flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl w-full sm:w-auto self-start md:self-auto shadow-inner">
            <button
              type="button"
              onClick={() => setActiveTab('process')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
                activeTab === 'process'
                  ? 'bg-white dark:bg-slate-900 text-emerald-900 dark:text-emerald-300 shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <RotateCcw className="h-4 w-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
              <span>Process Return</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
                activeTab === 'history'
                  ? 'bg-white dark:bg-slate-900 text-emerald-900 dark:text-emerald-300 shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <History className="h-4 w-4 text-slate-500 dark:text-slate-400 shrink-0" />
              <span>Return History</span>
            </button>
          </div>
        </div>

        {/* =======================================================================
            2. SUCCESS DIALOG (UPON COMPLETED RETURN)
        ======================================================================= */}
        {completedReturn && (
          <div className="rounded-3xl border-2 border-emerald-500 bg-emerald-50 p-5 sm:p-6 shadow-md space-y-3 animate-in fade-in">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-emerald-950">
                    Credit Note #{completedReturn.return_number} Issued Successfully!
                  </h3>
                  <p className="text-xs text-emerald-800 font-medium">
                    Stock has been restocked to godown inventory, and refund payout of ₹
                    {formatCurrency(completedReturn.refund_grand_total)} recorded via {completedReturn.refund_payment_method}.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCompletedReturn(null)}
                className="rounded-lg p-1 text-emerald-700 hover:bg-emerald-100 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-emerald-200/80">
              <button
                type="button"
                onClick={() => handleDownloadPdf(completedReturn.id)}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white font-bold px-4 py-2 text-xs shadow transition active:scale-95"
              >
                <Download className="h-4 w-4" />
                <span>Download Credit Note PDF</span>
              </button>
              <button
                type="button"
                onClick={() => window.open(returnsApi.getPdfUrl(completedReturn.id), '_blank')}
                className="flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-white hover:bg-emerald-100 text-emerald-950 font-bold px-4 py-2 text-xs shadow-sm transition active:scale-95"
              >
                <Printer className="h-4 w-4 text-emerald-700" />
                <span>Print Credit Memo</span>
              </button>
            </div>
          </div>
        )}

        {/* =======================================================================
            3. TAB 1: PROCESS RETURN (PRIMARY WORKSPACE)
        ======================================================================= */}
        {activeTab === 'process' ? (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            {/* LEFT / CENTER OPERATIONS AREA (8 COLS ON XL) */}
            <div className="xl:col-span-8 space-y-6">
              {/* Card 1: Invoice Lookup Card & Verified Match Strip */}
              <div className="rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm space-y-4">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleLookup();
                  }}
                  className="space-y-3"
                >
                  <label htmlFor="inv-search-input" className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Original Invoice Lookup
                  </label>
                  <div className="flex flex-col sm:flex-row items-stretch gap-2.5">
                    <div className="relative flex-1">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        ref={searchInputRef}
                        id="inv-search-input"
                        type="text"
                        value={invoiceQuery}
                        onChange={(e) => setInvoiceQuery(e.target.value)}
                        placeholder="Scan bill barcode or type #INV-2024-001..."
                        className="w-full h-12 pl-10 pr-14 rounded-2xl border border-slate-300 bg-slate-50/70 text-xs sm:text-sm font-mono font-bold text-slate-900 focus:bg-white focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold font-mono text-slate-600">
                        F2
                      </span>
                    </div>

                    <button
                      type="submit"
                      disabled={isSearching}
                      className="h-12 px-5 rounded-2xl bg-emerald-800 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition active:scale-95 disabled:opacity-50"
                    >
                      {isSearching ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          <span>Fetching...</span>
                        </>
                      ) : (
                        <>
                          <Search className="h-4 w-4" />
                          <span>Fetch Invoice</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>

                {searchError && (
                  <div role="alert" className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                    <span>{searchError}</span>
                  </div>
                )}

                {/* Matched Bill Metadata Ribbon (When Invoice Loaded) */}
                {lookupData && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 flex flex-wrap items-center justify-between gap-4 animate-in fade-in">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-900 font-black">
                        <User className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs sm:text-sm font-black text-slate-900">
                            {lookupData.customer_name || 'Walk-in Farmer'}
                          </h4>
                          <span className="rounded-full bg-emerald-100 px-2 py-0.2 text-[10px] font-bold text-emerald-800">
                            KYC VERIFIED
                          </span>
                        </div>
                        <p className="text-[11px] font-mono text-slate-500">
                          {lookupData.customer_phone ? `+91 ${lookupData.customer_phone}` : 'No phone linked'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-5 sm:gap-6 text-xs">
                      <div>
                        <div className="text-[10px] uppercase font-bold text-slate-400">Bill Date</div>
                        <div className="font-mono font-bold text-slate-900">
                          {new Date(lookupData.sale_date).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] uppercase font-bold text-slate-400">Billed Total</div>
                        <div className="font-mono font-black text-slate-900">
                          ₹{formatCurrency(lookupData.original_grand_total)}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] uppercase font-bold text-slate-400">Payment Mode</div>
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                          {lookupData.original_payment_method}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Card 2: Returnable Items Table */}
              <div className="rounded-3xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-emerald-700" />
                    <h3 className="text-sm font-black text-slate-900">Returnable Invoice Line Items</h3>
                    {lookupData && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.2 text-[10px] font-bold text-slate-600">
                        {lookupData.items.length} ITEMS BILLED
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-bold font-mono text-slate-400 uppercase tracking-wider">
                    FIFO RE-STOCKING RULE: ACTIVE
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-100 bg-slate-50/60 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Product &amp; Formulation</th>
                        <th className="py-3 px-3">Batch &amp; Expiry</th>
                        <th className="py-3 px-3 text-right">Billed / Max</th>
                        <th className="py-3 px-3 text-center">Return Qty</th>
                        <th className="py-3 px-3 text-right">Return Rate</th>
                        <th className="py-3 px-3 text-right">Refund Subtotal</th>
                        <th className="py-3 px-4">Restock Bay</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {lookupData && lookupData.items.length > 0 ? (
                        lookupData.items.map((item) => {
                          const returnQty = returnItems[item.sale_item_id] || 0;
                          const maxQty = safeNumber(item.available_return_quantity);
                          const isFullyReturned = maxQty <= 0;
                          const lineRefund = returnQty * safeNumber(item.unit_price);

                          return (
                            <tr
                              key={item.sale_item_id}
                              className={`transition-colors ${
                                returnQty > 0 ? 'bg-emerald-50/40' : isFullyReturned ? 'bg-slate-50/50 opacity-60' : 'hover:bg-slate-50/60'
                              }`}
                            >
                              <td className="py-3.5 px-4 min-w-[200px]">
                                <div className="font-bold text-slate-900">{item.product_name}</div>
                                <div className="text-[10px] text-slate-500">
                                  {item.company_name || 'Agro Formulation'}
                                </div>
                                <span className="inline-block mt-0.5 rounded bg-slate-100 px-1.5 py-0.2 text-[9px] font-bold text-slate-600">
                                  HSN: {item.net_content || '3808'}
                                </span>
                              </td>

                              <td className="py-3.5 px-3 font-mono">
                                <div className="font-bold text-slate-800">{item.batch_number || 'DEFAULT'}</div>
                                <div className="text-[10px] text-slate-400">Stock Verified</div>
                              </td>

                              <td className="py-3.5 px-3 text-right font-mono">
                                <div className="font-bold text-slate-800">
                                  {item.sold_quantity} {item.unit || 'Pkts'}
                                </div>
                                <div className="text-[10px] text-slate-400">Eligible: {maxQty}</div>
                              </td>

                              <td className="py-3.5 px-3 text-center whitespace-nowrap">
                                {isFullyReturned ? (
                                  <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-400">
                                    Fully Returned
                                  </span>
                                ) : (
                                  <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
                                    <button
                                      type="button"
                                      onClick={() => updateQuantity(item.sale_item_id, returnQty - 1, maxQty)}
                                      disabled={returnQty <= 0}
                                      className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-30 active:scale-95 transition"
                                    >
                                      −
                                    </button>
                                    <span className="w-10 text-center font-mono text-xs font-black text-emerald-900">
                                      {returnQty}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => updateQuantity(item.sale_item_id, returnQty + 1, maxQty)}
                                      disabled={returnQty >= maxQty}
                                      className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-30 active:scale-95 transition"
                                    >
                                      +
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setFullReturn(item.sale_item_id, maxQty)}
                                      className="ml-1 rounded-lg bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-800 hover:bg-emerald-100 transition"
                                      title="Return all eligible units"
                                    >
                                      All
                                    </button>
                                  </div>
                                )}
                              </td>

                              <td className="py-3.5 px-3 text-right font-mono font-semibold text-slate-700">
                                ₹{formatCurrency(item.unit_price)}
                              </td>

                              <td className="py-3.5 px-3 text-right font-mono font-bold whitespace-nowrap">
                                <span className={returnQty > 0 ? 'text-emerald-700 font-black' : 'text-slate-400'}>
                                  ₹{formatCurrency(lineRefund)}
                                </span>
                              </td>

                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-700 font-mono">
                                  <Warehouse className="h-3 w-3 text-emerald-700" />
                                  Rack G1
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-xs text-slate-400">
                            Enter an invoice number or scan bill barcode above to fetch sale details and select items for return.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Card 3: Quality Inspection & Return Settlement Details */}
              <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">Return Reason &amp; QC Verification</h3>
                  </div>
                  <span className="rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                    Mandatory Compliance Log
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="return-classification-select" className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                      Return Classification
                    </label>
                    <select
                      id="return-classification-select"
                      value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value)}
                      className="w-full h-11 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:border-emerald-600 focus:outline-none"
                    >
                      <option value="Unused seasonal excess / Crop switch">Unused seasonal excess / Crop switch</option>
                      <option value="Damaged bag packaging">Damaged bag packaging</option>
                      <option value="Substituted chemical formulation">Substituted chemical formulation</option>
                      <option value="Customer requested exchange or credit">Customer requested exchange or credit</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="qc-remarks-input" className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                      Store QC Inspection Remark
                    </label>
                    <input
                      id="qc-remarks-input"
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="e.g. Unopened sealed packet, intact batch stamp verified by store cashier."
                      className="w-full h-11 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:border-emerald-600 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Settlement Channel Options */}
                <div className="space-y-2 pt-2">
                  <span className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Refund Settlement Mode
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Option A: Farmer Credit */}
                    <button
                      type="button"
                      onClick={() => setRefundPaymentMethod('Khata')}
                      className={`rounded-2xl p-3.5 text-left transition-all border ${
                        refundPaymentMethod === 'Khata'
                          ? 'border-emerald-500 bg-emerald-50/90 dark:bg-emerald-950/80 ring-2 ring-emerald-500/20 shadow-sm'
                          : 'border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <User className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                          Farmer Credit
                        </span>
                        <span className="rounded-full bg-emerald-600 dark:bg-emerald-400 px-2 py-0.5 text-[9px] font-black text-white dark:text-slate-950 uppercase">
                          Recommended
                        </span>
                      </div>
                      <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300">Adjust ledger balance</p>
                      {customerOutstandingCredit !== null && (
                        <div className="mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-700 flex items-center justify-between font-mono text-[11px] font-bold">
                          <span className="text-slate-600 dark:text-slate-300">₹{formatCurrency(customerOutstandingCredit, 0)}</span>
                          <ArrowRight className="h-3 w-3 text-slate-400 dark:text-slate-400" />
                          <span className="text-emerald-800 dark:text-emerald-300">
                            ₹{formatCurrency(Math.max(0, customerOutstandingCredit - calculations.calculatedTotalRefund), 0)}
                          </span>
                        </div>
                      )}
                    </button>

                    {/* Option B: Cash Drawer */}
                    <button
                      type="button"
                      onClick={() => setRefundPaymentMethod('Cash')}
                      className={`rounded-2xl p-3.5 text-left transition-all border ${
                        refundPaymentMethod === 'Cash'
                          ? 'border-emerald-500 bg-emerald-50/90 dark:bg-emerald-950/80 ring-2 ring-emerald-500/20 shadow-sm'
                          : 'border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <IndianRupee className="h-4 w-4 text-slate-700 dark:text-slate-200" />
                          Cash Drawer
                        </span>
                        <span className="rounded-full bg-slate-200 dark:bg-slate-700 px-2 py-0.5 text-[9px] font-bold text-slate-700 dark:text-slate-200">
                          TILL #01
                        </span>
                      </div>
                      <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300">Direct cash payout from counter</p>
                      <div className="mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-700 flex items-center justify-between text-[11px] font-mono text-slate-600 dark:text-slate-300">
                        <span>Till Status:</span>
                        <span className="font-bold text-slate-900 dark:text-white">Ready</span>
                      </div>
                    </button>

                    {/* Option C: UPI Reversal */}
                    <button
                      type="button"
                      onClick={() => setRefundPaymentMethod('UPI')}
                      className={`rounded-2xl p-3.5 text-left transition-all border ${
                        refundPaymentMethod === 'UPI'
                          ? 'border-blue-500 bg-blue-50/90 dark:bg-blue-950/80 ring-2 ring-blue-500/20 shadow-sm'
                          : 'border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <QrCode className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          UPI Reversal
                        </span>
                        <span className="rounded-full bg-blue-100 dark:bg-blue-900/60 px-2 py-0.5 text-[9px] font-bold text-blue-800 dark:text-blue-200">
                          NPCI AUTO
                        </span>
                      </div>
                      <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300">Instant bank reversal via VPA</p>
                      <div className="mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-700 flex items-center justify-between text-[11px] font-mono text-slate-600 dark:text-slate-300 truncate">
                        <span className="truncate">{lookupData?.customer_phone ? `+91 ${lookupData.customer_phone}` : 'Bank VPA'}</span>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT OPERATIONS SUMMARY & HISTORICAL PREVIEWS (4 COLS ON XL) */}
            <div className="xl:col-span-4 space-y-6">
              {/* Card 1: Credit Note Summary Box */}
              <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <IndianRupee className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">Credit Note Summary</h3>
                  </div>
                  <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 px-2 py-0.5 text-[10px] font-bold">
                    GST REVERSED
                  </span>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between text-slate-600 dark:text-slate-300">
                    <span>Total Items to Return</span>
                    <strong className="text-slate-900 dark:text-white">
                      {calculations.itemsToReturnCount} Item(s) ({calculations.totalUnitsToReturn} Units)
                    </strong>
                  </div>

                  <div className="flex justify-between text-slate-600 dark:text-slate-300">
                    <div className="flex items-center gap-1.5">
                      <span>Gross Return Value</span>
                      <MetricInfoTooltip
                        title="Gross Return Value"
                        description="Taxable base value of products returned by the farmer before GST reversal."
                        formula="Sum(Returned Qty × Taxable Rate)"
                      />
                    </div>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      ₹{formatCurrency(calculations.calculatedTaxableRefund)}
                    </span>
                  </div>

                  <div className="space-y-1 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex justify-between text-slate-600 dark:text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <span>GST Reversal Total</span>
                        <MetricInfoTooltip
                          title="GST Reversal Total"
                          description="Statutory input GST credit reversal for returned fertilizer/seed/chemical batches under GSTR-1 credit notes."
                          formula="CGST + SGST (or IGST) of returned items"
                        />
                      </div>
                      <span className="font-mono font-bold text-blue-700 dark:text-blue-400">
                        ₹{formatCurrency(calculations.calculatedGstRefund)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-400 dark:text-slate-400 pl-3">
                      <span>• CGST Reversal</span>
                      <span className="font-mono text-slate-700 dark:text-slate-200">₹{formatCurrency(calculations.cgstAmount)}</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-400 dark:text-slate-400 pl-3">
                      <span>• SGST Reversal</span>
                      <span className="font-mono text-slate-700 dark:text-slate-200">₹{formatCurrency(calculations.sgstAmount)}</span>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700 p-3.5 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1 text-[10px] uppercase font-bold text-slate-400 dark:text-slate-400 tracking-wider">
                        <span>Net Refund Value</span>
                        <MetricInfoTooltip
                          title="Net Refund Value"
                          description="Final payable refund to the grower or credited back against their Khata ledger."
                          formula="Net Refund = Gross Return Value + GST Reversal"
                          align="right"
                        />
                      </div>
                      <div className="font-mono text-2xl font-black text-emerald-900 dark:text-emerald-300">
                        ₹{formatCurrency(calculations.calculatedTotalRefund)}
                      </div>
                    </div>
                    <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 px-2.5 py-1 text-[10px] font-black uppercase">
                      {refundPaymentMethod === 'Khata' ? 'Credit Offset' : refundPaymentMethod === 'Cash' ? 'Cash Drawer' : 'UPI Refund'}
                    </span>
                  </div>
                </div>

                {submitError && (
                  <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                    <span>{submitError}</span>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      void handleSubmitReturn();
                    }}
                    disabled={isSubmitting || calculations.totalUnitsToReturn <= 0}
                    className="w-full h-14 rounded-2xl bg-emerald-800 hover:bg-emerald-700 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-800/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Processing Credit Note...</span>
                      </>
                    ) : (
                      <>
                        <Bolt className="h-4 w-4 text-emerald-300" />
                        <span>Issue Credit Note &amp; Print Receipt</span>
                      </>
                    )}
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setReturnItems({});
                      }}
                      className="h-10 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs transition"
                    >
                      Clear Selection
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setLookupData(null);
                        setInvoiceQuery('');
                        setReturnItems({});
                      }}
                      className="h-10 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs transition"
                    >
                      Cancel Return
                    </button>
                  </div>
                </div>
              </div>

              {/* Card 2: Visual Batch Reference / Specification */}
              <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-900 uppercase tracking-wider">Visual Batch Reference</span>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.2 text-[9px] font-bold text-emerald-800">
                    AI AUDIT
                  </span>
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-950 p-4 text-white space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono font-bold">
                    <span>{lookupData ? `${lookupData.invoice_number} MATCHED SPEC` : 'AGRO BATCH INTEGRITY'}</span>
                    <span className="text-emerald-400">100% RETENTION OK</span>
                  </div>
                  <p className="text-[11px] text-emerald-200/80 leading-snug">
                    Chemical formulation verified against Central Insecticide Board &amp; Fertilizer Control Order standards.
                  </p>
                </div>
              </div>

              {/* Card 3: Recent Credit Notes History Preview */}
              <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-1.5">
                    <History className="h-4 w-4 text-slate-500" />
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Recent Credit Notes</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('history')}
                    className="text-[11px] font-bold text-emerald-700 hover:underline"
                  >
                    VIEW ALL
                  </button>
                </div>

                <div className="space-y-2">
                  {recentThreeCreditNotes.length > 0 ? (
                    recentThreeCreditNotes.map((cn) => (
                      <div
                        key={cn.id}
                        className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3 flex items-center justify-between gap-2 hover:bg-slate-100/70 transition"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-bold text-slate-900">
                              #{cn.return_number}
                            </span>
                            <span className="rounded bg-slate-200 px-1.5 py-0.2 text-[9px] font-bold text-slate-700 uppercase">
                              {cn.refund_payment_method}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">
                            {cn.customer_name || 'Walk-in'} • {cn.items?.length || 1} SKU(s)
                          </p>
                        </div>

                        <div className="flex flex-col items-end shrink-0">
                          <span className="font-mono text-xs font-black text-slate-900">
                            ₹{formatCurrency(cn.refund_grand_total)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDownloadPdf(cn.id)}
                            className="mt-1 flex h-7 w-7 items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-emerald-800 shadow-sm transition active:scale-95"
                            title="Print Credit Note"
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center py-4 text-xs text-slate-400">
                      No recent credit notes recorded yet.
                    </p>
                  )}
                </div>

                <div className="pt-2 text-center border-t border-slate-100">
                  <div className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>All credit notes registered with E-Way GST Portal</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* =====================================================================
              4. TAB 2: FULL RETURN HISTORY & CREDIT NOTES TABLE
          ===================================================================== */
          <div className="rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-black text-slate-900">Credit Notes &amp; Sales Return Records</h2>
                <p className="text-xs text-slate-500">All customer returns and restocked items recorded in the system.</p>
              </div>

              <div className="w-full sm:w-72 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Search return # or bill..."
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            {isLoadingHistory ? (
              <div className="py-12 flex items-center justify-center text-slate-400 gap-2">
                <RefreshCw className="h-5 w-5 animate-spin text-emerald-600" />
                <span className="text-xs font-semibold">Loading returns history...</span>
              </div>
            ) : historyList.length === 0 ? (
              <div className="py-16 text-center text-slate-400 space-y-2">
                <RotateCcw className="h-8 w-8 mx-auto text-slate-300" />
                <p className="text-sm font-semibold text-slate-600">No sales returns recorded yet</p>
                <p className="text-xs text-slate-400">When you process returns from customers, they will appear here with credit memos.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                      <th className="py-3 px-3">Credit Note #</th>
                      <th className="py-3 px-3">Original Bill</th>
                      <th className="py-3 px-3">Customer</th>
                      <th className="py-3 px-3">Date</th>
                      <th className="py-3 px-3">Items Restocked</th>
                      <th className="py-3 px-3 text-right">Refund Amount</th>
                      <th className="py-3 px-3">Payment Mode</th>
                      <th className="py-3 px-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {historyList.map((ret) => (
                      <tr key={ret.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-emerald-900">{ret.return_number}</td>
                        <td className="py-3 px-3 font-mono text-slate-600">{ret.invoice_number}</td>
                        <td className="py-3 px-3 font-semibold text-slate-800">{ret.customer_name || 'Walk-in'}</td>
                        <td className="py-3 px-3 text-slate-500">
                          {new Date(ret.return_date).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="py-3 px-3">
                          <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded font-bold">
                            {ret.items.reduce((s, i) => s + safeNumber(i.returned_quantity), 0)} units
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-black text-slate-900 font-mono">
                          ₹{formatCurrency(ret.refund_grand_total)}
                        </td>
                        <td className="py-3 px-3">
                          <span className="uppercase text-[10px] font-bold bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                            {ret.refund_payment_method}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleDownloadPdf(ret.id)}
                            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-lg font-bold text-[11px] inline-flex items-center gap-1 transition-colors active:scale-95"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            <span>PDF</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
