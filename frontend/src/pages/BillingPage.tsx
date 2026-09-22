import React, { useState, useEffect } from 'react';
import { 
  Scan, 
  Search, 
  Plus, 
  Trash2, 
  Printer, 
  Save, 
  RotateCcw, 
  User, 
  Phone, 
  MapPin, 
  CreditCard, 
  QrCode, 
  IndianRupee,
  CheckCircle,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { productsApi, salesApi } from '../api';
import { Product, SaleItem, Sale } from '../types';
import { useShop } from '../context/ShopContext';
import { CameraScannerModal } from '../components/ocr/CameraScannerModal';
import { InvoiceReceiptModal } from '../components/billing/InvoiceReceiptModal';
import { safeNumber, safeString, formatCurrency } from '../utils/formatters';

export const BillingPage: React.FC = () => {
  const { settings } = useShop();

  // Customer State
  const [customerName, setCustomerName] = useState('Cash Customer / Farmer');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerAadhar, setCustomerAadhar] = useState('');
  const [customerGstin, setCustomerGstin] = useState('');
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'UPI' | 'Card' | 'Credit'>('Cash');
  const [isInterstate, setIsInterstate] = useState(false);

  // Cart Items State
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [inventory, setInventory] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);

  // Modals & UI States
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [savedSale, setSavedSale] = useState<Sale | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load products list for fast search
  useEffect(() => {
    const loadProducts = async () => {
      try {
        const list = await productsApi.getAll();
        setInventory(list);
      } catch {
        // Fallback default fertilizer inventory
        setInventory([
          {
            id: 1,
            name: 'IFFCO Neem Coated Urea (45 Kg)',
            category: 'Fertilizer',
            hsn_code: '31021000',
            unit: 'Bags',
            current_stock: 140,
            cost_price: 250,
            selling_price: 266.5,
            mrp: 266.5,
            gst_rate: 5,
            batch_number: 'NCU-2024-88',
            expiry_date: '2027-04-30',
            min_stock_level: 30,
            is_active: true
          },
          {
            id: 2,
            name: 'IFFCO DAP 18-46-0 (50 Kg)',
            category: 'Fertilizer',
            hsn_code: '31053000',
            unit: 'Bags',
            current_stock: 85,
            cost_price: 1280,
            selling_price: 1350.0,
            mrp: 1350.0,
            gst_rate: 5,
            batch_number: 'DAP-901-B',
            expiry_date: '2026-11-20',
            min_stock_level: 25,
            is_active: true
          },
          {
            id: 3,
            name: 'MOP - Muriate of Potash 60% K2O (50 Kg)',
            category: 'Fertilizer',
            hsn_code: '31042000',
            unit: 'Bags',
            current_stock: 45,
            cost_price: 1600,
            selling_price: 1700.0,
            mrp: 1700.0,
            gst_rate: 5,
            batch_number: 'MOP-5521',
            expiry_date: '2027-01-15',
            min_stock_level: 20,
            is_active: true
          },
          {
            id: 4,
            name: 'UPL Saaf Fungicide (500g)',
            category: 'Pesticide',
            hsn_code: '38089290',
            unit: 'Packets',
            current_stock: 35,
            cost_price: 450,
            selling_price: 520.0,
            mrp: 550.0,
            gst_rate: 18,
            batch_number: 'SAF-24-09',
            expiry_date: '2026-06-30',
            min_stock_level: 15,
            is_active: true
          },
          {
            id: 5,
            name: 'Bayer Confidor Insecticide (100ml)',
            category: 'Pesticide',
            hsn_code: '38089199',
            unit: 'Bottles',
            current_stock: 22,
            cost_price: 320,
            selling_price: 380.0,
            mrp: 410.0,
            gst_rate: 18,
            batch_number: 'BC-2023-41',
            expiry_date: '2025-10-15',
            min_stock_level: 10,
            is_active: true
          }
        ]);
      }
    };
    loadProducts();

    // Check if there is an OCR-scanned item passed from Dashboard
    const pendingItemStr = sessionStorage.getItem('pending_bill_item');
    if (pendingItemStr) {
      try {
        const item = JSON.parse(pendingItemStr);
        addItemToCart(item);
        sessionStorage.removeItem('pending_bill_item');
      } catch {}
    }
  }, []);

  // Search filter
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const q = searchQuery.toLowerCase();
    const filtered = inventory.filter(p => {
      const pName = safeString(p.name || p.product_name).toLowerCase();
      const pBatch = safeString(p.batch_number || p.product_code).toLowerCase();
      const pHsn = safeString(p.hsn_code).toLowerCase();
      return pName.includes(q) || pBatch.includes(q) || pHsn.includes(q);
    });
    setSearchResults(filtered.slice(0, 6));
  }, [searchQuery, inventory]);

  // Recalculate line item taxes
  const calculateItemTaxes = (
    price: number,
    qty: number,
    discountPercent: number,
    gstRate: number,
    interstate: boolean
  ) => {
    const gross = price * qty;
    const discountAmt = (gross * discountPercent) / 100;
    const netGross = gross - discountAmt;
    // Since selling_price is inclusive of GST in Indian retail fertilizer billing:
    const taxable = netGross / (1 + gstRate / 100);
    const totalTax = netGross - taxable;

    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    if (interstate) {
      igst = totalTax;
    } else {
      cgst = totalTax / 2;
      sgst = totalTax / 2;
    }

    return {
      discount_amount: Math.round(discountAmt * 100) / 100,
      taxable_amount: Math.round(taxable * 100) / 100,
      cgst_amount: Math.round(cgst * 100) / 100,
      sgst_amount: Math.round(sgst * 100) / 100,
      igst_amount: Math.round(igst * 100) / 100,
      total_amount: Math.round(netGross * 100) / 100,
    };
  };

  const addItemToCart = (item: Partial<SaleItem>) => {
    const existingIndex = cart.findIndex(
      c => c.product_id === item.product_id && c.batch_number === item.batch_number
    );

    const price = item.unit_price || item.mrp || 100;
    const gstRate = item.gst_rate ?? 5;
    const qty = item.quantity || 1;
    const discount = item.discount_percent || 0;

    const taxes = calculateItemTaxes(price, qty, discount, gstRate, isInterstate);

    const newItem: SaleItem = {
      product_id: item.product_id || 1,
      product_name: item.product_name || 'Fertilizer Product',
      batch_number: item.batch_number || 'DEFAULT',
      expiry_date: item.expiry_date,
      hsn_code: item.hsn_code || '31021000',
      unit: item.unit || 'Bags',
      quantity: qty,
      unit_price: price,
      mrp: item.mrp || price,
      discount_percent: discount,
      discount_amount: taxes.discount_amount,
      taxable_amount: taxes.taxable_amount,
      gst_rate: gstRate,
      cgst_amount: taxes.cgst_amount,
      sgst_amount: taxes.sgst_amount,
      igst_amount: taxes.igst_amount,
      total_amount: taxes.total_amount,
    };

    if (existingIndex >= 0) {
      const updated = [...cart];
      const newQty = updated[existingIndex].quantity + qty;
      const updatedTaxes = calculateItemTaxes(
        updated[existingIndex].unit_price,
        newQty,
        updated[existingIndex].discount_percent,
        updated[existingIndex].gst_rate,
        isInterstate
      );
      updated[existingIndex] = {
        ...updated[existingIndex],
        quantity: newQty,
        ...updatedTaxes,
      };
      setCart(updated);
    } else {
      setCart([...cart, newItem]);
    }

    setSearchQuery('');
    setSearchResults([]);
  };

  const updateCartItemQty = (index: number, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(index);
      return;
    }
    const updated = [...cart];
    const item = updated[index];
    const taxes = calculateItemTaxes(
      item.unit_price,
      newQty,
      item.discount_percent,
      item.gst_rate,
      isInterstate
    );
    updated[index] = {
      ...item,
      quantity: newQty,
      ...taxes,
    };
    setCart(updated);
  };

  const updateCartItemPrice = (index: number, newPrice: number) => {
    const updated = [...cart];
    const item = updated[index];
    const taxes = calculateItemTaxes(
      newPrice,
      item.quantity,
      item.discount_percent,
      item.gst_rate,
      isInterstate
    );
    updated[index] = {
      ...item,
      unit_price: newPrice,
      ...taxes,
    };
    setCart(updated);
  };

  const removeFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const clearBill = () => {
    setCart([]);
    setCustomerName('Cash Customer / Farmer');
    setCustomerPhone('');
    setCustomerAddress('');
    setCustomerAadhar('');
    setCustomerGstin('');
    setErrorMsg(null);
  };

  // Totals calculations
  const subtotal = cart.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
  const totalDiscount = cart.reduce((sum, item) => sum + item.discount_amount, 0);
  const totalTaxable = cart.reduce((sum, item) => sum + item.taxable_amount, 0);
  const totalCgst = cart.reduce((sum, item) => sum + item.cgst_amount, 0);
  const totalSgst = cart.reduce((sum, item) => sum + item.sgst_amount, 0);
  const totalIgst = cart.reduce((sum, item) => sum + item.igst_amount, 0);

  const rawGrandTotal = totalTaxable + totalCgst + totalSgst + totalIgst;
  const roundedGrandTotal = Math.round(rawGrandTotal);
  const roundOff = Math.round((roundedGrandTotal - rawGrandTotal) * 100) / 100;

  const handleSaveAndPrint = async () => {
    if (cart.length === 0) {
      setErrorMsg('Please add at least one fertilizer item to the bill.');
      return;
    }
    setErrorMsg(null);
    setIsSaving(true);

    const salePayload = {
      customer_name: customerName || 'Farmer Cash Sale',
      customer_phone: customerPhone,
      customer_address: customerAddress,
      customer_aadhar: customerAadhar,
      customer_gstin: customerGstin,
      payment_mode: paymentMode,
      is_interstate: isInterstate,
      subtotal: Math.round(subtotal * 100) / 100,
      total_discount: Math.round(totalDiscount * 100) / 100,
      total_taxable: Math.round(totalTaxable * 100) / 100,
      total_cgst: Math.round(totalCgst * 100) / 100,
      total_sgst: Math.round(totalSgst * 100) / 100,
      total_igst: Math.round(totalIgst * 100) / 100,
      round_off: roundOff,
      grand_total: roundedGrandTotal,
      items: cart.map(item => ({
        product_id: item.product_id,
        product_name: item.product_name,
        batch_number: item.batch_number,
        expiry_date: item.expiry_date,
        hsn_code: item.hsn_code,
        unit: item.unit,
        quantity: item.quantity,
        unit_price: item.unit_price,
        mrp: item.mrp,
        discount_percent: item.discount_percent,
        discount_amount: item.discount_amount,
        taxable_amount: item.taxable_amount,
        gst_rate: item.gst_rate,
        cgst_amount: item.cgst_amount,
        sgst_amount: item.sgst_amount,
        igst_amount: item.igst_amount,
        total_amount: item.total_amount,
      }))
    };

    try {
      const response = await salesApi.create(salePayload);
      setSavedSale(response);
      setIsReceiptOpen(true);
      clearBill();
    } catch (err: any) {
      console.warn('Backend save failed, generating local offline invoice for preview');
      // Create local fallback invoice
      const randomInvNo = `${settings.invoice_prefix || 'KSK/'}${Math.floor(1000 + Math.random() * 9000)}`;
      const localInvoice: Sale = {
        id: Math.floor(1000 + Math.random() * 9000),
        invoice_number: randomInvNo,
        invoice_date: new Date().toISOString(),
        ...salePayload,
        status: 'Completed',
        items: cart,
      };
      setSavedSale(localInvoice);
      setIsReceiptOpen(true);
      clearBill();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-4">
      {/* Top Banner with Quick Actions */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
            <span>Fertilizer POS Billing Counter</span>
            <span className="text-[11px] bg-brand-100 text-brand-800 font-bold px-2 py-0.5 rounded-full">
              GST Ready
            </span>
          </h1>
          <p className="text-xs text-slate-500">Scan product label or select from warehouse stock</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsScannerOpen(true)}
            className="bg-brand-700 hover:bg-brand-800 text-white font-bold py-2.5 px-4 rounded-xl flex items-center gap-2 text-xs shadow-md shadow-brand-900/10 active:scale-95 transition-all"
          >
            <Scan className="w-4 h-4 text-emerald-300" />
            <span>Scan Fertilizer Label (Camera)</span>
          </button>
          <button
            onClick={clearBill}
            className="p-2.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
            title="Reset Bill"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Layout: Left Billing Items (8 Cols), Right Customer & Payment Summary (4 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Product Search & Items Table (8 Cols) */}
        <div className="lg:col-span-8 space-y-3">
          {/* Fast Product Search Bar */}
          <div className="relative">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Type Fertilizer Name, HSN code or Batch No (e.g. Urea, DAP, Potash, 3102)..."
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500 focus:outline-none shadow-sm"
              />
            </div>

            {/* Auto-suggest dropdown */}
            {searchResults.length > 0 && (
              <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden divide-y divide-slate-100">
                {searchResults.map((product) => (
                  <div
                    key={product.id}
                    onClick={() => addItemToCart({
                      product_id: product.id,
                      product_name: product.name,
                      batch_number: product.batch_number,
                      expiry_date: product.expiry_date,
                      hsn_code: product.hsn_code,
                      unit: product.unit,
                      unit_price: product.selling_price,
                      mrp: product.mrp,
                      gst_rate: product.gst_rate,
                      quantity: 1,
                    })}
                    className="p-3 hover:bg-brand-50/70 cursor-pointer flex items-center justify-between text-xs transition-colors"
                  >
                    <div>
                      <p className="font-bold text-slate-800">{product.name}</p>
                      <p className="text-[11px] text-slate-500">
                        HSN: <span className="font-mono">{product.hsn_code}</span> | Batch: <span className="font-mono">{product.batch_number}</span> | Stock: <strong className="text-brand-700">{product.current_stock} {product.unit}</strong>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-slate-900 text-sm">₹{formatCurrency(product.selling_price)}</p>
                      <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-100 px-1.5 py-0.5 rounded">
                        GST {safeNumber(product.gst_rate)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cart Table Container */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[360px]">
            <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700 uppercase tracking-wider">
                Bill Items ({cart.length})
              </span>
              <span className="text-slate-500 font-medium">
                Prices include applicable GST
              </span>
            </div>

            <div className="flex-1 overflow-x-auto">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-12 text-center text-slate-400 space-y-3">
                  <div className="w-16 h-16 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center">
                    <Scan className="w-8 h-8" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-700 text-sm">Cart is currently empty</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-xs">
                      Click <strong>Scan Fertilizer Label</strong> to take a photo of the bag or search products above to add items.
                    </p>
                  </div>
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/70 text-slate-600 font-semibold border-b border-slate-200 text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3">Product Description</th>
                      <th className="py-2.5 px-2 text-center">Batch / HSN</th>
                      <th className="py-2.5 px-2 text-center w-28">Quantity</th>
                      <th className="py-2.5 px-2 text-right">Rate (₹)</th>
                      <th className="py-2.5 px-2 text-right">Taxable</th>
                      <th className="py-2.5 px-2 text-center">GST%</th>
                      <th className="py-2.5 px-3 text-right">Total (₹)</th>
                      <th className="py-2.5 px-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cart.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70">
                        <td className="py-3 px-3">
                          <p className="font-bold text-slate-900">{item.product_name}</p>
                          <p className="text-[10px] text-slate-500 font-mono">Unit: {item.unit}</p>
                        </td>
                        <td className="py-3 px-2 text-center font-mono text-[11px]">
                          <p className="text-slate-800">{item.batch_number}</p>
                          <p className="text-[10px] text-slate-400">HSN: {item.hsn_code}</p>
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex items-center justify-center border border-slate-300 rounded-lg bg-white overflow-hidden max-w-[100px] mx-auto">
                            <button
                              onClick={() => updateCartItemQty(idx, item.quantity - 1)}
                              className="px-2 py-1 text-slate-600 hover:bg-slate-100 text-sm font-bold"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateCartItemQty(idx, parseInt(e.target.value) || 1)}
                              className="w-10 text-center font-bold text-xs focus:outline-none"
                            />
                            <button
                              onClick={() => updateCartItemQty(idx, item.quantity + 1)}
                              className="px-2 py-1 text-slate-600 hover:bg-slate-100 text-sm font-bold"
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-right">
                          <input
                            type="number"
                            step="0.5"
                            value={item.unit_price}
                            onChange={(e) => updateCartItemPrice(idx, parseFloat(e.target.value) || 0)}
                            className="w-20 text-right px-1.5 py-1 border border-slate-200 rounded font-semibold text-xs focus:ring-1 focus:ring-brand-500 focus:outline-none"
                          />
                        </td>
                        <td className="py-3 px-2 text-right text-slate-600 font-mono">
                          ₹{formatCurrency(item.taxable_amount)}
                        </td>
                        <td className="py-3 px-2 text-center">
                          <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px] font-bold">
                            {safeNumber(item.gst_rate)}%
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-black text-slate-900">
                          ₹{formatCurrency(item.total_amount)}
                        </td>
                        <td className="py-3 px-2 text-center">
                          <button
                            onClick={() => removeFromCart(idx)}
                            className="text-slate-300 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Customer Info, Taxes & Final Checkout (4 Cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Customer Details Card */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-brand-700" />
              Customer Information
            </h3>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Farmer / Customer Name *
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                placeholder="Ramesh Patel"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Mobile Number
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  placeholder="98250..."
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1" title="Mandatory for subsidized fertilizer DBT scheme">
                  Aadhaar (DBT)
                </label>
                <input
                  type="text"
                  maxLength={12}
                  value={customerAadhar}
                  onChange={(e) => setCustomerAadhar(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  placeholder="XXXX-XXXX-XXXX"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Village / Address
              </label>
              <input
                type="text"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                placeholder="Anand Rural"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="text-xs text-slate-600 font-medium cursor-pointer flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isInterstate}
                  onChange={(e) => setIsInterstate(e.target.checked)}
                  className="rounded text-brand-600 focus:ring-brand-500"
                />
                <span>Interstate Supply (IGST)</span>
              </label>
            </div>
          </div>

          {/* Payment Mode Selector */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-2.5">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-brand-700" />
              Payment Method
            </h3>

            <div className="grid grid-cols-2 gap-2">
              {(['Cash', 'UPI', 'Card', 'Credit'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPaymentMode(mode)}
                  className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                    paymentMode === mode
                      ? 'bg-brand-800 text-white shadow-sm ring-2 ring-brand-500/50'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {mode === 'UPI' && <QrCode className="w-3.5 h-3.5" />}
                  {mode === 'Cash' && <IndianRupee className="w-3.5 h-3.5" />}
                  <span>{mode}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Financial Calculation & Checkout Card */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-3">
            <div className="space-y-1.5 text-xs text-slate-600 border-b border-slate-100 pb-3">
              <div className="flex justify-between">
                <span>Gross Subtotal:</span>
                <span className="font-semibold text-slate-800">₹{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Taxable Value:</span>
                <span className="font-mono">₹{formatCurrency(totalTaxable)}</span>
              </div>
              {!isInterstate ? (
                <>
                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span>CGST (Central):</span>
                    <span>₹{formatCurrency(totalCgst)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span>SGST (State):</span>
                    <span>₹{formatCurrency(totalSgst)}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>IGST (Integrated):</span>
                  <span>₹{formatCurrency(totalIgst)}</span>
                </div>
              )}
              {roundOff !== 0 && (
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>Round Off:</span>
                  <span>{roundOff > 0 ? `+₹${formatCurrency(roundOff)}` : `-₹${formatCurrency(Math.abs(roundOff))}`}</span>
                </div>
              )}
            </div>

            {/* Grand Total Highlight */}
            <div className="flex items-baseline justify-between pt-1">
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">Total Payable</p>
                <p className="text-2xl font-black text-brand-900">₹{formatCurrency(roundedGrandTotal)}</p>
              </div>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                {cart.length} item(s)
              </span>
            </div>

            {/* Final Save & Print Invoice Button */}
            <button
              onClick={handleSaveAndPrint}
              disabled={cart.length === 0 || isSaving}
              className="w-full bg-brand-700 hover:bg-brand-800 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-brand-900/20 active:scale-95 transition-all text-sm disabled:opacity-50 disabled:pointer-events-none"
            >
              <Printer className="w-4 h-4" />
              <span>{isSaving ? 'Finalizing Invoice...' : 'Save & Print Invoice'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* OCR Scanner Modal */}
      <CameraScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onAddProductToBill={addItemToCart}
      />

      {/* Invoice Receipt Modal */}
      <InvoiceReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        sale={savedSale}
        settings={settings}
      />
    </div>
  );
};
