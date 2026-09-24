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
  Sparkles,
  Barcode,
  Zap,
  Package,
  X
} from 'lucide-react';
import { productsApi, salesApi, getErrorMessage } from '../api';
import { Product, ProductVariant, ProductBatch, SaleItem, Sale } from '../types';
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
  const [frequentlySold, setFrequentlySold] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeStatus, setBarcodeStatus] = useState<string | null>(null);

  // Packaging Variant Selector & Batch Selector States
  const [variantPickerProduct, setVariantPickerProduct] = useState<Product | null>(null);
  const [batchPickerProduct, setBatchPickerProduct] = useState<{ product: Product; variant?: ProductVariant } | null>(null);

  // Modals & UI States
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [savedSale, setSavedSale] = useState<Sale | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load products list and frequently sold products
  const loadData = async () => {
    try {
      const [list, freq] = await Promise.all([
        productsApi.getAll(),
        salesApi.getFrequentlySold(8).catch(() => [])
      ]);
      setInventory(list);
      setFrequentlySold(freq || []);
    } catch {
      // Local fallback
    }
  };

  useEffect(() => {
    loadData();

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
      const pBarcode = safeString(p.barcode).toLowerCase();
      const pCompany = safeString(p.company_name).toLowerCase();
      return pName.includes(q) || pBatch.includes(q) || pHsn.includes(q) || pBarcode.includes(q) || pCompany.includes(q);
    });
    setSearchResults(filtered.slice(0, 8));
  }, [searchQuery, inventory]);

  // Barcode Lookup Handler
  const handleBarcodeLookup = async (codeToLookup?: string) => {
    const code = (codeToLookup || barcodeInput).trim();
    if (!code) return;

    setBarcodeStatus('Searching...');
    try {
      const product = await productsApi.getByBarcode(code);
      if (product) {
        setBarcodeStatus(`Found ${product.product_name || product.name}`);
        setBarcodeInput('');
        
        // If product has multiple packaging variants, prompt variant selector
        if (product.variants && product.variants.length > 1) {
          setVariantPickerProduct(product);
        } else {
          // Check if multiple active batches exist
          const activeBatches = product.batches && product.batches.length > 0
            ? product.batches.filter(b => b.current_stock > 0 || product.batches!.length === 1)
            : [];
          if (activeBatches.length > 1) {
            setBatchPickerProduct({ product });
          } else {
            addProductToCart(product, undefined, activeBatches[0]);
          }
        }
      }
    } catch {
      setBarcodeStatus('Barcode not found in inventory');
      setTimeout(() => setBarcodeStatus(null), 3000);
    }
  };

  // Fast Product Selector from Search (handles variants & batches)
  const handleSelectProductFromSearch = (product: Product) => {
    if (product.variants && product.variants.length > 1) {
      setVariantPickerProduct(product);
      return;
    }
    const activeBatches = product.batches && product.batches.length > 0
      ? product.batches.filter(b => b.current_stock > 0 || product.batches!.length === 1)
      : [];
    if (activeBatches.length > 1) {
      setBatchPickerProduct({ product });
      return;
    }
    addProductToCart(product, undefined, activeBatches[0]);
  };

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

  // Add Product object to Cart (with optional packaging variant and optional batch)
  const addProductToCart = (product: Product, variant?: ProductVariant, batch?: ProductBatch) => {
    const activeBatches = product.batches && product.batches.length > 0
      ? product.batches.filter(b => b.current_stock > 0 || product.batches!.length === 1)
      : [];

    if (!batch && activeBatches.length > 1) {
      setBatchPickerProduct({ product, variant });
      return;
    }

    const selectedBatch = batch || (activeBatches.length === 1 ? activeBatches[0] : undefined);

    const pName = variant
      ? `${product.product_name || product.name} (${variant.variant_name || `${variant.unit_size} ${variant.unit}`})`
      : (product.product_name || product.name);

    // Prioritize batch selling price if batch selected
    const price = selectedBatch?.selling_price
      ? selectedBatch.selling_price
      : (variant ? variant.selling_price : (product.selling_price || 100));

    const mrp = selectedBatch?.mrp
      ? selectedBatch.mrp
      : (variant ? variant.mrp : (product.mrp || price));

    const unit = variant ? variant.unit : (product.unit || 'Bags');
    const batchNo = selectedBatch?.batch_number || product.batch_number || product.product_code || 'DEFAULT';
    const expiryDate = selectedBatch?.expiry_date || product.expiry_date;

    addItemToCart({
      product_id: product.id,
      batch_id: selectedBatch?.id,
      product_name: pName,
      batch_number: batchNo,
      expiry_date: expiryDate,
      hsn_code: product.hsn_code || '31021000',
      unit: unit,
      unit_price: price,
      mrp: mrp,
      gst_rate: product.gst_rate ?? 5,
      quantity: 1,
    });
  };

  const addItemToCart = (item: Partial<SaleItem>) => {
    const existingIndex = cart.findIndex(
      c => c.product_id === item.product_id && 
           c.product_name === item.product_name && 
           c.batch_number === item.batch_number
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
      payment_method: paymentMode,
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
        batch_id: item.batch_id,
        product_name: item.product_name,
        batch_number: item.batch_number,
        expiry_date: item.expiry_date,
        hsn_code: item.hsn_code,
        unit: item.unit,
        quantity: item.quantity,
        price: item.unit_price,
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
      console.error('Invoice creation error:', err);
      alert(`Could not save invoice in database: ${getErrorMessage(err, 'Failed to save bill')}`);
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
            <span className="text-[11px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
              GST Ready
            </span>
          </h1>
          <p className="text-xs text-slate-500">Scan barcodes with camera, typeahead search, or 1-click popular pills</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsScannerOpen(true)}
            className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-2.5 px-4 rounded-xl flex items-center gap-2 text-xs shadow-md shadow-emerald-900/10 active:scale-95 transition-all"
          >
            <Scan className="w-4 h-4 text-emerald-200" />
            <span>Scan with Camera</span>
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

      {/* Frequently Sold Quick Pills */}
      {frequentlySold && frequentlySold.length > 0 && (
        <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              Frequently Billed Products (1-Click Add):
            </span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            {frequentlySold.map((fItem) => {
              const matchedProduct = inventory.find(p => p.id === fItem.id);
              return (
                <button
                  key={fItem.id}
                  onClick={() => {
                    if (matchedProduct) {
                      if (matchedProduct.variants && matchedProduct.variants.length > 1) {
                        setVariantPickerProduct(matchedProduct);
                      } else {
                        addProductToCart(matchedProduct);
                      }
                    }
                  }}
                  className="px-3 py-1.5 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 border border-slate-200 rounded-xl font-medium text-slate-800 flex items-center gap-2 shrink-0 transition shadow-xs active:scale-95"
                >
                  <span className="font-bold text-slate-900">{fItem.product_name}</span>
                  <span className="font-semibold text-emerald-700 font-mono">
                    ₹{formatCurrency(fItem.selling_price)}
                  </span>
                  <span className="text-[10px] bg-slate-200 text-slate-600 px-1 rounded font-mono">
                    {fItem.current_stock} {fItem.unit}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Layout: Left Billing Items (8 Cols), Right Customer & Payment Summary (4 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Product Search & Items Table (8 Cols) */}
        <div className="lg:col-span-8 space-y-3">
          {/* Dual Bar: Barcode Scanner Input + Search Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
            {/* Direct Barcode Entry */}
            <div className="sm:col-span-5 relative">
              <div className="relative">
                <Barcode className="w-4 h-4 text-emerald-700 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    setBarcodeInput(val);
                    if (val.trim().length === 5) {
                      handleBarcodeLookup(val);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleBarcodeLookup();
                    }
                  }}
                  placeholder="Scan / Type 5-Digit Barcode (e.g. 10001)"
                  className="w-full pl-10 pr-16 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => handleBarcodeLookup()}
                  className="absolute right-1.5 top-1.5 bottom-1.5 px-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-[11px] font-bold"
                >
                  Lookup
                </button>
              </div>
              {barcodeStatus && (
                <div className="absolute z-20 left-0 mt-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  {barcodeStatus}
                </div>
              )}
            </div>

            {/* Fast Product Search Bar */}
            <div className="sm:col-span-7 relative">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (searchResults.length > 0) {
                        handleSelectProductFromSearch(searchResults[0]);
                        setSearchQuery('');
                        setSearchResults([]);
                      }
                    }
                  }}
                  placeholder="Type product name (Press Enter to Add) or brand, HSN..."
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none shadow-sm"
                />
              </div>

              {/* Auto-suggest dropdown */}
              {searchResults.length > 0 && (
                <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden divide-y divide-slate-100 max-h-72 overflow-y-auto">
                  {searchResults.map((product) => (
                    <div
                      key={product.id}
                      onClick={() => {
                        handleSelectProductFromSearch(product);
                        setSearchQuery('');
                        setSearchResults([]);
                      }}
                      className="p-3 hover:bg-emerald-50/70 cursor-pointer flex items-center justify-between text-xs transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-800">{product.name || product.product_name}</p>
                          {product.barcode && (
                            <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-1 rounded">
                              {product.barcode}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500">
                          {product.company_name ? `${product.company_name} • ` : ''}
                          Batch: <span className="font-mono">{product.batch_number}</span> | Stock: <strong className="text-emerald-700">{product.current_stock} {product.unit}</strong>
                          {product.variants && product.variants.length > 1 ? ` • (${product.variants.length} packaging sizes)` : ''}
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
          </div>

          {/* Cart Items Container - Responsive Dual View */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[300px]">
            <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <span>Bill Items ({cart.length})</span>
                {cart.length > 0 && (
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                    Total: ₹{formatCurrency(roundedGrandTotal)}
                  </span>
                )}
              </span>
              <span className="text-slate-500 font-medium hidden sm:inline">
                Prices include applicable GST
              </span>
            </div>

            <div className="flex-1">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-8 sm:p-12 text-center text-slate-400 space-y-3">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Scan className="w-8 h-8" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-700 text-sm">Cart is currently empty</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-xs">
                      Scan product barcode with camera or scanner, or search product above to start billing.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* MOBILE VIEW (< md): Touch-Friendly Item Cards */}
                  <div className="md:hidden p-2.5 space-y-2.5 divide-y-0">
                    {cart.map((item, idx) => (
                      <div
                        key={idx}
                        className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/80 shadow-xs space-y-2.5"
                      >
                        {/* Top: Product Name, Batch, and Trash */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <h4 className="font-bold text-slate-900 text-xs sm:text-sm leading-tight truncate">
                              {item.product_name}
                            </h4>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-slate-500 font-mono">
                              <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-700">
                                Batch: {item.batch_number}
                              </span>
                              <span className="text-slate-400">Unit: {item.unit}</span>
                              <span className="bg-emerald-50 text-emerald-700 font-bold px-1.5 py-0.5 rounded border border-emerald-200 text-[10px]">
                                GST {safeNumber(item.gst_rate)}%
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeFromCart(idx)}
                            className="p-2 text-slate-400 hover:text-red-500 active:text-red-600 rounded-lg -mr-1 -mt-1 transition"
                            title="Remove Item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Middle: Touch Quantity Controls & Price */}
                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/60">
                          {/* Large Thumb-friendly Quantity Stepper */}
                          <div className="flex items-center border border-slate-300 rounded-xl bg-white overflow-hidden shadow-xs">
                            <button
                              type="button"
                              onClick={() => updateCartItemQty(idx, item.quantity - 1)}
                              className="w-9 h-9 flex items-center justify-center text-slate-700 hover:bg-slate-100 active:bg-slate-200 text-base font-bold transition select-none"
                              aria-label="Decrease quantity"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateCartItemQty(idx, parseInt(e.target.value) || 1)}
                              className="w-12 h-9 text-center font-bold text-sm text-slate-900 focus:outline-none bg-transparent"
                            />
                            <button
                              type="button"
                              onClick={() => updateCartItemQty(idx, item.quantity + 1)}
                              className="w-9 h-9 flex items-center justify-center text-slate-700 hover:bg-slate-100 active:bg-slate-200 text-base font-bold transition select-none"
                              aria-label="Increase quantity"
                            >
                              +
                            </button>
                          </div>

                          {/* Editable Price Rate */}
                          <div className="flex items-center gap-1 text-right">
                            <span className="text-xs text-slate-400 font-bold">Rate ₹</span>
                            <input
                              type="number"
                              step="0.5"
                              value={item.unit_price}
                              onChange={(e) => updateCartItemPrice(idx, parseFloat(e.target.value) || 0)}
                              className="w-20 text-right px-2 py-1.5 border border-slate-300 rounded-lg font-bold text-xs bg-white text-slate-900 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                            />
                          </div>
                        </div>

                        {/* Bottom: Taxable Breakdown and Total Amount */}
                        <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-xs">
                          <span className="text-slate-500 text-[11px] font-mono">
                            Taxable: ₹{formatCurrency(item.taxable_amount)}
                          </span>
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 block leading-none">Line Total</span>
                            <span className="font-black text-sm text-slate-900 font-mono">
                              ₹{formatCurrency(item.total_amount)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* DESKTOP VIEW (>= md): Full Detail Data Table */}
                  <div className="hidden md:block overflow-x-auto">
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
                                  type="button"
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
                                  type="button"
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
                                className="w-20 text-right px-1.5 py-1 border border-slate-200 rounded font-semibold text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
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
                                type="button"
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
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Customer Info, Taxes & Final Checkout (4 Cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Customer Details Card */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-emerald-800" />
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
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
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
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
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
                  className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
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
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                placeholder="Anand Rural"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="text-xs text-slate-600 font-medium cursor-pointer flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isInterstate}
                  onChange={(e) => setIsInterstate(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>Interstate Supply (IGST)</span>
              </label>
            </div>
          </div>

          {/* Payment Mode Selector */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-2.5">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-emerald-800" />
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
                      ? 'bg-emerald-800 text-white shadow-sm ring-2 ring-emerald-500/50'
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
                <p className="text-2xl font-black text-slate-900">₹{formatCurrency(roundedGrandTotal)}</p>
              </div>
              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                {cart.length} item(s)
              </span>
            </div>

            {/* Final Save & Print Invoice Button */}
            <button
              onClick={handleSaveAndPrint}
              disabled={cart.length === 0 || isSaving}
              className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20 active:scale-95 transition-all text-sm disabled:opacity-50 disabled:pointer-events-none"
            >
              <Printer className="w-4 h-4" />
              <span>{isSaving ? 'Finalizing Invoice...' : 'Save & Print Invoice'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Floating Sticky Checkout Bar */}
      {cart.length > 0 && (
        <div className="md:hidden fixed bottom-[68px] left-2 right-2 z-20 bg-slate-900/95 backdrop-blur-md text-white p-3 rounded-2xl shadow-2xl border border-slate-700/60 flex items-center justify-between animate-in slide-in-from-bottom-2 duration-150">
          <div className="overflow-hidden mr-2">
            <p className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
              {cart.length} Item{cart.length > 1 ? 's' : ''} in Bill
            </p>
            <p className="text-lg font-black text-white truncate font-mono">
              ₹{formatCurrency(roundedGrandTotal)}
            </p>
          </div>
          <button
            type="button"
            onClick={handleSaveAndPrint}
            disabled={isSaving}
            className="bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl flex items-center gap-1.5 text-xs shadow-lg shadow-emerald-950/40 active:scale-95 transition-all shrink-0"
          >
            <Printer className="w-4 h-4" />
            <span>{isSaving ? 'Finalizing...' : 'Save & Print'}</span>
          </button>
        </div>
      )}

      {/* Packaging Variant Picker Modal */}
      {variantPickerProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden p-4 sm:p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  Select Packaging Size & Price
                </h3>
                <p className="text-xs text-slate-500">
                  {variantPickerProduct.product_name || variantPickerProduct.name}
                </p>
              </div>
              <button
                onClick={() => setVariantPickerProduct(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              {variantPickerProduct.variants?.map((v) => (
                <button
                  key={v.variant_name}
                  onClick={() => {
                    const prod = variantPickerProduct;
                    setVariantPickerProduct(null);
                    const activeBatches = prod.batches && prod.batches.length > 0
                      ? prod.batches.filter(b => b.current_stock > 0 || prod.batches!.length === 1)
                      : [];
                    if (activeBatches.length > 1) {
                      setBatchPickerProduct({ product: prod, variant: v });
                    } else {
                      addProductToCart(prod, v, activeBatches[0]);
                    }
                  }}
                  className="w-full p-3.5 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 flex items-center justify-between transition text-left group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-emerald-100 text-emerald-800 rounded-lg group-hover:bg-emerald-600 group-hover:text-white transition">
                      <Package className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-slate-900">
                        {v.variant_name || `${v.unit_size} ${v.unit}`}
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Size: {v.unit_size} {v.unit} • MRP: ₹{formatCurrency(v.mrp || v.selling_price)}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-black text-sm text-slate-900 block">
                      ₹{formatCurrency(v.selling_price)}
                    </span>
                    <span className="text-[10px] text-emerald-700 font-semibold">
                      Select Size
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Batch & Expiry Selection Modal (Multi-Batch / Price Variance) */}
      {batchPickerProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 max-h-[90vh] flex flex-col">
            <div className="px-5 py-4 bg-emerald-800 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <Package className="w-4 h-4 text-emerald-300" />
                  Select Batch & Expiry Date
                </h3>
                <p className="text-[11px] text-emerald-200">
                  {batchPickerProduct.product.product_name || batchPickerProduct.product.name}
                  {batchPickerProduct.variant ? ` (${batchPickerProduct.variant.variant_name})` : ''}
                </p>
              </div>
              <button
                onClick={() => setBatchPickerProduct(null)}
                className="text-emerald-200 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[11px] flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Multiple batches found in godown. <strong>FIFO Recommendation:</strong> Hand over older batch to farmer first.
                </span>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {batchPickerProduct.product.batches?.map((b, idx) => {
                  const isOldest = idx === 0;
                  return (
                    <button
                      key={b.id || idx}
                      onClick={() => {
                        addProductToCart(batchPickerProduct.product, batchPickerProduct.variant, b);
                        setBatchPickerProduct(null);
                      }}
                      className={`w-full p-3.5 text-left border rounded-xl transition flex items-center justify-between group ${
                        isOldest
                          ? 'border-emerald-500 bg-emerald-50/50 hover:bg-emerald-100/60'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {b.batch_number}
                          </span>
                          {isOldest && (
                            <span className="text-[10px] font-bold bg-emerald-600 text-white px-1.5 py-0.5 rounded-full">
                              FIFO Sell First
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-600 flex items-center gap-3">
                          <span>Expiry: <strong className="text-slate-800">{b.expiry_date}</strong></span>
                          <span>•</span>
                          <span>Stock: <strong className="text-slate-800">{b.current_stock}</strong></span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-black text-sm text-emerald-800 font-mono">
                          ₹{formatCurrency(b.selling_price)}
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 group-hover:text-emerald-700">
                          Select [{idx + 1}]
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setBatchPickerProduct(null)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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
