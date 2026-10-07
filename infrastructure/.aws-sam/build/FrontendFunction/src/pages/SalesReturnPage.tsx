import React, { useState, useEffect } from 'react';
import { 
  RotateCcw, Search, FileText, CheckCircle2, AlertCircle, 
  Printer, Download, IndianRupee, Package, Clock, 
  User, Phone, Calendar, ArrowLeft, History, RefreshCw, X, ShieldCheck
} from 'lucide-react';
import { returnsApi, getErrorMessage } from '../api';
import { InvoiceReturnLookup, SalesReturn, ReturnEligibleItem } from '../types';
import { safeNumber, formatCurrency } from '../utils/formatters';
import { CustomSelect } from '../components/common/CustomSelect';

interface ReturnItemState {
  sale_item_id: number;
  returned_quantity: number;
  max_quantity: number;
}

export const SalesReturnPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'process' | 'history'>('process');
  
  // Search State
  const [invoiceQuery, setInvoiceQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Active Lookup Data
  const [lookupData, setLookupData] = useState<InvoiceReturnLookup | null>(null);
  const [returnItems, setReturnItems] = useState<Record<number, number>>({});
  const [refundPaymentMethod, setRefundPaymentMethod] = useState('Cash');
  const [returnReason, setReturnReason] = useState('Customer returned unused quantity');
  const [notes, setNotes] = useState('');

  // Processing State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [completedReturn, setCompletedReturn] = useState<SalesReturn | null>(null);

  // History State
  const [historyList, setHistoryList] = useState<SalesReturn[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState('');

  // Check URL query parameters for invoice_number (e.g. /returns?invoice=INV-...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inv = params.get('invoice');
    if (inv) {
      setInvoiceQuery(inv);
      handleLookup(inv);
    }
  }, []);

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

    try {
      const data = await returnsApi.lookupInvoice(inv);
      setLookupData(data);
      // Initialize return quantities to 0
      const initialItems: Record<number, number> = {};
      data.items.forEach(item => {
        initialItems[item.sale_item_id] = 0;
      });
      setReturnItems(initialItems);
    } catch (err: any) {
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
      setHistoryList(list);
    } catch (err) {
      console.error('Failed to load returns history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab, historySearch]);

  const updateQuantity = (saleItemId: number, val: number, maxVal: number) => {
    const cleanVal = Math.max(0, Math.min(val, maxVal));
    setReturnItems(prev => ({
      ...prev,
      [saleItemId]: Math.round(cleanVal * 1000) / 1000,
    }));
  };

  const setFullReturn = (saleItemId: number, maxVal: number) => {
    updateQuantity(saleItemId, maxVal, maxVal);
  };

  // Calculations for current return selection
  let calculatedTaxableRefund = 0;
  let calculatedGstRefund = 0;
  let totalUnitsToReturn = 0;
  let itemsToReturnCount = 0;

  if (lookupData) {
    lookupData.items.forEach(item => {
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

  const handleSubmitReturn = async () => {
    if (!lookupData) return;
    if (totalUnitsToReturn <= 0) {
      setSubmitError('Please enter a return quantity for at least one item.');
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);

    const itemsPayload = Object.entries(returnItems)
      .map(([saleItemIdStr, qty]) => ({
        sale_item_id: parseInt(saleItemIdStr),
        returned_quantity: qty,
      }))
      .filter(item => item.returned_quantity > 0);

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
      // Refresh lookup data so available quantities update
      await handleLookup(lookupData.invoice_number);
    } catch (err: any) {
      setSubmitError(getErrorMessage(err, 'Failed to process return. Please check quantities and try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadPdf = (returnId: number) => {
    window.open(returnsApi.getPdfUrl(returnId), '_blank');
  };

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-5">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-brand-900 to-slate-900 rounded-3xl p-5 sm:p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold backdrop-blur-sm border border-emerald-500/30">
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Stock Reconciliation & Credit Notes</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
            Farmer Sales Return & Restocking
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
            Accept unused or excess fertilizer bags returned by farmers. Physical inventory is automatically restocked in the godown and accurate tax-adjusted refunds are recorded.
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex bg-slate-800/80 p-1.5 rounded-2xl border border-slate-700/60 shrink-0 self-start md:self-auto">
          <button
            onClick={() => setActiveTab('process')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'process'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Process Return
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'history'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Return History
          </button>
        </div>
      </div>

      {activeTab === 'process' ? (
        <div className="space-y-5">
          {/* Invoice Search Bar */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
            <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
              Step 1: Enter Customer Bill / Invoice Number
            </label>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleLookup();
              }}
              className="flex flex-col sm:flex-row items-stretch gap-3"
            >
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={invoiceQuery}
                  onChange={(e) => setInvoiceQuery(e.target.value)}
                  placeholder="e.g. KSK-202609-00001 or enter bill ID"
                  className="w-full pl-10 pr-4 py-2.5 text-sm font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-slate-50 focus:bg-white transition-all"
                />
                {invoiceQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setInvoiceQuery('');
                      setLookupData(null);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <button
                type="submit"
                disabled={isSearching}
                className="bg-emerald-800 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50"
              >
                {isSearching ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Searching Bill...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span>Find Invoice</span>
                  </>
                )}
              </button>
            </form>

            {searchError && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{searchError}</span>
              </div>
            )}
          </div>

          {/* Success Dialog when return processed */}
          {completedReturn && (
            <div className="bg-emerald-50 border-2 border-emerald-500 rounded-2xl p-5 shadow-md space-y-3 animate-in fade-in duration-300">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-emerald-950">
                      Sales Return #{completedReturn.return_number} Processed Successfully!
                    </h3>
                    <p className="text-xs text-emerald-800 font-medium">
                      Returned stock has been added back to your godown inventory, and refund payout of ₹{formatCurrency(completedReturn.refund_grand_total)} is recorded.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setCompletedReturn(null)}
                  className="text-emerald-700 hover:text-emerald-950 p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-emerald-200">
                <button
                  type="button"
                  onClick={() => handleDownloadPdf(completedReturn.id)}
                  className="bg-emerald-800 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-xs shadow flex items-center gap-1.5 transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Credit Note PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.open(returnsApi.getPdfUrl(completedReturn.id), '_blank')}
                  className="bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold px-4 py-2 rounded-xl text-xs transition-all flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Credit Memo</span>
                </button>
              </div>
            </div>
          )}

          {/* Invoice Details & Return Form */}
          {lookupData && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Left 2 Cols: Items Table */}
              <div className="lg:col-span-2 space-y-4">
                {/* Bill Header Info Card */}
                <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Bill Reference:</span>
                      <span className="font-mono font-black text-sm text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                        {lookupData.invoice_number}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-600">
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <strong>{lookupData.customer_name || 'Walk-in Farmer'}</strong>
                      </span>
                      {lookupData.customer_phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>{lookupData.customer_phone}</span>
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{new Date(lookupData.sale_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-[11px] text-slate-400 font-bold uppercase">Original Total Paid</p>
                    <p className="text-base font-black text-slate-900">₹{formatCurrency(lookupData.original_grand_total)}</p>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                      Paid via {lookupData.original_payment_method}
                    </span>
                  </div>
                </div>

                {lookupData.existing_returns_count > 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      Notice: <strong>{lookupData.existing_returns_count}</strong> previous return transaction(s) exist for this bill. Eligible return quantities are calculated below.
                    </span>
                  </div>
                )}

                {/* Items to Return List */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">
                        Step 2: Enter Unused Quantity Being Returned
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Adjust the quantity returned for each product. Inventory will be updated automatically.
                      </p>
                    </div>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {lookupData.items.map((item) => {
                      const returnQty = returnItems[item.sale_item_id] || 0;
                      const maxQty = safeNumber(item.available_return_quantity);
                      const isFullyReturned = maxQty <= 0;
                      const itemTaxable = returnQty * safeNumber(item.unit_price);
                      const itemTotalRefund = itemTaxable * (1 + safeNumber(item.gst_rate) / 100);

                      return (
                        <div
                          key={item.sale_item_id}
                          className={`p-4 transition-all ${
                            returnQty > 0 ? 'bg-emerald-50/40' : isFullyReturned ? 'bg-slate-50/80 opacity-60' : 'hover:bg-slate-50/50'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            {/* Product Details */}
                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-black text-sm text-slate-900">{item.product_name}</h4>
                                {item.company_name && (
                                  <span className="text-[11px] text-slate-500 font-medium">({item.company_name})</span>
                                )}
                                {item.net_content && (
                                  <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                                    {item.net_content}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                                {item.batch_number && (
                                  <span className="font-mono text-[11px]">Batch: {item.batch_number}</span>
                                )}
                                <span>Sold: <strong>{item.sold_quantity}</strong></span>
                                {safeNumber(item.previously_returned_quantity) > 0 && (
                                  <span className="text-amber-700 font-semibold">
                                    Prev. Returned: {item.previously_returned_quantity}
                                  </span>
                                )}
                                <span className="font-semibold text-emerald-800">
                                  Remaining Eligible: <strong>{maxQty}</strong> {item.unit || 'Units'}
                                </span>
                              </div>
                            </div>

                            {/* Return Quantity Controls & Refund calculation */}
                            <div className="flex items-center gap-4 shrink-0">
                              {isFullyReturned ? (
                                <span className="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                                  Fully Returned
                                </span>
                              ) : (
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => updateQuantity(item.sale_item_id, returnQty - 1, maxQty)}
                                      disabled={returnQty <= 0}
                                      className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center disabled:opacity-40 transition-colors"
                                    >
                                      -
                                    </button>
                                    <input
                                      type="number"
                                      step="any"
                                      min="0"
                                      max={maxQty}
                                      value={returnQty === 0 ? '' : returnQty}
                                      onChange={(e) => updateQuantity(item.sale_item_id, parseFloat(e.target.value) || 0, maxQty)}
                                      placeholder="0"
                                      className="w-16 px-2 py-1 text-center font-black text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => updateQuantity(item.sale_item_id, returnQty + 1, maxQty)}
                                      disabled={returnQty >= maxQty}
                                      className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center disabled:opacity-40 transition-colors"
                                    >
                                      +
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setFullReturn(item.sale_item_id, maxQty)}
                                      className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-2 py-1.5 rounded-lg border border-emerald-200 transition-colors"
                                    >
                                      All ({maxQty})
                                    </button>
                                  </div>
                                  {returnQty > 0 && (
                                    <p className="text-[11px] text-right font-bold text-emerald-800">
                                      Refund: ₹{formatCurrency(itemTotalRefund)}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Right Col: Refund & Restocking Checkout Card */}
              <div className="space-y-4">
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4 sticky top-6">
                  <h3 className="font-black text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-700" />
                    Step 3: Refund & Inventory Restock
                  </h3>

                  {/* Summary Breakdown */}
                  <div className="space-y-2 bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Products Selected:</span>
                      <strong className="text-slate-900">{itemsToReturnCount}</strong>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Total Units to Restock:</span>
                      <strong className="text-emerald-800">{totalUnitsToReturn}</strong>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Taxable Value Reversal:</span>
                      <span>₹{formatCurrency(calculatedTaxableRefund)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>GST Reversal:</span>
                      <span>₹{formatCurrency(calculatedGstRefund)}</span>
                    </div>
                    <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                      <span className="font-bold text-slate-900">Total Refund to Pay:</span>
                      <span className="font-black text-lg text-emerald-900">
                        ₹{formatCurrency(calculatedTotalRefund)}
                      </span>
                    </div>
                  </div>

                  {/* Refund Payment Mode */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Refund Payment Mode
                    </label>
                    <CustomSelect
                      value={refundPaymentMethod}
                      onChange={(val) => setRefundPaymentMethod(val)}
                      options={[
                        { value: 'Cash', label: 'Cash Refund' },
                        { value: 'UPI', label: 'UPI / Online Transfer' },
                        { value: 'Bank Transfer', label: 'Bank RTGS / NEFT' },
                        { value: 'Credit', label: 'Store Credit / Adjust with next bill' },
                      ]}
                    />
                  </div>

                  {/* Reason for Return */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Return Reason
                    </label>
                    <CustomSelect
                      value={returnReason}
                      onChange={(val) => setReturnReason(val)}
                      options={[
                        { value: 'Customer returned unused quantity', label: 'Unused fertilizer bags' },
                        { value: 'Excess bags bought for harvest season', label: 'Excess purchase returned' },
                        { value: 'Customer requested exchange or credit', label: 'Exchange / Store credit' },
                        { value: 'Damaged or defective package', label: 'Damaged packaging' },
                      ]}
                    />
                  </div>

                  {/* Additional Notes */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Notes / Remarks (Optional)
                    </label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="e.g. Returned 5 bags of Urea"
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  {submitError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                      <span>{submitError}</span>
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    type="button"
                    onClick={handleSubmitReturn}
                    disabled={isSubmitting || totalUnitsToReturn <= 0}
                    className="w-full bg-emerald-800 hover:bg-emerald-700 text-white font-black py-3 px-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Restocking &amp; Refunding...</span>
                      </>
                    ) : (
                      <>
                        <RotateCcw className="w-4 h-4" />
                        <span>Accept Return &amp; Restock (₹{formatCurrency(calculatedTotalRefund)})</span>
                      </>
                    )}
                  </button>

                  <p className="text-[10px] text-center text-slate-400">
                    Stock will be restored in database godown inventory and credit memo will be generated.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Tab 2: History List */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-slate-900">Credit Notes &amp; Sales Return Records</h2>
              <p className="text-xs text-slate-500">All customer returns and restocked items recorded in the system.</p>
            </div>

            <div className="w-full sm:w-72 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Search return # or bill..."
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {isLoadingHistory ? (
            <div className="py-12 flex items-center justify-center text-slate-400 gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
              <span className="text-xs font-semibold">Loading returns history...</span>
            </div>
          ) : historyList.length === 0 ? (
            <div className="py-16 text-center text-slate-400 space-y-2">
              <RotateCcw className="w-8 h-8 mx-auto text-slate-300" />
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
                    <tr key={ret.id} className="hover:bg-slate-50/60">
                      <td className="py-2.5 px-3 font-mono font-bold text-emerald-900">{ret.return_number}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">{ret.invoice_number}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">{ret.customer_name || 'Walk-in'}</td>
                      <td className="py-2.5 px-3 text-slate-500">
                        {new Date(ret.return_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded font-bold">
                          {ret.items.reduce((s, i) => s + safeNumber(i.returned_quantity), 0)} units
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-slate-900">
                        ₹{formatCurrency(ret.refund_grand_total)}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="uppercase text-[10px] font-bold bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                          {ret.refund_payment_method}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleDownloadPdf(ret.id)}
                          className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-lg font-bold text-[11px] inline-flex items-center gap-1 transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5" />
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
  );
};
