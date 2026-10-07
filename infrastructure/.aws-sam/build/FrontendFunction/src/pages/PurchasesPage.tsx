import React, { useState, useEffect } from 'react';
import { Plus, ShoppingBag, Truck, Check, X, FileText } from 'lucide-react';
import { purchasesApi, productsApi } from '../api';
import { Purchase, Product, PurchaseItem } from '../types';
import { safeNumber, formatCurrency } from '../utils/formatters';


export const PurchasesPage: React.FC = () => {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // New Purchase Form
  const [supplierName, setSupplierName] = useState('IFFCO State Marketing Federation');
  const [supplierGstin, setSupplierGstin] = useState('24AABCI1234E1Z0');
  const [billNumber, setBillNumber] = useState('INV-IFFCO-8821');
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [items, setItems] = useState<Partial<PurchaseItem>[]>([
    {
      product_id: 1,
      product_name: 'IFFCO Neem Coated Urea (45 Kg)',
      batch_number: 'NCU-2024-99',
      expiry_date: '2027-06-30',
      quantity: 100,
      purchase_price: 245.0,
      mrp: 266.5,
      selling_price: 266.5,
      gst_rate: 5,
      taxable_amount: 23333.33,
      cgst_amount: 583.33,
      sgst_amount: 583.33,
      igst_amount: 0,
      total_amount: 24500.0,
    }
  ]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [purchasesList, productsList] = await Promise.all([
        purchasesApi.getAll(),
        productsApi.getAll()
      ]);
      setPurchases(purchasesList);
      setProducts(productsList);
    } catch {
      setPurchases([
        { id: 1, supplier_name: 'IFFCO Regional Depot', supplier_gstin: '24AABCI1234E1Z0', supplier_phone: '02692-234567', bill_number: 'DEPOT-9982', bill_date: '2024-08-15', total_amount: 145000.0, total_tax: 6900.0, status: 'Received', items: [] },
        { id: 2, supplier_name: 'Gujarat State Fertilizers & Chemicals (GSFC)', supplier_gstin: '24AAACG1234A1Z9', bill_number: 'GSFC-8812', bill_date: '2024-08-28', total_amount: 135000.0, total_tax: 6428.0, status: 'Received', items: [] },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleAddItemRow = () => {
    setItems([...items, {
      product_id: products[0]?.id || 1,
      product_name: products[0]?.name || 'Fertilizer Product',
      batch_number: 'B-' + Math.floor(1000 + Math.random() * 9000),
      quantity: 50, purchase_price: 1000, mrp: 1100, selling_price: 1100,
      gst_rate: 5, total_amount: 50000,
    }]);
  };

  const handleSavePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    const total = items.reduce((sum, item) => sum + (item.total_amount || 0), 0);
    const payload = {
      supplier_name: supplierName, supplier_gstin: supplierGstin,
      bill_number: billNumber, bill_date: billDate,
      total_amount: total, total_tax: Math.round(total * 0.05 * 100) / 100,
      items: items.map(it => ({
        ...it,
        taxable_amount: Math.round(((it.purchase_price || 0) * (it.quantity || 1) / 1.05) * 100) / 100,
        cgst_amount: Math.round((((it.purchase_price || 0) * (it.quantity || 1) * 0.025)) * 100) / 100,
        sgst_amount: Math.round((((it.purchase_price || 0) * (it.quantity || 1) * 0.025)) * 100) / 100,
        igst_amount: 0,
      }))
    };

    try {
      await purchasesApi.create(payload);
      setIsModalOpen(false);
      loadData();
    } catch {
      setPurchases([{ id: Date.now(), supplier_name: supplierName, supplier_gstin: supplierGstin, bill_number: billNumber, bill_date: billDate, total_amount: total, total_tax: Math.round(total * 0.05), status: 'Received', items: items as PurchaseItem[] }, ...purchases]);
      setIsModalOpen(false);
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
          onClick={() => setIsModalOpen(true)}
          className="w-full sm:w-auto bg-brand-700 hover:bg-brand-600 text-white font-bold py-3 sm:py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-xs shadow-md transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Record Inward Stock</span>
        </button>
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
              <button onClick={() => setIsModalOpen(false)} className="text-brand-200 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePurchase} className="p-4 sm:p-5 space-y-4 text-xs overflow-y-auto flex-1">
              {/* Supplier Info — stacked on mobile, 2-col on sm */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Supplier / Depot Name *</label>
                  <input
                    type="text" required value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Supplier GSTIN</label>
                  <input
                    type="text" value={supplierGstin}
                    onChange={(e) => setSupplierGstin(e.target.value)}
                    className="w-full px-3 py-2.5 font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Invoice Number *</label>
                  <input
                    type="text" required value={billNumber}
                    onChange={(e) => setBillNumber(e.target.value)}
                    className="w-full px-3 py-2.5 font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Invoice Date</label>
                  <input
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
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Product Name</label>
                        <input
                          type="text" value={item.product_name || ''}
                          onChange={(e) => { const up = [...items]; up[idx].product_name = e.target.value; setItems(up); }}
                          className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Batch No.</label>
                        <input
                          type="text" value={item.batch_number || ''}
                          onChange={(e) => { const up = [...items]; up[idx].batch_number = e.target.value; setItems(up); }}
                          className="w-full px-2.5 py-2 font-mono border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Qty (Bags)</label>
                        <input
                          type="number" value={item.quantity || 1}
                          onChange={(e) => { const up = [...items]; const q = parseInt(e.target.value) || 1; up[idx].quantity = q; up[idx].total_amount = q * (up[idx].purchase_price || 0); setItems(up); }}
                          className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Cost Price (₹)</label>
                        <input
                          type="number" value={item.purchase_price || 0}
                          onChange={(e) => { const up = [...items]; const p = parseFloat(e.target.value) || 0; up[idx].purchase_price = p; up[idx].total_amount = (up[idx].quantity || 1) * p; setItems(up); }}
                          className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Line Total (₹)</label>
                        <input
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
                  className="flex-1 bg-brand-700 hover:bg-brand-600 text-white px-5 py-2.5 rounded-xl font-bold shadow transition-all text-sm"
                >
                  Confirm &amp; Inward
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
