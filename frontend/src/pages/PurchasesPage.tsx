import React, { useState, useEffect, useMemo } from 'react';
import { Plus, ShoppingBag, Truck, Check, X, FileText, AlertCircle, Receipt, Landmark } from 'lucide-react';
import { purchasesApi, productsApi, getErrorMessage } from '../api';
import { Purchase, Product, PurchaseItem } from '../types';
import { MetricInfoTooltip } from '../components/common/MetricInfoTooltip';
import {
  safeNumber,
  formatCurrency,
  sanitizeTextInput as sanitizeText,
  sanitizeCodeInput as sanitizeCode,
  resolveTradeName,
} from '../utils/formatters';


export const PurchasesPage: React.FC = () => {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // New Purchase Form
  const [supplierName, setSupplierName] = useState('');
  const [supplierGstin, setSupplierGstin] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [items, setItems] = useState<Partial<PurchaseItem>[]>([
    {
      product_id: undefined,
      product_name: '',
      company_name: '',
      trade_name: '',
      batch_number: '',
      expiry_date: '',
      quantity: 1,
      purchase_price: 0,
      mrp: 0,
      selling_price: 0,
      gst_rate: 5,
      taxable_amount: 0,
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: 0,
      total_amount: 0,
    }
  ]);

  const loadData = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [purchasesList, productsList] = await Promise.all([
        purchasesApi.getAll(),
        productsApi.getAll()
      ]);
      setPurchases(Array.isArray(purchasesList) ? purchasesList : []);
      setProducts(Array.isArray(productsList) ? productsList : []);
    } catch (err) {
      setErrorMsg(getErrorMessage(err, 'Failed to load purchases from server. Please refresh and try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void loadData(); }, []);

  const purchaseMetrics = useMemo(() => {
    let totalGross = 0;
    let totalTax = 0;
    for (const p of purchases as any[]) {
      totalGross += safeNumber(p.total_amount ?? p.grand_total);
      totalTax += safeNumber(p.total_tax ?? p.gst_amount);
    }
    return {
      totalGross,
      totalTax,
      count: purchases.length,
    };
  }, [purchases]);

  const handleAddItemRow = () => {
    const firstProd = products[0];
    const pName = firstProd?.name || firstProd?.product_name || '';
    const pComp = firstProd?.company_name || '';
    const pTrade = firstProd?.trade_name || resolveTradeName(pName, pComp, products).suggested;
    setItems([...items, {
      product_id: firstProd?.id,
      product_name: pName,
      company_name: pComp,
      trade_name: pTrade,
      batch_number: `B-${(Date.now() % 9000) + 1000}`,
      quantity: 1, purchase_price: 0, mrp: 0, selling_price: 0,
      gst_rate: 5, total_amount: 0,
    }]);
  };

  const handleSavePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const cleanSupplier = sanitizeText(supplierName, 150);
    const cleanBillNo = sanitizeCode(billNumber, 60);
    if (!cleanSupplier || !cleanBillNo) {
      setFormError('Supplier name and invoice number are required.');
      return;
    }

    const total = items.reduce((sum, item) => sum + (item.total_amount || 0), 0);
    const payload = {
      supplier_name: cleanSupplier,
      supplier_gstin: sanitizeCode(supplierGstin, 15),
      bill_number: cleanBillNo,
      bill_date: billDate,
      total_amount: total,
      total_tax: Math.round(total * 0.05 * 100) / 100,
      items: items.map(it => {
        const cleanProdName = sanitizeText(it.product_name || 'Fertilizer Product', 150);
        const cleanCompName = sanitizeText(it.company_name || '', 120);
        const resolvedTrade =
          sanitizeText(it.trade_name || '', 150) ||
          resolveTradeName(cleanProdName, cleanCompName, products).suggested;
        const matchedProd = it.product_id
          ? products.find(p => p.id === it.product_id)
          : products.find(
              p => (p.product_name || p.name || '').toLowerCase() === cleanProdName.toLowerCase()
            );
        return {
          ...it,
          product_id: matchedProd?.id,
          product_name: cleanProdName,
          company_name: cleanCompName || undefined,
          trade_name: resolvedTrade || undefined,
          batch_number: sanitizeCode(it.batch_number || 'DEFAULT', 60),
          taxable_amount: Math.round(((it.purchase_price || 0) * (it.quantity || 1) / 1.05) * 100) / 100,
          cgst_amount: Math.round((((it.purchase_price || 0) * (it.quantity || 1) * 0.025)) * 100) / 100,
          sgst_amount: Math.round((((it.purchase_price || 0) * (it.quantity || 1) * 0.025)) * 100) / 100,
          igst_amount: 0,
        };
      })
    };

    setIsSaving(true);
    try {
      await purchasesApi.create(payload);
      setIsModalOpen(false);
      setFormError(null);
      void loadData();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Could not save inward purchase. Please check the fields and retry.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-5">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Inward Stock &amp; Purchases
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Record incoming supplier invoices to update inventory
          </p>
        </div>

        <button
          type="button"
          onClick={() => { setFormError(null); setIsModalOpen(true); }}
          className="w-full sm:w-auto bg-brand-700 hover:bg-brand-600 text-white font-bold py-3 sm:py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-xs shadow-md transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Record Inward Stock</span>
        </button>
      </div>

      {errorMsg && (
        <div role="alert" className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 3 KPI Cards for Inward Purchases */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Inward Value</span>
              <MetricInfoTooltip
                title="Total Inward Purchases"
                description="Aggregated gross purchase value of all stock inwarded from seed companies and chemical distributors."
                formula="Sum(Supplier Invoiced Total Amounts)"
                tip="Matched against physical Godown intake to ensure accurate inventory valuation."
              />
            </div>
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
              <ShoppingBag className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="font-mono text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
            ₹{formatCurrency(purchaseMetrics.totalGross, 2)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {purchaseMetrics.count} supplier consignments
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Eligible ITC (GST)</span>
              <MetricInfoTooltip
                title="Input Tax Credit (ITC)"
                description="Total CGST, SGST, and IGST paid on inbound goods eligible for tax offset against retail outward sales GST liability."
                formula="ITC = Sum(Supplier CGST + SGST + IGST)"
                tip="Reconcile with GSTR-2B monthly to ensure no vendor fails to upload invoices."
              />
            </div>
            <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
              <Landmark className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="font-mono text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
            ₹{formatCurrency(purchaseMetrics.totalTax, 2)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Eligible GSTR-2B offset
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Recorded Bills</span>
              <MetricInfoTooltip
                title="Recorded Supplier Invoices"
                description="Total count of verified supplier tax invoices and delivery challans logged into the system."
                formula="Count(Inward Bills)"
                align="right"
              />
            </div>
            <div className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">
              <Receipt className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="font-mono text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
            {purchaseMetrics.count} Bills
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            All batches updated to stock
          </div>
        </div>
      </div>

      {/* Inward Invoices */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center gap-2">
          <Truck className="w-4 h-4 text-brand-700" />
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">
            Supplier Invoices History
          </h3>
        </div>

        {isLoading ? (
          <div className="p-10 text-center text-slate-400 text-xs">Loading...</div>
        ) : purchases.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-xs">No inward purchases yet.</div>
        ) : (
          <>
            {/* Mobile: card list */}
            <div className="md:hidden divide-y divide-slate-100">
              {purchases.map((pur: any) => {
                const billNo = pur.bill_number || pur.invoice_number || `INV-${pur.id}`;
                const billDt = pur.bill_date || (pur.purchase_date ? pur.purchase_date.split('T')[0] : '');
                const totTax = safeNumber(pur.total_tax ?? pur.gst_amount);
                const totAmt = safeNumber(pur.total_amount ?? pur.grand_total);

                return (
                  <div key={pur.id} className="p-3.5 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-mono font-bold text-[11px] text-blue-800 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                            {billNo}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">{billDt}</span>
                        </div>
                        <p className="font-bold text-xs text-slate-900 truncate">{pur.supplier_name || 'Supplier'}</p>
                        {pur.supplier_gstin && (
                          <p className="text-[10px] font-mono text-slate-500">GSTIN: {pur.supplier_gstin}</p>
                        )}
                      </div>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full shrink-0">
                        <Check className="w-3 h-3" />
                        Received
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                      <span className="text-[11px] text-slate-500">Tax: ₹{formatCurrency(totTax)}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-slate-900">₹{formatCurrency(totAmt)}</span>
                        <a
                          href={purchasesApi.getPdfUrl(pur.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-800 rounded-lg text-[10px] font-semibold border border-slate-200 transition"
                        >
                          <FileText className="w-3 h-3 text-blue-600" />
                          PDF
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop: table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Supplier Name</th>
                    <th className="py-3 px-3">Bill No.</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">GSTIN</th>
                    <th className="py-3 px-3 text-right">Tax (₹)</th>
                    <th className="py-3 px-4 text-right">Total (₹)</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Bill PDF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {purchases.map((pur: any) => {
                    const billNo = pur.bill_number || pur.invoice_number || `INV-${pur.id}`;
                    const billDt = pur.bill_date || (pur.purchase_date ? pur.purchase_date.split('T')[0] : '');
                    const totTax = safeNumber(pur.total_tax ?? pur.gst_amount);
                    const totAmt = safeNumber(pur.total_amount ?? pur.grand_total);

                    return (
                      <tr key={pur.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-900">{pur.supplier_name || 'Supplier'}</td>
                        <td className="py-3 px-3 font-mono text-emerald-800 font-semibold">{billNo}</td>
                        <td className="py-3 px-3 text-slate-600 font-mono text-xs">{billDt}</td>
                        <td className="py-3 px-3 font-mono text-slate-500 text-xs">{pur.supplier_gstin || 'N/A'}</td>
                        <td className="py-3 px-3 text-right text-slate-600">₹{formatCurrency(totTax)}</td>
                        <td className="py-3 px-4 text-right font-black text-slate-900">₹{formatCurrency(totAmt)}</td>
                        <td className="py-3 px-3 text-center">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                            <Check className="w-3 h-3" />Received
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <a
                            href={purchasesApi.getPdfUrl(pur.id)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 rounded-lg text-xs font-semibold border border-slate-200 transition shadow-xs"
                          >
                            <FileText className="w-3.5 h-3.5 text-emerald-600" />
                            <span>PDF</span>
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>


      {/* Record Inward Modal — bottom-sheet on mobile */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="px-5 py-4 bg-brand-800 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-brand-300" />
                <h3 className="font-bold text-sm">Record Inward Stock</h3>
              </div>
              <button type="button" onClick={() => setIsModalOpen(false)} aria-label="Close modal" className="text-brand-200 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={(e) => { void handleSavePurchase(e); }} className="p-4 sm:p-5 space-y-4 text-xs overflow-y-auto flex-1">
              {formError && (
                <div role="alert" className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}
              {/* Supplier Info — stacked on mobile, 2-col on sm */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="purchase-supplier-name" className="block font-semibold text-slate-700 mb-1">Supplier / Depot Name *</label>
                  <input
                    id="purchase-supplier-name"
                    type="text" required value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="purchase-supplier-gstin" className="block font-semibold text-slate-700 mb-1">Supplier GSTIN</label>
                  <input
                    id="purchase-supplier-gstin"
                    type="text" value={supplierGstin}
                    onChange={(e) => setSupplierGstin(e.target.value)}
                    className="w-full px-3 py-2.5 font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="purchase-bill-number" className="block font-semibold text-slate-700 mb-1">Invoice Number *</label>
                  <input
                    id="purchase-bill-number"
                    type="text" required value={billNumber}
                    onChange={(e) => setBillNumber(e.target.value)}
                    className="w-full px-3 py-2.5 font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="purchase-bill-date" className="block font-semibold text-slate-700 mb-1">Invoice Date</label>
                  <input
                    id="purchase-bill-date"
                    type="date" required value={billDate}
                    onChange={(e) => setBillDate(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none text-sm"
                  />
                </div>
              </div>

              {/* Items */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-800">Inward Items ({items.length})</h4>
                  <button
                    type="button" onClick={handleAddItemRow}
                    className="text-brand-700 font-bold hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                {items.map((item, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label htmlFor={`purchase-prod-name-${idx}`} className="block text-[10px] font-semibold text-slate-600 mb-0.5">Product / Technical Name *</label>
                        <input
                          id={`purchase-prod-name-${idx}`}
                          type="text"
                          required
                          maxLength={150}
                          value={item.product_name || ''}
                          onChange={(e) => {
                            const up = [...items];
                            const nextProd = e.target.value;
                            up[idx].product_name = nextProd;
                            up[idx].trade_name = resolveTradeName(nextProd, up[idx].company_name || '', products).suggested;
                            setItems(up);
                          }}
                          className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                        />
                      </div>
                      <div>
                        <label htmlFor={`purchase-company-${idx}`} className="block text-[10px] font-semibold text-slate-600 mb-0.5">Company / Brand</label>
                        <input
                          id={`purchase-company-${idx}`}
                          type="text"
                          maxLength={120}
                          value={item.company_name || ''}
                          onChange={(e) => {
                            const up = [...items];
                            const nextComp = e.target.value;
                            up[idx].company_name = nextComp;
                            up[idx].trade_name = resolveTradeName(up[idx].product_name || '', nextComp, products).suggested;
                            setItems(up);
                          }}
                          placeholder="e.g. Bayer, IFFCO, Tata Rallis"
                          className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label htmlFor={`purchase-trade-${idx}`} className="block text-[10px] font-bold text-emerald-800 mb-0.5">
                          Trade Name (Product + Brand Combination)
                        </label>
                        <input
                          id={`purchase-trade-${idx}`}
                          type="text"
                          maxLength={150}
                          value={item.trade_name || ''}
                          onChange={(e) => {
                            const up = [...items];
                            up[idx].trade_name = e.target.value;
                            setItems(up);
                          }}
                          placeholder="e.g. Confidor, Tatamida, Coragen"
                          className="w-full px-2.5 py-2 font-bold text-emerald-900 bg-emerald-50/50 border border-emerald-300 rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label htmlFor={`purchase-batch-${idx}`} className="block text-[10px] font-semibold text-slate-600 mb-0.5">Batch No.</label>
                        <input
                          id={`purchase-batch-${idx}`}
                          type="text"
                          maxLength={60}
                          value={item.batch_number || ''}
                          onChange={(e) => { const up = [...items]; up[idx].batch_number = e.target.value; setItems(up); }}
                          className="w-full px-2.5 py-2 font-mono border border-slate-300 rounded-lg text-xs bg-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label htmlFor={`purchase-qty-${idx}`} className="block text-[10px] font-semibold text-slate-600 mb-0.5">Qty (Bags)</label>
                        <input
                          id={`purchase-qty-${idx}`}
                          type="number" value={item.quantity || 1}
                          onChange={(e) => { const up = [...items]; const q = Number.parseInt(e.target.value, 10) || 1; up[idx].quantity = q; up[idx].total_amount = q * (up[idx].purchase_price || 0); setItems(up); }}
                          className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs font-bold"
                        />
                      </div>
                      <div>
                        <label htmlFor={`purchase-cost-${idx}`} className="block text-[10px] font-semibold text-slate-600 mb-0.5">Cost Price (₹)</label>
                        <input
                          id={`purchase-cost-${idx}`}
                          type="number" value={item.purchase_price || 0}
                          onChange={(e) => { const up = [...items]; const p = Number.parseFloat(e.target.value) || 0; up[idx].purchase_price = p; up[idx].total_amount = (up[idx].quantity || 1) * p; setItems(up); }}
                          className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs font-bold"
                        />
                      </div>
                      <div>
                        <label htmlFor={`purchase-total-${idx}`} className="block text-[10px] font-semibold text-slate-600 mb-0.5">Line Total (₹)</label>
                        <input
                          id={`purchase-total-${idx}`}
                          type="text" readOnly
                          value={`₹${(item.total_amount || 0).toFixed(2)}`}
                          className="w-full px-2.5 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs font-black text-brand-900"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total bar */}
              <div className="flex items-center justify-between bg-brand-50 border border-brand-200 rounded-xl px-4 py-3">
                <span className="font-bold text-sm text-brand-900">Grand Total</span>
                <span className="font-black text-lg text-brand-900">
                  ₹{formatCurrency(items.reduce((s, i) => s + (i.total_amount || 0), 0))}
                </span>
              </div>

              <div className="pt-1 flex gap-2">
                <button
                  type="button" onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 bg-brand-700 hover:bg-brand-600 disabled:opacity-60 text-white px-5 py-2.5 rounded-xl font-bold shadow transition-all text-sm"
                >
                  {isSaving ? 'Saving...' : 'Confirm & Inward'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
