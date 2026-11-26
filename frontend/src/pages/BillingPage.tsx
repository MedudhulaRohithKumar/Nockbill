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
  FileCheck2,
  CheckCircle2,
  MapPin,
  Clock,
  History,
  Pencil,
  Radio
} from 'lucide-react';
import { productsApi, salesApi, khataApi, settingsApi, getErrorMessage } from '../api';
import { Product, ProductVariant, ProductBatch, SaleItem, Sale } from '../types';
import { useShop } from '../context/ShopContext';
import { useAuth } from '../context/AuthContext';
import { CameraScannerModal } from '../components/ocr/CameraScannerModal';
import { InvoiceReceiptModal } from '../components/billing/InvoiceReceiptModal';
import { AgriDoctorModal } from '../components/billing/AgriDoctorModal';
import { MetricInfoTooltip } from '../components/common/MetricInfoTooltip';
import {
  INVENTORY_CATEGORIES,
  getCategoryConfig,
  normalizeCategory,
  sortBatchesByCategoryRule,
} from '../config/inventoryCategories';
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

const getSellableBatches = (product: Product): ProductBatch[] =>
  sortBatchesByCategoryRule(product.batches ?? [], product.category);

export const BillingPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { settings } = useShop();

  // ─── CUSTOMER / FARMER STATE ────────────────────────────────────────────────
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerAadhar, setCustomerAadhar] = useState('');
  const [customerGstin, setCustomerGstin] = useState('');
  const [isFarmerEditing, setIsFarmerEditing] = useState(false);
  const [isWalkIn, setIsWalkIn] = useState(true);
  const [isSearchingFarmer, setIsSearchingFarmer] = useState(false);

  // Returning Customer Profile & Purchase History from Backend
  const [customerLookup, setCustomerLookup] = useState<{
    found: boolean;
    customer_name?: string;
    customer_phone: string;
    customer_address?: string | null;
    customer_aadhar?: string | null;
    customer_gstin?: string | null;
    bill_count: number;
    total_billed?: number;
    total_credit_billed?: number;
    total_repaid?: number;
    outstanding_balance: number;
    recent_sales: Array<{
      id: number;
      invoice_number: string;
      sale_date?: string | null;
      grand_total: number;
      payment_method: string;
      items: Array<{
        product_id?: number;
        product_name: string;
        batch_number?: string | null;
        quantity: number;
        unit: string;
        unit_price: number;
        gst_rate: number;
        hsn_code?: string | null;
      }>;
    }>;
  } | null>(null);

  // ─── CART & INVENTORY STATE ─────────────────────────────────────────────────
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [inventory, setInventory] = useState<Product[]>([]);
  const [frequentlySold, setFrequentlySold] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [selectedCategoryChip, setSelectedCategoryChip] = useState<string>('ALL');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeStatus, setBarcodeStatus] = useState<string | null>(null);
  const [barcodeError, setBarcodeError] = useState(false);

  // ─── PAYMENT & BILL SETTINGS ────────────────────────────────────────────────
  const [selectedTender, setSelectedTender] = useState<PaymentType>('UPI');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [paymentSplits, setPaymentSplits] = useState<PaymentSplit[]>([{ method: 'UPI', amount: 0 }]);
  const [isInterstate, setIsInterstate] = useState(false);
  const [autoSendWhatsApp, setAutoSendWhatsApp] = useState(true);

  // ─── MODALS & SELECTION STATE ───────────────────────────────────────────────
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

  // ─── TAX & LINE CALCULATIONS ────────────────────────────────────────────────
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

  // ─── FARMER MOBILE NUMBER LOOKUP (Automatic on 10 Digits) ───────────────────
  useEffect(() => {
    const cleanDigits = sanitizePhoneInput(customerPhone);
    if (cleanDigits.length !== 10) {
      setCustomerLookup(null);
      setIsSearchingFarmer(false);
      return;
    }

    let active = true;
    setIsSearchingFarmer(true);

    khataApi
      .lookupCustomer(cleanDigits)
      .then((res) => {
        if (!active) return;
        setIsSearchingFarmer(false);
        if (res && res.found) {
          setCustomerLookup(res);
          setIsWalkIn(false);
          setCustomerName((prev) => prev.trim() || res.customer_name || '');
          setCustomerAddress((prev) => prev.trim() || res.customer_address || '');
          setCustomerAadhar((prev) => prev.trim() || res.customer_aadhar || '');
          setCustomerGstin((prev) => prev.trim() || res.customer_gstin || '');
        } else {
          setCustomerLookup(null);
          setIsWalkIn(false);
        }
      })
      .catch(() => {
        if (active) {
          setIsSearchingFarmer(false);
          setCustomerLookup(null);
        }
      });

    return () => {
      active = false;
    };
  }, [customerPhone]);

  // ─── KEYBOARD SHORTCUTS (F1-F6, Enter, Escape) ──────────────────────────────
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

  // ─── LOAD REAL PRODUCTS & FREQUENTLY BOUGHT DATA ────────────────────────────
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

  useEffect(() => {
    if (user?.id) {
      void loadData();
    }

    const state = location.state as any;
    if (state?.pendingBillItem) {
      addItemToCart(state.pendingBillItem);
      navigate(location.pathname, { replace: true, state: null });
    } else if (Array.isArray(state?.stagedCartItems) && state.stagedCartItems.length > 0) {
      state.stagedCartItems.forEach((item: any) => addItemToCart(item));
      if (state.selectedTender) {
        setSelectedTender(state.selectedTender);
      }
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [user?.id, location.state]);

  // ─── LIVE OMNIBAR SEARCH & CATEGORY CHIP FILTERING ──────────────────────────
  useEffect(() => {
    const trimmed = searchQuery.trim();
    const invList = Array.isArray(inventory) ? inventory : [];

    if (!trimmed) {
      if (selectedCategoryChip !== 'ALL') {
        const byCat = invList
          .filter((p) => normalizeCategory(p.category) === selectedCategoryChip)
          .slice(0, 30);
        setSearchResults(byCat);
      } else {
        setSearchResults([]);
      }
      return;
    }
    const q = trimmed.toLowerCase();
    const filtered = invList.filter((p) => {
      if (selectedCategoryChip !== 'ALL' && normalizeCategory(p.category) !== selectedCategoryChip) {
        return false;
      }
      const pName = safeString(p.name || p.product_name).toLowerCase();
      const pTrade = safeString(p.trade_name).toLowerCase();
      const pCat = safeString(p.category).toLowerCase();
      const pBatch = safeString(p.batch_number || p.product_code).toLowerCase();
      const pHsn = safeString(p.hsn_code).toLowerCase();
      const pBarcode = safeString(p.barcode).toLowerCase();
      const pCompany = safeString(p.company_name).toLowerCase();
      const hasBatchMatch = (p.batches ?? []).some((b) =>
        safeString(b.batch_number).toLowerCase().includes(q)
      );
      return (
        pName.includes(q) ||
        pTrade.includes(q) ||
        pCat.includes(q) ||
        pBatch.includes(q) ||
        pHsn.includes(q) ||
        pBarcode.includes(q) ||
        pCompany.includes(q) ||
        hasBatchMatch
      );
    });

    const localSlice = filtered.slice(0, 30);
    setSearchResults(localSlice);

    if (trimmed.length < 2) return;

    let cancelled = false;
    const timer = setTimeout(() => {
      void productsApi
        .search(trimmed)
        .then((remoteMatches) => {
          if (!cancelled && remoteMatches.length > 0) {
            const catFiltered =
              selectedCategoryChip === 'ALL'
                ? remoteMatches
                : remoteMatches.filter((p) => normalizeCategory(p.category) === selectedCategoryChip);
            setSearchResults(mergeProductSearchResults(localSlice, catFiltered, 30));
          }
        })
        .catch(() => {});
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, inventory, selectedCategoryChip]);

  // ─── BARCODE LOOKUP HANDLER ─────────────────────────────────────────────────
  const handleBarcodeLookup = async (codeToLookup?: string) => {
    const code = (codeToLookup || barcodeInput).trim();
    if (!code) return;

    setBarcodeStatus('Searching...');
    setBarcodeError(false);
    try {
      const product = await productsApi.getByBarcode(code);
      if (product) {
        setBarcodeStatus(`Found ${product.product_name || product.name}`);
        setTimeout(() => setBarcodeStatus(null), 2500);
        setBarcodeInput('');
        if (product.variants && product.variants.length > 1) {
          setVariantPickerProduct(product);
        } else {
          const activeBatches = getSellableBatches(product);
          addProductToCart(product, undefined, activeBatches[0]);
        }
      }
    } catch {
      setBarcodeError(true);
      setBarcodeStatus('Barcode not found in inventory');
      setTimeout(() => setBarcodeStatus(null), 3000);
    }
  };

  // ─── ADD PRODUCT TO CART (Auto-allocates priority FEFO/FIFO batch across all categories) ───
  const addProductToCart = (
    product: Product,
    variant?: ProductVariant,
    batch?: ProductBatch
  ) => {
    if (!variant && product.variants && product.variants.length > 1) {
      setVariantPickerProduct(product);
      return;
    }

    const activeBatches = getSellableBatches(product);
    const selectedBatch = batch || activeBatches[0];
    const pName = variant
      ? `${product.product_name || product.name} (${variant.variant_name || `${variant.unit_size} ${variant.unit}`})`
      : product.product_name || product.name;

    const price = safeNumber(
      selectedBatch?.selling_price ||
        (variant ? variant.selling_price : undefined) ||
        product.selling_price,
      0
    );

    const mrp = safeNumber(
      selectedBatch?.mrp || (variant ? variant.mrp : undefined) || product.mrp,
      price
    );

    const unit = variant ? variant.unit : product.unit || 'Bags';
    const batchNo =
      selectedBatch?.batch_number || product.batch_number || product.product_code || 'DEFAULT';
    const expiryDate = selectedBatch?.expiry_date || product.expiry_date;
    const tradeName = selectedBatch?.trade_name || product.trade_name || undefined;
    const categoryGst = getCategoryConfig(product.category).defaultGstRate;

    addItemToCart({
      product_id: product.id,
      batch_id: selectedBatch?.id || undefined,
      product_name: pName,
      trade_name: tradeName,
      batch_number: batchNo,
      expiry_date: expiryDate,
      hsn_code: product.hsn_code || '',
      unit: unit,
      unit_price: price,
      mrp: mrp,
      gst_rate: product.gst_rate ?? categoryGst,
      quantity: 1,
    });
  };

  const addItemToCart = (item: Partial<SaleItem>) => {
    const price = safeNumber(item.unit_price ?? item.mrp, 0);
    const gstRate = safeNumber(item.gst_rate, 0);
    const qty = safeNumber(item.quantity, 1) || 1;
    const discount = safeNumber(item.discount_percent, 0);

    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex(
        (c) =>
          c.product_id === item.product_id &&
          c.product_name === item.product_name &&
          c.batch_number === (item.batch_number || 'DEFAULT')
      );

      if (existingIndex >= 0) {
        const updated = [...prevCart];
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
        return updated;
      }

      const taxes = calculateItemTaxes(price, qty, discount, gstRate, isInterstate);
      const newItem: SaleItem = {
        product_id: item.product_id || 1,
        batch_id: item.batch_id,
        product_name: item.product_name || 'Agri Input Product',
        trade_name: item.trade_name,
        batch_number: item.batch_number || 'DEFAULT',
        expiry_date: item.expiry_date,
        hsn_code: item.hsn_code || '',
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
      return [...prevCart, newItem];
    });

    setSearchQuery('');
    setSelectedCategoryChip('ALL');
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

  const removeFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const clearBill = () => {
    setCart([]);
    setCustomerPhone('');
    setCustomerName('');
    setCustomerAddress('');
    setCustomerAadhar('');
    setCustomerGstin('');
    setCustomerLookup(null);
    setIsWalkIn(true);
    setErrorMsg(null);
    setCashTendered('');
    setBillIdempotencyKey(generateBillIdempotencyKey());
  };

  const handleWalkInToggle = () => {
    setIsWalkIn(true);
    setCustomerName('Walk-in Cash Customer');
    setCustomerPhone('');
    setCustomerAddress('');
    setCustomerAadhar('');
    setCustomerGstin('');
    setCustomerLookup(null);
    setIsFarmerEditing(false);
    handleSelectTender('Cash');
  };

  const handleSelectTender = (tender: PaymentType) => {
    setSelectedTender(tender);
    setPaymentSplits([{ method: tender, amount: roundedGrandTotal }]);
  };

  // Re-add a previously purchased product by the farmer
  const handleReaddPastProduct = (pastItem: any) => {
    const matched = inventory.find(
      (p) =>
        (pastItem.product_id && p.id === pastItem.product_id) ||
        (p.product_name || p.name || '').toLowerCase() === pastItem.product_name.toLowerCase()
    );
    if (matched) {
      addProductToCart(matched);
    } else {
      addItemToCart({
        product_id: pastItem.product_id || 1,
        product_name: pastItem.product_name,
        batch_number: pastItem.batch_number || 'DEFAULT',
        unit: pastItem.unit || 'Bags',
        unit_price: pastItem.unit_price,
        mrp: pastItem.unit_price,
        gst_rate: pastItem.gst_rate ?? 5,
        quantity: pastItem.quantity || 1,
      });
    }
  };

  // ─── TOTALS & MATH ──────────────────────────────────────────────────────────
  const grossSubtotal = cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  const totalClearanceDiscount = cart.reduce((sum, item) => sum + item.discount_amount, 0);
  const totalTaxable = cart.reduce((sum, item) => sum + item.taxable_amount, 0);
  const totalCgst = cart.reduce((sum, item) => sum + item.cgst_amount, 0);
  const totalSgst = cart.reduce((sum, item) => sum + item.sgst_amount, 0);
  const totalIgst = cart.reduce((sum, item) => sum + item.igst_amount, 0);

  const rawGrandTotal = totalTaxable + totalCgst + totalSgst + totalIgst;
  const roundedGrandTotal = Math.round(rawGrandTotal);
  const roundOff = Math.round((roundedGrandTotal - rawGrandTotal) * 100) / 100;

  // Change Return for Cash
  const numericCashTendered = Number.parseFloat(cashTendered) || 0;
  const changeDue = Math.max(0, numericCashTendered - roundedGrandTotal);

  // Dynamic SVG UPI QR Code
  const [posUpiQrSvg, setPosUpiQrSvg] = useState<string | null>(null);
  useEffect(() => {
    const vpa = (settings.upi_id || '').trim();
    if (!vpa || cart.length === 0 || roundedGrandTotal <= 0 || selectedTender !== 'UPI') {
      setPosUpiQrSvg(null);
      return;
    }
    let active = true;
    settingsApi
      .getUpiQr({
        amount: roundedGrandTotal,
        invoice_number: `${settings.invoice_prefix || 'INV'}-POS`,
        upi_id: vpa,
      })
      .then((res) => {
        if (active && res?.qr_svg_data_uri) {
          setPosUpiQrSvg(res.qr_svg_data_uri);
        }
      })
      .catch(() => {
        if (active) setPosUpiQrSvg(null);
      });
    return () => {
      active = false;
    };
  }, [settings.upi_id, settings.invoice_prefix, cart.length, roundedGrandTotal, selectedTender]);

  // ─── FINALIZE SALE & PRINT ESC/POS THERMAL RECEIPT ───────────────────────────
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
      customer_name: sanitizeText(customerName, 120) || (isWalkIn ? 'Walk-in Cash Customer' : 'Farmer'),
      customer_phone: cleanPhone || undefined,
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

  const userName = user?.full_name || user?.username || 'Cashier Counter';
  const shopName = settings.shop_name || 'Agro Kendra';
  const upiId = (settings.upi_id || 'store@upi').trim();

  return (
    <div className="w-full min-h-screen bg-surface font-sans text-on-surface antialiased">
      <div className="flex flex-col w-full">
        {/* ─── POS QUICK BILLING WORKSPACE CONTAINER ─── */}
        <div className="w-full flex flex-col gap-4 px-3 py-4 sm:p-6 max-w-[1600px] mx-auto">
          
          {/* TOP COMMAND & HOTKEY STRIP */}
          <div className="w-full bg-surface-container-lowest/80 backdrop-blur-xl rounded-2xl p-4 shadow-xs border border-surface-container flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 bg-sprout-tint dark:bg-emerald-950/60 text-primary dark:text-emerald-300 border border-primary/20 dark:border-emerald-800/60 px-3 py-1.5 rounded-xl text-[10px] font-bold tracking-wider uppercase">
                <span className="w-2 h-2 rounded-full bg-forest-emerald animate-pulse" />
                LIVE COUNTER #01
              </div>
              <div className="flex items-center gap-2 text-xs sm:text-sm">
                <span className="text-on-surface-variant font-medium">POS Billing</span>
                <span className="text-outline-variant font-mono">/</span>
                <span className="text-on-surface font-bold tracking-tight">
                  Active Terminal • {userName}
                </span>
                <span className="text-outline-variant font-mono">·</span>
                <span className="text-xs text-primary dark:text-emerald-400 font-semibold">{shopName}</span>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-2 ml-auto xl:ml-0">
              <button
                type="button"
                onClick={() => setIsAgriDoctorOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-sprout-tint dark:bg-emerald-950/60 text-primary dark:text-emerald-300 hover:bg-secondary-container dark:hover:bg-emerald-900 border border-primary/20 dark:border-emerald-800/60 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Sprout className="w-3.5 h-3.5" />
                <span>Agri Doctor</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/returns')}
                className="px-3 py-1.5 rounded-xl bg-surface-container dark:bg-slate-800 text-on-surface dark:text-slate-200 hover:bg-surface-container-high dark:hover:bg-slate-700 border border-surface-container dark:border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Return</span>
              </button>
              <button
                type="button"
                onClick={clearBill}
                className="p-2 text-on-surface-variant hover:text-critical-rose rounded-xl hover:bg-surface-container transition-colors cursor-pointer"
                title="Clear current bill"
              >
                <Eraser className="w-4 h-4" />
              </button>
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
                className="text-critical-rose hover:opacity-80 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* MAIN 2-COLUMN LAYOUT: Left (8 Cols) Billing & Cart, Right (4 Cols) Calculation & Payment */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* ══════════ LEFT COLUMN: Omnibar + Dynamic Farmer Card + Staged Cart (8 Cols) ══════════ */}
            <div className="lg:col-span-8 flex flex-col gap-4">
              
              {/* 1. OMNIBAR PRODUCT SEARCH & BARCODE SCANNER */}
              <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-xs border border-surface-container flex flex-col gap-3 relative overflow-visible">
                <div className="flex items-center gap-3 bg-surface-container-low rounded-xl px-4 py-2.5 transition-all focus-within:bg-sprout-tint focus-within:ring-2 focus-within:ring-primary">
                  <Barcode className="w-6 h-6 text-forest-emerald shrink-0" />
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
                        } else if (searchQuery.trim()) {
                          void handleBarcodeLookup(searchQuery.trim());
                        }
                      }
                    }}
                    placeholder="Scan Barcode or Search Molecule, Brand, HSN (e.g. Neem Coated Urea, Ridomil, Regent)..."
                    className="w-full bg-transparent text-on-surface text-xs sm:text-sm placeholder:text-on-surface-variant/60 outline-none"
                  />
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsScannerOpen(true)}
                      className="flex items-center gap-1 text-forest-emerald bg-surface-container-lowest px-2.5 py-1 rounded-lg font-mono text-[11px] font-bold hover:bg-forest-emerald hover:text-on-primary transition-all shadow-xs cursor-pointer"
                    >
                      <Radio className="w-3.5 h-3.5" />
                      <span>AUTO-SCAN ON</span>
                    </button>
                  </div>
                </div>

                {/* Auto-suggest dropdown when typing in omnibar */}
                {searchResults.length > 0 && (
                  <div className="absolute z-50 left-4 right-4 top-16 bg-surface-container-lowest border border-surface-container rounded-2xl shadow-2xl overflow-hidden divide-y divide-surface-container max-h-80 overflow-y-auto">
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
                            {product.expiry_date && ` • Exp: ${product.expiry_date}`}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-mono font-bold text-sm text-on-surface block">
                            ₹{formatCurrency(product.selling_price)}
                          </span>
                          <span className="font-mono text-[10px] text-primary font-semibold">
                            Per {product.unit || 'Unit'}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Categorical Filter Chips */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {INVENTORY_CATEGORIES.map((cat) => {
                    const isSelected = selectedCategoryChip === cat;
                    return (
                      <button
                        type="button"
                        key={cat}
                        onClick={() => {
                          setSelectedCategoryChip((prev) => (prev === cat ? 'ALL' : cat));
                        }}
                        className={`text-xs px-3.5 py-1.5 rounded-full font-semibold flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-forest-emerald text-white shadow-xs'
                            : 'bg-surface-container-low hover:bg-sprout-tint hover:text-primary text-on-surface'
                        }`}
                      >
                        <Sprout className="w-4 h-4" />
                        <span>{cat}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. DYNAMIC FARMER LOOKUP & PROFILE CARD (Connected to real Khata & purchase history) */}
              <div className="bg-surface-container-lowest rounded-2xl p-4 sm:p-5 shadow-xs border border-surface-container flex flex-col gap-3">
                {/* Farmer Mobile Number Input Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-surface-container">
                  <div className="flex-1 flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-sprout-tint text-primary flex items-center justify-center shrink-0">
                      <Phone className="w-4 h-4" />
                    </div>
                    <div className="flex-1 relative">
                      <label htmlFor="farmer-mobile-input" className="sr-only">
                        Farmer Mobile Number
                      </label>
                      <input
                        id="farmer-mobile-input"
                        type="tel"
                        maxLength={10}
                        value={customerPhone}
                        onChange={(e) => {
                          const val = sanitizePhoneInput(e.target.value);
                          setCustomerPhone(val);
                          if (val.length === 0) {
                            setIsWalkIn(true);
                          }
                        }}
                        placeholder="Enter 10-Digit Farmer Mobile Number (e.g. 9876543210)..."
                        className="w-full h-9 px-3 rounded-xl bg-surface-container-low text-xs sm:text-sm font-mono text-on-surface placeholder:text-on-surface-variant/60 focus:bg-sprout-tint focus:ring-2 focus:ring-primary focus:outline-none"
                      />
                      {isSearchingFarmer && (
                        <div className="absolute right-3 top-2.5 w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleWalkInToggle}
                      className={`text-xs px-3 py-2 rounded-xl font-bold transition-all cursor-pointer border ${
                        isWalkIn
                          ? 'bg-forest-emerald text-on-primary border-forest-emerald shadow-xs'
                          : 'bg-surface-container-low text-on-surface-variant border-surface-container hover:bg-surface-container'
                      }`}
                    >
                      Walk-in Cash
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsFarmerEditing((prev) => !prev)}
                      className="text-xs px-3 py-2 rounded-xl font-bold bg-surface-container-low hover:bg-surface-container text-on-surface-variant border border-surface-container transition-colors cursor-pointer flex items-center gap-1"
                      title="Edit Farmer Details"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>{isFarmerEditing ? 'Close' : 'Details'}</span>
                    </button>
                  </div>
                </div>

                {/* Farmer Profile Information Display */}
                {isWalkIn ? (
                  <div className="flex items-center justify-between py-1 px-1 text-xs text-on-surface-variant">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-outline-variant" />
                      <span className="font-bold text-on-surface">Walk-in Cash Customer</span>
                      <span className="text-outline-variant">•</span>
                      <span>No phone record or credit balance attached</span>
                    </div>
                    <span className="text-[11px] font-mono text-outline">Counter POS</span>
                  </div>
                ) : (
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pt-1">
                    {/* Farmer Identity */}
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-2xl bg-sprout-tint border border-primary/20 text-primary flex items-center justify-center shrink-0 font-['Grandstander'] font-black text-xl shadow-xs">
                        {customerName ? customerName.charAt(0).toUpperCase() : 'F'}
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm sm:text-base font-bold text-on-surface">
                            {customerName || 'Farmer (New Profile)'}
                          </span>
                          <span className="font-mono text-xs bg-surface-container-high text-on-surface-variant px-2 py-0.5 rounded-md font-semibold">
                            +91 {customerPhone}
                          </span>
                          {customerLookup?.found ? (
                            <span className="text-[10px] font-bold bg-sprout-tint text-primary px-2 py-0.5 rounded-full flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> REGISTERED FARMER
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                              NEW FARMER
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-on-surface-variant mt-0.5">
                          {customerAddress || 'Village / Address will be saved upon billing'}
                          {customerAadhar ? ` • Aadhaar: XXXX-XXXX-${customerAadhar.slice(-4)}` : ''}
                        </p>
                      </div>
                    </div>

                    {/* Khata Balance & Purchase Telemetry Box */}
                    <div className="flex items-center gap-4 self-stretch md:self-auto justify-between md:justify-end bg-surface-container-low px-4 py-2.5 rounded-xl border border-surface-container">
                      <div className="flex flex-col">
                        <span className="font-mono text-[10px] text-khata-amber font-bold uppercase tracking-wider flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-khata-amber" />
                          Khata Outstanding
                        </span>
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-mono text-base font-bold text-on-surface leading-tight">
                            ₹{formatCurrency(customerLookup?.outstanding_balance || 0)}
                          </span>
                          <span className="font-mono text-[11px] text-on-surface-variant">
                            / Due
                          </span>
                        </div>
                      </div>

                      <div className="w-px h-8 bg-surface-container-highest" />

                      <div className="flex flex-col">
                        <span className="font-mono text-[10px] text-primary font-bold uppercase tracking-wider">
                          Lifetime Purchases
                        </span>
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-mono text-base font-bold text-on-surface leading-tight">
                            ₹{formatCurrency(customerLookup?.total_billed || 0)}
                          </span>
                          <span className="font-mono text-[11px] text-on-surface-variant">
                            ({customerLookup?.bill_count || 0} Bills)
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Previously Purchased Products Chips (1-Click Re-Add for Returning Farmers) */}
                {customerLookup?.recent_sales && customerLookup.recent_sales.length > 0 && (
                  <div className="pt-2 border-t border-surface-container flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-on-surface-variant flex items-center gap-1">
                        <History className="w-3.5 h-3.5 text-primary" />
                        <span>Previously Bought by this Farmer (1-Click Re-Add):</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                      {customerLookup.recent_sales.flatMap((s) => s.items).slice(0, 8).map((pItem, idx) => (
                        <button
                          type="button"
                          key={`${pItem.product_name}-${idx}`}
                          onClick={() => handleReaddPastProduct(pItem)}
                          className="px-2.5 py-1 rounded-lg bg-surface-container-low hover:bg-sprout-tint text-on-surface hover:text-primary text-xs font-medium border border-surface-container flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
                        >
                          <Plus className="w-3 h-3 text-primary" />
                          <span>{pItem.product_name}</span>
                          <span className="font-mono text-[10px] text-outline-variant font-semibold">
                            ₹{formatCurrency(pItem.unit_price)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Farmer Quick Edit Inline Form */}
                {isFarmerEditing && (
                  <div className="bg-surface-container-low p-4 rounded-xl border border-surface-container grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in duration-150">
                    <div>
                      <label htmlFor="farmer-name-field" className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">
                        Farmer Full Name *
                      </label>
                      <input
                        id="farmer-name-field"
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="e.g. Ramesh Patel"
                        className="w-full h-8 px-2.5 rounded-lg bg-surface-container-lowest text-xs text-on-surface font-semibold border border-surface-container focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label htmlFor="farmer-address-field" className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">
                        Village / Plot Address
                      </label>
                      <input
                        id="farmer-address-field"
                        type="text"
                        value={customerAddress}
                        onChange={(e) => setCustomerAddress(e.target.value)}
                        placeholder="e.g. Rampur Village, Survey #12"
                        className="w-full h-8 px-2.5 rounded-lg bg-surface-container-lowest text-xs text-on-surface border border-surface-container focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label htmlFor="farmer-aadhar-field" className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">
                        Aadhaar / Farmer UID (Optional)
                      </label>
                      <input
                        id="farmer-aadhar-field"
                        type="text"
                        maxLength={12}
                        value={customerAadhar}
                        onChange={(e) => setCustomerAadhar(e.target.value.replace(/\D/g, ''))}
                        placeholder="12-digit Aadhaar number"
                        className="w-full h-8 px-2.5 rounded-lg bg-surface-container-lowest text-xs font-mono text-on-surface border border-surface-container focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 3. STAGED BILLING ITEMS (REAL LIVE CART LEDGER) */}
              <div className="bg-surface-container-lowest rounded-2xl p-4 sm:p-5 shadow-xs border border-surface-container flex flex-col gap-3">
                <div className="flex items-center justify-between pb-2 border-b border-surface-container">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-on-surface">Staged Billing Items</span>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-sprout-tint dark:bg-emerald-950/60 text-primary dark:text-emerald-300 border border-primary/20 dark:border-emerald-800/60">
                      {cart.length} {cart.length === 1 ? 'ITEM' : 'ITEMS'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] font-mono text-forest-emerald dark:text-emerald-400 font-semibold">
                    <Zap className="w-3.5 h-3.5" />
                    <span>FEFO Batch Allocation Active</span>
                    <MetricInfoTooltip
                      title="FEFO Batch Allocation Active"
                      description="First-Expiry-First-Out (FEFO) automated rule automatically allocates stock from batches with the closest expiry date to minimize store wastage."
                      tip="Guarantees older chemical and seed stocks are dispensed before newer shipments."
                      align="right"
                    />
                  </div>
                </div>

                {/* Cart Items List */}
                {cart.length === 0 ? (
                  <div className="py-8 text-center flex flex-col items-center justify-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-surface-container-low flex items-center justify-center text-outline">
                      <Package className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm font-bold text-on-surface">
                        Staged cart is empty
                      </p>
                      <p className="text-[11px] text-on-surface-variant mt-0.5">
                        Scan a product barcode with gun or search SKU above to add products to the bill.
                      </p>
                    </div>

                    {/* Frequently Sold Quick Add Cards */}
                    {frequentlySold && frequentlySold.length > 0 && (
                      <div className="w-full pt-4 border-t border-surface-container text-left space-y-2">
                        <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1">
                          <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                          Fast-Billed Counter Items (1-Click Add):
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {frequentlySold.map((fItem) => (
                            <button
                              type="button"
                              key={fItem.id}
                              onClick={() => {
                                const matched = inventory.find((p) => p.id === fItem.id);
                                if (matched) addProductToCart(matched);
                              }}
                              className="p-2.5 rounded-xl bg-surface-container-low hover:bg-sprout-tint border border-surface-container text-left transition-all cursor-pointer flex flex-col justify-between"
                            >
                              <span className="font-bold text-xs text-on-surface truncate block">
                                {fItem.product_name}
                              </span>
                              <div className="flex items-center justify-between mt-1 text-[11px]">
                                <span className="font-mono font-bold text-primary">
                                  ₹{formatCurrency(fItem.selling_price)}
                                </span>
                                <span className="text-[10px] font-bold text-forest-emerald flex items-center gap-0.5">
                                  <Plus className="w-3 h-3" /> Add
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {cart.map((item, idx) => (
                      <div
                        key={`${item.product_id}-${item.batch_number}-${idx}`}
                        className="p-3 sm:p-3.5 rounded-xl bg-surface-container-low/80 border border-surface-container flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-container-low transition-colors"
                      >
                        {/* Item Details */}
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-sprout-tint text-primary flex items-center justify-center shrink-0 font-bold">
                            <Package className="w-4 h-4" />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-bold text-xs sm:text-sm text-on-surface truncate">
                              {item.product_name}
                            </span>
                            <div className="flex items-center gap-2 text-[11px] text-on-surface-variant flex-wrap mt-0.5">
                              {item.hsn_code && <span>HSN: {item.hsn_code}</span>}
                              <span>•</span>
                              <span className="font-mono">Batch: {item.batch_number}</span>
                              {item.expiry_date && (
                                <>
                                  <span>•</span>
                                  <span className="font-mono text-outline">Exp: {item.expiry_date}</span>
                                </>
                              )}
                              <span>•</span>
                              <span className="font-mono text-primary font-semibold">
                                Rate: ₹{formatCurrency(item.unit_price)} / {item.unit}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Quantity Stepper & Price */}
                        <div className="flex items-center gap-4 justify-between sm:justify-end shrink-0">
                          {/* Stepper */}
                          <div className="flex items-center bg-surface-container-lowest rounded-xl border border-surface-container p-0.5">
                            <button
                              type="button"
                              onClick={() => updateCartItemQty(idx, item.quantity - 1)}
                              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-container text-on-surface-variant transition-colors cursor-pointer"
                              title="Decrease quantity"
                            >
                              -
                            </button>
                            <span className="w-8 text-center font-mono text-xs font-bold text-on-surface">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateCartItemQty(idx, item.quantity + 1)}
                              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-container text-on-surface-variant transition-colors cursor-pointer"
                              title="Increase quantity"
                            >
                              +
                            </button>
                          </div>

                          {/* Line Total */}
                          <div className="text-right min-w-[80px]">
                            <span className="font-mono font-bold text-sm sm:text-base text-on-surface block">
                              ₹{formatCurrency(item.total_amount)}
                            </span>
                            <span className="text-[10px] text-on-surface-variant block">
                              Inc. Tax
                            </span>
                          </div>

                          {/* Delete Item */}
                          <button
                            type="button"
                            onClick={() => removeFromCart(idx)}
                            className="p-1.5 text-on-surface-variant hover:text-critical-rose rounded-lg hover:bg-surface-container transition-colors cursor-pointer"
                            title="Remove item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ══════════ RIGHT COLUMN: Tax Invoice Summary & Payment Tender (4 Cols) ══════════ */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              
              {/* TAX INVOICE CALCULATION PANEL */}
              <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-xs border border-surface-container flex flex-col gap-4">
                <div className="flex items-center justify-between pb-3 border-b border-surface-container">
                  <span className="font-bold text-sm text-on-surface">Tax Invoice Calculation</span>
                  <span className="font-mono text-xs font-bold text-primary bg-sprout-tint px-2 py-0.5 rounded-md">
                    BILL #{settings.invoice_prefix || 'NB'}-LIVE
                  </span>
                </div>

                {/* Subtotal Breakdowns */}
                <div className="flex flex-col gap-2 text-xs">
                  <div className="flex items-center justify-between text-on-surface-variant">
                    <div className="flex items-center gap-1.5">
                      <span>Subtotal (Items Gross Value)</span>
                      <MetricInfoTooltip
                        title="Subtotal (Items Gross Value)"
                        description="Total pre-tax value of all items in the staged cart calculated from unit selling prices before discounts."
                        formula="Sum(Item Quantity × Unit Selling Price)"
                        align="right"
                      />
                    </div>
                    <span className="font-mono font-semibold text-on-surface">
                      ₹{formatCurrency(grossSubtotal)}
                    </span>
                  </div>

                  {totalClearanceDiscount > 0 && (
                    <div className="flex items-center justify-between text-critical-rose font-medium">
                      <div className="flex items-center gap-1.5">
                        <span>Clearance Discount</span>
                        <MetricInfoTooltip
                          title="Clearance Discount"
                          description="Automatic price markdown applied to near-expiry chemical batches to accelerate inventory liquidation."
                          formula="Item Selling Price × Clearance Markdown %"
                          align="right"
                        />
                      </div>
                      <span className="font-mono font-bold">
                        -₹{formatCurrency(totalClearanceDiscount)}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-on-surface-variant">
                    <div className="flex items-center gap-1.5">
                      <span>Taxable Value</span>
                      <MetricInfoTooltip
                        title="Taxable Value"
                        description="The net value of goods subject to statutory GST after deducting all item-level trade discounts."
                        formula="Taxable Value = Subtotal - Total Discounts"
                        align="right"
                      />
                    </div>
                    <span className="font-mono text-on-surface">
                      ₹{formatCurrency(totalTaxable)}
                    </span>
                  </div>

                  {isInterstate ? (
                    <div className="flex items-center justify-between text-on-surface-variant">
                      <div className="flex items-center gap-1.5">
                        <span>IGST (Integrated Tax)</span>
                        <MetricInfoTooltip
                          title="IGST (Integrated GST)"
                          description="Integrated Goods & Services Tax applied when goods are sold across state borders to interstate farmers or businesses."
                          formula="Taxable Value × Statutory IGST Rate"
                          align="right"
                        />
                      </div>
                      <span className="font-mono text-on-surface">
                        ₹{formatCurrency(totalIgst)}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-on-surface-variant">
                      <div className="flex items-center gap-1.5">
                        <span>GST (CGST ₹{formatCurrency(totalCgst)} + SGST ₹{formatCurrency(totalSgst)})</span>
                        <MetricInfoTooltip
                          title="GST (CGST + SGST)"
                          description="Statutory Goods and Services Tax split equally into Central GST and State GST based on product HSN classification (e.g. 5% fertilizer, 18% pesticide)."
                          formula="CGST = Taxable × Rate/2 | SGST = Taxable × Rate/2"
                          align="right"
                        />
                      </div>
                      <span className="font-mono text-on-surface">
                        ₹{formatCurrency(totalCgst + totalSgst)}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-on-surface-variant">
                    <div className="flex items-center gap-1.5">
                      <span>Auto Round-off (50-Paisa Rule)</span>
                      <MetricInfoTooltip
                        title="Auto Round-off (50-Paisa Rule)"
                        description="Statutory cash rounding under Indian GST law to the nearest whole rupee (+/- 50 paise) for clean counter cash & digital settlement."
                        formula="Round-off = Math.round(Invoice Total) - Invoice Total"
                        align="right"
                      />
                    </div>
                    <span className="font-mono text-on-surface">
                      {roundOff >= 0 ? `+₹${roundOff.toFixed(2)}` : `-₹${Math.abs(roundOff).toFixed(2)}`}
                    </span>
                  </div>
                </div>

                {/* NET PAYABLE GRAND TOTAL */}
                <div className="p-4 rounded-xl bg-sprout-tint/60 dark:bg-emerald-950/60 border border-primary/20 dark:border-emerald-800/60 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-primary dark:text-emerald-300">
                      NET PAYABLE TOTAL
                    </span>
                    <MetricInfoTooltip
                      title="Net Payable Total"
                      description="The final settlement amount due from the farmer after all statutory taxes, trade discounts, and 50-paisa rounding."
                      formula="Net Payable = Taxable Value + CGST + SGST ± Round-off"
                      tip="Farmer receipt and thermal print slip will reflect this exact settlement figure."
                      align="right"
                    />
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="font-mono text-2xl sm:text-3xl font-black text-forest-emerald dark:text-emerald-400">
                      ₹{formatCurrency(roundedGrandTotal)}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-primary dark:text-emerald-300">
                      INC. ALL TAXES
                    </span>
                  </div>
                </div>

                {/* SELECT PAYMENT MODE */}
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                    Select Payment Mode:
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => handleSelectTender('UPI')}
                      className={`p-2.5 rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer border ${
                        selectedTender === 'UPI'
                          ? 'bg-forest-emerald text-on-primary border-forest-emerald shadow-xs'
                          : 'bg-surface-container-low text-on-surface border-surface-container hover:bg-surface-container'
                      }`}
                    >
                      <QrCode className="w-4 h-4" />
                      <span>UPI QR</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectTender('Cash')}
                      className={`p-2.5 rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer border ${
                        selectedTender === 'Cash'
                          ? 'bg-forest-emerald text-on-primary border-forest-emerald shadow-xs'
                          : 'bg-surface-container-low text-on-surface border-surface-container hover:bg-surface-container'
                      }`}
                    >
                      <IndianRupee className="w-4 h-4" />
                      <span>Cash</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectTender('Credit')}
                      className={`p-2.5 rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer border ${
                        selectedTender === 'Credit'
                          ? 'bg-khata-amber text-on-primary border-khata-amber shadow-xs'
                          : 'bg-surface-container-low text-on-surface border-surface-container hover:bg-surface-container'
                      }`}
                    >
                      <Layers className="w-4 h-4" />
                      <span>Khata</span>
                    </button>
                  </div>
                </div>

                {/* DYNAMIC UPI QR DISPLAY */}
                {selectedTender === 'UPI' && (
                  <div className="p-4 rounded-xl bg-surface-container-low border border-surface-container flex flex-col items-center text-center gap-2">
                    {posUpiQrSvg ? (
                      <div data-keep-light="true" className="w-44 h-44 bg-white p-2 rounded-xl shadow-xs flex items-center justify-center">
                        <img
                          src={posUpiQrSvg}
                          alt="Dynamic UPI QR Code"
                          className="w-full h-full object-contain"
                        />
                      </div>
                    ) : (
                      <div data-keep-light="true" className="w-44 h-44 bg-white p-2 rounded-xl shadow-xs flex flex-col items-center justify-center text-on-surface-variant">
                        <QrCode className="w-10 h-10 text-primary mb-1" />
                        <span className="text-[11px] font-bold">UPI ID: {upiId}</span>
                        <span className="text-[10px] text-outline mt-0.5">Scan with GPay / PhonePe</span>
                      </div>
                    )}
                    <span className="text-xs font-bold text-on-surface">
                      Scan to Pay ₹{formatCurrency(roundedGrandTotal)}
                    </span>
                    <span className="text-[10px] text-on-surface-variant">
                      Instant reconciliation with counter till
                    </span>
                  </div>
                )}

                {/* CASH TENDER & CHANGE CALCULATION */}
                {selectedTender === 'Cash' && (
                  <div className="p-3.5 rounded-xl bg-surface-container-low border border-surface-container flex flex-col gap-2">
                    <label htmlFor="cash-tendered-input" className="text-xs font-bold text-on-surface">
                      Cash Received from Farmer
                    </label>
                    <div className="relative">
                      <IndianRupee className="w-4 h-4 absolute left-3 top-2.5 text-primary" />
                      <input
                        id="cash-tendered-input"
                        type="number"
                        value={cashTendered}
                        onChange={(e) => setCashTendered(e.target.value)}
                        placeholder={`e.g. ₹${roundedGrandTotal}`}
                        className="w-full h-9 pl-9 pr-3 rounded-lg bg-surface-container-lowest text-sm font-mono font-bold text-on-surface border border-surface-container focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    {numericCashTendered > 0 && (
                      <div className="flex items-center justify-between pt-1 text-xs font-bold">
                        <span className="text-on-surface-variant">Change Due to Return:</span>
                        <span className="font-mono text-sm text-forest-emerald">
                          ₹{formatCurrency(changeDue)}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* KHATA CREDIT WARNING */}
                {selectedTender === 'Credit' && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 font-bold">
                      <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                      <span>Booking to Farmer Credit Ledger</span>
                    </div>
                    <p className="text-[11px] text-amber-800 leading-tight">
                      This bill of ₹{formatCurrency(roundedGrandTotal)} will be debited to{' '}
                      <strong>{customerName || 'Farmer Khata'}</strong>. An automated payment reminder with UPI QR can be dispatched via WhatsApp.
                    </p>
                  </div>
                )}

                {/* COMPLETE BILL & PRINT BUTTON */}
                <button
                  type="button"
                  disabled={isSaving || cart.length === 0}
                  onClick={() => void handleSaveAndPrint()}
                  className="w-full py-3.5 rounded-xl bg-forest-emerald hover:bg-primary active:scale-[0.99] text-on-primary font-bold text-sm shadow-md shadow-forest-emerald/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer min-h-[48px]"
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Saving &amp; Printing...</span>
                    </>
                  ) : (
                    <>
                      <Printer className="w-4 h-4" />
                      <span>Complete Bill &amp; Print ESC/POS</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── MODALS ─────────────────────────────────────────────────────────── */}
      {/* 1. Barcode / Document Camera Scanner */}
      {isScannerOpen && (
        <CameraScannerModal
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
          onAddProductToBill={(item: Partial<SaleItem>) => {
            setIsScannerOpen(false);
            addItemToCart(item);
          }}
        />
      )}

      {/* 2. Agri Doctor Pathology Modal */}
      {isAgriDoctorOpen && (
        <AgriDoctorModal
          isOpen={isAgriDoctorOpen}
          onClose={() => setIsAgriDoctorOpen(false)}
          onAddToCart={(p: Product) => addProductToCart(p)}
          customerPhone={customerPhone}
        />
      )}

      {/* 3. Packaging Variant Selector Modal (when a product has multiple pack sizes) */}
      {variantPickerProduct && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="variant-picker-title"
          className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 id="variant-picker-title" className="font-bold text-sm text-slate-900 dark:text-white">
                  Select Pack Size — {variantPickerProduct.name || variantPickerProduct.product_name}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Choose the packaging size to add to the bill
                </p>
              </div>
              <button
                type="button"
                aria-label="Close pack size selector"
                onClick={() => setVariantPickerProduct(null)}
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {(variantPickerProduct.variants || []).map((v, vIdx) => (
                <button
                  key={v.id || vIdx}
                  type="button"
                  onClick={() => {
                    const target = variantPickerProduct;
                    setVariantPickerProduct(null);
                    addProductToCart(target, v);
                  }}
                  className="w-full text-left p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-emerald-500 hover:bg-emerald-50/60 dark:hover:bg-slate-800 flex items-center justify-between text-xs transition"
                >
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white block">
                      {v.variant_name || `${v.unit_size} ${v.unit}`}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Net: {v.unit_size} {v.unit}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-sm text-emerald-700 dark:text-emerald-400">
                    ₹{formatCurrency(v.selling_price)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4. 80mm ESC/POS Thermal Receipt & A4 Tax Invoice Modal */}
      {isReceiptOpen && savedSale && (
        <InvoiceReceiptModal
          isOpen={isReceiptOpen}
          sale={savedSale}
          settings={settings}
          onClose={() => {
            setIsReceiptOpen(false);
            setSavedSale(null);
          }}
        />
      )}
    </div>
  );
};
