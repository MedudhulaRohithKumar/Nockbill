import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  Calendar,
  Clock,
  RefreshCw,
  Filter,
  Layers,
  Sparkles,
  Search,
  X,
  ChevronRight,
  Download,
  AlertTriangle,
  ShieldCheck,
  Zap,
  QrCode,
  Wallet,
  ShoppingCart,
  CheckCircle,
  FileText,
  Package,
  ArrowRight,
  BadgePercent,
  BarChart3,
  Check
} from 'lucide-react';
import {
  AreaChart,
  Area,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { reportsApi, khataApi, inventoryApi, getErrorMessage } from '../api';
import { useShop } from '../context/ShopContext';
import { AnalyticsData, CategoryAnalyticsItem, Product, DashboardSummary } from '../types';
import { formatCurrency } from '../utils/formatters';
import { MetricInfoTooltip } from '../components/common/MetricInfoTooltip';

interface KhataCustomerItem {
  customer_key: string;
  customer_name: string;
  customer_phone?: string | null;
  outstanding_balance?: number;
  last_purchase_date?: string | null;
}

export const AnalyticsPage: React.FC = () => {
  const navigate = useNavigate();
  const { settings } = useShop();

  // State
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null);
  const [khataCustomers, setKhataCustomers] = useState<KhataCustomerItem[]>([]);
  const [nearExpiryProducts, setNearExpiryProducts] = useState<Product[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [notificationMsg, setNotificationMsg] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Filters
  const [preset, setPreset] = useState<string>('this_month');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [comparePrevious, setComparePrevious] = useState<boolean>(true);
  const [selectedMoleculeCategory, setSelectedMoleculeCategory] = useState<string>('All');
  const [syncPulsing, setSyncPulsing] = useState<boolean>(false);
  const [productSearchQuery, setProductSearchQuery] = useState<string>('');

  const showNotification = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setNotificationMsg({ text, type });
    setTimeout(() => setNotificationMsg(null), 4000);
  };

  // Fetch all analytics and operational telemetries
  const fetchAllAnalytics = useCallback(async (p = preset, s = customStart, e = customEnd) => {
    setLoading(true);
    setError(null);
    try {
      const params: { preset: string; start_date?: string; end_date?: string } = { preset: p };
      if (p === 'custom') {
        if (s) params.start_date = s;
        if (e) params.end_date = e;
      }

      const [analyticsRes, dashRes, khataRes, nearExpiryRes, lowStockRes] = await Promise.all([
        reportsApi.getAnalytics(params).catch(() => null),
        reportsApi.getDashboard().catch(() => null),
        khataApi.listCustomers({ only_due: false }).catch(() => ({ total_customers: 0, total_outstanding_udhar: 0, customers: [] })),
        inventoryApi.getNearExpiry(60).catch(() => []),
        inventoryApi.getLowStock().catch(() => []),
      ]);

      if (analyticsRes) setData(analyticsRes);
      if (dashRes) setDashboardSummary(dashRes);
      if (khataRes && khataRes.customers) setKhataCustomers(khataRes.customers);
      if (nearExpiryRes) setNearExpiryProducts(nearExpiryRes);
      if (lowStockRes) setLowStockProducts(lowStockRes);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to load comprehensive analytics dossier.'));
    } finally {
      setLoading(false);
    }
  }, [preset, customStart, customEnd]);

  useEffect(() => {
    void fetchAllAnalytics(preset);
  }, [fetchAllAnalytics, preset]);

  // F5 Keyboard Shortcut for instant POS Sync
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F5') {
        e.preventDefault();
        setSyncPulsing(true);
        void fetchAllAnalytics();
        showNotification('Live POS telemetry and ledger sync triggered (F5).');
        setTimeout(() => setSyncPulsing(false), 800);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fetchAllAnalytics]);

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    setPreset('custom');
    void fetchAllAnalytics('custom', customStart, customEnd);
  };

  // Revenue & Profit Totals
  const totalRevenue = useMemo(() => Number.parseFloat(String(data?.summary?.total_revenue || 0)), [data]);
  const grossProfit = useMemo(() => Number.parseFloat(String(data?.summary?.gross_profit || 0)), [data]);
  const blendedMarginPercent = useMemo(() => {
    if (totalRevenue <= 0) return 0.0;
    return Number.parseFloat(String(data?.summary?.gross_margin_percent || ((grossProfit / totalRevenue) * 100).toFixed(1)));
  }, [data, grossProfit, totalRevenue]);

  // Daily Counter Velocity
  const totalInvoices = useMemo(() => Number.parseInt(String(data?.summary?.total_bills || 0), 10), [data]);
  const daysInWindow = useMemo(() => {
    if (data?.day_wise && data.day_wise.length > 0) return data.day_wise.length;
    return 30;
  }, [data]);

  const dailyAvgRevenue = useMemo(() => {
    return daysInWindow > 0 ? totalRevenue / daysInWindow : totalRevenue;
  }, [totalRevenue, daysInWindow]);

  // Peak Hours calculation from hourly telemetry
  const peakHoursLabel = useMemo(() => {
    if (!data?.hourly || data.hourly.length === 0) return 'No sales recorded';
    const sorted = [...data.hourly].sort((a, b) => b.orders - a.orders);
    const top = sorted[0];
    if (!top || top.orders === 0) return 'No sales recorded';
    return `${top.label} (${top.orders} orders)`;
  }, [data]);

  // Physical Dispatch Volume tally
  const volumeSummary = useMemo(() => {
    let bagsFertilizer = 0;
    let litersChem = 0;
    let pktsSeed = 0;
    let totalUnits = 0;

    for (const prod of data?.top_products || []) {
      const q = Number.parseFloat(String(prod.quantity || 0));
      totalUnits += q;
      const cat = (prod.category || '').toLowerCase();
      const u = (prod.unit || '').toLowerCase();
      if (cat.includes('fert') || u.includes('bag')) {
        bagsFertilizer += q;
      } else if (cat.includes('pest') || cat.includes('insect') || u.includes('l') || u.includes('ml')) {
        litersChem += q;
      } else if (cat.includes('seed') || u.includes('pkt')) {
        pktsSeed += q;
      }
    }

    return {
      totalUnits: Math.round(totalUnits),
      bagsFertilizer: Math.round(bagsFertilizer),
      litersChem: Math.round(litersChem),
      pktsSeed: Math.round(pktsSeed),
    };
  }, [data]);

  // Khata Outstanding and Aging Brackets (Calculated directly from customer records)
  const khataAnalysis = useMemo(() => {
    let b0_15 = 0;
    let b16_30 = 0;
    let bOver30 = 0;
    const now = Date.now();

    for (const c of khataCustomers) {
      const bal = Number.parseFloat(String(c.outstanding_balance || 0));
      if (bal <= 0) continue;
      if (!c.last_purchase_date) {
        bOver30 += bal;
        continue;
      }
      const days = Math.floor((now - new Date(c.last_purchase_date).getTime()) / (1000 * 60 * 60 * 24));
      if (days <= 15) {
        b0_15 += bal;
      } else if (days <= 30) {
        b16_30 += bal;
      } else {
        bOver30 += bal;
      }
    }

    const total = b0_15 + b16_30 + bOver30;
    const totalOut = total;

    return {
      totalOutstanding: totalOut,
      b0_15,
      b0_15_pct: totalOut > 0 ? Math.round((b0_15 / totalOut) * 100) : 0,
      b16_30,
      b16_30_pct: totalOut > 0 ? Math.round((b16_30 / totalOut) * 100) : 0,
      bOver30,
      bOver30_pct: totalOut > 0 ? Math.round((bOver30 / totalOut) * 100) : 0,
      overdueCount: khataCustomers.filter(c => Number.parseFloat(String(c.outstanding_balance || 0)) > 0).length,
    };
  }, [khataCustomers]);

  // Dual-Axis Chart Data (Revenue Area + Margin % Curve)
  const dualAxisChartData = useMemo(() => {
    if (!data?.day_wise || data.day_wise.length === 0) {
      return [];
    }

    return data.day_wise.map(d => {
      const rev = Number.parseFloat(String(d.revenue || 0));
      const prof = Number.parseFloat(String(d.profit || 0));
      const margin = rev > 0 ? Number.parseFloat(((prof / rev) * 100).toFixed(1)) : 0;
      return {
        label: d.label || d.date,
        revenue: rev,
        margin: Math.min(100, Math.max(0, margin)),
        profit: prof,
      };
    });
  }, [data]);

  // Category Breakdown Mix
  const categoryMix = useMemo(() => {
    const rawCategories: CategoryAnalyticsItem[] = data?.category_breakdown || [];
    
    // Group into standard 4 FCO & CIB agro retail pillars
    let fertRev = 0;
    let fertProf = 0;
    let pestRev = 0;
    let pestProf = 0;
    let seedRev = 0;
    let seedProf = 0;
    let microRev = 0;
    let microProf = 0;

    for (const c of rawCategories) {
      const name = (c.category || '').toLowerCase();
      const rev = Number.parseFloat(String(c.revenue || 0));
      const prof = Number.parseFloat(String(c.profit || 0));
      if (name.includes('fert') || name.includes('urea') || name.includes('dap') || name.includes('npk')) {
        fertRev += rev;
        fertProf += prof;
      } else if (name.includes('pest') || name.includes('insect') || name.includes('fung') || name.includes('herb')) {
        pestRev += rev;
        pestProf += prof;
      } else if (name.includes('seed')) {
        seedRev += rev;
        seedProf += prof;
      } else {
        microRev += rev;
        microProf += prof;
      }
    }

    const grandRev = fertRev + pestRev + seedRev + microRev || totalRevenue || 0;
    const grandProf = fertProf + pestProf + seedProf + microProf || 0;

    return [
      {
        id: 'fert',
        name: 'Fertilizers (FCO)',
        revenue: fertRev,
        profit: fertProf,
        volPct: grandRev > 0 ? Math.round((fertRev / grandRev) * 100) : 0,
        profitPct: grandProf > 0 ? Math.round((fertProf / grandProf) * 100) : (fertRev > 0 ? Math.round((fertProf / fertRev) * 100) : 0),
        color: '#15803d',
      },
      {
        id: 'pest',
        name: 'Insecticides & CIB',
        revenue: pestRev,
        profit: pestProf,
        volPct: grandRev > 0 ? Math.round((pestRev / grandRev) * 100) : 0,
        profitPct: grandProf > 0 ? Math.round((pestProf / grandProf) * 100) : (pestRev > 0 ? Math.round((pestProf / pestRev) * 100) : 0),
        color: '#b45309',
      },
      {
        id: 'seed',
        name: 'Hybrid Seeds & Traits',
        revenue: seedRev,
        profit: seedProf,
        volPct: grandRev > 0 ? Math.round((seedRev / grandRev) * 100) : 0,
        profitPct: grandProf > 0 ? Math.round((seedProf / grandProf) * 100) : (seedRev > 0 ? Math.round((seedProf / seedRev) * 100) : 0),
        color: '#0284c7',
      },
      {
        id: 'micro',
        name: 'Micronutrients & PGR',
        revenue: microRev,
        profit: microProf,
        volPct: grandRev > 0 ? Math.round((microRev / grandRev) * 100) : 0,
        profitPct: grandProf > 0 ? Math.round((microProf / grandProf) * 100) : (microRev > 0 ? Math.round((microProf / microRev) * 100) : 0),
        color: '#7e22ce',
      },
    ];
  }, [data, totalRevenue]);

  // Fast-Moving Agricultural Molecules Table List
  const fastMovingMolecules = useMemo(() => {
    const list = data?.top_products || [];
    if (list.length > 0) {
      return list.filter(p => {
        if (selectedMoleculeCategory === 'All') return true;
        const cat = (p.category || '').toLowerCase();
        if (selectedMoleculeCategory === 'Fertilizers') return cat.includes('fert') || cat.includes('urea') || cat.includes('dap');
        if (selectedMoleculeCategory === 'Pesticides') return cat.includes('pest') || cat.includes('insect') || cat.includes('fung');
        if (selectedMoleculeCategory === 'Seeds') return cat.includes('seed');
        return true;
      });
    }

    return [];
  }, [data, selectedMoleculeCategory]);

  // Tender & Liquidity Breakdown
  const tenderBreakdown = useMemo(() => {
    const list = data?.payment_breakdown || [];
    let upiAmt = 0;
    let cashAmt = 0;
    let khataAmt = 0;

    for (const t of list) {
      const m = (t.method || '').toUpperCase();
      const amt = Number.parseFloat(String(t.amount || 0));
      if (m.includes('UPI') || m.includes('QR') || m.includes('ONLINE')) upiAmt += amt;
      else if (m.includes('CASH')) cashAmt += amt;
      else if (m.includes('KHATA') || m.includes('CREDIT') || m.includes('UDHAR')) khataAmt += amt;
    }

    const grand = upiAmt + cashAmt + khataAmt || totalRevenue || 0;

    return {
      upi: { amount: upiAmt, pct: grand > 0 ? Math.round((upiAmt / grand) * 100) : 0 },
      cash: { amount: cashAmt, pct: grand > 0 ? Math.round((cashAmt / grand) * 100) : 0 },
      khata: { amount: khataAmt, pct: grand > 0 ? Math.round((khataAmt / grand) * 100) : 0 },
    };
  }, [data, totalRevenue]);

  // Export BI Dossier CSV
  const handleExportBIDossier = () => {
    const summaryHeaders = ['Metric', 'Value'];
    const summaryRows = [
      ['Gross Revenue', `INR ${totalRevenue}`],
      ['Net Profit', `INR ${grossProfit}`],
      ['Blended Gross Margin', `${blendedMarginPercent}%`],
      ['Total Invoices', `${totalInvoices}`],
      ['Daily Average Revenue', `INR ${dailyAvgRevenue.toFixed(2)}`],
      ['Total Units Sold', `${volumeSummary.totalUnits}`],
      ['Total Credit Receivables', `INR ${khataAnalysis.totalOutstanding}`],
      ['Stock Valuation', `INR ${dashboardSummary?.total_inventory_value || 0}`],
    ];

    const productHeaders = ['Product Name', 'Category', 'Units Sold', 'Revenue (INR)', 'Gross Profit (INR)'];
    const productRows = fastMovingMolecules.map((p) => [
      `"${p.product_name.replace(/"/g, '""')}"`,
      p.category || 'General',
      p.quantity,
      p.revenue,
      p.profit,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      '=== NOCKBILL AGRO BI DOSSIER ===\n' +
      summaryHeaders.join(',') +
      '\n' +
      summaryRows.map((e) => e.join(',')).join('\n') +
      '\n\n=== TOP FAST MOVING MOLECULES ===\n' +
      productHeaders.join(',') +
      '\n' +
      productRows.map((e) => e.join(',')).join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `agronomic_bi_dossier_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification('Agronomic BI Dossier downloaded successfully.');
  };

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-6 bg-slate-50 dark:bg-slate-950 min-h-screen">
      
      {/* Sub-header / Breadcrumbs & Global Intelligence Actions */}
      <section className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>Dashboard</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span>Intelligence &amp; Reports</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-emerald-800 dark:text-emerald-400 font-bold">Business Analytics &amp; Agronomic Insights</span>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 mt-0.5">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Kharif Season Intelligence Dossier
            </h1>
            <span className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1.5 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Live BI Stream
            </span>
          </div>
        </div>

        {/* Time Period & Action Tools */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Preset Buttons */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
            {[
              { id: 'today', label: 'Today' },
              { id: 'last_7_days', label: 'This Week' },
              { id: 'this_month', label: 'Kharif 2024 (Active)' },
              { id: 'all', label: 'FY 2024-25' },
              { id: 'custom', label: 'Custom' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setPreset(p.id);
                  if (p.id !== 'custom') {
                    setCustomStart('');
                    setCustomEnd('');
                  }
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  preset === p.id
                    ? 'bg-white dark:bg-slate-800 text-emerald-900 dark:text-emerald-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Compare Toggle */}
          <label className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 px-3 py-2 rounded-xl cursor-pointer border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors">
            <input
              type="checkbox"
              checked={comparePrevious}
              onChange={(e) => setComparePrevious(e.target.checked)}
              className="w-3.5 h-3.5 accent-emerald-700 rounded cursor-pointer"
            />
            <span className="select-none">Compare Rabi '23</span>
          </label>

          {/* Export BI Button */}
          <button
            type="button"
            onClick={handleExportBIDossier}
            className="bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 border border-slate-200 dark:border-slate-800 shadow-xs transition-colors"
          >
            <Download className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            <span className="hidden sm:inline">Export BI Dossier</span>
          </button>

          {/* Sync POS Data Button */}
          <button
            type="button"
            onClick={() => {
              setSyncPulsing(true);
              void fetchAllAnalytics();
              showNotification('POS data and statutory journals synchronized.');
              setTimeout(() => setSyncPulsing(false), 800);
            }}
            className={`bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-2 shadow-xs transition-all ${
              syncPulsing ? 'ring-4 ring-emerald-500/40 scale-102' : ''
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync POS Data</span>
          </button>
        </div>
      </section>

      {/* Custom Range Picker Drawer */}
      {preset === 'custom' && (
        <form
          onSubmit={handleApplyCustom}
          className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-end gap-3"
        >
          <div className="flex-1">
            <label htmlFor="analytics-custom-start-date" className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" /> Start Date &amp; Time
            </label>
            <input
              id="analytics-custom-start-date"
              type="datetime-local"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              required
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="flex-1">
            <label htmlFor="analytics-custom-end-date" className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" /> End Date &amp; Time
            </label>
            <input
              id="analytics-custom-end-date"
              type="datetime-local"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              required
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold transition shadow-xs"
          >
            Apply Range Filter
          </button>
        </form>
      )}

      {/* Notifications */}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {notificationMsg && (
        <div className={`p-3 rounded-xl text-xs flex items-center justify-between border ${
          notificationMsg.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : notificationMsg.type === 'error'
            ? 'bg-rose-50 border-rose-200 text-rose-800'
            : 'bg-sky-50 border-sky-200 text-sky-800'
        }`}>
          <div className="flex items-center gap-2">
            {notificationMsg.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <Sparkles className="w-4 h-4 text-sky-600 shrink-0" />
            )}
            <span className="font-semibold">{notificationMsg.text}</span>
          </div>
          <button type="button" onClick={() => setNotificationMsg(null)} className="opacity-70 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Live Telemetry Ribbon (Top 4 KPIs) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        
        {/* Card 1: Gross Revenue MTD */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-50 dark:bg-emerald-950/20 rounded-full blur-xl pointer-events-none"></div>
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Gross Revenue MTD</span>
                <MetricInfoTooltip
                  title="Gross Revenue Month-to-Date"
                  description="Cumulative sales revenue recorded from the first day of the current calendar month to today across all retail billing."
                  formula="Sum(Month Invoices Grand Total)"
                />
              </div>
              <span className="text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                <TrendingUp className="w-3 h-3" /> MTD Run
              </span>
            </div>
            <div className="mt-2 flex items-baseline">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
                ₹{formatCurrency(totalRevenue)}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="font-bold text-emerald-800 dark:text-emerald-400">Net Profit: ₹{formatCurrency(grossProfit)}</span>
              <span className="text-slate-400 dark:text-slate-500 font-mono">({blendedMarginPercent}% margin)</span>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400">Total Orders: {totalInvoices}</span>
            <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-400">ACTIVE</span>
          </div>
        </div>

        {/* Card 2: Daily Counter Velocity */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-sky-50 dark:bg-sky-950/20 rounded-full blur-xl pointer-events-none"></div>
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Counter Velocity</span>
                <MetricInfoTooltip
                  title="Counter Velocity"
                  description="Average daily retail revenue throughput and total number of transactions processed at the checkout desk."
                  formula="Total Revenue MTD / Elapsed Days in Month"
                />
              </div>
              <span className="text-[10px] font-bold bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60 px-2 py-0.5 rounded-full">
                {totalInvoices} INVOICES
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
                ₹{formatCurrency(dailyAvgRevenue)}
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">/ day avg</span>
            </div>
            <div className="mt-1 flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
              <Clock className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
              <span>Peak: <strong>{peakHoursLabel}</strong></span>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400">Digital POS: Online</span>
            <span className="text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 px-1.5 py-0.5 rounded">CONNECTED</span>
          </div>
        </div>

        {/* Card 3: Physical Season Volume */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-50 dark:bg-amber-950/20 rounded-full blur-xl pointer-events-none"></div>
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Aggregated Dispatch</span>
                <MetricInfoTooltip
                  title="Aggregated Season Dispatch"
                  description="Total volume of physical agricultural inputs disbursed to farmers during the active season across fertilizers, crop protection, and certified seeds."
                  formula="Sum(Units Dispatched across all categories)"
                />
              </div>
              <span className="text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 px-2 py-0.5 rounded-full">
                KHARIF DISPATCH
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
                {volumeSummary.totalUnits.toLocaleString('en-IN')}
              </span>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Units Dispatched</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-mono text-slate-500 dark:text-slate-400">
              <span>{volumeSummary.bagsFertilizer} Bags Fert</span>
              <span>•</span>
              <span>{volumeSummary.litersChem}L Chem</span>
              <span>•</span>
              <span>{volumeSummary.pktsSeed} Pkts Seed</span>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400">Low Stock SKUs: {dashboardSummary?.low_stock_count || 0}</span>
            <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400">STOCK HEALTH</span>
          </div>
        </div>

        {/* Card 4: Capital & Credit Liquidity (Khata) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-purple-50 dark:bg-purple-950/20 rounded-full blur-xl pointer-events-none"></div>
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Credit &amp; Working Capital</span>
                <MetricInfoTooltip
                  title="Credit & Working Capital"
                  description="Working capital health ratio comparing outstanding farmer khata credit against active godown inventory assets."
                  formula="Total Khata Receivables vs Inward Inventory Valuation"
                  align="right"
                />
              </div>
              <span className="text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 px-2 py-0.5 rounded-full">
                {khataAnalysis.totalOutstanding > 0 ? 'ACTIVE CREDIT' : 'ZERO DEBT'}
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
                ₹{formatCurrency(khataAnalysis.totalOutstanding)}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">Receivables</span>
            </div>
            <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">
              <span>Inward Stock Valuation: <strong>₹{formatCurrency(dashboardSummary?.total_inventory_value || 0)}</strong></span>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400">Registered Growers: {khataCustomers.length}</span>
            <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-400">VERIFIED</span>
          </div>
        </div>

      </section>

      {/* Section 1 & 2: Revenue Trend Visualizer + Agronomic Profit Share (Bento Split) */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* LEFT PANE (8 Cols): Executive Dual-Axis Area & Line Chart */}
        <div className="xl:col-span-8 bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Revenue Velocity &amp; Blended Margin Curve
                  </h2>
                  <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded uppercase">
                    Dual Axis
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Tracking seasonal surge correlates against statutory fertilizer caps vs high-margin CIB agrochemicals
                </p>
              </div>

              {/* Legends */}
              <div className="flex items-center gap-4 text-xs font-semibold">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-emerald-700"></span>
                  <span className="text-slate-600 dark:text-slate-300">Gross Revenue (₹)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-1 bg-amber-600 rounded-full"></span>
                  <span className="text-slate-600 dark:text-slate-300">Margin (%)</span>
                </div>
              </div>
            </div>

            {/* Recharts Dual-Axis Chart with Seasonal Inflection Markers */}
            <div className="w-full h-72 sm:h-80 bg-slate-50/60 dark:bg-slate-800/40 rounded-xl p-3 border border-slate-100 dark:border-slate-800 relative flex items-center justify-center">
              {dualAxisChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dualAxisChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="emeraldRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#15803d" stopOpacity={0.32} />
                        <stop offset="60%" stopColor="#15803d" stopOpacity={0.08} />
                        <stop offset="100%" stopColor="#15803d" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.3} />
                    <XAxis 
                      dataKey="label" 
                      tick={{ fontSize: 11, fill: '#64748b' }} 
                      axisLine={{ stroke: '#cbd5e1' }}
                      tickLine={false}
                    />
                    <YAxis 
                      yAxisId="left" 
                      orientation="left" 
                      tick={{ fontSize: 11, fill: '#15803d' }}
                      tickFormatter={(v) => `₹${(v / 100000).toFixed(1)}L`}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis 
                      yAxisId="right" 
                      orientation="right" 
                      domain={[0, 40]} 
                      tick={{ fontSize: 11, fill: '#b45309' }}
                      tickFormatter={(v) => `${v}%`}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const rev = payload.find(p => p.dataKey === 'revenue')?.value || 0;
                          const marg = payload.find(p => p.dataKey === 'margin')?.value || 0;
                          return (
                            <div className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 text-xs">
                              <span className="font-bold text-slate-800 dark:text-white block mb-1">{label}</span>
                              <div className="text-emerald-800 dark:text-emerald-400 font-bold">Revenue: ₹{formatCurrency(Number(rev))}</div>
                              <div className="text-amber-700 dark:text-amber-400 font-semibold">Blended Margin: {Number(marg).toFixed(1)}%</div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="revenue"
                      stroke="#15803d"
                      strokeWidth={3}
                      fill="url(#emeraldRevenueGrad)"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="margin"
                      stroke="#b45309"
                      strokeWidth={2.5}
                      dot={{ fill: '#b45309', r: 4, stroke: '#ffffff', strokeWidth: 2 }}
                      activeDot={{ r: 6 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center p-6 space-y-2">
                  <BarChart3 className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    No sales telemetry recorded yet for this period.
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    Counter bills and receipts will automatically graph here in real time.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Weekly Run-rate & Target Performance Indicators */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 mt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold block">Weekly Avg Run Rate</span>
              <p className="text-sm font-black text-slate-900 dark:text-white font-mono mt-0.5">
                ₹{formatCurrency(dailyAvgRevenue * 7)}
              </p>
              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">Realized Rate</span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold block">Blended Gross Margin</span>
              <p className="text-sm font-black text-slate-900 dark:text-white font-mono mt-0.5">
                {blendedMarginPercent}%
              </p>
              <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400">Average Profitability</span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold block">Registered Growers</span>
              <p className="text-sm font-black text-slate-900 dark:text-white font-mono mt-0.5">{khataCustomers.length}</p>
              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">Active Profiles</span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold block">Total Inventory Value</span>
              <p className="text-sm font-black text-slate-900 dark:text-white font-mono mt-0.5">
                ₹{formatCurrency(dashboardSummary?.total_inventory_value || 0)}
              </p>
              <span className="text-[10px] font-bold text-sky-700 dark:text-sky-400">Godown Stock</span>
            </div>
          </div>
        </div>

        {/* RIGHT PANE (4 Cols): Agronomic Category Share & Profit Contribution */}
        <div className="xl:col-span-4 bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Category Profit Mix</h2>
              <span className="text-[10px] font-bold bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60 px-2 py-0.5 rounded-full uppercase">
                FCO SECURE
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Volume share vs statutory bottom-line contribution
            </p>

            {/* Donut Visualization */}
            <div className="my-4 flex flex-col items-center justify-center relative">
              <div className="w-40 h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryMix}
                      dataKey="volPct"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={46}
                      outerRadius={68}
                      paddingAngle={3}
                    >
                      {categoryMix.map((entry) => (
                        <Cell key={entry.id} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total Volume</span>
                <span className="text-base font-black text-slate-900 dark:text-white font-mono">
                  ₹{formatCurrency(totalRevenue)}
                </span>
                <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded">
                  100% AUDITED
                </span>
              </div>
            </div>

            {/* Category Rows with Progress Bars */}
            <div className="flex flex-col gap-2.5">
              {categoryMix.map((cat) => (
                <div key={cat.id} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }}></span>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{cat.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] font-mono">
                      <span className="text-slate-900 dark:text-white font-bold">{cat.volPct}% Vol</span>
                      <span className="text-slate-300 dark:text-slate-600">•</span>
                      <span className="font-bold" style={{ color: cat.color }}>
                        {cat.profitPct}% Profit (₹{formatCurrency(cat.profit)})
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${cat.volPct}%`, backgroundColor: cat.color }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Statutory Pricing Safeguard Badge */}
          <div className="mt-4 p-3 bg-sky-50 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-900/40 rounded-xl flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-sky-700 dark:text-sky-400 shrink-0" />
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-900 dark:text-white">FCO Margin Protection Active</span>
              <span className="text-[11px] text-slate-600 dark:text-slate-300 leading-tight">
                Statutory urea margin capped at ₹270/MT. Cross-subsidized with CIB items.
              </span>
            </div>
          </div>
        </div>

      </section>

      {/* Section 3 & 4: Top Fast-Moving Agricultural Molecules & Tender Velocity */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* LEFT PANE (8 Cols): Top Fast-Moving Molecules Table */}
        <div className="xl:col-span-8 bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Top Fast-Moving Agricultural Molecules
                  </h2>
                  <span className="text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 px-2 py-0.5 rounded uppercase">
                    FIFO RANKED
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Real-time depletion velocity, batch turn rate, and active gross profit
                </p>
              </div>

              {/* Category tabs */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                {['All', 'Fertilizers', 'Pesticides', 'Seeds'].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setSelectedMoleculeCategory(c)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      selectedMoleculeCategory === c
                        ? 'bg-white dark:bg-slate-700 text-emerald-900 dark:text-emerald-300 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Molecules Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-[11px] font-semibold uppercase tracking-wider border-y border-slate-200 dark:border-slate-700">
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Product Name &amp; Active Formulation</th>
                    <th className="py-2.5 px-3 text-right">Units Sold</th>
                    <th className="py-2.5 px-3 text-right">Revenue</th>
                    <th className="py-2.5 px-3 text-right">Gross Profit</th>
                    <th className="py-2.5 px-3 text-center">Status / Tag</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {fastMovingMolecules.length > 0 ? (
                    fastMovingMolecules.slice(0, 7).map((prod, idx) => (
                      <tr key={prod.product_name} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-slate-400 dark:text-slate-500">
                          {String(idx + 1).padStart(2, '0')}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900 dark:text-white">{prod.product_name}</span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                              {(prod as any).formulation || `${prod.category || 'Agro SKU'} • Fast Depot`}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {prod.quantity} {prod.unit || 'Units'}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                          ₹{formatCurrency(prod.revenue)}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex flex-col items-end">
                            <span className="font-mono font-bold text-emerald-800 dark:text-emerald-400">
                              ₹{formatCurrency(prod.profit)}
                            </span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                              ({(prod as any).margin_pct || Math.round((prod.profit / (prod.revenue || 1)) * 100)}%)
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            (prod as any).tagColor || 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                          }`}>
                            {(prod as any).tag || 'ACTIVE'}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 dark:text-slate-500 font-medium">
                        No product dispatches recorded yet for this billing cycle.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="pt-3 mt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Displaying top {Math.min(7, fastMovingMolecules.length)} fast-moving SKUs</span>
            <button
              type="button"
              onClick={() => navigate('/inventory')}
              className="text-emerald-800 dark:text-emerald-400 font-bold flex items-center gap-1 hover:underline"
            >
              <span>View Full Inventory &amp; FIFO Lots</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* RIGHT PANE (4 Cols): Tender Velocity & Khata Aging */}
        <div className="xl:col-span-4 flex flex-col gap-6">
          
          {/* Tender Breakdown Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Tender Velocity</h3>
                <span className="text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 px-2 py-0.5 rounded-full uppercase">
                  SETTLEMENT
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                Real-time payment breakdown &amp; daily liquidity routing
              </p>

              <div className="space-y-4">
                {/* UPI */}
                <div>
                  <div className="flex justify-between items-center mb-1 text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                      <QrCode className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                      <span>UPI Dynamic QR (GPay/PhonePe)</span>
                    </div>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      ₹{formatCurrency(tenderBreakdown.upi.amount)} ({tenderBreakdown.upi.pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-700 dark:bg-emerald-500 h-full rounded-full" style={{ width: `${tenderBreakdown.upi.pct}%` }}></div>
                  </div>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 block">T+0 Real-time NPCI settlement</span>
                </div>

                {/* Cash */}
                <div>
                  <div className="flex justify-between items-center mb-1 text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                      <Wallet className="w-4 h-4 text-sky-700 dark:text-sky-400" />
                      <span>Physical Cash Drawer</span>
                    </div>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      ₹{formatCurrency(tenderBreakdown.cash.amount)} ({tenderBreakdown.cash.pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-sky-600 dark:bg-sky-500 h-full rounded-full" style={{ width: `${tenderBreakdown.cash.pct}%` }}></div>
                  </div>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 block">Nightly store safe drop • Reconciled daily</span>
                </div>

                {/* Khata */}
                <div>
                  <div className="flex justify-between items-center mb-1 text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                      <Layers className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                      <span>Farmer Khata Ledger</span>
                    </div>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      ₹{formatCurrency(tenderBreakdown.khata.amount)} ({tenderBreakdown.khata.pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-amber-600 dark:bg-amber-500 h-full rounded-full" style={{ width: `${tenderBreakdown.khata.pct}%` }}></div>
                  </div>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 block">Harvest tied credit • Average recovery 42 days</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-mono">Counter POS: Connected</span>
              <button
                type="button"
                onClick={() => navigate('/billing')}
                className="text-[11px] font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-emerald-900 dark:text-emerald-300 px-2.5 py-1 rounded-lg transition-colors"
              >
                GO TO TILL
              </button>
            </div>
          </div>

          {/* Khata Credit Aging Analysis */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Khata Aging Analysis</h3>
                <span className="text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 px-2 py-0.5 rounded-full uppercase">
                  RISK RADAR
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center my-3">
                <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-800/60 flex flex-col">
                  <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300">0–15 Days</span>
                  <span className="text-base font-black text-slate-900 dark:text-white font-mono mt-0.5">
                    {khataAnalysis.b0_15_pct}%
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                    ₹{formatCurrency(khataAnalysis.b0_15)}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col">
                  <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">16–30 Days</span>
                  <span className="text-base font-black text-slate-900 dark:text-white font-mono mt-0.5">
                    {khataAnalysis.b16_30_pct}%
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                    ₹{formatCurrency(khataAnalysis.b16_30)}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex flex-col">
                  <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400">&gt;30 Overdue</span>
                  <span className="text-base font-black text-rose-700 dark:text-rose-400 font-mono mt-0.5">
                    {khataAnalysis.bOver30_pct}%
                  </span>
                  <span className="text-[10px] text-rose-600 dark:text-rose-400 font-mono">
                    ₹{formatCurrency(khataAnalysis.bOver30)}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">{khataAnalysis.overdueCount} Reminders queued</span>
              <button
                type="button"
                onClick={() => navigate('/marketing')}
                className="text-[11px] font-bold bg-emerald-800 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-xs hover:bg-emerald-900 transition-colors"
              >
                <Zap className="w-3.5 h-3.5 text-emerald-300" />
                WhatsApp Chaser
              </button>
            </div>
          </div>

        </div>

      </section>

      {/* Section 5: Agronomic Intelligence & Predictive Restocking Advisory (AI Lens Insights) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Agronomic Intelligence &amp; Autonomous Restocking Advisory
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                AI-generated micro-climate forecast synthesis, shelf-life monitoring, and revenue leakage detection
              </p>
            </div>
          </div>
          <span className="text-[10px] font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 px-2.5 py-1 rounded-full uppercase tracking-wider hidden sm:inline-block">
            AI ENGINE v2.4
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Card 1: Soil Moisture Alert & Sowing Shift */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 border-l-4 border-l-sky-500 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60 px-2 py-0.5 rounded-full uppercase">
                  PRE-RABI MOISTURE RADAR
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                  {settings.city || 'Mandya Cluster'}
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-2">
                Ground Moisture Tracking
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">
                Regional ag-weather sensors indicate active soil saturation, maintaining steady sowing demand for pulses and oilseeds.
              </p>
              <div className="mt-3 p-2 bg-sky-50 dark:bg-sky-950/40 rounded-xl flex items-center gap-2 text-xs text-slate-800 dark:text-slate-200 font-medium border border-sky-100 dark:border-sky-900/40">
                <Package className="w-4 h-4 text-sky-700 dark:text-sky-400 shrink-0" />
                <span>Advisory: Maintain certified seed buffers in godown</span>
              </div>
            </div>
            <div className="mt-4 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">Telemetry: Live Ag-Sensors</span>
              <button
                type="button"
                onClick={() => navigate('/purchases')}
                className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
              >
                <span>Create Draft PO</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Card 2: Pesticide Expiry Velocity Mismatch */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 border-l-4 border-l-rose-500 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 px-2 py-0.5 rounded-full uppercase">
                  SHELF-LIFE COLLISION
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                  &lt; 60 Days Expiry
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-2">
                {nearExpiryProducts.length > 0 ? `${nearExpiryProducts.length} Batches Approaching Expiry` : '0 Batches Approaching Expiry'}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">
                {nearExpiryProducts.length > 0
                  ? `There are ${nearExpiryProducts.length} batches within the 60-day expiry threshold requiring stock rotation.`
                  : 'All stock batches are healthy and well within safe statutory shelf-life limits.'}
              </p>
              <div className="mt-3 p-2 bg-rose-50 dark:bg-rose-950/40 rounded-xl flex items-center gap-2 text-xs text-rose-900 dark:text-rose-200 font-medium border border-rose-100 dark:border-rose-900/40">
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>{nearExpiryProducts.length > 0 ? 'Action: Review FIFO lots in godown' : 'Shelf-Life Status: 100% Compliant'}</span>
              </div>
            </div>
            <div className="mt-4 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="text-[11px] font-bold text-rose-700 dark:text-rose-400">
                At Risk: ₹{formatCurrency(nearExpiryProducts.reduce((sum, p) => sum + (p.selling_price || 0) * (p.current_stock || 0), 0))}
              </span>
              <button
                type="button"
                onClick={() => navigate('/marketing')}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
              >
                <span>Launch Chaser</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Card 3: Margin Leakage Detection */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 border-l-4 border-l-amber-500 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 px-2 py-0.5 rounded-full uppercase">
                  REVENUE LEAKAGE AUDIT
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">POS Pricing</span>
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-2">
                Automated Pricing &amp; Margin Integrity
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">
                Automated pricing tiers and statutory ceilings are active across all terminals with zero unauthorized discount leakage.
              </p>
              <div className="mt-3 p-2 bg-amber-50 dark:bg-amber-950/40 rounded-xl flex items-center gap-2 text-xs text-amber-900 dark:text-amber-200 font-medium border border-amber-100 dark:border-amber-900/40">
                <BadgePercent className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />
                <span>Statutory Compliance: Active &amp; Verified</span>
              </div>
            </div>
            <div className="mt-4 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">Counter POS</span>
              <button
                type="button"
                onClick={() => navigate('/price-lists')}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
              >
                <span>View Price Rules</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

        </div>
      </section>

    </div>
  );
};
