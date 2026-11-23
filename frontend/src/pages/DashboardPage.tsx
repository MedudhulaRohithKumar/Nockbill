import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IndianRupee,
  RefreshCw,
  AlertTriangle,
  Receipt,
  ScanLine,
  Search,
  Plus,
  Minus,
  X,
  Printer,
  FileCheck2,
  Package,
  Clock,
  ArrowUpRight,
  Sparkles,
  CheckCircle2,
  Check,
  Send,
  Camera,
  Smartphone,
  ShieldCheck,
  FileSpreadsheet,
  Download
} from 'lucide-react';
import { reportsApi, getErrorMessage } from '../api';
import { DashboardSummary, Product, Sale } from '../types';
import { useAuth } from '../context/AuthContext';
import { useShop } from '../context/ShopContext';
import { CameraScannerModal } from '../components/ocr/CameraScannerModal';
import { formatCurrency, formatCompactINR } from '../utils/formatters';

interface StagedCartItem {
  id: string;
  name: string;
  categoryBadge: string;
  badgeBg: string;
  badgeText: string;
  batch: string;
  mrp: number;
  rate: number;
  gstRate: number;
  quantity: number;
  unit: string;
}

const DEFAULT_STAGED_ITEMS: StagedCartItem[] = [
  {
    id: 'stage-1',
    name: 'IFFCO Neem Coated Urea (45kg)',
    categoryBadge: 'DBT Govt Subsidized',
    badgeBg: 'bg-regulatory-sky-bg',
    badgeText: 'text-regulatory-sky',
    batch: 'UF-982',
    mrp: 266.5,
    rate: 266.5,
    gstRate: 5,
    quantity: 4,
    unit: 'Bags',
  },
  {
    id: 'stage-2',
    name: 'Syngenta Ridomil Gold (Mancozeb 64% + Metalaxyl-M 4%)',
    categoryBadge: 'Bio-Fungicide',
    badgeBg: 'bg-sprout-tint',
    badgeText: 'text-primary',
    batch: 'RG-702',
    mrp: 980.0,
    rate: 980.0,
    gstRate: 18,
    quantity: 2,
    unit: 'Pkts',
  },
];

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { settings } = useShop();

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isIdleBannerVisible, setIsIdleBannerVisible] = useState(true);
  const [thermalToast, setThermalToast] = useState<string | null>(null);

  // Fast-till staged cart state
  const [stagedItems, setStagedItems] = useState<StagedCartItem[]>(DEFAULT_STAGED_ITEMS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTender, setSelectedTender] = useState<'UPI' | 'CASH' | 'KHATA'>('UPI');
  const [expiryFilter, setExpiryFilter] = useState<'CRITICAL' | 'ALL'>('CRITICAL');

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const fetchDashboard = async () => {
    setIsLoading(true);
    try {
      const data = await reportsApi.getDashboard();
      setSummary(data);
      setLoadError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Could not load live dashboard telemetry'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      void fetchDashboard();
    }
  }, [user?.id]);

  // Global F1 and / keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        if (barcodeInputRef.current) {
          barcodeInputRef.current.focus();
          barcodeInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          navigate('/billing');
        }
      } else if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        barcodeInputRef.current?.focus();
      } else if (e.key === 'Escape') {
        setIsIdleBannerVisible(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  // Cart operations
  const handleQuantityChange = (id: string, delta: number) => {
    setStagedItems((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const nextQty = Math.max(1, item.quantity + delta);
            return { ...item, quantity: nextQty };
          }
          return item;
        })
    );
  };

  const handleRemoveStagedItem = (id: string) => {
    setStagedItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleOcrAddProduct = (item: any) => {
    navigate('/billing', { state: { pendingBillItem: item } });
  };

  const handleBillPrescribedMedicine = (medicineName: string, category: string) => {
    navigate('/billing', {
      state: {
        pendingBillItem: {
          name: medicineName,
          category,
          quantity: 1,
        },
      },
    });
  };

  const triggerThermalAction = (message: string) => {
    setThermalToast(message);
    setTimeout(() => {
      setThermalToast(null);
    }, 3500);
  };

  // Calculations
  const stagedPreGst = stagedItems.reduce((acc, item) => {
    const baseRate = item.rate / (1 + item.gstRate / 100);
    return acc + baseRate * item.quantity;
  }, 0);

  const stagedPayableTotal = stagedItems.reduce((acc, item) => {
    return acc + item.rate * item.quantity;
  }, 0);

  // Time-aware greeting (100% English, zero Hindi)
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const userName = user?.full_name || 'Dealer';
  const shopName = settings.shop_name || 'Green Valley Agro Kendra';
  const fertLicense = settings.fertilizer_license_no || 'KA-BLR-F9';
  const pestLicense = settings.pesticide_license_no || 'CIB-8941';
  const seedLicense = settings.seed_license_no || 'DS-KAR-102';

  const todayGross = summary?.today_sales ?? 148920;
  const todayBills = summary?.today_bills ?? 84;
  const avgBasket = todayBills > 0 ? todayGross / todayBills : 1772;
  const expiryCount = summary?.near_expiry_count ?? 4;
  const stockValueAtRisk = summary?.total_inventory_value
    ? Math.round(summary.total_inventory_value * 0.08)
    : 38400;

  return (
    <div className="min-h-screen bg-surface text-on-surface pb-16">
      {/* ─── TOP BAR / AGRO HUB STATUS HEADER ─────────────────────── */}
      <header className="sticky top-0 z-30 bg-surface/95 backdrop-blur-xl border-b border-surface-container px-4 sm:px-6 lg:px-8 py-3.5 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Left: Hub Identification & Statutory Licenses */}
          <div className="flex flex-col">
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-primary ring-2 ring-secondary-container" />
              <span className="font-bold text-sm sm:text-base text-on-surface">
                {shopName}
              </span>
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-medium">
                Hub #{settings.shop_account_id || 'KA-BLR-2023'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="font-mono text-[10px] text-outline-variant font-semibold">
                LICENSES:
              </span>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface-container-low text-on-surface-variant">
                FERT: {fertLicense}
              </span>
              <span className="text-outline-variant text-[10px]">•</span>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface-container-low text-on-surface-variant">
                PEST: {pestLicense}
              </span>
              <span className="text-outline-variant text-[10px]">•</span>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface-container-low text-on-surface-variant">
                SEED: {seedLicense}
              </span>
            </div>
          </div>

          {/* Right: Operational Status Badges & Licensee Profile */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Till Active Metric Pill */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-container-low border border-surface-container shadow-xs">
              <span className="material-symbols-outlined text-primary text-[18px]">
                point_of_sale
              </span>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-wider text-outline leading-tight">
                  Till Active
                </span>
                <span className="font-mono text-xs sm:text-sm text-canopy-deep font-bold leading-none">
                  ₹{formatCompactINR(todayGross)}
                </span>
              </div>
            </div>

            {/* DBT Aadhaar Online Status */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-sprout-tint text-primary text-xs font-semibold shadow-xs">
              <span className="material-symbols-outlined text-[16px]">cloud_done</span>
              <span>DBT Aadhaar</span>
              <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-secondary-container text-on-secondary-container font-bold">
                ONLINE
              </span>
            </div>

            {/* Refresh / Notifications Trigger */}
            <button
              type="button"
              onClick={() => {
                void fetchDashboard();
              }}
              className="relative p-2 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface-variant transition-colors"
              title="Refresh Telemetry"
              aria-label="Refresh Telemetry"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-primary' : ''}`} />
            </button>

            {/* Licensee Profile Pill */}
            <div className="flex items-center gap-2 pl-2 border-l border-surface-container">
              <div className="flex flex-col text-right">
                <span className="text-xs sm:text-sm font-bold text-on-surface leading-tight">
                  {userName}
                </span>
                <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded-full bg-iam-purple-bg text-iam-purple mt-0.5">
                  Authorized Licensee
                </span>
              </div>
              <div className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-xs shadow-xs">
                {userName.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
        {/* Error Alert with Safe Recovery */}
        {loadError && (
          <div
            role="alert"
            className="p-4 bg-critical-rose-bg text-critical-rose border border-critical-rose/30 rounded-xl text-xs sm:text-sm flex items-center justify-between gap-3 shadow-xs"
          >
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle className="w-4 h-4 shrink-0 text-critical-rose" />
              <span className="truncate">
                {summary
                  ? `Showing cached figures — refresh failed: ${loadError}`
                  : `Dashboard telemetry unavailable: ${loadError}`}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                void fetchDashboard();
              }}
              disabled={isLoading}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-white border border-critical-rose/30 font-semibold text-critical-rose hover:bg-critical-rose-bg disabled:opacity-50 transition-colors"
            >
              {isLoading ? 'Retrying…' : 'Retry'}
            </button>
          </div>
        )}

        {/* ─── PASTORAL DAWN PROTOCOL BANNER ──────────────────────── */}
        <section className="relative overflow-hidden p-6 sm:p-7 rounded-2xl bg-gradient-to-r from-canopy-deep via-primary to-primary-container text-on-primary shadow-lg">
          {/* Atmospheric Pastoral Graphic Overlays */}
          <div className="absolute -right-12 -bottom-24 w-96 h-96 rounded-full bg-secondary-container/20 blur-3xl pointer-events-none" />
          <div
            className="absolute top-0 right-0 w-full h-full opacity-10 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(#d3ffd5 1.5px, transparent 1.5px)',
              backgroundSize: '20px 20px',
            }}
          />

          <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="max-w-2xl">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary-fixed/20 text-on-primary text-[10px] font-bold uppercase tracking-wider backdrop-blur-md">
                  <span className="material-symbols-outlined text-[14px] text-primary-fixed">
                    wb_sunny
                  </span>
                  Dawn Protocol • Kharif Cycle 2024
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container-lowest/15 text-primary-fixed font-mono text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-inverse-primary animate-pulse" />
                  NIC Ag-Stack Gateway Online
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-on-primary tracking-tight font-display-hero">
                {getGreeting()}, {userName}!
              </h1>
              <p className="text-xs sm:text-sm text-on-primary-container mt-1 font-medium">
                Counter #01 is live, synced with State Agriculture Registry &amp; Central DBT Fertilizer DB. No pending sync collisions.
              </p>

              {/* Dynamic Counter Badges Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-4 border-t border-white/15">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase text-secondary-fixed opacity-90">
                    Today's Gross
                  </span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="font-mono text-lg sm:text-xl font-bold text-on-primary">
                      ₹{formatCompactINR(todayGross)}
                    </span>
                    <span className="font-mono text-secondary-fixed text-[11px]">
                      ({todayBills} bills)
                    </span>
                  </div>
                </div>

                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase text-secondary-fixed opacity-90">
                    Active DBT Claim
                  </span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="font-mono text-lg sm:text-xl font-bold text-secondary-fixed">
                      ₹24,800
                    </span>
                    <span className="font-mono text-on-primary-container text-[11px]">
                      Auto-credit
                    </span>
                  </div>
                </div>

                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase text-secondary-fixed opacity-90">
                    Form O Allocated
                  </span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="font-mono text-lg sm:text-xl font-bold text-on-primary">
                      14.8 MT
                    </span>
                    <span className="font-mono text-secondary-fixed text-[11px] font-bold">
                      82% Quota
                    </span>
                  </div>
                </div>

                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase text-secondary-fixed opacity-90">
                    Khata Exposure
                  </span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="font-mono text-lg sm:text-xl font-bold text-khata-amber-bg">
                      ₹3,12,400
                    </span>
                    <span className="font-mono text-secondary-fixed text-[11px]">
                      64 Growers
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Action Command CTAs */}
            <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 w-full lg:w-auto shrink-0">
              <button
                type="button"
                onClick={() => navigate('/billing')}
                className="h-12 px-5 rounded-xl bg-surface-container-lowest text-primary font-bold text-sm flex items-center justify-between gap-4 shadow-md hover:bg-sprout-tint transition-all active:scale-[0.98]"
              >
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-primary">
                    add_shopping_cart
                  </span>
                  <span>+ New POS Bill</span>
                </div>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-surface-container-high text-on-surface font-bold">
                  [F1]
                </span>
              </button>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/purchases')}
                  className="h-10 px-2 rounded-xl bg-surface-container-lowest/15 hover:bg-surface-container-lowest/25 backdrop-blur-md text-on-primary text-xs font-semibold flex items-center justify-center gap-1 transition-all"
                  title="Add Inward Stock Batch"
                >
                  <span className="material-symbols-outlined text-[16px]">add_box</span>
                  <span>Inward</span>
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/khata?tab=compliance')}
                  className="h-10 px-2 rounded-xl bg-surface-container-lowest/15 hover:bg-surface-container-lowest/25 backdrop-blur-md text-on-primary text-xs font-semibold flex items-center justify-center gap-1 transition-all"
                  title="Validate Fertilizer Quotas"
                >
                  <span className="material-symbols-outlined text-[16px]">fact_check</span>
                  <span>Form O</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsScannerOpen(true)}
                  className="h-10 px-2 rounded-xl bg-secondary-container text-on-secondary-container text-xs font-bold flex items-center justify-center gap-1 shadow-sm hover:brightness-105 transition-all"
                  title="Launch Crop Leaf AI Scan"
                >
                  <span className="material-symbols-outlined text-[16px]">psychology_alt</span>
                  <span>AI Lens</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ─── 4-METRIC KPI GRID ───────────────────────────────────── */}
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* Card 1: Counter Billing Today */}
          <div className="bg-surface-container-lowest rounded-xl p-5 shadow-xs border border-surface-container hover:shadow-md transition-shadow flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-outline">
                Counter Velocity
              </span>
              <span className="p-1.5 rounded-lg bg-sprout-tint text-primary">
                <span className="material-symbols-outlined text-[18px]">receipt_long</span>
              </span>
            </div>

            <div>
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-2xl font-extrabold text-canopy-deep">
                  ₹{formatCurrency(todayGross)}
                </span>
                <span className="font-mono text-xs text-forest-emerald font-bold flex items-center">
                  <span className="material-symbols-outlined text-[14px]">arrow_upward</span> +14.2%
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1 text-on-surface-variant text-xs">
                <span>{todayBills} Invoices</span>
                <span>•</span>
                <span>
                  Avg Basket <span className="font-mono font-semibold text-on-surface">₹{formatCurrency(avgBasket)}</span>
                </span>
              </div>
            </div>

            {/* Tender Split Visual Bar */}
            <div className="mt-4 pt-2 border-t border-surface-container">
              <div className="flex items-center justify-between font-mono text-outline-variant mb-1 text-[10px]">
                <span>UPI: 58%</span>
                <span>Cash: 26%</span>
                <span>Khata: 16%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-surface-container overflow-hidden flex">
                <div className="h-full bg-forest-emerald" style={{ width: '58%' }} />
                <div className="h-full bg-meadow-leaf" style={{ width: '26%' }} />
                <div className="h-full bg-khata-amber" style={{ width: '16%' }} />
              </div>
            </div>
          </div>

          {/* Card 2: Batch Expiry Risk */}
          <div className="bg-surface-container-lowest rounded-xl p-5 shadow-xs border border-surface-container hover:shadow-md transition-shadow flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-critical-rose">
                FIFO Expiry Radar
              </span>
              <span className="p-1.5 rounded-lg bg-critical-rose-bg text-critical-rose">
                <span className="material-symbols-outlined text-[18px]">warning</span>
              </span>
            </div>

            <div>
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-2xl font-extrabold text-critical-rose">
                  {expiryCount} Batches
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-critical-rose-bg text-critical-rose">
                  &lt;30 Days
                </span>
              </div>
              <div className="mt-1 text-on-surface-variant text-xs">
                Value at Risk:{' '}
                <span className="font-mono font-bold text-on-surface">
                  ₹{formatCurrency(stockValueAtRisk)}
                </span>
              </div>
            </div>

            <div className="mt-4 p-2 rounded-lg bg-surface-container-low flex items-center justify-between">
              <span className="font-mono text-[11px] text-on-surface-variant truncate max-w-[170px]">
                Bayer Regent 0.3G (18d)
              </span>
              <button
                type="button"
                onClick={() => navigate('/khata?tab=catalog')}
                className="font-mono text-[11px] font-bold text-critical-rose hover:underline"
              >
                Clearance 15%
              </button>
            </div>
          </div>

          {/* Card 3: Farmer Credit Ledger */}
          <div className="bg-surface-container-lowest rounded-xl p-5 shadow-xs border border-surface-container hover:shadow-md transition-shadow flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-khata-amber">
                Farmer Credit Ledger
              </span>
              <span className="p-1.5 rounded-lg bg-khata-amber-bg text-khata-amber">
                <span className="material-symbols-outlined text-[18px]">account_balance_wallet</span>
              </span>
            </div>

            <div>
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-2xl font-extrabold text-on-surface">
                  ₹3,12,400
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sprout-tint text-primary">
                  94.6% Rate
                </span>
              </div>
              <div className="flex items-center justify-between mt-1 text-on-surface-variant text-xs">
                <span>Today Collected:</span>
                <span className="font-mono font-bold text-forest-emerald">₹48,200</span>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-forest-emerald">
                  sms
                </span>
                <span className="font-mono text-[11px] text-on-surface-variant">
                  Auto WhatsApp Recovers
                </span>
              </div>
              <button
                type="button"
                onClick={() => navigate('/khata?tab=farmers')}
                className="font-mono text-[11px] text-tertiary font-bold hover:underline"
              >
                Active
              </button>
            </div>
          </div>

          {/* Card 4: Statutory Govt Quota */}
          <div className="bg-surface-container-lowest rounded-xl p-5 shadow-xs border border-surface-container hover:shadow-md transition-shadow flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-regulatory-sky">
                Statutory Govt Quota
              </span>
              <span className="p-1.5 rounded-lg bg-regulatory-sky-bg text-regulatory-sky">
                <span className="material-symbols-outlined text-[18px]">verified</span>
              </span>
            </div>

            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-bold text-on-surface">Form O: 84%</span>
                <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-surface-container text-regulatory-sky font-bold">
                  Form M 100%
                </span>
              </div>
              <div className="flex items-center justify-between mt-1 text-on-surface-variant text-xs">
                <span>Neem Urea 45kg:</span>
                <span className="font-mono font-bold text-on-surface">420 / 500 Bags</span>
              </div>
            </div>

            <div className="mt-4">
              <div className="w-full h-2 rounded-full bg-surface-container overflow-hidden">
                <div className="h-full bg-regulatory-sky rounded-full" style={{ width: '84%' }} />
              </div>
              <div className="flex justify-between items-center mt-1">
                <span className="font-mono text-outline-variant text-[10px]">
                  DAP 18:46:0: 180/200
                </span>
                <span className="font-mono text-regulatory-sky font-bold text-[10px]">
                  CIB-RC Compliant
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ─── MAIN OPERATIONAL WORKSPACE (12 COLS: 8 LEFT, 4 RIGHT) ─── */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* ══════════ LEFT COLUMN (8 COLS) ══════════ */}
          <div className="xl:col-span-8 flex flex-col gap-6">
            {/* SUBSECTION A: Live Counter Quick POS Strip & Fast Till */}
            <div className="bg-surface-container-lowest rounded-2xl p-5 sm:p-6 shadow-xs border border-surface-container">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-sprout-tint text-primary flex items-center justify-center">
                    <span className="material-symbols-outlined text-[22px]">point_of_sale</span>
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-on-surface leading-tight">
                      Counter Fast-Till &amp; DBT Terminal
                    </h2>
                    <span className="font-mono text-xs text-on-surface-variant">
                      Live Session • Cash Drawer #01 Connected
                    </span>
                  </div>
                </div>

                {/* Aadhaar Status Pill for Active Counter Grower */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-sprout-tint text-on-surface border border-secondary-container/60">
                  <span className="material-symbols-outlined text-primary text-[18px]">
                    fingerprint
                  </span>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold leading-none">Ramesh B. Gowda</span>
                    <span className="font-mono text-primary text-[10px]">
                      Aadhaar Verified DBT Eligible
                    </span>
                  </div>
                  <span className="material-symbols-outlined text-primary text-[16px] ml-1">
                    check_circle
                  </span>
                </div>
              </div>

              {/* Fast Barcode / SKU / Formula Search Bar */}
              <div className="relative flex items-center mb-4">
                <label htmlFor="fast-barcode-input" className="sr-only">
                  Fast Barcode and SKU search
                </label>
                <div className="absolute left-3.5 flex items-center pointer-events-none text-meadow-leaf">
                  <span className="material-symbols-outlined text-[20px]">barcode_scanner</span>
                </div>
                <input
                  id="fast-barcode-input"
                  ref={barcodeInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Scan Bag Barcode or Search Formula: 'Neem Urea', 'Glyphosate 41%', 'Hybrid Maize' [Press / or F1]..."
                  className="w-full h-12 pl-12 pr-28 rounded-xl bg-surface-container-low text-on-surface placeholder:text-outline text-xs sm:text-sm focus:outline-none focus:bg-sprout-tint focus:ring-2 focus:ring-primary transition-all border border-transparent focus:border-primary"
                />
                <div className="absolute right-2.5 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsScannerOpen(true)}
                    className="font-mono text-xs px-2.5 py-1 rounded-lg bg-surface-container-highest text-on-surface font-bold hover:bg-surface-container-high transition-colors"
                  >
                    Auto-Scan
                  </button>
                </div>
              </div>

              {/* Staged Cart Preview Grid */}
              <div className="rounded-xl bg-surface-container-low p-3 sm:p-4">
                <div className="flex items-center justify-between px-1 pb-2.5 text-outline text-[10px] font-bold uppercase tracking-wider">
                  <span>Staged Items for Ramesh Gowda ({stagedItems.length} Items)</span>
                  <span className="font-mono text-primary text-xs">
                    Pre-GST: ₹{formatCurrency(stagedPreGst)}
                  </span>
                </div>

                <div className="space-y-2">
                  {stagedItems.map((item, idx) => (
                    <div
                      key={item.id}
                      className="bg-surface-container-lowest p-3 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs border border-surface-container"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-secondary-container/40 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                          {String(idx + 1).padStart(2, '0')}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs sm:text-sm font-semibold text-on-surface truncate">
                              {item.name}
                            </span>
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${item.badgeBg} ${item.badgeText}`}
                            >
                              {item.categoryBadge}
                            </span>
                          </div>
                          <span className="font-mono text-[11px] text-outline-variant">
                            Batch: {item.batch} • MRP: ₹{formatCurrency(item.mrp)} • GST: {item.gstRate}%
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4">
                        <div className="flex items-center bg-surface-container rounded-lg px-2 py-1 gap-2.5 font-mono text-xs font-bold">
                          <button
                            type="button"
                            onClick={() => handleQuantityChange(item.id, -1)}
                            className="text-meadow-leaf hover:text-primary active:scale-90 text-sm px-1"
                            title="Decrease quantity"
                            aria-label={`Decrease ${item.name} quantity`}
                          >
                            -
                          </button>
                          <span>
                            {item.quantity} {item.unit}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleQuantityChange(item.id, 1)}
                            className="text-meadow-leaf hover:text-primary active:scale-90 text-sm px-1"
                            title="Increase quantity"
                            aria-label={`Increase ${item.name} quantity`}
                          >
                            +
                          </button>
                        </div>

                        <span className="font-mono text-sm font-bold text-on-surface w-24 text-right">
                          ₹{formatCurrency(item.rate * item.quantity)}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleRemoveStagedItem(item.id)}
                          className="text-outline-variant hover:text-critical-rose p-1 transition-colors"
                          title="Remove item"
                          aria-label={`Remove ${item.name}`}
                        >
                          <span className="material-symbols-outlined text-[18px]">close</span>
                        </button>
                      </div>
                    </div>
                  ))}

                  {stagedItems.length === 0 && (
                    <div className="p-6 text-center text-outline text-xs">
                      Cart is empty. Type in the barcode box above or press{' '}
                      <span className="font-mono font-bold text-primary">[F1]</span> to add products.
                    </div>
                  )}
                </div>

                {/* Checkout Control Strip */}
                <div className="mt-4 pt-3 border-t border-surface-container flex flex-wrap items-center justify-between gap-3 px-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-outline">Payment Tender:</span>
                    <button
                      type="button"
                      onClick={() => setSelectedTender('UPI')}
                      className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold transition-all ${
                        selectedTender === 'UPI'
                          ? 'bg-forest-emerald text-on-primary shadow-xs'
                          : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
                      }`}
                    >
                      UPI QR [F4]
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedTender('CASH')}
                      className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold transition-all ${
                        selectedTender === 'CASH'
                          ? 'bg-forest-emerald text-on-primary shadow-xs'
                          : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
                      }`}
                    >
                      Cash [F5]
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedTender('KHATA')}
                      className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold transition-all ${
                        selectedTender === 'KHATA'
                          ? 'bg-khata-amber text-white shadow-xs'
                          : 'bg-khata-amber-bg text-khata-amber hover:brightness-95'
                      }`}
                    >
                      Add to Khata [F6]
                    </button>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase text-outline">
                        Payable Total
                      </span>
                      <div className="font-mono text-xl sm:text-2xl font-extrabold text-canopy-deep leading-none">
                        ₹{formatCurrency(stagedPayableTotal)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        navigate('/billing', {
                          state: { stagedCartItems: stagedItems, paymentMode: selectedTender },
                        })
                      }
                      className="h-11 px-5 rounded-xl bg-primary text-on-primary font-bold text-xs sm:text-sm shadow-md hover:bg-canopy-deep transition-all active:scale-95 flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined text-[18px]">print</span>
                      <span>Print Bill [Enter]</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* SUBSECTION B: Batch Expiry & FIFO Inventory Control */}
            <div className="bg-surface-container-lowest rounded-2xl p-5 sm:p-6 shadow-xs border border-surface-container">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-critical-rose-bg text-critical-rose flex items-center justify-center">
                    <span className="material-symbols-outlined text-[20px]">
                      hourglass_bottom
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-on-surface">
                        Batch Expiry &amp; FIFO Inventory Control
                      </h2>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-critical-rose-bg text-critical-rose">
                        Strict FIFO
                      </span>
                    </div>
                    <span className="font-mono text-xs text-on-surface-variant">
                      Automated Price Markdowns &amp; Distributor Return Slips
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-outline">Filter:</span>
                  <button
                    type="button"
                    onClick={() => setExpiryFilter('CRITICAL')}
                    className={`px-2.5 py-1 rounded-lg font-mono text-xs font-bold transition-colors ${
                      expiryFilter === 'CRITICAL'
                        ? 'bg-critical-rose text-on-primary'
                        : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
                    }`}
                  >
                    &lt;30d Critical
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpiryFilter('ALL')}
                    className={`px-2.5 py-1 rounded-lg font-mono text-xs font-bold transition-colors ${
                      expiryFilter === 'ALL'
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
                    }`}
                  >
                    All Warehouses
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-surface-container-low text-outline font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-2.5 px-3 rounded-l-lg">Product &amp; Formula</th>
                      <th className="py-2.5 px-3">Manufacturer</th>
                      <th className="py-2.5 px-3">Batch &amp; HSN</th>
                      <th className="py-2.5 px-3">Expiry Lifecycle</th>
                      <th className="py-2.5 px-3 text-right">Stock On Hand</th>
                      <th className="py-2.5 px-3 text-right rounded-r-lg">Counter Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container">
                    {/* Item 1: Critical Expiring */}
                    <tr className="hover:bg-surface-container-low/60 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-bold text-on-surface">Bayer Regent 0.3G</div>
                        <span className="font-mono text-outline text-[11px]">
                          Fipronil 0.3% GR Insecticide
                        </span>
                      </td>
                      <td className="py-3 px-3 text-on-surface-variant font-medium">
                        Bayer CropScience
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-mono font-bold text-on-surface">BR-411</div>
                        <span className="font-mono text-outline-variant text-[10px]">
                          HSN: 380891
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-critical-rose-bg text-critical-rose">
                          <span className="w-1.5 h-1.5 rounded-full bg-critical-rose animate-pulse" />
                          18 Days Remaining
                        </span>
                        <div className="font-mono text-critical-rose text-[11px] mt-0.5 font-bold">
                          Oct 14, 2024
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className="font-mono font-bold text-critical-rose">
                          14 Jars (1kg)
                        </span>
                        <div className="font-mono text-outline-variant text-[10px]">Val: ₹9,100</div>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => navigate('/khata?tab=catalog')}
                          className="px-2.5 py-1 rounded-lg bg-critical-rose text-on-primary font-mono text-[11px] font-bold shadow-xs hover:brightness-95 transition-all"
                        >
                          Clearance 20%
                        </button>
                      </td>
                    </tr>

                    {/* Item 2: Warning Expiring */}
                    <tr className="hover:bg-surface-container-low/60 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-bold text-on-surface">Syngenta Ridomil Gold</div>
                        <span className="font-mono text-outline text-[11px]">
                          Mancozeb 64% + Metalaxyl-M 4%
                        </span>
                      </td>
                      <td className="py-3 px-3 text-on-surface-variant font-medium">
                        Syngenta India
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-mono font-bold text-on-surface">RG-702</div>
                        <span className="font-mono text-outline-variant text-[10px]">
                          HSN: 380892
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-khata-amber-bg text-khata-amber">
                          45 Days (FIFO First)
                        </span>
                        <div className="font-mono text-outline text-[11px] mt-0.5">Nov 10, 2024</div>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className="font-mono font-bold text-on-surface">28 Pkts</span>
                        <div className="font-mono text-outline-variant text-[10px]">
                          Val: ₹27,440
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            barcodeInputRef.current?.focus();
                            setSearchQuery('Ridomil Gold');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-surface-container text-on-surface font-mono text-[11px] font-medium hover:bg-surface-container-high transition-all"
                        >
                          Push to Counter
                        </button>
                      </td>
                    </tr>

                    {/* Item 3: Healthy Fertilizer */}
                    <tr className="hover:bg-surface-container-low/60 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-bold text-on-surface">Coromandel Gromor 14-35-14</div>
                        <span className="font-mono text-outline text-[11px]">
                          Complex NPK Fertilizer
                        </span>
                      </td>
                      <td className="py-3 px-3 text-on-surface-variant font-medium">
                        Coromandel Int.
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-mono font-bold text-on-surface">CR-881</div>
                        <span className="font-mono text-outline-variant text-[10px]">
                          HSN: 310520
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-sprout-tint text-primary">
                          120 Days Healthy
                        </span>
                        <div className="font-mono text-outline text-[11px] mt-0.5">Jan 22, 2025</div>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className="font-mono font-bold text-on-surface">140 Bags</span>
                        <div className="font-mono text-outline-variant text-[10px]">
                          Val: ₹2,38,000
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className="font-mono text-[11px] px-2 py-1 rounded bg-surface-container text-primary font-bold">
                          DBT Bound
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* SUBSECTION C: Recent Counter Invoices & Thermal Reprint */}
            <div className="bg-surface-container-lowest rounded-2xl p-5 sm:p-6 shadow-xs border border-surface-container">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-sprout-tint text-primary flex items-center justify-center">
                    <span className="material-symbols-outlined text-[20px]">print</span>
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-on-surface">
                      Recent Counter Invoices &amp; 80mm ESC/POS Reprint
                    </h2>
                    <span className="font-mono text-xs text-on-surface-variant">
                      Instant Thermal Slips &amp; WhatsApp E-Bills
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => navigate('/reports')}
                  className="text-xs text-primary font-bold flex items-center gap-1 hover:underline"
                >
                  <span>View All Invoices</span>
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </button>
              </div>

              <div className="space-y-3">
                {/* Transaction 1 */}
                <div className="p-3.5 rounded-xl bg-surface-container-low flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border border-surface-container/50">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-xs px-2.5 py-1 rounded-lg bg-surface-container-highest text-on-surface font-bold">
                      #NB-8491
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-on-surface">Basavaraj Patil</span>
                        <span className="font-mono text-xs text-outline-variant">
                          (ID: FRM-KA-092)
                        </span>
                      </div>
                      <span className="text-xs text-on-surface-variant truncate block">
                        IFFCO Urea 45kg (x6), Bayleton Fungicide 250g (x1)
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between w-full md:w-auto gap-4 shrink-0">
                    <div className="text-right">
                      <div className="font-mono text-sm font-bold text-on-surface">₹2,240.00</div>
                      <span className="inline-flex items-center gap-1 text-[10px] text-forest-emerald font-bold">
                        <span className="material-symbols-outlined text-[12px]">
                          qr_code_scanner
                        </span>{' '}
                        UPI Paid
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="material-symbols-outlined text-forest-emerald text-[18px]"
                        title="WhatsApp Receipt Delivered"
                      >
                        chat
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          triggerThermalAction(
                            'Reprinting 80mm ESC/POS slip for invoice #NB-8491 (Basavaraj Patil)...'
                          )
                        }
                        className="h-8 px-2.5 rounded-lg bg-surface-container-lowest hover:bg-surface-container text-on-surface font-mono text-xs font-bold flex items-center gap-1 shadow-xs border border-surface-container transition-all"
                        title="Reprint 80mm Bill"
                      >
                        <span className="material-symbols-outlined text-[16px]">print</span>
                        <span>Reprint</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Transaction 2 */}
                <div className="p-3.5 rounded-xl bg-surface-container-low flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border border-surface-container/50">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-xs px-2.5 py-1 rounded-lg bg-surface-container-highest text-on-surface font-bold">
                      #NB-8490
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-on-surface">Nanjegowda</span>
                        <span className="font-mono text-xs text-outline-variant">
                          (ID: FRM-KA-118)
                        </span>
                      </div>
                      <span className="text-xs text-on-surface-variant truncate block">
                        Roundup Glyphosate 1L (x3), Gromor 14-35-14 (x2)
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between w-full md:w-auto gap-4 shrink-0">
                    <div className="text-right">
                      <div className="font-mono text-sm font-bold text-khata-amber">₹4,890.00</div>
                      <span className="inline-flex items-center gap-1 text-[10px] text-khata-amber font-bold">
                        <span className="material-symbols-outlined text-[12px]">menu_book</span>{' '}
                        Khata Credit
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="material-symbols-outlined text-forest-emerald text-[18px]"
                        title="WhatsApp Ledger Slip Sent"
                      >
                        chat
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          triggerThermalAction(
                            'Reprinting 80mm ESC/POS slip for invoice #NB-8490 (Nanjegowda)...'
                          )
                        }
                        className="h-8 px-2.5 rounded-lg bg-surface-container-lowest hover:bg-surface-container text-on-surface font-mono text-xs font-bold flex items-center gap-1 shadow-xs border border-surface-container transition-all"
                      >
                        <span className="material-symbols-outlined text-[16px]">print</span>
                        <span>Reprint</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Transaction 3 */}
                <div className="p-3.5 rounded-xl bg-surface-container-low flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border border-surface-container/50">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-xs px-2.5 py-1 rounded-lg bg-surface-container-highest text-on-surface font-bold">
                      #NB-8489
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-on-surface">Girish Kumar K.</span>
                        <span className="font-mono text-xs text-outline-variant">
                          (Cash Customer)
                        </span>
                      </div>
                      <span className="text-xs text-on-surface-variant truncate block">
                        Pioneer Hybrid Maize 3302 (4kg Pack x 2)
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between w-full md:w-auto gap-4 shrink-0">
                    <div className="text-right">
                      <div className="font-mono text-sm font-bold text-on-surface">₹1,850.00</div>
                      <span className="inline-flex items-center gap-1 text-[10px] text-outline font-bold">
                        <span className="material-symbols-outlined text-[12px]">payments</span> Cash
                        Drawer
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="material-symbols-outlined text-outline-variant text-[18px]"
                        title="Cash Receipt Printed"
                      >
                        sms_failed
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          triggerThermalAction(
                            'Reprinting 80mm ESC/POS slip for invoice #NB-8489 (Girish Kumar K.)...'
                          )
                        }
                        className="h-8 px-2.5 rounded-lg bg-surface-container-lowest hover:bg-surface-container text-on-surface font-mono text-xs font-bold flex items-center gap-1 shadow-xs border border-surface-container transition-all"
                      >
                        <span className="material-symbols-outlined text-[16px]">print</span>
                        <span>Reprint</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ══════════ RIGHT STATUTORY & AI INTELLIGENCE COLUMN (4 COLS) ══════════ */}
          <div className="xl:col-span-4 flex flex-col gap-6">
            {/* WIDGET 1: Agri Doctor AI Field Pathology Diagnostics */}
            <div className="bg-surface-container-lowest rounded-2xl p-5 sm:p-6 shadow-xs border border-secondary-container/50">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-sprout-tint text-primary flex items-center justify-center">
                    <span className="material-symbols-outlined text-[20px]">
                      psychology_alt
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm font-bold text-canopy-deep">Agri Doctor AI Lens</h3>
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded-full bg-secondary-container text-on-secondary-container">
                        v3.2
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-meadow-leaf">
                      Real-Time Crop Pathology
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsScannerOpen(true)}
                  className="h-7 px-2.5 rounded-lg bg-sprout-tint text-primary font-mono text-[11px] font-bold hover:bg-secondary-container flex items-center gap-1 transition-colors"
                >
                  <span className="material-symbols-outlined text-[14px]">camera</span>
                  <span>Scan Leaf</span>
                </button>
              </div>

              <p className="text-xs text-on-surface-variant mb-4">
                Diagnosed from inbound grower photos via WhatsApp bot. Click prescription to load bill instantly.
              </p>

              {/* Diagnostics Card Stream */}
              <div className="space-y-3">
                {/* Case 1: Brown Plant Hopper */}
                <div className="p-3.5 rounded-xl bg-surface-container-low flex flex-col gap-2.5 border border-surface-container/50">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-critical-rose">
                        Crop: Paddy (Rice)
                      </span>
                      <div className="text-sm font-bold text-on-surface">
                        Brown Plant Hopper (BPH)
                      </div>
                      <span className="font-mono text-[11px] text-outline">
                        Farmer: T. Narayana (Hosur)
                      </span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sprout-tint text-primary">
                      96% Match
                    </span>
                  </div>

                  {/* Visual Comparison Thumbnail */}
                  <div className="flex items-center gap-3 py-1">
                    <div className="w-14 h-14 rounded-xl bg-surface-container-highest flex items-center justify-center shrink-0 overflow-hidden shadow-xs">
                      <img
                        className="w-full h-full object-cover"
                        alt="Macro photography of green paddy rice leaf infested with brown planthopper"
                        src="https://lh3.googleusercontent.com/aida-public/AB6AXuCh-fTGHPPb5jPzFunnldeaFGibKrBSHvn44kgHZTF1uqpX5Vsqu3etfJUY5T0Y5xXjftZraAZ9-ib4E5s8469FHiLJ07AmqP2MwFutq2D1BsUU3G6w2EYBoitL_izPyb4RMivrbTplq0-QpiePiuUF8D__hAF4egQONMdOXnNDonYmglYfVo0ic-yntV5OAIAC_O1L-uZeU-bNL6jOEjtlzaYBw190Ivac9pho8VW2"
                      />
                    </div>
                    <div className="text-on-surface-variant text-xs">
                      <div className="font-bold text-on-surface text-xs">Prescribed Molecule:</div>
                      <span className="font-mono text-primary font-semibold text-[11px]">
                        Pymetrozine 50% WDG @ 120g/acre
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-surface-container">
                    <span className="font-mono text-[11px] text-forest-emerald font-bold">
                      In Stock: Chess 50g (34 pkts)
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        handleBillPrescribedMedicine('Chess Pymetrozine 50% WDG (50g)', 'Pesticides')
                      }
                      className="px-2.5 py-1 rounded-lg bg-primary text-on-primary font-mono text-[11px] font-bold hover:bg-canopy-deep transition-all active:scale-95 shadow-xs"
                    >
                      + Bill Medicine
                    </button>
                  </div>
                </div>

                {/* Case 2: Chilli Leaf Curl */}
                <div className="p-3.5 rounded-xl bg-surface-container-low flex flex-col gap-2.5 border border-surface-container/50">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-khata-amber">
                        Crop: Byadagi Chilli
                      </span>
                      <div className="text-sm font-bold text-on-surface">
                        Thrips &amp; Mite Leaf Curl
                      </div>
                      <span className="font-mono text-[11px] text-outline">
                        Farmer: K. Veerappa (Ranebennur)
                      </span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sprout-tint text-primary">
                      91% Match
                    </span>
                  </div>

                  <div className="flex items-center gap-3 py-1">
                    <div className="w-14 h-14 rounded-xl bg-surface-container-highest flex items-center justify-center shrink-0 overflow-hidden shadow-xs">
                      <img
                        className="w-full h-full object-cover"
                        alt="Macro agriculture photography of curled upwards chilli pepper plant foliage"
                        src="https://lh3.googleusercontent.com/aida-public/AB6AXuB-Io4DdD28nvHNPo3K8RpZsyzTh3dpaTNgXfPGDhR3gNvqpMNtmS9pwV4z5vpQttSRNndHrZNUqE-0DqjYYEGQyL112n4Km_37bDDwyw-SLcyj4LNPgZLlNnLsYySgFaN5VX7heboj9DIhVCZ5rDXtV4cUTa66tlniOpLKoU-GBs49TkSumjhv1QQSlztZMfRCLswXLmx1d9R7P21Ypi1hWwTJuq7BWpE6ZendDHxf"
                      />
                    </div>
                    <div className="text-on-surface-variant text-xs">
                      <div className="font-bold text-on-surface text-xs">Prescribed Molecule:</div>
                      <span className="font-mono text-primary font-semibold text-[11px]">
                        Diafenthiuron 50% WP @ 250g/acre
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-surface-container">
                    <span className="font-mono text-[11px] text-forest-emerald font-bold">
                      In Stock: Pegasus 250g (19 pkts)
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        handleBillPrescribedMedicine('Pegasus Diafenthiuron 50% WP (250g)', 'Pesticides')
                      }
                      className="px-2.5 py-1 rounded-lg bg-primary text-on-primary font-mono text-[11px] font-bold hover:bg-canopy-deep transition-all active:scale-95 shadow-xs"
                    >
                      + Bill Medicine
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* WIDGET 2: Statutory Compliance Registers */}
            <div className="bg-surface-container-lowest rounded-2xl p-5 sm:p-6 shadow-xs border border-surface-container">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-regulatory-sky-bg text-regulatory-sky flex items-center justify-center">
                    <span className="material-symbols-outlined text-[20px]">verified_user</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-on-surface">Statutory Audit Registers</h3>
                    <span className="font-mono text-[11px] text-on-surface-variant">
                      Form O &amp; Pesticide Stock Registers
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {/* Form O Card */}
                <div className="p-3.5 rounded-xl bg-surface-container-low flex flex-col gap-2 border border-surface-container/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-on-surface">
                        Fertilizer Form O (MFMS &amp; FCO 1985)
                      </span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sprout-tint text-primary">
                      100% Audited
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant">
                    Reconciled against MFMS Point-of-Sale logs. Total retail quota matched within 0.02% tolerance.
                  </p>
                  <div className="flex items-center justify-between pt-2 border-t border-surface-container">
                    <span className="font-mono text-[10px] text-outline">
                      Govt Inspector Seal: Ready
                    </span>
                    <button
                      type="button"
                      onClick={() => navigate('/khata?tab=compliance')}
                      className="px-2.5 py-1 rounded-lg bg-regulatory-sky text-on-primary font-mono text-xs font-bold hover:brightness-95 flex items-center gap-1 shadow-xs transition-all"
                    >
                      <span className="material-symbols-outlined text-[14px]">download</span>
                      <span>Download Form O</span>
                    </button>
                  </div>
                </div>

                {/* Form M Card */}
                <div className="p-3.5 rounded-xl bg-surface-container-low flex flex-col gap-2 border border-surface-container/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-on-surface">
                        Pesticide Form M &amp; CIB
                      </span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sprout-tint text-primary">
                      100% CIB-RC
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant">
                    Zero banned chemicals detected. All active batches cross-verified against Central Insecticide Board database.
                  </p>
                  <div className="flex items-center justify-between pt-2 border-t border-surface-container">
                    <span className="font-mono text-[10px] text-outline">B2B E-Way: 14 Syncs OK</span>
                    <button
                      type="button"
                      onClick={() => navigate('/reports')}
                      className="px-2.5 py-1 rounded-lg bg-surface-container text-on-surface font-mono text-xs font-bold hover:bg-surface-container-high flex items-center gap-1 transition-all"
                    >
                      <span className="material-symbols-outlined text-[14px]">table_view</span>
                      <span>Export Form M</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* WIDGET 3: 80mm ESC/POS Thermal Hardware Monitor */}
            <div className="bg-surface-container-lowest rounded-2xl p-5 sm:p-6 shadow-xs border border-surface-container">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-surface-container text-on-surface flex items-center justify-center">
                    <span className="material-symbols-outlined text-[20px]">print</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-on-surface">Counter Thermal Engine</h3>
                    <span className="font-mono text-[11px] text-forest-emerald font-semibold">
                      TVS RP-3200 Star USB • ESC/POS Online
                    </span>
                  </div>
                </div>
              </div>

              {/* Receipt Simulator Teaser Card */}
              <div className="rounded-xl bg-surface-container-low p-3.5 font-mono text-xs text-on-surface flex flex-col gap-1.5 border-dashed border border-outline-variant/60">
                <div className="text-center font-bold pb-2 border-b border-dashed border-outline-variant/60">
                  *** {shopName.toUpperCase()} ***
                  <br />
                  <span className="text-[10px] text-outline font-normal">
                    GSTIN: {settings.gstin || '29AAAAA0000A1Z5'} • 80mm Direct
                  </span>
                </div>
                <div className="flex justify-between text-[11px] pt-1">
                  <span>Thermal Roll Health:</span>
                  <span className="font-bold text-forest-emerald">78% Remaining</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span>Auto Cutter Mechanism:</span>
                  <span className="font-bold text-on-surface">Engaged (Partial)</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span>Regional Header Print:</span>
                  <span className="font-bold text-meadow-leaf">Enabled (UTF-8)</span>
                </div>
                <div className="mt-2 pt-2 border-t border-dashed border-outline-variant/60 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() =>
                      triggerThermalAction('Feed command sent: Advancing thermal roll by 20mm...')
                    }
                    className="px-2.5 py-1 rounded-lg bg-surface-container text-on-surface text-[10px] font-bold hover:bg-surface-container-high transition-colors"
                  >
                    Feed 20mm
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      triggerThermalAction(
                        'Test slip printed successfully on 80mm ESC/POS counter terminal.'
                      )
                    }
                    className="px-2.5 py-1 rounded-lg bg-surface-container-lowest text-primary text-[10px] font-bold shadow-xs hover:bg-surface-container border border-surface-container transition-colors"
                  >
                    Print Test Slip
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── FLOATING THERMAL ACTION FEEDBACK TOAST ──────────────── */}
      {thermalToast && (
        <div className="fixed bottom-20 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-slate-900 text-white shadow-2xl border border-slate-700 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <span className="material-symbols-outlined text-emerald-400 text-[18px]">
            check_circle
          </span>
          <span className="text-xs font-medium">{thermalToast}</span>
        </div>
      )}

      {/* ─── FLOATING QUICK-BILL TRIGGER NOTIFICATION ON COUNTER IDLE ─── */}
      {isIdleBannerVisible && (
        <div className="fixed bottom-6 right-6 z-40 hidden md:flex items-center gap-3 px-4 py-3 rounded-2xl bg-canopy-deep text-on-primary shadow-xl backdrop-blur-md border border-white/20">
          <div className="w-3 h-3 rounded-full bg-inverse-primary animate-ping" />
          <div className="flex flex-col">
            <span className="text-xs font-bold leading-tight">Counter #01 Idle &amp; Ready</span>
            <span className="font-mono text-secondary-fixed text-[11px]">
              Tap [F1] for instant bill or press Barcode Gun
            </span>
          </div>
          <div className="h-6 w-px bg-white/20 ml-2" />
          <button
            type="button"
            onClick={() => setIsIdleBannerVisible(false)}
            className="font-mono text-[10px] px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-on-primary font-bold transition-colors"
            title="Dismiss notification"
          >
            ESC: Close
          </button>
        </div>
      )}

      {/* ─── OCR CAMERA SCANNER MODAL ────────────────────────────── */}
      <CameraScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onAddProductToBill={handleOcrAddProduct}
      />
    </div>
  );
};
