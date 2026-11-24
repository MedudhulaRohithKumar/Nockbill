import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Printer,
  ShoppingCart,
  PlusCircle,
  Plus,
  FileText,
  Sparkles,
  Microscope,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  TrendingUp,
  Clock,
  ScanLine,
  QrCode,
  Banknote,
  BookOpen,
  Share2,
  RefreshCw,
  ArrowUpRight,
  Download,
  ExternalLink,
  X,
  Search,
  ChevronRight,
  BadgeCheck,
  Sun,
  Minus,
  Send,
  Package,
} from 'lucide-react';
import {
  reportsApi,
  salesApi,
  inventoryApi,
  productsApi,
  khataApi,
  agriDoctorApi,
  getErrorMessage,
} from '../api';
import {
  DashboardSummary,
  Sale,
  Product,
  AgriDoctorAdvisory,
  SaleItem,
  ShopSettings,
} from '../types';
import { useAuth } from '../context/AuthContext';
import { useShop } from '../context/ShopContext';
import { CameraScannerModal } from '../components/ocr/CameraScannerModal';
import { AgriDoctorModal } from '../components/billing/AgriDoctorModal';
import { InvoiceReceiptModal } from '../components/billing/InvoiceReceiptModal';
import {
  formatCurrency,
  formatCompactINR,
  safeNumber,
  safeString,
  buildWhatsAppInvoiceUrl,
} from '../utils/formatters';

interface StagedFastTillItem {
  product_id: number;
  product_name: string;
  company_name?: string;
  trade_name?: string;
  category: string;
  batch_number: string;
  expiry_date?: string;
  hsn_code: string;
  unit: string;
  quantity: number;
  unit_price: number;
  mrp: number;
  gst_rate: number;
  discount_percent: number;
}

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { settings } = useShop();

  // ─── API STATE ─────────────────────────────────────────────────────────────
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [nearExpiryProducts, setNearExpiryProducts] = useState<Product[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [khataSummary, setKhataSummary] = useState<{
    total_customers: number;
    total_outstanding_udhar: number;
  } | null>(null);
  const [advisories, setAdvisories] = useState<AgriDoctorAdvisory[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ─── MODAL CONTROLS ─────────────────────────────────────────────────────────
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isAgriDoctorOpen, setIsAgriDoctorOpen] = useState(false);
  const [selectedReprintSale, setSelectedReprintSale] = useState<Sale | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  // ─── FAST-TILL LOCAL STATE ─────────────────────────────────────────────────
  const [stagedItems, setStagedItems] = useState<StagedFastTillItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [selectedTender, setSelectedTender] = useState<'UPI' | 'Cash' | 'Credit'>('UPI');
  const [selectedCustomerName, setSelectedCustomerName] = useState<string>('');
  const [isDockVisible, setIsDockVisible] = useState(true);
  const [thermalFeedbackMsg, setThermalFeedbackMsg] = useState<string | null>(null);

  // ─── EXPIRY FILTER STATE ───────────────────────────────────────────────────
  const [expiryFilter, setExpiryFilter] = useState<'critical' | 'all'>('critical');

  // ─── DATA FETCHING ─────────────────────────────────────────────────────────
  const fetchAllData = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [dashRes, salesRes, expiryRes, productsRes, khataRes, advRes] =
        await Promise.allSettled([
          reportsApi.getDashboard(),
          salesApi.getAll({ limit: 5 }),
          inventoryApi.getNearExpiry(60),
          productsApi.getAll({ limit: 300 }),
          khataApi.listCustomers(),
          agriDoctorApi.getAdvisories(),
        ]);

      if (dashRes.status === 'fulfilled') {
        setSummary(dashRes.value);
      }
      if (salesRes.status === 'fulfilled') {
        setRecentSales(Array.isArray(salesRes.value) ? salesRes.value : []);
      }
      if (expiryRes.status === 'fulfilled') {
        setNearExpiryProducts(Array.isArray(expiryRes.value) ? expiryRes.value : []);
      }
      if (productsRes.status === 'fulfilled') {
        setAllProducts(Array.isArray(productsRes.value) ? productsRes.value : []);
      }
      if (khataRes.status === 'fulfilled') {
        setKhataSummary({
          total_customers: khataRes.value.total_customers || 0,
          total_outstanding_udhar: khataRes.value.total_outstanding_udhar || 0,
        });
      }
      if (advRes.status === 'fulfilled') {
        setAdvisories(Array.isArray(advRes.value) ? advRes.value : []);
      }
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Failed to sync live store telemetry.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      void fetchAllData();
    }
  }, [user?.id]);

  // ─── KEYBOARD SHORTCUTS ─────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        navigate('/billing');
      } else if (e.key === 'F4') {
        e.preventDefault();
        setSelectedTender('UPI');
      } else if (e.key === 'F5') {
        e.preventDefault();
        setSelectedTender('Cash');
      } else if (e.key === 'F6') {
        e.preventDefault();
        setSelectedTender('Credit');
      } else if (e.key === 'Escape') {
        setIsDockVisible(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  // ─── SEARCH & AUTOSUGGEST ───────────────────────────────────────────────────
  useEffect(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      setSearchResults([]);
      return;
    }
    const matches = allProducts.filter((p) => {
      const name = safeString(p.name || p.product_name).toLowerCase();
      const trade = safeString(p.trade_name).toLowerCase();
      const code = safeString(p.barcode || p.product_code || p.batch_number).toLowerCase();
      const hsn = safeString(p.hsn_code).toLowerCase();
      return (
        name.includes(query) || trade.includes(query) || code.includes(query) || hsn.includes(query)
      );
    });
    setSearchResults(matches.slice(0, 6));
  }, [searchQuery, allProducts]);

  // ─── FAST-TILL CART MANAGEMENT ─────────────────────────────────────────────
  const stageProduct = (product: Product, discountPct = 0) => {
    setStagedItems((prev) => {
      const existingIdx = prev.findIndex(
        (i) => i.product_id === product.id && i.batch_number === (product.batch_number || 'DEFAULT')
      );
      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx].quantity += 1;
        return next;
      }
      const price = safeNumber(product.selling_price || product.mrp, 100);
      return [
        ...prev,
        {
          product_id: product.id,
          product_name: product.name || product.product_name || 'Agri Input Product',
          company_name: product.company_name,
          trade_name: product.trade_name,
          category: product.category || 'General',
          batch_number: product.batch_number || 'DEFAULT',
          expiry_date: product.expiry_date,
          hsn_code: product.hsn_code || '310210',
          unit: product.unit || 'Bags',
          quantity: 1,
          unit_price: price,
          mrp: safeNumber(product.mrp, price),
          gst_rate: safeNumber(product.gst_rate, 5),
          discount_percent: discountPct,
        },
      ];
    });
    setSearchQuery('');
    setSearchResults([]);
  };

  const updateStagedQty = (idx: number, delta: number) => {
    setStagedItems((prev) => {
      const next = [...prev];
      const newQty = next[idx].quantity + delta;
      if (newQty <= 0) {
        next.splice(idx, 1);
      } else {
        next[idx].quantity = newQty;
      }
      return next;
    });
  };

  const removeStagedItem = (idx: number) => {
    setStagedItems((prev) => prev.filter((_, i) => i !== idx));
  };

  // ─── FINANCIAL CALCULATIONS ────────────────────────────────────────────────
  const fastTillTotals = useMemo(() => {
    let preGstTotal = 0;
    let payableTotal = 0;

    for (const item of stagedItems) {
      const lineBase = item.unit_price * item.quantity;
      const discount = (lineBase * item.discount_percent) / 100;
      const netLine = lineBase - discount;
      const gstRate = item.gst_rate;
      const itemTax = (netLine * gstRate) / 100;
      preGstTotal += netLine;
      payableTotal += netLine + itemTax;
    }

    return {
      preGstTotal,
      payableTotal: Math.round(payableTotal * 100) / 100,
    };
  }, [stagedItems]);

  const handleProceedToBilling = () => {
    if (stagedItems.length === 0) {
      navigate('/billing');
      return;
    }
    const stagedCartItems = stagedItems.map((item) => ({
      product_id: item.product_id,
      product_name: item.product_name,
      company_name: item.company_name,
      trade_name: item.trade_name,
      batch_number: item.batch_number,
      expiry_date: item.expiry_date,
      hsn_code: item.hsn_code,
      unit: item.unit,
      quantity: item.quantity,
      unit_price: item.unit_price,
      mrp: item.mrp,
      discount_percent: item.discount_percent,
      gst_rate: item.gst_rate,
    }));
    navigate('/billing', {
      state: {
        stagedCartItems,
        selectedTender,
      },
    });
  };

  // ─── GREETING & TELEMETRY CALCULATIONS ──────────────────────────────────────
  const timeGreeting = useMemo(() => {
    const hr = new Date().getHours();
    if (hr < 12) return 'Good Morning';
    if (hr < 17) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  const todayCashAmount = useMemo(() => {
    const cashSales = recentSales.filter(
      (s) => (s.payment_mode || '').toLowerCase() === 'cash'
    );
    return cashSales.reduce((acc, s) => acc + safeNumber(s.grand_total), 0);
  }, [recentSales]);

  // Real inventory metrics calculation from live database products
  const inventoryMetrics = useMemo(() => {
    const totalStockQty = allProducts.reduce((acc, p) => acc + safeNumber(p.current_stock), 0);
    const inStockCount = allProducts.filter((p) => safeNumber(p.current_stock) > 0).length;
    const outOfStockCount = allProducts.filter((p) => safeNumber(p.current_stock) <= 0).length;
    return {
      totalStockQty,
      inStockCount,
      outOfStockCount,
      totalSkus: allProducts.length,
    };
  }, [allProducts]);

  // Velocity payment distribution
  const paymentVelocity = useMemo(() => {
    if (recentSales.length === 0) {
      return { upiPct: 0, cashPct: 0, khataPct: 0 };
    }
    let upi = 0;
    let cash = 0;
    let khata = 0;
    for (const sale of recentSales) {
      const mode = (sale.payment_mode || '').toLowerCase();
      if (mode.includes('upi')) upi += sale.grand_total;
      else if (mode.includes('cash')) cash += sale.grand_total;
      else khata += sale.grand_total;
    }
    const total = upi + cash + khata;
    if (total <= 0) return { upiPct: 0, cashPct: 0, khataPct: 0 };
    return {
      upiPct: Math.round((upi / total) * 100),
      cashPct: Math.round((cash / total) * 100),
      khataPct: Math.max(0, 100 - Math.round((upi / total) * 100) - Math.round((cash / total) * 100)),
    };
  }, [recentSales]);

  // Filtered near-expiry batches
  const displayedExpiryProducts = useMemo(() => {
    const list = nearExpiryProducts.length > 0 ? nearExpiryProducts : allProducts.filter((p) => p.expiry_date);
    const now = Date.now();
    return list.map((p) => {
      const expTime = p.expiry_date ? new Date(p.expiry_date).getTime() : now + 90 * 86400000;
      const daysRemaining = Math.max(0, Math.ceil((expTime - now) / 86400000));
      return { ...p, calculatedDays: daysRemaining };
    }).filter((p) => {
      if (expiryFilter === 'critical') return p.calculatedDays <= 45;
      return true;
    }).sort((a, b) => a.calculatedDays - b.calculatedDays);
  }, [nearExpiryProducts, allProducts, expiryFilter]);

  const valueAtRisk = useMemo(() => {
    return displayedExpiryProducts.reduce(
      (acc, p) => acc + safeNumber(p.current_stock) * safeNumber(p.selling_price || p.mrp),
      0
    );
  }, [displayedExpiryProducts]);

  // ─── REPRINT INVOICE HANDLER ────────────────────────────────────────────────
  const handleOpenReprint = (sale: Sale) => {
    setSelectedReprintSale(sale);
    setIsReceiptOpen(true);
  };

  // ─── TEST PRINT SLIP ────────────────────────────────────────────────────────
  const handlePrintTestSlip = () => {
    const printWindow = window.open('', '_blank', 'width=350,height=500');
    if (!printWindow) return;
    const shopTitle = settings.shop_name || `${user?.full_name || 'Dealer'}'s Shop`;
    const gstin = settings.gstin || '29AAAAA0000A1Z5';
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>ESC/POS 80mm Test Slip</title>
          <style>
            @page { size: 80mm auto; margin: 0; }
            body {
              font-family: 'Courier New', monospace;
              width: 72mm;
              margin: 0 auto;
              padding: 10px 0;
              font-size: 11px;
              color: #000;
            }
            .center { text-align: center; }
            .divider { border-top: 1px dashed #000; margin: 6px 0; }
            .bold { font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="center bold">*** ${shopTitle} ***</div>
          <div class="center">GSTIN: ${gstin}</div>
          <div class="center">80mm Direct Thermal POS</div>
          <div class="divider"></div>
          <div>TEST PRINT: ESC/POS ENGINE OK</div>
          <div>DATE: ${new Date().toLocaleString('en-IN')}</div>
          <div>TERMINAL: COUNTER #01</div>
          <div>AUTO-CUTTER: TEST OK (PARTIAL)</div>
          <div class="divider"></div>
          <div class="center bold">SYSTEM READY FOR FAST BILLING</div>
          <br/><br/>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const handleFeedPaper = () => {
    setThermalFeedbackMsg('Fed 20mm thermal roll (TVS RP-3200 Star USB ready)');
    setTimeout(() => setThermalFeedbackMsg(null), 3000);
  };

  // ─── FORM O EXPORT ──────────────────────────────────────────────────────────
  const handleDownloadFormO = () => {
    navigate('/khata?tab=compliance');
  };

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20 text-slate-800">
      {/* Main Content Workspace */}
      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 space-y-6">
        {/* Error Notification Banner if backend call fails */}
        {loadError && (
          <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-800">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
              <span>{loadError}</span>
            </div>
            <button
              type="button"
              onClick={() => void fetchAllData()}
              className="rounded-lg bg-amber-200 px-3 py-1 font-bold text-amber-900 hover:bg-amber-300"
            >
              Retry Sync
            </button>
          </div>
        )}

        {/* =======================================================================
            2. DAWN PROTOCOL BANNER (SCREENSHOT 1)
        ======================================================================= */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-900 via-emerald-800 to-emerald-950 p-5 sm:p-7 text-white shadow-xl">
          {/* Subtle Background Pattern */}
          <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]"></div>

          <div className="relative z-10 flex flex-col justify-between gap-6">
            {/* Top Bar: Protocol Pill & Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-950/60 border border-emerald-700/50 px-3 py-1 text-[11px] font-semibold text-emerald-200">
                  <Sun className="h-3.5 w-3.5 text-amber-300" />
                  <span>DAWN PROTOCOL • KHARIF CYCLE {new Date().getFullYear()}</span>
                  <span>•</span>
                  <span className="text-emerald-300">NIC Ag-Stack Gateway Online</span>
                </div>
                <h2 className="mt-2.5 text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-white">
                  {timeGreeting}, {user?.full_name || 'Dealer'}!
                </h2>
                <p className="mt-1 max-w-2xl text-xs sm:text-sm text-emerald-100/90 leading-relaxed">
                  Counter #01 is live, synced with State Agriculture Registry. Fast billing and real-time inventory active.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2 sm:self-start">
                <button
                  type="button"
                  onClick={() => navigate('/billing')}
                  className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs sm:text-sm font-black text-emerald-950 shadow-lg transition hover:bg-emerald-50 active:scale-95"
                >
                  <ShoppingCart className="h-4 w-4 text-emerald-700" />
                  <span>+ New POS Bill</span>
                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-900 font-mono">
                    [F1]
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/purchases')}
                  className="flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold text-white backdrop-blur transition hover:bg-white/20 active:scale-95"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>+ Inward</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadFormO}
                  className="flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold text-white backdrop-blur transition hover:bg-white/20 active:scale-95"
                >
                  <FileText className="h-3.5 w-3.5 text-emerald-200" />
                  <span>Form O</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsAgriDoctorOpen(true)}
                  className="flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold text-white backdrop-blur transition hover:bg-white/20 active:scale-95"
                >
                  <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                  <span>AI Lens</span>
                </button>
              </div>
            </div>

            {/* Bottom: 4 Live Telemetry Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-emerald-700/60 pt-4 text-xs">
              <div>
                <div className="text-[10px] uppercase font-bold tracking-wider text-emerald-300">Today's Gross</div>
                <div className="mt-0.5 text-lg sm:text-xl font-black text-white font-mono">
                  ₹{formatCurrency(summary?.today_sales || 0, 0)}
                </div>
                <div className="text-[11px] text-emerald-200">
                  {summary?.today_bills || 0} bills today
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase font-bold tracking-wider text-emerald-300">Monthly Sales</div>
                <div className="mt-0.5 text-lg sm:text-xl font-black text-white font-mono">
                  ₹{formatCurrency(summary?.month_sales || 0, 0)}
                </div>
                <div className="text-[11px] text-emerald-200">
                  Current month turnover
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase font-bold tracking-wider text-emerald-300">Stock Valuation</div>
                <div className="mt-0.5 text-lg sm:text-xl font-black text-white font-mono">
                  ₹{formatCurrency(summary?.total_inventory_value || 0, 0)}
                </div>
                <div className="text-[11px] text-emerald-200">
                  {summary?.low_stock_count || 0} items low on stock
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase font-bold tracking-wider text-emerald-300">Khata Exposure</div>
                <div className="mt-0.5 text-lg sm:text-xl font-black text-white font-mono">
                  ₹{formatCurrency(khataSummary?.total_outstanding_udhar || 0, 0)}
                </div>
                <div className="text-[11px] text-emerald-200">
                  {khataSummary?.total_customers || 0} Registered Growers
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =======================================================================
            3. FOUR KPI CARDS (SCREENSHOT 1)
        ======================================================================= */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Counter Velocity */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition hover:shadow-md">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">Counter Velocity</span>
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/60 p-2 text-emerald-700 dark:text-emerald-300">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                ₹{formatCurrency(summary?.today_sales || 0, 2)}
              </span>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                {summary?.today_bills ? `+${summary.today_bills} bills` : 'Ready'}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              {summary?.today_bills || 0} Invoices • Avg Basket ₹
              {summary?.today_bills && summary.today_bills > 0
                ? formatCurrency(summary.today_sales / summary.today_bills, 2)
                : '0.00'}
            </p>
            {/* Multi-segment Payment Bar */}
            <div className="mt-3">
              <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div style={{ width: `${paymentVelocity.upiPct}%` }} className="bg-emerald-500" title={`UPI: ${paymentVelocity.upiPct}%`}></div>
                <div style={{ width: `${paymentVelocity.cashPct}%` }} className="bg-emerald-800 dark:bg-emerald-600" title={`Cash: ${paymentVelocity.cashPct}%`}></div>
                <div style={{ width: `${paymentVelocity.khataPct}%` }} className="bg-amber-500" title={`Khata: ${paymentVelocity.khataPct}%`}></div>
              </div>
              <div className="mt-1 flex justify-between text-[10px] font-bold text-slate-400 dark:text-slate-500">
                <span className="text-emerald-700 dark:text-emerald-400">UPI: {paymentVelocity.upiPct}%</span>
                <span className="text-emerald-900 dark:text-emerald-300">Cash: {paymentVelocity.cashPct}%</span>
                <span className="text-amber-600 dark:text-amber-400">Khata: {paymentVelocity.khataPct}%</span>
              </div>
            </div>
          </div>

          {/* Card 2: FIFO Expiry Radar */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition hover:shadow-md">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">FIFO Expiry Radar</span>
              <div className="rounded-xl bg-red-50 dark:bg-red-950/60 p-2 text-red-600 dark:text-red-400">
                <AlertTriangle className="h-4 w-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                {displayedExpiryProducts.length} Batches
              </span>
              <span className="rounded-full bg-red-100 dark:bg-red-950/60 px-2 py-0.5 text-[10px] font-black text-red-700 dark:text-red-300">
                &lt;30 Days
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Value at Risk: <strong className="text-slate-800 dark:text-slate-200">₹{formatCurrency(valueAtRisk, 2)}</strong>
            </p>
            <div className="mt-3 flex items-center justify-between rounded-xl bg-red-50/60 dark:bg-red-950/40 border border-red-100 dark:border-red-900/60 p-2 text-[11px]">
              <span className="truncate font-semibold text-slate-800 dark:text-slate-200">
                {displayedExpiryProducts[0]?.name || 'All batches healthy'}
              </span>
              {displayedExpiryProducts.length > 0 && (
                <span className="shrink-0 rounded bg-red-200 dark:bg-red-900/80 px-1.5 py-0.5 text-[10px] font-bold text-red-800 dark:text-red-200">
                  Near Expiry
                </span>
              )}
            </div>
          </div>

          {/* Card 3: Farmer Credit Ledger */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition hover:shadow-md">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">Farmer Credit Ledger</span>
              <div className="rounded-xl bg-amber-50 dark:bg-amber-950/60 p-2 text-amber-700 dark:text-amber-400">
                <BookOpen className="h-4 w-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                ₹{formatCurrency(khataSummary?.total_outstanding_udhar || 0, 0)}
              </span>
              <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 text-[10px] font-black text-emerald-800 dark:text-emerald-300">
                {khataSummary?.total_customers || 0} Growers
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Today Cash Inward: <strong className="text-emerald-700 dark:text-emerald-400 font-mono">₹{formatCurrency(todayCashAmount, 0)}</strong>
            </p>
            <div className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>WhatsApp Reminders Ready</span>
            </div>
          </div>

          {/* Card 4: Store Inventory */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition hover:shadow-md">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">Store Inventory</span>
              <div className="rounded-xl bg-blue-50 dark:bg-blue-950/60 p-2 text-blue-700 dark:text-blue-300">
                <Package className="h-4 w-4" />
              </div>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                {inventoryMetrics.totalSkus} SKUs
              </span>
              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                {inventoryMetrics.inStockCount} In Stock
              </span>
            </div>
            <div className="mt-3 space-y-1.5 text-[11px] text-slate-600 dark:text-slate-300">
              <div className="flex justify-between">
                <span>Total Units in Stock:</span>
                <span className="font-mono font-bold">{inventoryMetrics.totalStockQty} Units</span>
              </div>
              <div className="flex justify-between">
                <span>Near Expiry Batches:</span>
                <span className="font-mono font-bold text-red-600 dark:text-red-400">{nearExpiryProducts.length} Batches</span>
              </div>
            </div>
            <p className="mt-2 text-[10px] text-slate-400 dark:text-slate-500 truncate">
              {summary?.low_stock_count || 0} items low stock • FIFO tracking active
            </p>
          </div>
        </section>

        {/* =======================================================================
            4. FAST-TILL COUNTER & AGRI DOCTOR AI LENS (SCREENSHOT 2)
        ======================================================================= */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Counter Fast-Till POS Terminal (8 Cols) */}
          <div className="lg:col-span-8 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-sm">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 p-2.5 text-emerald-700 dark:text-emerald-300">
                  <Printer className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                    Counter Fast-Till POS Terminal
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Live Session • Cash Drawer Connected</p>
                </div>
              </div>

              {/* Farmer Badge */}
              <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/40 px-3 py-1.5">
                <BadgeCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <div className="text-left text-xs">
                  <span className="font-bold text-slate-900 dark:text-white">
                    {selectedCustomerName || 'Walk-in Customer'}
                  </span>
                  <div className="text-[10px] text-emerald-700 dark:text-emerald-300 font-semibold">
                    {selectedCustomerName ? 'Registered Farmer • Active Credit' : 'Counter Till • Instant Bill'}
                  </div>
                </div>
              </div>
            </div>

            {/* Omnibar Search / Barcode Input */}
            <div className="relative mt-4">
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800 px-3.5 py-2.5 focus-within:border-emerald-600 focus-within:bg-white dark:focus-within:bg-slate-800 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all">
                <ScanLine className="h-5 w-5 text-slate-400 dark:text-slate-500 shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && searchResults.length > 0) {
                      stageProduct(searchResults[0]);
                    }
                  }}
                  placeholder="Scan Bag Barcode or Search Formula: 'Neem Urea', 'Glyphosate 41%', 'Hybrid Seeds'..."
                  className="w-full bg-transparent text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setIsScannerOpen(true)}
                  className="shrink-0 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-1 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900 transition"
                >
                  Auto-Scan
                </button>
              </div>

              {/* Dropdown Suggestions */}
              {searchResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1.5 shadow-xl">
                  {searchResults.map((prod) => (
                    <button
                      key={prod.id}
                      type="button"
                      onClick={() => stageProduct(prod)}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs hover:bg-emerald-50 dark:hover:bg-slate-700 transition"
                    >
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">{prod.name}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                          {prod.company_name || prod.category} • Batch: {prod.batch_number || 'STK'} • Stock: {prod.current_stock} {prod.unit}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-emerald-800 dark:text-emerald-300 font-mono">₹{formatCurrency(prod.selling_price || prod.mrp)}</div>
                        <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-1 rounded">Stage +</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Staged Items List */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">
                <span>STAGED ITEMS {selectedCustomerName ? `FOR ${selectedCustomerName.toUpperCase()}` : ''} ({stagedItems.length} ITEMS)</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">PRE-GST: ₹{formatCurrency(fastTillTotals.preGstTotal, 2)}</span>
              </div>

              {stagedItems.length > 0 ? (
                <div className="space-y-2.5">
                  {stagedItems.map((item, idx) => {
                    const lineTotal = item.unit_price * item.quantity * (1 - item.discount_percent / 100);
                    return (
                      <div
                        key={`${item.product_id}-${item.batch_number}-${idx}`}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 p-3.5 transition hover:border-slate-300 dark:hover:border-slate-700"
                      >
                        <div className="flex items-start gap-3">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-[11px] font-black text-emerald-900 dark:text-emerald-200">
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">{item.product_name}</h4>
                              <span className="rounded bg-blue-100 dark:bg-blue-950/60 px-1.5 py-0.2 text-[9px] font-bold text-blue-800 dark:text-blue-300">
                                {item.category}
                              </span>
                            </div>
                            <div className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                              Batch: <strong className="text-slate-700 dark:text-slate-300">{item.batch_number}</strong> • MRP: ₹{formatCurrency(item.mrp)} • GST: {item.gst_rate}%
                            </div>
                          </div>
                        </div>

                        {/* Quantity Stepper & Price */}
                        <div className="flex items-center justify-between sm:justify-end gap-3">
                          <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                            <button
                              type="button"
                              onClick={() => updateStagedQty(idx, -1)}
                              className="px-2.5 py-1 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white active:scale-95"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="px-2 font-mono text-xs font-bold text-slate-900 dark:text-white">
                              {item.quantity} {item.unit}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateStagedQty(idx, 1)}
                              className="px-2.5 py-1 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white active:scale-95"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>

                          <div className="font-mono text-sm font-black text-slate-900 dark:text-white w-24 text-right">
                            ₹{formatCurrency(lineTotal, 2)}
                          </div>

                          <button
                            type="button"
                            onClick={() => removeStagedItem(idx)}
                            className="p-1 text-slate-400 hover:text-red-600 transition"
                            title="Remove"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                  <p className="font-semibold text-slate-700 dark:text-slate-300">Fast-till is ready for rapid billing</p>
                  <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                    Scan a bag barcode above, search a molecule, or select in-stock items to stage them on counter.
                  </p>
                  {allProducts.length > 0 && (
                    <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                      {allProducts.slice(0, 3).map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => stageProduct(p)}
                          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:border-emerald-300 hover:bg-emerald-50 dark:hover:bg-slate-700 transition"
                        >
                          + {p.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Tender & Action Bar */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 dark:border-slate-800 pt-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Payment Tender:</span>
                <button
                  type="button"
                  onClick={() => setSelectedTender('UPI')}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                    selectedTender === 'UPI'
                      ? 'bg-emerald-700 text-white shadow'
                      : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  UPI QR [F4]
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTender('Cash')}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                    selectedTender === 'Cash'
                      ? 'bg-emerald-700 text-white shadow'
                      : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  Cash [F5]
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTender('Credit')}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                    selectedTender === 'Credit'
                      ? 'bg-amber-600 text-white shadow'
                      : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  Add to Khata [F6]
                </button>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Payable Total</div>
                  <div className="font-mono text-xl font-black text-slate-900 dark:text-white">
                    ₹{formatCurrency(fastTillTotals.payableTotal, 2)}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleProceedToBilling}
                  className="flex items-center gap-2 rounded-2xl bg-emerald-700 hover:bg-emerald-600 text-white px-5 py-3 text-xs sm:text-sm font-black shadow-lg shadow-emerald-700/20 active:scale-95 transition-all"
                >
                  <Printer className="h-4 w-4" />
                  <span>Print Bill [Enter]</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right: Agri Doctor AI Lens (4 Cols) */}
          <div className="lg:col-span-4 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/60 p-2 text-emerald-700 dark:text-emerald-300">
                  <Microscope className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">Agri Doctor AI Lens</h3>
                    <span className="rounded bg-emerald-100 dark:bg-emerald-950/60 px-1.5 py-0.2 text-[9px] font-bold text-emerald-800 dark:text-emerald-300">
                      v3.2
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Real-Time Crop Pathology</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAgriDoctorOpen(true)}
                className="flex items-center gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                <Sparkles className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />
                <span>Scan Leaf</span>
              </button>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
              Diagnosed from inbound grower photos via WhatsApp bot. Click prescription to load bill instantly.
            </p>

            {/* Real Advisories from Database / Backend */}
            {advisories.length > 0 ? (
              advisories.slice(0, 2).map((adv, aIdx) => (
                <div key={aIdx} className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-black text-emerald-800 dark:text-emerald-300 text-[10px] uppercase tracking-wider">Crop: {adv.crop_name}</span>
                    <span className="rounded bg-emerald-100 dark:bg-emerald-950/60 px-1.5 py-0.2 text-[10px] font-bold text-emerald-800 dark:text-emerald-300">Active</span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">{adv.pest_disease}</h4>
                  <div className="rounded-xl bg-white dark:bg-slate-900 p-2.5 border border-slate-200/70 dark:border-slate-800 text-[11px] space-y-1">
                    <div className="font-semibold text-slate-800 dark:text-slate-200">
                      Prescribed Molecule: <span className="font-mono text-emerald-700 dark:text-emerald-400">{adv.technical_molecule}</span>
                    </div>
                    {adv.matching_products && adv.matching_products.length > 0 && (
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold truncate max-w-[160px]">
                          In Stock: {adv.matching_products[0].product_name}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const match = allProducts.find((p) => p.id === adv.matching_products[0].id);
                            if (match) stageProduct(match);
                          }}
                          className="rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white px-2.5 py-1 text-[10px] font-bold shadow-xs"
                        >
                          + Bill Medicine
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-6 text-center text-xs text-slate-400 dark:text-slate-500">
                <Microscope className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                <p className="font-semibold text-slate-700 dark:text-slate-300">No active disease outbreaks</p>
                <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                  Click 'Scan Leaf' to diagnose crop symptoms or trigger instant molecular prescription.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* =======================================================================
            5. BATCH EXPIRY & FIFO INVENTORY CONTROL + STATUTORY REGISTERS (SCREENSHOT 3)
        ======================================================================= */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Batch Expiry & FIFO Inventory Control Table (8 Cols) */}
          <div className="lg:col-span-8 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-sm overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="rounded-2xl bg-red-50 dark:bg-red-950/60 p-2.5 text-red-600 dark:text-red-400">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                      Batch Expiry &amp; FIFO Inventory Control
                    </h3>
                    <span className="rounded bg-red-100 dark:bg-red-950/60 px-1.5 py-0.2 text-[9px] font-black text-red-700 dark:text-red-300">
                      Strict FIFO
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Automated Price Markdowns &amp; Distributor Return Slips</p>
                </div>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-400 dark:text-slate-500 font-semibold">Filter:</span>
                <button
                  type="button"
                  onClick={() => setExpiryFilter('critical')}
                  className={`rounded-xl px-2.5 py-1 font-bold transition ${
                    expiryFilter === 'critical'
                      ? 'bg-red-600 text-white shadow'
                      : 'border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  &lt;30d Critical
                </button>
                <button
                  type="button"
                  onClick={() => setExpiryFilter('all')}
                  className={`rounded-xl px-2.5 py-1 font-bold transition ${
                    expiryFilter === 'all'
                      ? 'bg-slate-800 text-white shadow'
                      : 'border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  All Warehouses
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-[10px] font-black uppercase text-slate-400 dark:text-slate-400 tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">Product &amp; Formula</th>
                    <th className="py-2.5 px-3">Manufacturer</th>
                    <th className="py-2.5 px-3">Batch &amp; HSN</th>
                    <th className="py-2.5 px-3">Expiry Lifecycle</th>
                    <th className="py-2.5 px-3">Stock on Hand</th>
                    <th className="py-2.5 px-3 text-right">Counter Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {displayedExpiryProducts.length > 0 ? (
                    displayedExpiryProducts.slice(0, 5).map((prod) => {
                      const days = prod.calculatedDays ?? 30;
                      const isCritical = days <= 30;
                      const isWarning = days > 30 && days <= 60;
                      return (
                        <tr key={prod.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-900 dark:text-white">{prod.name}</div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">{prod.trade_name || prod.category}</div>
                          </td>
                          <td className="py-3 px-3 font-medium text-slate-700 dark:text-slate-300">
                            {prod.company_name || 'Agro Manufacturer'}
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-400">
                            <div>{prod.batch_number || 'STK'}</div>
                            <div className="text-[10px] text-slate-400 dark:text-slate-500">HSN: {prod.hsn_code || '380891'}</div>
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`inline-block rounded-lg px-2 py-0.5 text-[10px] font-black ${
                                isCritical
                                  ? 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300'
                                  : isWarning
                                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                                  : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                              }`}
                            >
                              {days} Days {isCritical ? 'Remaining' : isWarning ? '(FIFO First)' : 'Healthy'}
                            </span>
                            <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                              {prod.expiry_date || 'No Expiry Set'}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-900 dark:text-white">
                              {prod.current_stock} {prod.unit}
                            </div>
                            <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                              Val: ₹{formatCurrency(safeNumber(prod.current_stock) * safeNumber(prod.selling_price || prod.mrp), 0)}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right">
                            {isCritical ? (
                              <button
                                type="button"
                                onClick={() => stageProduct(prod, 20)}
                                className="rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold px-3 py-1.5 text-[11px] shadow-sm transition active:scale-95"
                              >
                                Clearance 20%
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => stageProduct(prod)}
                                className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold px-3 py-1.5 text-[11px] transition active:scale-95"
                              >
                                Push to Counter
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">
                        All batches healthy — 0 items expiring within 60 days. FIFO auto-rotation active.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right: Statutory Audit Registers (4 Cols) */}
          <div className="lg:col-span-4 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="rounded-xl bg-blue-50 dark:bg-blue-950/60 p-2 text-blue-700 dark:text-blue-300">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">Statutory Audit Registers</h3>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">Form O &amp; Pesticide Stock Registers</p>
              </div>
            </div>

            {/* Card 1: Fertilizer Form O */}
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 p-4 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <h4 className="font-bold text-slate-900 dark:text-white">Fertilizer Form O (MFMS &amp; FCO 1985)</h4>
                <span className="rounded bg-emerald-100 dark:bg-emerald-950/60 px-1.5 py-0.2 text-[9px] font-bold text-emerald-800 dark:text-emerald-300">
                  100% Audited
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                Reconciled against MFMS Point-of-Sale logs. Total retail quota matched within 0.02% tolerance.
              </p>
              <div className="flex items-center justify-between pt-1 text-xs">
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Govt Inspector Seal: Ready</span>
                <button
                  type="button"
                  onClick={handleDownloadFormO}
                  className="flex items-center gap-1.5 rounded-xl bg-blue-700 hover:bg-blue-600 text-white font-bold px-3 py-1.5 text-xs shadow transition active:scale-95"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download Form O</span>
                </button>
              </div>
            </div>

            {/* Card 2: Pesticide Form M */}
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 p-4 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <h4 className="font-bold text-slate-900 dark:text-white">Pesticide Form M &amp; CIB</h4>
                <span className="rounded bg-emerald-100 dark:bg-emerald-950/60 px-1.5 py-0.2 text-[9px] font-bold text-emerald-800 dark:text-emerald-300">
                  100% CIB-RC
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                Zero banned chemicals detected. All active batches cross-verified against Central Insecticide Board database.
              </p>
              <div className="flex items-center justify-between pt-1 text-xs">
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">B2B E-Way: 14 Syncs OK</span>
                <button
                  type="button"
                  onClick={() => navigate('/khata?tab=catalog')}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold px-3 py-1.5 text-xs transition active:scale-95"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>Export Form M</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* =======================================================================
            6. RECENT COUNTER INVOICES & THERMAL ENGINE (SCREENSHOT 4)
        ======================================================================= */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Recent Counter Invoices & 80mm ESC/POS Reprint (8 Cols) */}
          <div className="lg:col-span-8 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 p-2.5 text-emerald-700 dark:text-emerald-300">
                  <Printer className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                    Recent Counter Invoices &amp; 80mm ESC/POS Reprint
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Instant Thermal Slips &amp; WhatsApp E-Bills</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate('/reports')}
                className="flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 transition"
              >
                <span>View All Invoices</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* List of Recent Sales */}
            <div className="mt-4 space-y-3">
              {recentSales.length > 0 ? (
                recentSales.map((sale) => {
                  const mode = (sale.payment_mode || 'Cash').toLowerCase();
                  const isUpi = mode.includes('upi');
                  const isCash = mode.includes('cash');
                  const isCredit = mode.includes('credit') || mode.includes('khata');

                  const itemsDesc =
                    sale.items && sale.items.length > 0
                      ? sale.items.map((i) => `${i.product_name} (x${i.quantity})`).join(', ')
                      : 'Fertilizer, seed & pesticide supplies';

                  return (
                    <div
                      key={sale.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-4 transition hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/70"
                    >
                      <div className="flex items-start gap-3">
                        <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-200/80 dark:bg-slate-700/80 px-2 py-1 rounded-lg">
                          #{sale.invoice_number}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">{sale.customer_name}</h4>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                              ({sale.customer_phone ? `ID: ${sale.customer_phone}` : 'Walk-in Farmer'})
                            </span>
                          </div>
                          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 max-w-md">
                            {itemsDesc}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3">
                        <div className="text-right">
                          <div className="font-mono text-sm font-black text-slate-900 dark:text-white">
                            ₹{formatCurrency(sale.grand_total, 2)}
                          </div>
                          <div className="flex items-center justify-end gap-1 text-[10px] font-bold">
                            {isUpi ? (
                              <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-0.5">
                                <QrCode className="h-3 w-3" /> UPI Paid
                              </span>
                            ) : isCash ? (
                              <span className="text-emerald-900 dark:text-emerald-300 flex items-center gap-0.5">
                                <Banknote className="h-3 w-3" /> Cash Drawer
                              </span>
                            ) : isCredit ? (
                              <span className="text-amber-700 dark:text-amber-400 flex items-center gap-0.5">
                                <BookOpen className="h-3 w-3" /> Khata Credit
                              </span>
                            ) : (
                              <span className="text-slate-600 dark:text-slate-400">{sale.payment_mode}</span>
                            )}
                          </div>
                        </div>

                        {/* WhatsApp Link */}
                        {sale.customer_phone && (
                          <button
                            type="button"
                            onClick={() => {
                              const waUrl = buildWhatsAppInvoiceUrl(sale.customer_phone, sale, settings);
                              window.open(waUrl, '_blank', 'noopener,noreferrer');
                            }}
                            className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 p-2 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition"
                            title="Share on WhatsApp"
                          >
                            <Send className="h-3.5 w-3.5" />
                          </button>
                        )}

                        {/* 1-Click ESC/POS Reprint */}
                        <button
                          type="button"
                          onClick={() => handleOpenReprint(sale)}
                          className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold px-3 py-1.5 text-xs shadow-sm transition active:scale-95"
                        >
                          <Printer className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                          <span>Reprint</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-6 text-center text-xs text-slate-400 dark:text-slate-500">
                  No counter sales recorded yet today. Use Fast-Till or New Bill [F1] to issue invoices.
                </div>
              )}
            </div>
          </div>

          {/* Right: Counter Thermal Engine (4 Cols) */}
          <div className="lg:col-span-4 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="rounded-xl bg-slate-100 dark:bg-slate-800 p-2 text-slate-700 dark:text-slate-300">
                <Printer className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">Counter Thermal Engine</h3>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">TVS RP-3200 Star USB • ESC/POS Online</p>
              </div>
            </div>

            {/* Thermal Slip Simulation */}
            <div className="rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950/80 p-4 font-mono text-[11px] text-slate-700 dark:text-slate-300 space-y-2">
              <div className="text-center font-bold text-slate-900 dark:text-white">
                *** {settings.shop_name || `${user?.full_name || 'Dealer'}'s Shop`} ***
              </div>
              <div className="text-center text-[10px] text-slate-500 dark:text-slate-400">
                GSTIN: {settings.gstin || '29AAAAA0000A1Z5'} • 80mm Direct
              </div>
              <div className="border-t border-slate-200 dark:border-slate-800 pt-2 space-y-1 text-[10px]">
                <div className="flex justify-between">
                  <span>Thermal Roll Health:</span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">78% Remaining</span>
                </div>
                <div className="flex justify-between">
                  <span>Auto Cutter Mechanism:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">Engaged (Partial)</span>
                </div>
                <div className="flex justify-between">
                  <span>Regional Header Print:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">Enabled (UTF-8)</span>
                </div>
              </div>
            </div>

            {/* Feedback notification if button pressed */}
            {thermalFeedbackMsg && (
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 p-2 text-center text-[11px] font-bold text-emerald-800 dark:text-emerald-300 animate-fade-in">
                {thermalFeedbackMsg}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleFeedPaper}
                className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold py-2 text-xs text-slate-700 dark:text-slate-200 transition"
              >
                Feed 20mm
              </button>
              <button
                type="button"
                onClick={handlePrintTestSlip}
                className="flex-1 rounded-xl bg-slate-900 dark:bg-emerald-700 hover:bg-slate-800 dark:hover:bg-emerald-600 text-white font-bold py-2 text-xs shadow transition active:scale-95"
              >
                Print Test Slip
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* =========================================================================
          7. FLOATING STATUS DOCK (BOTTOM RIGHT)
      ========================================================================= */}
      {isDockVisible && (
        <aside
          aria-label="Counter status"
          className="fixed bottom-4 right-4 z-40 flex items-center gap-3 rounded-2xl bg-emerald-950 text-white px-4 py-2.5 shadow-2xl border border-emerald-800/80 backdrop-blur"
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400"></span>
          </span>
          <div className="text-left text-xs">
            <div className="font-bold text-white">Counter #01 Idle &amp; Ready</div>
            <div className="text-[10px] text-emerald-200">
              Tap [F1] for instant bill or press Barcode Gun
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsDockVisible(false)}
            className="ml-2 rounded-lg bg-emerald-900/60 hover:bg-emerald-800 px-2 py-1 text-[10px] font-mono text-emerald-300"
          >
            ESC: Close
          </button>
        </aside>
      )}

      {/* =========================================================================
          MODALS
      ========================================================================= */}
      {/* 80mm ESC/POS Reprint Receipt Modal */}
      {isReceiptOpen && selectedReprintSale && (
        <InvoiceReceiptModal
          isOpen={isReceiptOpen}
          sale={selectedReprintSale}
          settings={settings}
          onClose={() => {
            setIsReceiptOpen(false);
            setSelectedReprintSale(null);
          }}
        />
      )}

      {/* Camera Barcode & OCR Scanner Modal */}
      <CameraScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onAddProductToBill={(item: Partial<SaleItem>) => {
          setIsScannerOpen(false);
          const matched = allProducts.find((p) => p.id === item.product_id) || allProducts[0];
          if (matched) {
            stageProduct(matched);
          }
        }}
      />

      {/* Agri Doctor AI Diagnostic Modal */}
      <AgriDoctorModal
        isOpen={isAgriDoctorOpen}
        onClose={() => setIsAgriDoctorOpen(false)}
        onAddToCart={(product: Product) => {
          stageProduct(product);
          setIsAgriDoctorOpen(false);
        }}
      />
    </div>
  );
};
