import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Scan,
  Search,
  Plus,
  Trash2,
  Printer,
  RotateCcw,
  User,
  Phone,
  CreditCard,
  QrCode,
  IndianRupee,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Barcode,
  Zap,
  Package,
  Eraser,
  Sprout,
  X,
  ChevronRight,
  ShieldCheck,
  Send,
  Smartphone,
  Layers,
  ArrowUpDown,
  FileCheck2
} from 'lucide-react';
import { productsApi, salesApi, khataApi, settingsApi, getErrorMessage } from '../api';
import { Product, ProductVariant, ProductBatch, SaleItem, Sale } from '../types';
import { useShop } from '../context/ShopContext';
import { useAuth } from '../context/AuthContext';
import { CameraScannerModal } from '../components/ocr/CameraScannerModal';
import { InvoiceReceiptModal } from '../components/billing/InvoiceReceiptModal';
import { AgriDoctorModal } from '../components/billing/AgriDoctorModal';
import {
  safeNumber,
  safeString,
  formatCurrency,
  sanitizeTextInput as sanitizeText,
  sanitizeCodeInput as sanitizeCode,
  sanitizePhoneInput,
  isValidPhone,
  generateBillIdempotencyKey,
  mergeProductSearchResults,
} from '../utils/formatters';

type PaymentType = 'Cash' | 'UPI' | 'Card' | 'Credit';
interface PaymentSplit {
  method: PaymentType;
  amount: number;
}

const getSellableBatches = (product: Product): ProductBatch[] => {
  const batches = product.batches ?? [];
  if (batches.length === 0) return [];
  const sellable = batches.length === 1 ? batches : batches.filter((b) => b.current_stock > 0);
  const expiryTime = (b: ProductBatch) => {
    const t = b.expiry_date ? new Date(b.expiry_date).getTime() : Number.NaN;
    return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
  };
  return [...sellable].sort((a, b) => expiryTime(a) - expiryTime(b));
};

const INITIAL_STAGED_CART: SaleItem[] = [
  {
    product_id: 101,
    batch_id: 501,
    product_name: 'IFFCO Neem Coated Urea (45kg)',
    trade_name: 'Neem Urea',
    batch_number: 'UF-982',
    expiry_date: '2026-10-31',
    hsn_code: '310210',
    unit: 'Bags',
    quantity: 4,
    unit_price: 266.5,
    mrp: 266.5,
    discount_percent: 0,
    discount_amount: 0,
    taxable_amount: 1015.24,
    gst_rate: 5,
    cgst_amount: 25.38,
    sgst_amount: 25.38,
    igst_amount: 0,
    total_amount: 1066.0,
  },
  {
    product_id: 102,
    batch_id: 502,
    product_name: 'Syngenta Ridomil Gold (Mancozeb 64% + Metalaxyl-M 4%)',
    trade_name: 'Ridomil Gold',
    batch_number: 'RG-702',
    expiry_date: '2024-11-10',
    hsn_code: '380891',
    unit: 'Pkt',
    quantity: 2,
    unit_price: 980.0,
    mrp: 980.0,
    discount_percent: 0,
    discount_amount: 0,
    taxable_amount: 1661.02,
    gst_rate: 18,
    cgst_amount: 149.49,
    sgst_amount: 149.49,
    igst_amount: 0,
    total_amount: 1960.0,
  },
  {
    product_id: 103,
    batch_id: 503,
    product_name: 'Bayer Regent 0.3G (Fipronil 0.3% GR) - 1kg Jar',
    trade_name: 'Regent 0.3G',
    batch_number: 'BR-411',
    expiry_date: '2024-10-14',
    hsn_code: '380891',
    unit: 'Jar',
    quantity: 2,
    unit_price: 552.5,
    mrp: 650.0,
    discount_percent: 15,
    discount_amount: 195.0,
    taxable_amount: 936.44,
    gst_rate: 18,
    cgst_amount: 84.28,
    sgst_amount: 84.28,
    igst_amount: 0,
    total_amount: 1105.0,
  },
];

export const BillingPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { settings } = useShop();

  // Customer State
  const [customerName, setCustomerName] = useState('Ramesh B. Gowda');
  const [customerPhone, setCustomerPhone] = useState('9876543210');
  const [customerAddress, setCustomerAddress] = useState('Hosur Road Village, Plot #4B');
  const [customerAadhar, setCustomerAadhar] = useState('548920194821');
  const [customerGstin, setCustomerGstin] = useState('');
  const [farmerId, setFarmerId] = useState('FRM-KA-092');
  const [isFarmerEditing, setIsFarmerEditing] = useState(false);
  const [autoSendWhatsApp, setAutoSendWhatsApp] = useState(true);

  // Payment Tender State
  const [selectedTender, setSelectedTender] = useState<PaymentType>('UPI');
  const [paymentSplits, setPaymentSplits] = useState<PaymentSplit[]>([{ method: 'UPI', amount: 0 }]);
  const [isInterstate, setIsInterstate] = useState(false);

  // Cart Items State
  const [cart, setCart] = useState<SaleItem[]>(INITIAL_STAGED_CART);
  const [inventory, setInventory] = useState<Product[]>([]);
  const [frequentlySold, setFrequentlySold] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [selectedCategoryChip, setSelectedCategoryChip] = useState<string>('ALL');
  const [barcodeStatus, setBarcodeStatus] = useState<string | null>(null);
  const [barcodeError, setBarcodeError] = useState(false);

  // Modals & Variant / Batch States
  const [variantPickerProduct, setVariantPickerProduct] = useState<Product | null>(null);
  const [batchPickerProduct, setBatchPickerProduct] = useState<{
    product: Product;
    variant?: ProductVariant;
  } | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isAgriDoctorOpen, setIsAgriDoctorOpen] = useState(false);
  const [savedSale, setSavedSale] = useState<Sale | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [billIdempotencyKey, setBillIdempotencyKey] = useState<string>(() =>
    generateBillIdempotencyKey()
  );

  const omnibarInputRef = useRef<HTMLInputElement>(null);

  // Calculate Line Item Taxes
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

  // Keyboard Shortcuts (F1 to F6, F8, Enter, Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        omnibarInputRef.current?.focus();
        omnibarInputRef.current?.select();
      } else if (e.key === 'F2') {
        e.preventDefault();
        omnibarInputRef.current?.focus();
      } else if (e.key === 'F3') {
        e.preventDefault();
        setIsFarmerEditing((prev) => !prev);
      } else if (e.key === 'F4') {
        e.preventDefault();
        handleSelectTender('UPI');
      } else if (e.key === 'F5') {
        e.preventDefault();
        handleSelectTender('Cash');
      } else if (e.key === 'F6') {
        e.preventDefault();
        handleSelectTender('Credit');
      } else if (e.key === 'Escape') {
        if (batchPickerProduct) setBatchPickerProduct(null);
        else if (variantPickerProduct) setVariantPickerProduct(null);
        else setSearchResults([]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [batchPickerProduct, variantPickerProduct]);

  // Load Inventory & Initial Router State
  useEffect(() => {
    const loadData = async () => {
      try {
        const [list, freq] = await Promise.all([
          productsApi.getAll().catch(() => []),
          salesApi.getFrequentlySold(8).catch(() => []),
        ]);
        setInventory(Array.isArray(list) ? list : []);
        setFrequentlySold(Array.isArray(freq) ? freq : []);
      } catch {
        setInventory([]);
        setFrequentlySold([]);
      }
    };

    if (user?.id) {
      void loadData();
    }

    // Process Router State (pendingBillItem or stagedCartItems)
    const state = location.state as any;
    if (state?.pendingBillItem) {
      addItemToCart(state.pendingBillItem);
    } else if (state?.stagedCartItems && Array.isArray(state.stagedCartItems)) {
      const converted: SaleItem[] = state.stagedCartItems.map((item: any, i: number) => {
        const taxes = calculateItemTaxes(
          item.rate || item.unit_price || 100,
          item.quantity || 1,
          0,
          item.gstRate || item.gst_rate || 5,
          false
        );
        return {
          product_id: item.productId || item.product_id || 100 + i,
          batch_id: item.batchId || item.batch_id,
          product_name: item.name || item.product_name || 'Product',
          trade_name: item.trade_name,
          batch_number: item.batch || item.batch_number || 'DEFAULT',
          expiry_date: item.expiry_date,
          hsn_code: item.hsn_code || '310210',
          unit: item.unit || 'Bags',
          quantity: item.quantity || 1,
          unit_price: item.rate || item.unit_price || 100,
          mrp: item.mrp || item.rate || 100,
          discount_percent: 0,
          ...taxes,
        };
      });
      setCart(converted);
      if (state.paymentMode) {
        handleSelectTender(state.paymentMode === 'KHATA' ? 'Credit' : state.paymentMode);
      }
    }
  }, [user?.id, location.state]);

  // Product Search Filter
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      return;
    }
    const q = trimmed.toLowerCase();
    const invList = Array.isArray(inventory) ? inventory : [];
    const filtered = invList.filter((p) => {
      const pName = safeString(p.name || p.product_name).toLowerCase();
      const pTrade = safeString(p.trade_name).toLowerCase();
      const pCat = safeString(p.category).toLowerCase();
      const pBatch = safeString(p.batch_number || p.product_code).toLowerCase();
      const pHsn = safeString(p.hsn_code).toLowerCase();
      const pBarcode = safeString(p.barcode).toLowerCase();
      const pCompany = safeString(p.company_name).toLowerCase();
      return (
        pName.includes(q) ||
        pTrade.includes(q) ||
        pCat.includes(q) ||
        pBatch.includes(q) ||
        pHsn.includes(q) ||
        pBarcode.includes(q) ||
        pCompany.includes(q)
      );
    });
    setSearchResults(filtered.slice(0, 30));
  }, [searchQuery, inventory]);

  const handleSelectTender = (method: PaymentType) => {
    setSelectedTender(method);
    setPaymentSplits([{ method, amount: roundedGrandTotal }]);
  };

  // Add Item to Cart
  const addItemToCart = (item: Partial<SaleItem>) => {
    const price = item.unit_price || item.mrp || 100;
    const gstRate = item.gst_rate ?? 5;
    const qty = item.quantity || 1;
    const discount = item.discount_percent || 0;

    const existingIndex = cart.findIndex(
      (c) =>
        c.product_id === item.product_id &&
        c.product_name === item.product_name &&
        c.batch_number === item.batch_number
    );

    const taxes = calculateItemTaxes(price, qty, discount, gstRate, isInterstate);

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
      const newItem: SaleItem = {
        product_id: item.product_id || Math.floor(Math.random() * 9000) + 1000,
        batch_id: item.batch_id,
        product_name: item.product_name || 'Agri Item',
        trade_name: item.trade_name,
        batch_number: item.batch_number || 'DEFAULT',
        expiry_date: item.expiry_date,
        hsn_code: item.hsn_code || '380891',
        unit: item.unit || 'Pack',
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
      setCart([...cart, newItem]);
    }

    setSearchQuery('');
    setSearchResults([]);
  };

  const addProductToCart = (product: Product, variant?: ProductVariant, batch?: ProductBatch) => {
    const activeBatches = getSellableBatches(product);

    if (!batch && activeBatches.length > 1) {
      setBatchPickerProduct({ product, variant });
      return;
    }

    const selectedBatch = batch || (activeBatches.length === 1 ? activeBatches[0] : undefined);
    const pName = variant
      ? `${product.product_name || product.name} (${variant.variant_name || `${variant.unit_size} ${variant.unit}`})`
      : product.product_name || product.name;

    const price = selectedBatch?.selling_price
      ? selectedBatch.selling_price
      : variant
      ? variant.selling_price
      : product.selling_price || 100;

    const mrp = selectedBatch?.mrp
      ? selectedBatch.mrp
      : variant
      ? variant.mrp
      : product.mrp || price;

    addItemToCart({
      product_id: product.id,
      batch_id: selectedBatch?.id,
      product_name: pName,
      trade_name: selectedBatch?.trade_name || product.trade_name,
      batch_number: selectedBatch?.batch_number || product.batch_number || 'DEFAULT',
      expiry_date: selectedBatch?.expiry_date || product.expiry_date,
      hsn_code: product.hsn_code || '380891',
      unit: variant ? variant.unit : product.unit || 'Pack',
      unit_price: price,
      mrp,
      gst_rate: product.gst_rate ?? 5,
      quantity: 1,
    });
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

  const removeFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const clearBill = () => {
    setCart([]);
    setErrorMsg(null);
    setBillIdempotencyKey(generateBillIdempotencyKey());
  };

  const handleWalkInToggle = () => {
    setCustomerName('Walk-in Cash Grower');
    setCustomerPhone('');
    setCustomerAadhar('');
    setFarmerId('WALK-IN');
    handleSelectTender('Cash');
    setIsFarmerEditing(false);
  };

  // Math Calculations
  const grossSubtotal = cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  const totalClearanceDiscount = cart.reduce((sum, item) => sum + item.discount_amount, 0);
  const totalTaxable = cart.reduce((sum, item) => sum + item.taxable_amount, 0);
  const totalCgst = cart.reduce((sum, item) => sum + item.cgst_amount, 0);
  const totalSgst = cart.reduce((sum, item) => sum + item.sgst_amount, 0);
  const totalIgst = cart.reduce((sum, item) => sum + item.igst_amount, 0);

  // Subsidized Urea calculation for DBT offset display
  const dbtSubsidyOffset = cart.some((i) => i.product_name.includes('Urea')) ? 800.0 : 0.0;

  const rawGrandTotal = totalTaxable + totalCgst + totalSgst + totalIgst;
  const roundedGrandTotal = Math.round(rawGrandTotal);
  const roundOff = Math.round((roundedGrandTotal - rawGrandTotal) * 100) / 100;

  // Handle Save Sale and Print
  const handleSaveAndPrint = async () => {
    if (cart.length === 0) {
      setErrorMsg('Please add at least one product to the staged bill.');
      return;
    }
    setErrorMsg(null);
    setIsSaving(true);

    const cleanPhone = sanitizePhoneInput(customerPhone);
    const salePayload = {
      idempotency_key: billIdempotencyKey,
      customer_name: sanitizeText(customerName, 120) || 'Ramesh B. Gowda',
      customer_phone: cleanPhone || '9876543210',
      customer_address: sanitizeText(customerAddress, 300),
      customer_aadhar: customerAadhar.replace(/\D/g, '').slice(0, 12),
      customer_gstin: sanitizeCode(customerGstin, 15, true),
      payment_method: selectedTender,
      payment_mode: selectedTender,
      payment_details: JSON.stringify([{ method: selectedTender, amount: roundedGrandTotal }]),
      is_interstate: isInterstate,
      subtotal: Math.round(grossSubtotal * 100) / 100,
      total_discount: Math.round(totalClearanceDiscount * 100) / 100,
      total_taxable: Math.round(totalTaxable * 100) / 100,
      total_cgst: Math.round(totalCgst * 100) / 100,
      total_sgst: Math.round(totalSgst * 100) / 100,
      total_igst: Math.round(totalIgst * 100) / 100,
      round_off: roundOff,
      grand_total: roundedGrandTotal,
      items: cart.map((item) => ({
        product_id: item.product_id,
        batch_id: item.batch_id,
        product_name: item.product_name,
        trade_name: item.trade_name,
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
      })),
    };

    try {
      const response = await salesApi.create(salePayload);
      setSavedSale(response);
      setIsReceiptOpen(true);
      clearBill();
    } catch (err: any) {
      setErrorMsg(`Could not finalize bill: ${getErrorMessage(err, 'Failed to save bill')}`);
    } finally {
      setIsSaving(false);
    }
  };

  const userName = user?.full_name || 'Devendra Gowda';
  const shopName = settings.shop_name || 'Green Valley Agro Kendra';
  const upiId = (settings.upi_id || 'greenvalleyagro@sbi').trim();

  return (
    <div className="w-full min-h-screen bg-surface font-sans text-on-surface antialiased pb-20">
      <div className="flex flex-col w-full">
        {/* ─── INTERACTIVE POS QUICK BILLING COUNTER WORKSPACE ─── */}
        <div className="w-full flex flex-col gap-4 p-4 sm:p-6 max-w-[1600px] mx-auto">
          {/* TOP COMMAND & HOTKEY DOCK (Luminous Modern Pill Strip) */}
          <div className="w-full bg-surface-container-lowest/80 backdrop-blur-xl rounded-2xl p-4 shadow-xs border border-surface-container flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
            {/* Breadcrumb & Active Terminal */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 bg-sprout-tint text-primary px-3 py-1.5 rounded-xl text-[10px] font-bold tracking-wider uppercase">
                <span className="w-2 h-2 rounded-full bg-forest-emerald animate-pulse" />
                LIVE COUNTER #01
              </div>
              <div className="flex items-center gap-2 text-xs sm:text-sm">
                <span className="text-on-surface-variant font-medium">POS Billing</span>
                <span className="text-outline-variant font-mono">/</span>
                <span className="text-on-surface font-bold tracking-tight">
                  Active Terminal • {userName}
                </span>
              </div>
            </div>

            {/* Quick Hotkey Keyboard Badges */}
            <div className="hidden 2xl:flex items-center gap-2 overflow-x-auto py-0.5">
              <button
                type="button"
                onClick={() => omnibarInputRef.current?.focus()}
                className="flex items-center gap-1.5 bg-surface-container-low hover:bg-surface-container px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
              >
                <span className="font-mono text-xs bg-surface-container-highest text-primary font-bold px-1.5 py-0.5 rounded">
                  F1
                </span>
                <span className="text-xs text-on-surface-variant">Scan</span>
              </button>
              <button
                type="button"
                onClick={() => omnibarInputRef.current?.focus()}
                className="flex items-center gap-1.5 bg-surface-container-low hover:bg-surface-container px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
              >
                <span className="font-mono text-xs bg-surface-container-highest text-primary font-bold px-1.5 py-0.5 rounded">
                  F2
                </span>
                <span className="text-xs text-on-surface-variant">Search SKU</span>
              </button>
              <button
                type="button"
                onClick={() => setIsFarmerEditing((prev) => !prev)}
                className="flex items-center gap-1.5 bg-surface-container-low hover:bg-surface-container px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
              >
                <span className="font-mono text-xs bg-surface-container-highest text-primary font-bold px-1.5 py-0.5 rounded">
                  F3
                </span>
                <span className="text-xs text-on-surface-variant">DBT Farmer</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectTender('UPI')}
                className="flex items-center gap-1.5 bg-surface-container-low hover:bg-surface-container px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
              >
                <span className="font-mono text-xs bg-surface-container-highest text-primary font-bold px-1.5 py-0.5 rounded">
                  F4
                </span>
                <span className="text-xs text-on-surface-variant">UPI QR</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectTender('Cash')}
                className="flex items-center gap-1.5 bg-surface-container-low hover:bg-surface-container px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
              >
                <span className="font-mono text-xs bg-surface-container-highest text-primary font-bold px-1.5 py-0.5 rounded">
                  F5
                </span>
                <span className="text-xs text-on-surface-variant">Cash</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectTender('Credit')}
                className="flex items-center gap-1.5 bg-surface-container-low hover:bg-surface-container px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
              >
                <span className="font-mono text-xs bg-khata-amber-bg text-khata-amber font-bold px-1.5 py-0.5 rounded">
                  F6
                </span>
                <span className="text-xs text-on-surface-variant">Khata</span>
              </button>
              <button
                type="button"
                onClick={() => void handleSaveAndPrint()}
                className="flex items-center gap-1.5 bg-sprout-tint hover:bg-secondary-container px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
              >
                <span className="font-mono text-xs bg-forest-emerald text-on-primary font-bold px-1.5 py-0.5 rounded">
                  ↵ Enter
                </span>
                <span className="text-xs text-primary font-semibold">Settle</span>
              </button>
            </div>

            {/* Till Status Pill */}
            <div className="flex items-center gap-3 bg-surface-container-low/90 px-3.5 py-1.5 rounded-xl ml-auto xl:ml-0 border border-surface-container">
              <span className="material-symbols-outlined text-forest-emerald text-[18px]">
                lock_clock
              </span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-on-surface-variant">Drawer #01</span>
                <span className="w-1 h-1 rounded-full bg-outline" />
                <span className="font-mono text-xs sm:text-sm text-primary font-bold">
                  ₹42,850
                </span>
                <span className="w-1 h-1 rounded-full bg-outline" />
                <span className="font-mono text-xs text-on-surface-variant">84 Bills</span>
              </div>
            </div>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="p-4 bg-critical-rose-bg text-critical-rose border border-critical-rose/30 rounded-xl text-xs sm:text-sm flex items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-critical-rose" />
                <span>{errorMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setErrorMsg(null)}
                className="text-critical-rose hover:opacity-80 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* MAIN TWO-COLUMN FLUID WORKSTATION */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* ══════════ LEFT COLUMN: 65% Interactive Fast-Billing & Cart Staging (8 Cols) ══════════ */}
            <div className="lg:col-span-8 flex flex-col gap-4">
              {/* Omnibar Search & High-Speed Barcode Gun Input */}
              <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-xs border border-surface-container flex flex-col gap-3 relative overflow-hidden">
                <div className="flex items-center gap-3 bg-surface-container-low rounded-xl px-4 py-2.5 transition-all focus-within:bg-sprout-tint focus-within:ring-2 focus-within:ring-primary">
                  <span className="material-symbols-outlined text-forest-emerald text-[24px]">
                    barcode_scanner
                  </span>
                  <label htmlFor="sku-omnibar-input" className="sr-only">
                    Scan Barcode or Search Molecule, Brand, HSN
                  </label>
                  <input
                    id="sku-omnibar-input"
                    ref={omnibarInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (searchResults.length > 0) {
                          addProductToCart(searchResults[0]);
                          setSearchQuery('');
                          setSearchResults([]);
                        }
                      }
                    }}
                    placeholder="Scan Barcode or Search Molecule, Brand, HSN (e.g. Neem Coated Urea, Ridomil, Glyphosate 41%)..."
                    className="w-full bg-transparent text-on-surface text-xs sm:text-sm placeholder:text-on-surface-variant/60 outline-none"
                  />
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsScannerOpen(true)}
                      className="flex items-center gap-1 text-forest-emerald bg-surface-container-lowest px-2.5 py-1 rounded-lg font-mono text-[11px] font-bold hover:bg-forest-emerald hover:text-on-primary transition-all shadow-xs"
                    >
                      <span className="material-symbols-outlined text-[14px]">sensors</span>
                      <span>AUTO-SCAN ON</span>
                    </button>
                    <kbd className="font-mono text-xs bg-surface-container-high text-on-surface-variant px-2 py-1 rounded font-bold">
                      F1
                    </kbd>
                  </div>
                </div>

                {/* Auto-suggest dropdown when typing in omnibar */}
                {searchResults.length > 0 && (
                  <div className="absolute z-40 left-4 right-4 top-16 bg-surface-container-lowest border border-surface-container rounded-2xl shadow-2xl overflow-hidden divide-y divide-surface-container max-h-80 overflow-y-auto">
                    {searchResults.map((product) => (
                      <button
                        type="button"
                        key={product.id}
                        onClick={() => {
                          addProductToCart(product);
                          setSearchQuery('');
                          setSearchResults([]);
                        }}
                        className="w-full text-left p-3.5 hover:bg-sprout-tint/60 flex items-center justify-between text-xs transition-colors cursor-pointer"
                      >
                        <div className="min-w-0 pr-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-on-surface truncate">
                              {product.name || product.product_name}
                            </span>
                            {product.category && (
                              <span className="text-[10px] font-semibold bg-surface-container text-on-surface-variant px-2 py-0.5 rounded-full">
                                {product.category}
                              </span>
                            )}
                            {product.batch_number && (
                              <span className="font-mono text-[10px] text-outline">
                                Batch: {product.batch_number}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-on-surface-variant mt-0.5">
                            HSN: {product.hsn_code || '380891'} • Stock:{' '}
                            <strong className="text-forest-emerald">
                              {product.current_stock} {product.unit}
                            </strong>
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-mono font-bold text-sm text-on-surface block">
                            ₹{formatCurrency(product.selling_price)}
                          </span>
                          <span className="font-mono text-[10px] text-primary font-semibold">
                            GST {safeNumber(product.gst_rate)}%
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Quick Categorical Chips */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategoryChip('Fertilizers');
                      setSearchQuery('Urea');
                    }}
                    className="bg-primary text-on-primary text-xs px-3.5 py-1.5 rounded-full font-semibold flex items-center gap-1.5 shrink-0 shadow-xs hover:brightness-105 transition-all"
                  >
                    <span className="material-symbols-outlined text-[16px]">eco</span>
                    <span>Fertilizers (Subsidized DBT)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategoryChip('Insecticides');
                      setSearchQuery('Regent');
                    }}
                    className="bg-surface-container-low hover:bg-surface-container text-on-surface text-xs px-3 py-1.5 rounded-full font-semibold flex items-center gap-1.5 shrink-0 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">bug_report</span>
                    <span>Insecticides</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategoryChip('Herbicides');
                      setSearchQuery('Glyphosate');
                    }}
                    className="bg-surface-container-low hover:bg-surface-container text-on-surface text-xs px-3 py-1.5 rounded-full font-semibold flex items-center gap-1.5 shrink-0 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">grass</span>
                    <span>Herbicides</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategoryChip('Seeds');
                      setSearchQuery('Maize');
                    }}
                    className="bg-surface-container-low hover:bg-surface-container text-on-surface text-xs px-3 py-1.5 rounded-full font-semibold flex items-center gap-1.5 shrink-0 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">grain</span>
                    <span>Hybrid Seeds</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategoryChip('Micronutrients');
                      setSearchQuery('Zinc');
                    }}
                    className="bg-surface-container-low hover:bg-surface-container text-on-surface text-xs px-3 py-1.5 rounded-full font-semibold flex items-center gap-1.5 shrink-0 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">science</span>
                    <span>Micronutrients</span>
                  </button>
                </div>
              </div>

              {/* FARMER PROFILE & AADHAAR DBT CARD */}
              <div className="bg-surface-container-lowest rounded-2xl p-4 sm:p-5 shadow-xs border border-surface-container flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="relative w-14 h-14 rounded-2xl overflow-hidden shrink-0 shadow-sm border border-surface-container">
                    <img
                      className="w-full h-full object-cover"
                      alt="Dignified Indian farmer portrait outdoors with turban in warm morning light"
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuADZdcdu_EpR0DTGsw6ZbUzT2o3nZuhjA_px1BhNXzW_9_yj2BpcExQwbyBVO9bApGeg3dMxQuyZOVYAHDA01DkeP5cuk1-UqBCc8Ur4Hu9Dm7nfdCus-zx8bhEDE_paYiO3IPKsHz1dx8oe8WVRo8HmCoECUkfoLSQaPNT-RVsY87eTL8I-fwLe5C7Gjqa_TiyHhDEFBrFQS1kcDjnOyC3G_i-y7sPeJs4x_CV9Spd"
                    />
                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-forest-emerald ring-2 ring-surface-container-lowest" />
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base sm:text-lg font-bold text-on-surface">
                        {customerName}
                      </span>
                      <span className="font-mono text-xs bg-surface-container-high text-on-surface-variant px-2 py-0.5 rounded-md font-semibold">
                        {farmerId}
                      </span>
                      <span className="text-[10px] font-bold bg-sprout-tint text-primary px-2 py-0.5 rounded-full flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">verified</span> DBT
                        VERIFIED
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant flex items-center gap-1.5 mt-0.5">
                      <span className="material-symbols-outlined text-[16px] text-forest-emerald">
                        fingerprint
                      </span>
                      Aadhaar Biometric Matched • {customerAddress} • Entitlement Active
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 self-stretch md:self-auto justify-between md:justify-end bg-surface-container-low/70 px-4 py-2.5 rounded-xl border border-surface-container">
                  <div className="flex flex-col">
                    <span className="font-mono text-[10px] text-khata-amber font-bold uppercase tracking-wider flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-khata-amber" />
                      Khata Balance
                    </span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-mono text-base font-bold text-on-surface leading-tight">
                        ₹12,400
                      </span>
                      <span className="font-mono text-[11px] text-on-surface-variant">
                        / Limit ₹50,000
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsFarmerEditing((prev) => !prev)}
                      className="w-9 h-9 rounded-xl bg-surface-container-lowest hover:bg-surface-container text-on-surface-variant hover:text-on-surface flex items-center justify-center transition-colors shadow-xs border border-surface-container"
                      title="Switch Farmer (F3)"
                    >
                      <span className="material-symbols-outlined text-[18px]">swap_horiz</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleWalkInToggle}
                      className="text-xs bg-surface-container-lowest hover:bg-surface-container text-on-surface px-3 py-2 rounded-xl font-semibold transition-colors shadow-xs border border-surface-container"
                    >
                      Walk-in
                    </button>
                  </div>
                </div>
              </div>

              {/* Farmer Quick Edit Expandable Form */}
              {isFarmerEditing && (
                <div className="bg-surface-container-low p-4 rounded-2xl border border-surface-container grid grid-cols-1 sm:grid-cols-4 gap-3 animate-in fade-in duration-150">
                  <div>
                    <label htmlFor="edit-cust-name" className="block text-[10px] font-bold text-outline uppercase mb-1">
                      Farmer Name
                    </label>
                    <input
                      id="edit-cust-name"
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg bg-surface-container-lowest text-xs text-on-surface font-semibold border border-surface-container focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label htmlFor="edit-cust-phone" className="block text-[10px] font-bold text-outline uppercase mb-1">
                      Mobile No
                    </label>
                    <input
                      id="edit-cust-phone"
                      type="text"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg bg-surface-container-lowest text-xs text-on-surface font-mono border border-surface-container focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label htmlFor="edit-cust-aadhar" className="block text-[10px] font-bold text-outline uppercase mb-1">
                      Aadhaar UID
                    </label>
                    <input
                      id="edit-cust-aadhar"
                      type="text"
                      value={customerAadhar}
                      onChange={(e) => setCustomerAadhar(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg bg-surface-container-lowest text-xs text-on-surface font-mono border border-surface-container focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => setIsFarmerEditing(false)}
                      className="w-full h-9 rounded-lg bg-primary text-on-primary font-bold text-xs hover:bg-canopy-deep transition-all"
                    >
                      Done Editing
                    </button>
                  </div>
                </div>
              )}

              {/* STAGED CART ITEMS LEDGER */}
              <div className="bg-surface-container-lowest rounded-2xl shadow-xs border border-surface-container overflow-hidden flex flex-col">
                <div className="p-4 flex items-center justify-between bg-surface-container-low/40 border-b border-surface-container">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-on-surface">Staged Billing Items</span>
                    <span className="text-[10px] font-bold bg-sprout-tint text-primary px-2.5 py-0.5 rounded-full">
                      {cart.length} ACTIVE ITEMS
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-on-surface-variant font-mono text-xs">
                    <span className="material-symbols-outlined text-[16px] text-forest-emerald">
                      layers
                    </span>
                    FIFO Smart Allocation Active
                  </div>
                </div>

                {/* Items Staging List */}
                <div className="divide-y divide-surface-container flex flex-col">
                  {cart.map((item, idx) => (
                    <div
                      key={`${item.product_id}-${item.batch_number}-${idx}`}
                      className="p-4 hover:bg-surface-container-low/30 transition-colors flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                    >
                      <div className="flex items-start gap-4 flex-1 min-w-0">
                        <div className="w-12 h-12 rounded-xl bg-sprout-tint flex items-center justify-center text-primary shrink-0 font-bold shadow-xs">
                          <span className="material-symbols-outlined text-[24px]">
                            {item.product_name.toLowerCase().includes('urea')
                              ? 'yard'
                              : item.product_name.toLowerCase().includes('ridomil')
                              ? 'pest_control'
                              : 'crisis_alert'}
                          </span>
                        </div>
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-on-surface truncate">
                              {item.product_name}
                            </span>
                            {item.product_name.includes('Urea') && (
                              <span className="text-[10px] font-bold bg-regulatory-sky-bg text-regulatory-sky px-2 py-0.5 rounded-full">
                                DBT SUBSIDY
                              </span>
                            )}
                            {item.discount_percent > 0 && (
                              <span className="text-[10px] font-bold bg-sprout-tint text-primary px-2 py-0.5 rounded-full">
                                AUTO {item.discount_percent}% CLEARANCE
                              </span>
                            )}
                            <span className="font-mono text-[10px] bg-surface-container-high text-on-surface-variant px-1.5 py-0.5 rounded font-medium">
                              HSN: {item.hsn_code || '380891'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 font-mono text-[11px] text-on-surface-variant mt-1 flex-wrap">
                            <span>
                              Batch: <strong className="text-on-surface">{item.batch_number}</strong>
                            </span>
                            <span>
                              Exp:{' '}
                              <span className="text-forest-emerald font-semibold">
                                {item.expiry_date || 'Stable'}
                              </span>
                            </span>
                            <span>
                              Rate:{' '}
                              <span className="text-on-surface font-semibold">
                                ₹{formatCurrency(item.unit_price)} / {item.unit}
                              </span>
                            </span>
                            <span className="text-primary font-semibold">GST: {item.gst_rate}%</span>
                          </div>
                        </div>
                      </div>

                      {/* Quantity Controls & Item Total */}
                      <div className="flex items-center gap-4 self-end md:self-auto shrink-0">
                        <div className="flex items-center bg-surface-container-low rounded-xl p-1 border border-surface-container">
                          <button
                            type="button"
                            onClick={() => updateCartItemQty(idx, item.quantity - 1)}
                            className="w-8 h-8 rounded-lg bg-surface-container-lowest hover:bg-surface-container flex items-center justify-center text-on-surface transition-colors font-bold shadow-xs"
                            title="Decrease quantity"
                            aria-label={`Decrease ${item.product_name} quantity`}
                          >
                            -
                          </button>
                          <span className="font-mono text-sm font-bold text-on-surface px-3">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateCartItemQty(idx, item.quantity + 1)}
                            className="w-8 h-8 rounded-lg bg-surface-container-lowest hover:bg-surface-container flex items-center justify-center text-on-surface transition-colors font-bold shadow-xs"
                            title="Increase quantity"
                            aria-label={`Increase ${item.product_name} quantity`}
                          >
                            +
                          </button>
                        </div>
                        <div className="flex flex-col items-end min-w-[100px]">
                          <span className="font-mono text-base font-bold text-primary">
                            ₹{formatCurrency(item.unit_price * item.quantity)}
                          </span>
                          {item.product_name.includes('Urea') ? (
                            <span className="font-mono text-[10px] text-regulatory-sky font-semibold">
                              DBT Offset ₹800
                            </span>
                          ) : item.discount_amount > 0 ? (
                            <span className="font-mono text-[10px] text-critical-rose font-bold">
                              Saved ₹{formatCurrency(item.discount_amount)}
                            </span>
                          ) : (
                            <span className="font-mono text-[10px] text-on-surface-variant">
                              Tax Incl.
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFromCart(idx)}
                          className="text-outline-variant hover:text-critical-rose transition-colors p-1"
                          title="Remove Item"
                          aria-label={`Remove ${item.product_name}`}
                        >
                          <span className="material-symbols-outlined text-[20px]">delete_sweep</span>
                        </button>
                      </div>
                    </div>
                  ))}

                  {cart.length === 0 && (
                    <div className="p-8 text-center text-outline text-xs">
                      Cart is empty. Scan product barcode with gun or press{' '}
                      <span className="font-mono font-bold text-primary">[F1]</span> to search.
                    </div>
                  )}
                </div>
              </div>

              {/* AGRI DOCTOR AI RECOMMENDATIONS BAR */}
              <div className="bg-gradient-to-r from-surface-container-lowest via-sprout-tint/60 to-surface-container-lowest rounded-2xl p-4 shadow-xs border border-surface-container flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-iam-purple-bg flex items-center justify-center text-iam-purple shadow-xs shrink-0">
                    <span className="material-symbols-outlined text-[22px]">psychology</span>
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-bold text-on-surface">
                        Agri Doctor AI Pairing
                      </span>
                      <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-iam-purple-bg text-iam-purple">
                        DISEASE COMPANION
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant">
                      Farmer has Ridomil in cart. Pairing with silicone adjuvant increases efficacy by
                      38% for Chilli blast.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    addItemToCart({
                      product_id: 104,
                      product_name: 'Dhanuka Wetcit (Silicone Adjuvant) - 100ml',
                      unit: 'Bottle',
                      unit_price: 180,
                      mrp: 180,
                      gst_rate: 18,
                      quantity: 1,
                    });
                  }}
                  className="w-full sm:w-auto bg-surface-container-lowest hover:bg-primary hover:text-on-primary text-forest-emerald text-xs px-4 py-2.5 rounded-xl font-bold transition-all shadow-xs border border-surface-container flex items-center justify-center gap-2 shrink-0 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">add_circle</span>
                  <span>+ Add Dhanuka Wetcit (100ml) • ₹180</span>
                </button>
              </div>
            </div>

            {/* ══════════ RIGHT COLUMN: 35% Billing Calculation, Tender, & Live Thermal Slip (4 Cols) ══════════ */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              {/* BILL SUMMARY CARD */}
              <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-xs border border-surface-container flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-on-surface">Tax Invoice Calculation</span>
                  <span className="font-mono text-xs bg-surface-container-high text-on-surface-variant px-2 py-0.5 rounded font-bold">
                    BILL #NB-8492
                  </span>
                </div>

                {/* Tabular Math Calculations */}
                <div className="flex flex-col gap-2 text-xs text-on-surface-variant">
                  <div className="flex items-center justify-between">
                    <span>Subtotal (Items Gross Value)</span>
                    <span className="font-mono font-bold text-on-surface">
                      ₹{formatCurrency(grossSubtotal)}
                    </span>
                  </div>

                  {dbtSubsidyOffset > 0 && (
                    <div className="flex items-center justify-between text-regulatory-sky font-semibold">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[16px]">verified</span>
                        DBT Govt Subsidy Offset
                      </span>
                      <span className="font-mono font-bold">-₹{formatCurrency(dbtSubsidyOffset)}</span>
                    </div>
                  )}

                  {totalClearanceDiscount > 0 && (
                    <div className="flex items-center justify-between text-critical-rose font-semibold">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[16px]">trending_down</span>
                        FIFO Expiry Clearance Discount
                      </span>
                      <span className="font-mono font-bold">
                        -₹{formatCurrency(totalClearanceDiscount)}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span>GST (CGST ₹{formatCurrency(totalCgst)} + SGST ₹{formatCurrency(totalSgst)})</span>
                    <span className="font-mono font-bold text-on-surface">
                      ₹{formatCurrency(totalCgst + totalSgst + totalIgst)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span>Auto Round-off (50 Paisa Rule)</span>
                    <span className="font-mono text-on-surface-variant font-medium">
                      {roundOff >= 0 ? `+₹${roundOff}` : `-₹${Math.abs(roundOff)}`}
                    </span>
                  </div>

                  {/* Total Amount Payable Spotlight */}
                  <div className="mt-1 pt-3 bg-sprout-tint/70 p-4 rounded-2xl flex flex-col gap-1 border border-secondary-container/50">
                    <span className="text-[10px] font-bold text-forest-emerald tracking-widest uppercase">
                      Net Payable Total
                    </span>
                    <div className="flex items-baseline justify-between">
                      <span className="font-mono text-2xl sm:text-3xl font-black text-primary tracking-tight">
                        ₹{formatCurrency(roundedGrandTotal)}
                      </span>
                      <span className="font-mono text-xs text-primary font-bold bg-surface-container-lowest px-2 py-1 rounded-md shadow-xs">
                        INC. ALL TAXES
                      </span>
                    </div>
                  </div>
                </div>

                {/* PAYMENT TENDER SELECTOR (Fluid Segmented Pills) */}
                <div className="flex flex-col gap-1.5">
                  <span className="font-mono text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">
                    Select Payment Mode
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => handleSelectTender('UPI')}
                      className={`flex flex-col items-center justify-center p-2.5 rounded-xl font-semibold transition-all cursor-pointer ${
                        selectedTender === 'UPI'
                          ? 'bg-forest-emerald text-on-primary shadow-xs'
                          : 'bg-surface-container-low hover:bg-surface-container text-on-surface'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[20px]">qr_code_scanner</span>
                      <span className="text-xs mt-0.5">UPI QR</span>
                      <span className="font-mono text-[10px] opacity-80">[F4]</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectTender('Cash')}
                      className={`flex flex-col items-center justify-center p-2.5 rounded-xl font-semibold transition-all cursor-pointer ${
                        selectedTender === 'Cash'
                          ? 'bg-forest-emerald text-on-primary shadow-xs'
                          : 'bg-surface-container-low hover:bg-surface-container text-on-surface'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[20px]">payments</span>
                      <span className="text-xs mt-0.5">Cash</span>
                      <span className="font-mono text-[10px] opacity-80">[F5]</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectTender('Credit')}
                      className={`flex flex-col items-center justify-center p-2.5 rounded-xl font-semibold transition-all cursor-pointer ${
                        selectedTender === 'Credit'
                          ? 'bg-khata-amber text-white shadow-xs'
                          : 'bg-khata-amber-bg text-khata-amber hover:opacity-90'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[20px]">menu_book</span>
                      <span className="text-xs mt-0.5">Khata</span>
                      <span className="font-mono text-[10px] opacity-80">[F6]</span>
                    </button>
                  </div>
                </div>

                {/* Dynamic UPI Fast QR Container */}
                <div className="bg-surface-container-low/70 rounded-xl p-3.5 flex items-center gap-3.5 border border-surface-container">
                  <div className="w-18 h-18 bg-surface-container-lowest p-1 rounded-xl shadow-xs shrink-0 flex items-center justify-center border border-surface-container">
                    <svg
                      className="w-full h-full fill-current text-on-surface"
                      viewBox="0 0 100 100"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <rect fill="currentColor" height="28" rx="4" width="28" x="5" y="5" />
                      <rect fill="#fff" height="20" rx="2" width="20" x="9" y="9" />
                      <rect fill="currentColor" height="12" rx="1" width="12" x="13" y="13" />
                      <rect fill="currentColor" height="28" rx="4" width="28" x="67" y="5" />
                      <rect fill="#fff" height="20" rx="2" width="20" x="71" y="9" />
                      <rect fill="currentColor" height="12" rx="1" width="12" x="75" y="13" />
                      <rect fill="currentColor" height="28" rx="4" width="28" x="5" y="67" />
                      <rect fill="#fff" height="20" rx="2" width="20" x="9" y="71" />
                      <rect fill="currentColor" height="12" rx="1" width="12" x="13" y="75" />
                      <rect height="6" rx="1" width="6" x="40" y="8" />
                      <rect height="6" rx="1" width="6" x="52" y="8" />
                      <rect height="6" rx="1" width="6" x="40" y="20" />
                      <rect height="6" rx="1" width="6" x="52" y="20" />
                      <rect height="6" rx="1" width="20" x="40" y="32" />
                      <rect height="18" rx="1" width="6" x="8" y="42" />
                      <rect height="6" rx="1" width="6" x="20" y="45" />
                      <rect height="6" rx="1" width="10" x="32" y="42" />
                      <rect height="12" rx="1" width="8" x="50" y="45" />
                      <rect height="6" rx="1" width="24" x="68" y="42" />
                      <rect height="8" rx="1" width="8" x="40" y="65" />
                      <rect height="6" rx="1" width="15" x="55" y="65" />
                      <rect height="8" rx="1" width="18" x="40" y="80" />
                      <rect height="12" rx="1" width="12" x="65" y="78" />
                      <rect height="22" rx="1" width="10" x="82" y="68" />
                    </svg>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-on-surface">Scan with BHIM / GPay</span>
                    <span className="font-mono text-[11px] text-on-surface-variant truncate">
                      {upiId}
                    </span>
                    <span className="font-mono text-sm text-primary font-bold mt-0.5">
                      ₹{formatCurrency(roundedGrandTotal)}
                    </span>
                  </div>
                </div>

                {/* WhatsApp e-Bill Dispatch Checkbox */}
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoSendWhatsApp}
                    onChange={(e) => setAutoSendWhatsApp(e.target.checked)}
                    className="w-4 h-4 rounded text-forest-emerald accent-forest-emerald cursor-pointer"
                  />
                  <span className="text-xs text-on-surface font-medium flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-forest-emerald">
                      send_to_mobile
                    </span>
                    Auto-send PDF Tax Invoice via WhatsApp to {customerPhone || '+91 98765 43210'}
                  </span>
                </label>

                {/* PRIMARY ACTION BUTTON: PRINT & SETTLE */}
                <div className="flex flex-col gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => void handleSaveAndPrint()}
                    disabled={isSaving}
                    className="w-full bg-forest-emerald hover:bg-canopy-deep text-on-primary text-sm py-4 px-4 rounded-2xl font-bold shadow-md transition-all flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[24px]">print</span>
                    <span>
                      {isSaving ? 'Finalizing Bill...' : '⚡ Print Thermal Bill & Next'}
                    </span>
                    <span className="font-mono text-xs bg-on-primary/20 text-on-primary px-2 py-0.5 rounded font-bold ml-1">
                      ↵ Enter
                    </span>
                  </button>

                  {/* Secondary Actions Strip */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => clearBill()}
                      className="bg-surface-container-low hover:bg-surface-container text-on-surface text-xs py-2.5 px-3 rounded-xl font-semibold flex items-center justify-center gap-1 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">pause_circle</span>
                      <span>Hold Cart [F8]</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/khata?tab=compliance')}
                      className="bg-surface-container-low hover:bg-surface-container text-on-surface text-xs py-2.5 px-3 rounded-xl font-semibold flex items-center justify-center gap-1 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">verified</span>
                      <span>Form O Voucher</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* LIVE ESC/POS 80mm THERMAL SLIP PREVIEW */}
              <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-xs border border-surface-container flex flex-col gap-2">
                <div className="flex items-center justify-between pb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-on-surface-variant text-[18px]">
                      receipt_long
                    </span>
                    <span className="text-xs font-bold text-on-surface">
                      80mm ESC/POS Live Stream
                    </span>
                  </div>
                  <span className="font-mono text-[10px] bg-sprout-tint text-primary px-2 py-0.5 rounded-full font-bold">
                    READY TO CUT
                  </span>
                </div>

                {/* Monospace Receipt Paper Simulator */}
                <div className="bg-surface-bright rounded-xl p-4 text-on-surface font-mono text-[11px] flex flex-col gap-1 shadow-inner border border-outline-variant/30">
                  <div className="text-center flex flex-col items-center">
                    <span className="font-bold text-xs tracking-wider">
                      *** {shopName.toUpperCase()} ***
                    </span>
                    <span className="text-on-surface-variant text-[10px]">
                      Hosur Main Rd, Anekal, Bengaluru - 562106
                    </span>
                    <span className="text-on-surface-variant text-[10px]">
                      GSTIN: {settings.gstin || '29AAAAA0000A1Z5'} | Ph: 080-27849102
                    </span>
                    <span className="text-on-surface-variant text-[10px]">
                      FERT LIC: {settings.fertilizer_license_no || 'FCO/CR/KA/2021/8940'}
                    </span>
                  </div>

                  <div className="my-1 border-t border-dashed border-outline-variant" />

                  <div className="flex justify-between text-[10px]">
                    <span>Bill: #NB-8492</span>
                    <span>18-Oct-2024 11:42 AM</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span>Farmer: {customerName}</span>
                    <span>DBT: Verified UID</span>
                  </div>

                  <div className="my-1 border-t border-dashed border-outline-variant" />

                  {/* Receipt Line Items */}
                  <div className="flex flex-col gap-1 text-[10px]">
                    <div className="flex justify-between font-bold">
                      <span>ITEM</span>
                      <span>QTY x RATE</span>
                      <span>AMT</span>
                    </div>
                    {cart.map((item, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span className="truncate max-w-[140px]">{item.product_name}</span>
                        <span>
                          {item.quantity} x {item.unit_price}
                        </span>
                        <span>{(item.quantity * item.unit_price).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="my-1 border-t border-dashed border-outline-variant" />

                  <div className="flex flex-col gap-0.5 text-[10px]">
                    <div className="flex justify-between">
                      <span>Gross Value</span>
                      <span>₹{grossSubtotal.toFixed(2)}</span>
                    </div>
                    {dbtSubsidyOffset > 0 && (
                      <div className="flex justify-between text-primary font-bold">
                        <span>Govt Subsidy Offset</span>
                        <span>-₹{dbtSubsidyOffset.toFixed(2)}</span>
                      </div>
                    )}
                    {totalClearanceDiscount > 0 && (
                      <div className="flex justify-between text-critical-rose">
                        <span>FIFO Exp. Discount</span>
                        <span>-₹{totalClearanceDiscount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>CGST + SGST</span>
                      <span>₹{(totalCgst + totalSgst).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-xs pt-1 border-t border-on-surface">
                      <span>NET PAYABLE</span>
                      <span>₹{roundedGrandTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-[9px] text-on-surface-variant">
                      <span>Payment Mode: {selectedTender} (Verified)</span>
                    </div>
                  </div>

                  <div className="my-1 border-t border-dashed border-outline-variant" />

                  {/* Statutory Form O Seal Stamp */}
                  <div className="text-center text-[9px] text-on-surface-variant flex flex-col items-center">
                    <span>*** STATUTORY FORM O COMPLIANT VOUCHER ***</span>
                    <span>Quality certified under Fertilizer Control Order 1985</span>
                    <span>Thank You! Keep Our State Green!</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Packaging Variant Picker Modal */}
      {variantPickerProduct && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="variant-modal-title"
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 id="variant-modal-title" className="font-bold text-sm text-slate-900">
                  Select Packaging Size &amp; Price
                </h3>
                <p className="text-xs text-slate-500">
                  {variantPickerProduct.product_name || variantPickerProduct.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setVariantPickerProduct(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              {variantPickerProduct.variants?.map((v) => (
                <button
                  type="button"
                  key={v.variant_name}
                  onClick={() => {
                    const prod = variantPickerProduct;
                    setVariantPickerProduct(null);
                    addProductToCart(prod, v);
                  }}
                  className="w-full p-3.5 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 flex items-center justify-between transition text-left"
                >
                  <div>
                    <h4 className="font-bold text-xs text-slate-900">
                      {v.variant_name || `${v.unit_size} ${v.unit}`}
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Size: {v.unit_size} {v.unit} • MRP: ₹{formatCurrency(v.mrp || v.selling_price)}
                    </p>
                  </div>
                  <span className="font-mono font-bold text-sm text-slate-900">
                    ₹{formatCurrency(v.selling_price)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Batch & Expiry Selection Modal */}
      {batchPickerProduct && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="batch-modal-title"
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 max-h-[90vh] flex flex-col">
            <div className="px-5 py-4 bg-emerald-800 text-white flex items-center justify-between">
              <div>
                <h3 id="batch-modal-title" className="font-bold text-sm flex items-center gap-2">
                  <Package className="w-4 h-4 text-emerald-300" />
                  Select Batch &amp; Expiry Date
                </h3>
                <p className="text-[11px] text-emerald-200">
                  {batchPickerProduct.product.product_name || batchPickerProduct.product.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBatchPickerProduct(null)}
                className="text-emerald-200 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-2 max-h-72 overflow-y-auto">
              {getSellableBatches(batchPickerProduct.product).map((b, idx) => (
                <button
                  type="button"
                  key={b.id || idx}
                  onClick={() => {
                    addProductToCart(batchPickerProduct.product, batchPickerProduct.variant, b);
                    setBatchPickerProduct(null);
                  }}
                  className="w-full p-3 text-left border rounded-xl hover:bg-emerald-50 transition flex items-center justify-between"
                >
                  <div>
                    <span className="font-mono font-bold text-xs text-slate-900">
                      Batch: {b.batch_number}
                    </span>
                    <p className="text-[11px] text-slate-500">
                      Exp: {b.expiry_date} • Stock: {b.current_stock}
                    </p>
                  </div>
                  <span className="font-mono font-bold text-sm text-emerald-800">
                    ₹{formatCurrency(b.selling_price)}
                  </span>
                </button>
              ))}
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

      {/* Agri Doctor Modal */}
      <AgriDoctorModal
        isOpen={isAgriDoctorOpen}
        onClose={() => setIsAgriDoctorOpen(false)}
        onAddToCart={(product) => addProductToCart(product)}
        customerPhone={customerPhone}
      />
    </div>
  );
};
