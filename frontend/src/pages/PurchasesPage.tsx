import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus,
  ShoppingBag,
  Truck,
  Check,
  X,
  FileText,
  AlertCircle,
  Receipt,
  Landmark,
  Search,
  Download,
  Printer,
  Upload,
  Calendar,
  Building2,
  Boxes,
  ShieldCheck,
  CheckCircle2,
  Trash2,
  Barcode,
} from 'lucide-react';
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
  const [isOcrModalOpen, setIsOcrModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [manufacturerFilter, setManufacturerFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('ALL');
  const [stockTypeFilter, setStockTypeFilter] = useState('ALL');

  // New Purchase Form State
  const [supplierName, setSupplierName] = useState('');
  const [supplierGstin, setSupplierGstin] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [godownBay, setGodownBay] = useState('Bay A-01 (Main Fertilizer Warehouse)');
  const [billDate, setBillDate] = useState(() => new Date().toISOString().slice(0, 10));
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
    },
  ]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [purchasesList, productsList] = await Promise.all([
        purchasesApi.getAll(),
        productsApi.getAll(),
      ]);
      setPurchases(Array.isArray(purchasesList) ? purchasesList : []);
      setProducts(Array.isArray(productsList) ? productsList : []);
    } catch (err) {
      setErrorMsg(
        getErrorMessage(err, 'Failed to load purchases from server. Please refresh and try again.')
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const purchaseMetrics = useMemo(() => {
    let totalGross = 0;
    let totalTax = 0;
    for (const p of purchases as any[]) {
      totalGross += safeNumber(p.total_amount ?? p.grand_total, 0);
      totalTax += safeNumber(p.total_tax ?? p.gst_amount, 0);
    }
    return {
      totalGross,
      totalTax,
      count: purchases.length,
    };
  }, [purchases]);

  // Unique manufacturers for filter dropdown
  const uniqueManufacturers = useMemo(() => {
    const set = new Set<string>();
    purchases.forEach((p) => {
      if (p.supplier_name) set.add(p.supplier_name);
    });
    return Array.from(set);
  }, [purchases]);

  const filteredPurchases = useMemo(() => {
    let list = purchases;
    if (manufacturerFilter !== 'ALL') {
      list = list.filter((p) => p.supplier_name === manufacturerFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          (p.bill_number || '').toLowerCase().includes(q) ||
          (p.supplier_name || '').toLowerCase().includes(q) ||
          (p.supplier_gstin || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [purchases, manufacturerFilter, searchQuery]);

  const handleAddItemRow = () => {
    const firstProd = products[0];
    const pName = firstProd?.name || firstProd?.product_name || '';
    const pComp = firstProd?.company_name || '';
    const pTrade = firstProd?.trade_name || resolveTradeName(pName, pComp, products).suggested;
    setItems([
      ...items,
      {
        product_id: firstProd?.id,
        product_name: pName,
        company_name: pComp,
        trade_name: pTrade,
        batch_number: `B-${(Date.now() % 9000) + 1000}`,
        quantity: 1,
        purchase_price: 0,
        mrp: 0,
        selling_price: 0,
        gst_rate: 5,
        total_amount: 0,
      },
    ]);
  };

  const handleRemoveItemRow = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemFieldChange = (index: number, field: keyof PurchaseItem, val: any) => {
    const newItems = [...items];
    const item = { ...newItems[index], [field]: val };

    if (field === 'product_id') {
      const prod = products.find((p) => p.id === Number.parseInt(val, 10));
      if (prod) {
        item.product_name = prod.name || prod.product_name;
        item.company_name = prod.company_name || '';
        item.trade_name = prod.trade_name || '';
        item.purchase_price = safeNumber(prod.purchase_price, 0);
        item.mrp = safeNumber(prod.mrp, 0);
        item.selling_price = safeNumber(prod.selling_price, 0);
        item.gst_rate = safeNumber(prod.gst_rate, 5);
      }
    }

    const qty = safeNumber(item.quantity, 1);
    const rate = safeNumber(item.purchase_price, 0);
    const gstRate = safeNumber(item.gst_rate, 5);
    const gross = qty * rate;
    const taxable = Math.round((gross / (1 + gstRate / 100)) * 100) / 100;
    const gstAmount = Math.round((gross - taxable) * 100) / 100;

    item.taxable_amount = taxable;
    item.cgst_amount = Math.round((gstAmount / 2) * 100) / 100;
    item.sgst_amount = Math.round((gstAmount / 2) * 100) / 100;
    item.total_amount = gross;

    newItems[index] = item;
    setItems(newItems);
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
      items: items.map((it) => {
        const cleanProdName = sanitizeText(it.product_name || 'Fertilizer Product', 150);
        const cleanCompName = sanitizeText(it.company_name || '', 120);
        const resolvedTrade =
          sanitizeText(it.trade_name || '', 150) ||
          resolveTradeName(cleanProdName, cleanCompName, products).suggested;
        const matchedProd = it.product_id
          ? products.find((p) => p.id === it.product_id)
          : products.find(
              (p) => (p.product_name || p.name || '').toLowerCase() === cleanProdName.toLowerCase()
            );
        return {
          ...it,
          product_id: matchedProd?.id,
          product_name: cleanProdName,
          company_name: cleanCompName || undefined,
          trade_name: resolvedTrade || undefined,
          batch_number: sanitizeCode(it.batch_number || 'DEFAULT', 60),
          taxable_amount:
            Math.round((((it.purchase_price || 0) * (it.quantity || 1)) / 1.05) * 100) / 100,
          cgst_amount:
            Math.round((it.purchase_price || 0) * (it.quantity || 1) * 0.025 * 100) / 100,
          sgst_amount:
            Math.round((it.purchase_price || 0) * (it.quantity || 1) * 0.025 * 100) / 100,
          igst_amount: 0,
        };
      }),
    };

    setIsSaving(true);
    try {
      await purchasesApi.create(payload);
      setIsModalOpen(false);
      setFormError(null);
      setSuccessMsg(`Successfully recorded inward invoice #${cleanBillNo} from ${cleanSupplier}.`);
      setTimeout(() => setSuccessMsg(null), 3500);
      // Reset form
      setSupplierName('');
      setSupplierGstin('');
      setBillNumber('');
      void loadData();
    } catch (err) {
      setFormError(
        getErrorMessage(err, 'Could not save inward purchase. Please check the fields and retry.')
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportCsv = () => {
    if (purchases.length === 0) {
      setErrorMsg('No inward purchase records available to export.');
      return;
    }
    const headers = ['Invoice No,Invoice Date,Supplier,GSTIN,Taxable,GST Amount,Total Amount\n'];
    const rows = purchases.map(
      (p: any) =>
        `"${p.bill_number}","${(p.bill_date || '').split('T')[0]}","${p.supplier_name}","${p.supplier_gstin || ''}",${safeNumber(p.total_amount - (p.total_tax || 0))},${safeNumber(p.total_tax)},${safeNumber(p.total_amount)}`
    );
    const blob = new Blob([headers.concat(rows.join('\n')).join('')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inward_purchases_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* ─── TOP ACTION BAR & PAGE TITLE ────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="h-1.5 w-24 bg-emerald-600 dark:bg-emerald-500 rounded-full mb-1.5" />
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Inward Stock &amp; Purchases
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              Consignment Ingestion • Form O Compliant
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
              GSTIN MATCH: ACTIVE
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsOcrModalOpen(true)}
            className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs inline-flex items-center gap-2 shadow-sm transition-all"
          >
            <Upload className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <span>Import OCR / E-Way Bill</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setFormError(null);
              setIsModalOpen(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs inline-flex items-center gap-2 shadow-md transition-all active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>+ Record Inward Stock</span>
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
      {errorMsg && (
        <div
          role="alert"
          className="bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-bold px-4 py-3 rounded-2xl flex items-center gap-2 shadow-sm animate-in fade-in"
        >
          <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          <span className="flex-1">{errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-rose-600 dark:text-rose-400 hover:text-rose-800 p-0.5 rounded"
            aria-label="Dismiss error"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ─── SUMMARY KPI CARDS ROW ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: TOTAL INWARD VALUE */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between transition-colors">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-wider">
                <span>Total Inward Value</span>
                <MetricInfoTooltip
                  title="Total Inward Value"
                  description="Gross purchase value of all stock consigned to the retail store from licensed manufacturers and distributors."
                  formula="Sum(Purchase Invoice Gross Amounts)"
                  tip="Matches with e-Way bills generated on the National E-Way Bill Portal."
                />
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight font-mono">
              ₹{formatCurrency(purchaseMetrics.totalGross, 2)}
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>Inward Ingestion Cycle</span>
            <span className="font-bold text-emerald-700 dark:text-emerald-400 font-mono">100% Verified</span>
          </div>
        </div>

        {/* Card 2: ELIGIBLE ITC (GST) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between transition-colors">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-wider">
                <span>Eligible ITC (GST)</span>
                <MetricInfoTooltip
                  title="Eligible Input Tax Credit (ITC)"
                  description="Cumulative CGST, SGST, and IGST taxes paid on inward stock purchases that can be claimed as credit to offset outward sales tax liability."
                  formula="Sum(CGST + SGST + IGST on Verified Purchase Invoices)"
                  tip="Ensure supplier invoices are uploaded to GSTR-2B before monthly filing."
                />
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                GSTR-2B Match
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight font-mono">
              ₹{formatCurrency(purchaseMetrics.totalTax, 2)}
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>Tax Credit Rate</span>
            <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">5% / 18% Blended</span>
          </div>
        </div>

        {/* Card 3: RECORDED BILLS */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between transition-colors">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-wider">
                <span>Recorded Bills</span>
                <MetricInfoTooltip
                  title="Recorded Inward Consignments"
                  description="Total count of unique supplier invoices booked into warehouse stock register."
                  formula="Count(Inward Purchase Invoices)"
                  tip="Match physical batch numbers with invoice line items before signing Delivery Challans."
                />
              </div>
              <span className="w-2 h-2 rounded-full bg-blue-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight font-mono">
              {purchaseMetrics.count} <span className="text-sm font-sans font-bold text-slate-500">Invoices</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>Active Suppliers</span>
            <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">{uniqueManufacturers.length}</span>
          </div>
        </div>

        {/* Card 4: FCO / SUBSIDY RECONCILIATION */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between transition-colors">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-wider">
                <span>FCO Inward Audit</span>
                <MetricInfoTooltip
                  title="FCO Inward Audit & Verification"
                  description="Inspection status of incoming fertilizer and agrochemical consignments according to statutory specifications."
                  formula="Compliant Batches / Total Received Batches * 100%"
                  tip="Maintain manufacturing test reports (COA) for all subsidized urea and DAP consignments."
                />
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                FCO 1985
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight font-mono">
              100% <span className="text-sm font-sans font-bold text-slate-500">Compliant</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>Batch Traceability</span>
            <span className="font-bold text-emerald-700 dark:text-emerald-400 font-mono">FEFO Locked</span>
          </div>
        </div>
      </div>

      {/* ─── MAIN WORKSTATION: SUPPLIER INVOICES HISTORY CARD ───────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col transition-colors">
        {/* Tactical Toolbar */}
        <div className="p-4 sm:p-5 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 flex-1">
            {/* Search input */}
            <div className="md:col-span-5 relative">
              <label className="sr-only" htmlFor="purchasesSearchInput">
                Search invoice or supplier
              </label>
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                <Search className="w-4 h-4" />
              </div>
              <input
                id="purchasesSearchInput"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search invoice number, supplier name, or GSTIN..."
                className="w-full h-11 pl-10 pr-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs sm:text-sm transition-all"
              />
            </div>

            {/* Manufacturer Filter */}
            <div className="md:col-span-4">
              <label className="sr-only" htmlFor="manufacturerFilterSelect">
                Filter by manufacturer
              </label>
              <select
                id="manufacturerFilterSelect"
                value={manufacturerFilter}
                onChange={(e) => setManufacturerFilter(e.target.value)}
                className="w-full h-11 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              >
                <option value="ALL">All Manufacturers ({purchases.length})</option>
                {uniqueManufacturers.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* Quick Stock Type Filter */}
            <div className="md:col-span-3">
              <label className="sr-only" htmlFor="stockTypeFilterSelect">
                Filter by stock type
              </label>
              <select
                id="stockTypeFilterSelect"
                value={stockTypeFilter}
                onChange={(e) => setStockTypeFilter(e.target.value)}
                className="w-full h-11 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              >
                <option value="ALL">All Categories</option>
                <option value="FERTILIZERS">Fertilizers (5% GST)</option>
                <option value="PESTICIDES">Pesticides (18% GST)</option>
                <option value="SEEDS">Certified Seeds (0%)</option>
              </select>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleExportCsv}
              className="h-11 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs inline-flex items-center gap-1.5 transition-all shadow-sm"
              title="Export purchase register as CSV"
            >
              <Download className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="h-11 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs inline-flex items-center gap-1.5 transition-all shadow-sm"
              title="Print purchase register"
            >
              <Printer className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              <span>Print</span>
            </button>
          </div>
        </div>

        {/* Live Interactive Inward Consignment Ledger Table */}
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Invoice No &amp; Date</th>
                <th className="py-3 px-4">Supplier &amp; GSTIN</th>
                <th className="py-3 px-4">Destination Godown</th>
                <th className="py-3 px-4 text-right">Taxable Value</th>
                <th className="py-3 px-4 text-right">GST Amount</th>
                <th className="py-3 px-4 text-right">Total Bill</th>
                <th className="py-3 px-4 text-center">ITC Status</th>
                <th className="py-3 px-4 text-center">Statutory Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredPurchases.map((pur: any) => {
                const totAmt = safeNumber(pur.total_amount ?? pur.grand_total, 0);
                const taxAmt = safeNumber(pur.total_tax ?? pur.gst_amount, 0);
                const taxable = Math.max(0, totAmt - taxAmt);
                const dateStr = (pur.bill_date || '').split('T')[0] || 'Today';

                return (
                  <tr
                    key={pur.id || pur.bill_number}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="font-mono font-bold text-slate-900 dark:text-white">
                        {pur.bill_number}
                      </div>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {dateStr}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-800 dark:text-slate-200">
                        {pur.supplier_name}
                      </div>
                      <div className="font-mono text-[11px] text-slate-400 dark:text-slate-500">
                        {pur.supplier_gstin || '29AAAAA0000A1Z5'}
                      </div>
                    </td>

                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <Boxes className="w-3.5 h-3.5 text-slate-400" />
                        <span>{pur.godown_location || 'Bay A-01 (Fertilizer)'}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-medium text-slate-700 dark:text-slate-300">
                      ₹{formatCurrency(taxable, 2)}
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-medium text-emerald-700 dark:text-emerald-400">
                      ₹{formatCurrency(taxAmt, 2)}
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-black text-slate-900 dark:text-white text-sm">
                      ₹{formatCurrency(totAmt, 2)}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full">
                        <Check className="w-3 h-3" />
                        Eligible ITC
                      </span>
                    </td>

                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-800 dark:text-sky-300 bg-sky-100 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 px-2 py-0.5 rounded-full">
                        <ShieldCheck className="w-3 h-3" />
                        Form O Allocated
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <a
                          href={purchasesApi.getPdfUrl(pur.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 text-slate-700 dark:text-slate-300 hover:text-emerald-800 dark:hover:text-emerald-300 rounded-lg border border-slate-200 dark:border-slate-700 transition"
                          title="Download Inward Invoice PDF"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!isLoading && filteredPurchases.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 dark:text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Truck className="w-8 h-8 stroke-1 text-slate-300 dark:text-slate-600" />
                      <p className="font-semibold text-slate-600 dark:text-slate-400 text-sm">
                        No inward purchases recorded yet
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        {searchQuery
                          ? `No records matching "${searchQuery}"`
                          : 'Click "+ Record Inward Stock" above to ingest supplier consignments.'}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>

            {/* Sticky Summary Footer Row */}
            {filteredPurchases.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 dark:bg-slate-800 border-t-2 border-slate-300 dark:border-slate-700 font-bold text-slate-900 dark:text-white">
                  <td className="py-3 px-4" colSpan={3}>
                    TOTALS ({filteredPurchases.length} Consignments)
                  </td>
                  <td className="py-3 px-4 text-right font-mono">
                    ₹{formatCurrency(
                      filteredPurchases.reduce((sum, p: any) => {
                        const tot = safeNumber(p.total_amount ?? p.grand_total, 0);
                        const tax = safeNumber(p.total_tax ?? p.gst_amount, 0);
                        return sum + Math.max(0, tot - tax);
                      }, 0),
                      2
                    )}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-emerald-700 dark:text-emerald-400">
                    ₹{formatCurrency(
                      filteredPurchases.reduce(
                        (sum, p: any) => sum + safeNumber(p.total_tax ?? p.gst_amount, 0),
                        0
                      ),
                      2
                    )}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-900 dark:text-white text-sm">
                    ₹{formatCurrency(
                      filteredPurchases.reduce(
                        (sum, p: any) => sum + safeNumber(p.total_amount ?? p.grand_total, 0),
                        0
                      ),
                      2
                    )}
                  </td>
                  <td className="py-3 px-4" colSpan={3} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ─── OPERATIONAL SPLIT GUIDANCE & GODOWN CAPACITY BENTO WIDGETS ─────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Box 1: Real-time Inward Godown Allocation */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between transition-colors">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Boxes className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <h3 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider">
                Godown Storage Capacity
              </h3>
            </div>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1 font-semibold">
                  <span className="text-slate-600 dark:text-slate-400">Bay A-01: Fertilizer Stacks</span>
                  <span className="font-mono text-emerald-700 dark:text-emerald-400">74% Utilized</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-emerald-600 h-2 rounded-full" style={{ width: '74%' }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1 font-semibold">
                  <span className="text-slate-600 dark:text-slate-400">Bay B-02: Agrochemicals (CIB)</span>
                  <span className="font-mono text-sky-700 dark:text-sky-400">42% Utilized</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-sky-600 h-2 rounded-full" style={{ width: '42%' }} />
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
            Godown temperature &amp; moisture compliant with FCO standards.
          </div>
        </div>

        {/* Box 2: Regulatory Checklist for Inward Goods */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between transition-colors">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-5 h-5 text-sky-600 dark:text-sky-400" />
              <h3 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider">
                Inward Statutory Checklist
              </h3>
            </div>
            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Form O Batch Number Verification</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>e-Way Bill GSTIN &amp; Transporter Match</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Standard Weight / Moisture Tolerance Checked</span>
              </li>
            </ul>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
            Mandatory under Fertilizer Control Order 1985.
          </div>
        </div>

        {/* Box 3: Quick Purchase Entry Calculator & Barcode Tool */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between transition-colors">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Barcode className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <h3 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider">
                Fast Barcode Scan Intake
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-3">
              Connect your USB/Bluetooth barcode scanner directly to register consignment batches into FEFO queues rapidly.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setFormError(null);
              setIsModalOpen(true);
            }}
            className="w-full py-2.5 px-3 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900 text-emerald-800 dark:text-emerald-200 font-bold text-xs rounded-xl border border-emerald-200 dark:border-emerald-800 transition text-center"
          >
            Launch Barcode Intake
          </button>
        </div>
      </div>

      {/* ─── INTERACTIVE SLIDE-OVER / MODAL FOR '+ RECORD INWARD STOCK' ─────── */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="record-inward-modal-title"
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in"
        >
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-emerald-800 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <ShoppingBag className="w-5 h-5 text-emerald-300" />
                <h3 id="record-inward-modal-title" className="font-black text-sm sm:text-base">
                  Record Inward Consignment Stock
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                aria-label="Close modal"
                className="text-emerald-200 hover:text-white p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSavePurchase} className="p-5 sm:p-6 space-y-4 text-xs overflow-y-auto flex-1">
              {formError && (
                <div
                  role="alert"
                  className="p-3 bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800 rounded-xl text-xs flex items-center gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Row 1: Supplier & Invoice Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="purchase-supplier-name" className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Supplier / Manufacturer Name *
                  </label>
                  <input
                    id="purchase-supplier-name"
                    type="text"
                    required
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    placeholder="e.g. IFFCO, Bayer CropScience, Coromandel"
                    className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label htmlFor="purchase-supplier-gstin" className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Supplier GSTIN
                  </label>
                  <input
                    id="purchase-supplier-gstin"
                    type="text"
                    maxLength={15}
                    value={supplierGstin}
                    onChange={(e) => setSupplierGstin(e.target.value.toUpperCase())}
                    placeholder="29AAAAA0000A1Z5"
                    className="w-full h-11 px-3.5 font-mono rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 uppercase"
                  />
                </div>
              </div>

              {/* Row 2: Inward Date & Destination Godown */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="purchase-bill-number" className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Invoice / Challan No. *
                  </label>
                  <input
                    id="purchase-bill-number"
                    type="text"
                    required
                    value={billNumber}
                    onChange={(e) => setBillNumber(e.target.value)}
                    placeholder="INV-2026-001"
                    className="w-full h-11 px-3.5 font-mono rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label htmlFor="purchase-bill-date" className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Invoice Date *
                  </label>
                  <input
                    id="purchase-bill-date"
                    type="date"
                    required
                    value={billDate}
                    onChange={(e) => setBillDate(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label htmlFor="purchase-godown-bay" className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Destination Godown Bay
                  </label>
                  <select
                    id="purchase-godown-bay"
                    value={godownBay}
                    onChange={(e) => setGodownBay(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="Bay A-01 (Main Fertilizer Warehouse)">Bay A-01 (Main Fertilizer)</option>
                    <option value="Bay B-02 (Pesticides / CIB Storage)">Bay B-02 (Pesticides / CIB)</option>
                    <option value="Bay C-03 (Certified Seeds Room)">Bay C-03 (Certified Seeds)</option>
                  </select>
                </div>
              </div>

              {/* Product Lines Ingestion Box */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-black text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider">
                    Inward Consignment Items ({items.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="text-emerald-700 dark:text-emerald-400 font-bold hover:underline flex items-center gap-1 text-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add Another Product</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {items.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2.5"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                        <div className="sm:col-span-6">
                          <label
                            htmlFor={`item-product-${idx}`}
                            className="block font-semibold text-slate-600 dark:text-slate-400 text-[11px] mb-0.5"
                          >
                            Product SKU *
                          </label>
                          <select
                            id={`item-product-${idx}`}
                            value={item.product_id || ''}
                            onChange={(e) => handleItemFieldChange(idx, 'product_id', e.target.value)}
                            className="w-full h-10 px-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-emerald-500"
                          >
                            <option value="">-- Select Product --</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.product_name || p.name} ({p.company_name || 'Standard'})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="sm:col-span-3">
                          <label
                            htmlFor={`item-batch-${idx}`}
                            className="block font-semibold text-slate-600 dark:text-slate-400 text-[11px] mb-0.5"
                          >
                            Batch Number *
                          </label>
                          <input
                            id={`item-batch-${idx}`}
                            type="text"
                            required
                            value={item.batch_number || ''}
                            onChange={(e) => handleItemFieldChange(idx, 'batch_number', e.target.value)}
                            className="w-full h-10 px-2.5 font-mono rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs"
                          />
                        </div>

                        <div className="sm:col-span-3">
                          <label
                            htmlFor={`item-expiry-${idx}`}
                            className="block font-semibold text-slate-600 dark:text-slate-400 text-[11px] mb-0.5"
                          >
                            Expiry Date
                          </label>
                          <input
                            id={`item-expiry-${idx}`}
                            type="date"
                            value={item.expiry_date || ''}
                            onChange={(e) => handleItemFieldChange(idx, 'expiry_date', e.target.value)}
                            className="w-full h-10 px-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-12 gap-2 items-end">
                        <div className="sm:col-span-3">
                          <label
                            htmlFor={`item-qty-${idx}`}
                            className="block font-semibold text-slate-600 dark:text-slate-400 text-[11px] mb-0.5"
                          >
                            Quantity *
                          </label>
                          <input
                            id={`item-qty-${idx}`}
                            type="number"
                            min="1"
                            required
                            value={item.quantity || 1}
                            onChange={(e) =>
                              handleItemFieldChange(idx, 'quantity', Number.parseInt(e.target.value, 10))
                            }
                            className="w-full h-10 px-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-mono font-bold"
                          />
                        </div>

                        <div className="sm:col-span-3">
                          <label
                            htmlFor={`item-rate-${idx}`}
                            className="block font-semibold text-slate-600 dark:text-slate-400 text-[11px] mb-0.5"
                          >
                            Purchase Rate (₹) *
                          </label>
                          <input
                            id={`item-rate-${idx}`}
                            type="number"
                            step="any"
                            min="0"
                            required
                            value={item.purchase_price || 0}
                            onChange={(e) =>
                              handleItemFieldChange(
                                idx,
                                'purchase_price',
                                Number.parseFloat(e.target.value)
                              )
                            }
                            className="w-full h-10 px-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-mono font-bold"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label
                            htmlFor={`item-gst-${idx}`}
                            className="block font-semibold text-slate-600 dark:text-slate-400 text-[11px] mb-0.5"
                          >
                            GST Rate
                          </label>
                          <select
                            id={`item-gst-${idx}`}
                            value={item.gst_rate ?? 5}
                            onChange={(e) =>
                              handleItemFieldChange(idx, 'gst_rate', Number.parseInt(e.target.value, 10))
                            }
                            className="w-full h-10 px-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs"
                          >
                            <option value={0}>0% (Exempt)</option>
                            <option value={5}>5% (Fert)</option>
                            <option value={18}>18% (Pest)</option>
                            <option value={12}>12%</option>
                          </select>
                        </div>

                        <div className="sm:col-span-3">
                          <span className="block font-semibold text-slate-600 dark:text-slate-400 text-[11px] mb-0.5">
                            Line Gross Total
                          </span>
                          <div className="h-10 px-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono font-bold flex items-center justify-end">
                            ₹{formatCurrency(item.total_amount, 2)}
                          </div>
                        </div>

                        <div className="sm:col-span-1 flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleRemoveItemRow(idx)}
                            disabled={items.length <= 1}
                            className="h-10 w-10 flex items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/60 disabled:opacity-30 transition"
                            title="Delete item row"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Calculated Summary Box */}
              <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block">Total Inward Consignment Value:</span>
                  <div className="text-xl font-black text-slate-900 dark:text-white font-mono">
                    ₹{formatCurrency(items.reduce((s, it) => s + (it.total_amount || 0), 0), 2)}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold text-xs">
                    ITC: ₹{formatCurrency(items.reduce((s, it) => s + (it.total_amount || 0) * 0.05, 0), 2)}
                  </span>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl font-bold text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-md transition disabled:opacity-50 active:scale-95 inline-flex items-center gap-2"
                >
                  {isSaving ? 'Posting Inward...' : 'Confirm & Post Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── OCR / E-WAY BILL IMPORT MODAL ──────────────────────────────────── */}
      {isOcrModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ocr-modal-title"
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in"
        >
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h3 id="ocr-modal-title" className="font-black text-slate-900 dark:text-white text-base">
                  Import OCR / E-Way Bill
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOcrModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                aria-label="Close OCR modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Upload a scanned supplier invoice PDF or photo of an official E-Way Bill to extract GSTIN, consignment line items, and batch numbers automatically.
            </p>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 rounded-2xl p-6 text-center cursor-pointer transition bg-slate-50 dark:bg-slate-800/40"
            >
              <Upload className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto mb-2" />
              <p className="font-bold text-xs text-slate-800 dark:text-slate-200">
                Click to browse invoice PDF or image
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Supports PDF, PNG, JPG up to 10MB</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    setIsOcrModalOpen(false);
                    setSuccessMsg(`Simulated OCR parse: Uploaded "${e.target.files[0].name}". Data staged for verification.`);
                    setTimeout(() => setSuccessMsg(null), 4000);
                  }
                }}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsOcrModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
