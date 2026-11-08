import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  Calendar,
  Clock,
  DollarSign,
  Receipt,
  Percent,
  RefreshCw,
  Filter,
  BarChart2,
  PieChart as PieIcon,
  Package,
  Layers,
  Sparkles,
  Search,
  X,
  Tag
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { reportsApi } from '../api';
import { AnalyticsData, CategoryAnalyticsItem } from '../types';

const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#64748B'];

const ALL_CATEGORIES = [
  'All Categories',
  'Fertilizer',
  'Pesticide',
  'Seeds',
  'Micronutrients',
  'Bio-fertilizer',
  'Organic',
  'Others',
];

export const AnalyticsPage: React.FC = () => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [preset, setPreset] = useState<string>('this_month');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'day' | 'month' | 'hourly'>('day');

  // Category & Product Search Explorer states
  const [categorySearchQuery, setCategorySearchQuery] = useState<string>('');
  const [selectedCategoryPill, setSelectedCategoryPill] = useState<string>('All Categories');
  const [categoryChartMetric, setCategoryChartMetric] = useState<'all' | 'revenue' | 'profit' | 'stock_value'>('all');

  const fetchAnalytics = async (p = preset, s = customStart, e = customEnd) => {
    setLoading(true);
    try {
      const params: any = { preset: p };
      if (p === 'custom') {
        if (s) params.start_date = s;
        if (e) params.end_date = e;
      }
      const res = await reportsApi.getAnalytics(params);
      setData(res);
    } catch (err) {
      console.error('Failed to load analytics', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics(preset);
  }, [preset]);

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    setPreset('custom');
    fetchAnalytics('custom', customStart, customEnd);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  const formatCompactCurrency = (val: number) => {
    const n = Number(val || 0);
    if (Math.abs(n) >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
    if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
    if (Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
    return `₹${Math.round(n)}`;
  };

  const categoryBreakdown: CategoryAnalyticsItem[] = useMemo(() => {
    return data?.category_breakdown || [];
  }, [data]);

  const categoryTotals = useMemo(() => {
    return categoryBreakdown.reduce(
      (acc, c) => {
        acc.revenue += Number(c.revenue || 0);
        acc.profit += Number(c.profit || 0);
        acc.stock_value += Number(c.stock_value || 0);
        acc.products += Number(c.product_count || 0);
        return acc;
      },
      { revenue: 0, profit: 0, stock_value: 0, products: 0 }
    );
  }, [categoryBreakdown]);

  const hasCategoryActivity =
    categoryTotals.revenue > 0 || categoryTotals.profit > 0 || categoryTotals.stock_value > 0;

  // Flatten all products across categories & filter by category search or selected category pill
  const filteredCategoryProducts = useMemo(() => {
    const allProds: Array<{
      id: number;
      product_name: string;
      category: string;
      unit: string;
      current_stock: number;
      selling_price: number;
      units_sold: number;
      revenue: number;
      profit: number;
    }> = [];

    for (const catItem of categoryBreakdown) {
      for (const p of catItem.products || []) {
        allProds.push({
          ...p,
          category: p.category || catItem.category,
        });
      }
    }

    const q = categorySearchQuery.trim().toLowerCase();

    return allProds.filter((p) => {
      const matchesPill =
        selectedCategoryPill === 'All Categories' ||
        (p.category || 'Fertilizer').toLowerCase() === selectedCategoryPill.toLowerCase();

      if (!q) return matchesPill;

      // Match either category name OR product name
      const matchesQuery =
        (p.category || '').toLowerCase().includes(q) ||
        (p.product_name || '').toLowerCase().includes(q);

      return matchesPill && matchesQuery;
    });
  }, [categoryBreakdown, categorySearchQuery, selectedCategoryPill]);

  // Keep all categories visible in the summary table unless narrowed by search query
  const matchingCategoriesSummary = useMemo(() => {
    const q = categorySearchQuery.trim().toLowerCase();
    if (!q) return categoryBreakdown;
    return categoryBreakdown.filter((c) => {
      const catMatches = c.category.toLowerCase().includes(q);
      const anyProdMatches = (c.products || []).some(
        (p) => (p.product_name || '').toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q)
      );
      return catMatches || anyProdMatches;
    });
  }, [categoryBreakdown, categorySearchQuery]);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Business & Category Analytics</h1>
              <p className="text-xs md:text-sm text-slate-500">
                Real-time sales velocity, category-wise breakdown, gross margins & product search explorer
              </p>
            </div>
          </div>
        </div>

        {/* Action & Refresh */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchAnalytics(preset)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter Bar with Presets & Date-Time Picker */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex overflow-x-auto gap-1.5 pb-1 -mx-1 px-1 scrollbar-hide sm:flex-wrap">
            {[
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'last_7_days', label: 'Last 7 Days' },
              { id: 'this_month', label: 'This Month' },
              { id: 'last_month', label: 'Last Month' },
              { id: 'all', label: 'All Time' },
              { id: 'custom', label: 'Custom' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setPreset(p.id);
                  if (p.id !== 'custom') {
                    setCustomStart('');
                    setCustomEnd('');
                  }
                }}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  preset === p.id
                    ? 'bg-emerald-700 text-white shadow-sm ring-2 ring-emerald-600/20'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {data?.period && (
            <div className="text-xs text-slate-500 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>
                Window: {new Date(data.period.start).toLocaleDateString('en-IN')} -{' '}
                {new Date(data.period.end).toLocaleDateString('en-IN')}
              </span>
            </div>
          )}
        </div>

        {/* Custom Date & Time Picker */}
        {preset === 'custom' && (
          <form
            onSubmit={handleApplyCustom}
            className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3 bg-slate-50 p-3 rounded-xl"
          >
            <div className="flex-1 min-w-0">
              <label className="block text-[11px] font-medium text-slate-600 mb-1 flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" /> Start Date &amp; Time
              </label>
              <input
                type="datetime-local"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                required
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
            <div className="flex-1 min-w-0">
              <label className="block text-[11px] font-medium text-slate-600 mb-1 flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" /> End Date &amp; Time
              </label>
              <input
                type="datetime-local"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                required
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="flex items-center justify-center gap-1 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold transition w-full sm:w-auto"
            >
              <Filter className="w-3 h-3" />
              Apply Range
            </button>
          </form>
        )}
      </div>

      {loading && !data ? (
        <div className="min-h-[300px] flex items-center justify-center bg-white rounded-2xl border border-slate-200">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs text-slate-500 font-medium">Crunching sales & category numbers...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Summary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Revenue */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Total Sales Revenue
                </span>
                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900">
                {formatCurrency(data?.summary.total_revenue || 0)}
              </div>
              <div className="mt-2 flex items-center text-xs text-slate-500">
                <span className="text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded-md mr-1.5">
                  Taxable: {formatCurrency(data?.summary.total_taxable || 0)}
                </span>
              </div>
            </div>

            {/* Gross Profit & Margin */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Gross Profit & Margin
                </span>
                <div className="p-2 bg-blue-50 text-blue-700 rounded-xl">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900">
                {formatCurrency(data?.summary.gross_profit || 0)}
              </div>
              <div className="mt-2 flex items-center text-xs text-slate-500">
                <span className="text-blue-700 font-semibold bg-blue-50 px-1.5 py-0.5 rounded-md mr-1.5">
                  {data?.summary.gross_margin_percent}% Margin
                </span>
                <span>COGS: {formatCurrency(data?.summary.total_cogs || 0)}</span>
              </div>
            </div>

            {/* Total Bills & Average Ticket */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Orders / Footfall
                </span>
                <div className="p-2 bg-purple-50 text-purple-700 rounded-xl">
                  <Receipt className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900">
                {data?.summary.total_bills || 0}{' '}
                <span className="text-sm font-normal text-slate-500">Bills</span>
              </div>
              <div className="mt-2 flex items-center text-xs text-slate-500">
                <span className="text-purple-700 font-semibold bg-purple-50 px-1.5 py-0.5 rounded-md mr-1.5">
                  Avg Bill: {formatCurrency(data?.summary.average_bill_value || 0)}
                </span>
              </div>
            </div>

            {/* Total GST */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  GST Collected
                </span>
                <div className="p-2 bg-amber-50 text-amber-700 rounded-xl">
                  <Percent className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900">
                {formatCurrency(data?.summary.total_gst || 0)}
              </div>
              <div className="mt-2 flex items-center text-xs text-slate-500">
                <span className="text-amber-700 font-semibold bg-amber-50 px-1.5 py-0.5 rounded-md mr-1.5">
                  CGST + SGST
                </span>
                <span>Ready for GSTR-1</span>
              </div>
            </div>
          </div>

          {/* ============================================================== */}
          {/* NEW: Category-Based Analytics & Category Product Search        */}
          {/* ============================================================== */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-emerald-600" />
                  Analytics by Product Category &amp; Category Search
                </h2>
                <p className="text-xs text-slate-500">
                  Compare sales revenue, profit, stock value, and search any category (including Fertilizer, Pesticide, Seeds, Others) to view all products in that category.
                </p>
              </div>
            </div>

            {/* Category Bar Chart + Category Breakdown Table */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Category Chart */}
              <div className="lg:col-span-5 bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Category Revenue &amp; Stock Value Comparison
                  </h3>
                  <div className="inline-flex items-center bg-white border border-slate-200 p-0.5 rounded-lg text-[11px] font-semibold">
                    {[
                      { id: 'all', label: 'All' },
                      { id: 'revenue', label: 'Revenue' },
                      { id: 'profit', label: 'Profit' },
                      { id: 'stock_value', label: 'Stock' },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setCategoryChartMetric(m.id as any)}
                        className={`px-2 py-1 rounded-md transition ${
                          categoryChartMetric === m.id
                            ? 'bg-emerald-700 text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Legend Strip (never collides with axis labels) */}
                <div className="grid grid-cols-3 gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() =>
                      setCategoryChartMetric(categoryChartMetric === 'revenue' ? 'all' : 'revenue')
                    }
                    className={`flex flex-col p-2 rounded-lg border text-left transition ${
                      categoryChartMetric === 'all' || categoryChartMetric === 'revenue'
                        ? 'bg-white border-emerald-200 shadow-2xs'
                        : 'bg-slate-100/70 border-slate-200/60 opacity-60'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500">
                      <span className="w-2 h-2 rounded-xs bg-emerald-500 shrink-0" />
                      Sales Revenue
                    </span>
                    <span className="text-xs font-bold text-slate-900 mt-0.5 truncate">
                      {formatCurrency(categoryTotals.revenue)}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setCategoryChartMetric(categoryChartMetric === 'profit' ? 'all' : 'profit')
                    }
                    className={`flex flex-col p-2 rounded-lg border text-left transition ${
                      categoryChartMetric === 'all' || categoryChartMetric === 'profit'
                        ? 'bg-white border-blue-200 shadow-2xs'
                        : 'bg-slate-100/70 border-slate-200/60 opacity-60'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500">
                      <span className="w-2 h-2 rounded-xs bg-blue-500 shrink-0" />
                      Gross Profit
                    </span>
                    <span className="text-xs font-bold text-slate-900 mt-0.5 truncate">
                      {formatCurrency(categoryTotals.profit)}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setCategoryChartMetric(categoryChartMetric === 'stock_value' ? 'all' : 'stock_value')
                    }
                    className={`flex flex-col p-2 rounded-lg border text-left transition ${
                      categoryChartMetric === 'all' || categoryChartMetric === 'stock_value'
                        ? 'bg-white border-amber-200 shadow-2xs'
                        : 'bg-slate-100/70 border-slate-200/60 opacity-60'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500">
                      <span className="w-2 h-2 rounded-xs bg-amber-500 shrink-0" />
                      Stock Value
                    </span>
                    <span className="text-xs font-bold text-slate-900 mt-0.5 truncate">
                      {formatCurrency(categoryTotals.stock_value)}
                    </span>
                  </button>
                </div>

                {/* Horizontal Bar Chart — zero tilted text, zero label overlap */}
                <div className="h-72 w-full bg-white rounded-xl border border-slate-200/80 p-2.5">
                  {categoryBreakdown.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={categoryBreakdown}
                        layout="vertical"
                        margin={{ top: 6, right: 16, left: 4, bottom: 4 }}
                        barCategoryGap="22%"
                        barGap={2}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                        <XAxis
                          type="number"
                          domain={[
                            0,
                            (dataMax: number) => (dataMax > 0 ? Math.ceil(dataMax * 1.15) : 1000),
                          ]}
                          tick={{ fontSize: 10, fill: '#64748B' }}
                          tickFormatter={(v) => formatCompactCurrency(Number(v))}
                          axisLine={{ stroke: '#CBD5E1' }}
                          tickLine={false}
                        />
                        <YAxis
                          type="category"
                          dataKey="category"
                          width={94}
                          tick={{ fontSize: 11, fontWeight: 600, fill: '#334155' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          cursor={{ fill: '#F8FAFC' }}
                          content={({ active, payload, label }) => {
                            if (!active || !payload || !payload.length) return null;
                            const row = payload[0]?.payload as CategoryAnalyticsItem | undefined;
                            return (
                              <div className="bg-white/95 backdrop-blur-xs border border-slate-200 rounded-xl shadow-lg p-3 text-xs space-y-1.5 min-w-[180px]">
                                <div className="font-bold text-slate-900 border-b border-slate-100 pb-1 flex items-center justify-between">
                                  <span>{label}</span>
                                  {row && (
                                    <span className="text-[10px] font-semibold text-slate-500">
                                      {row.product_count} items ({row.stock_units} in stock)
                                    </span>
                                  )}
                                </div>
                                {payload.map((entry: any) => (
                                  <div
                                    key={entry.dataKey}
                                    className="flex items-center justify-between gap-4"
                                  >
                                    <span className="flex items-center gap-1.5 text-slate-600">
                                      <span
                                        className="w-2 h-2 rounded-full"
                                        style={{ backgroundColor: entry.color }}
                                      />
                                      {entry.name}
                                    </span>
                                    <span className="font-bold text-slate-900">
                                      {formatCurrency(Number(entry.value || 0))}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            );
                          }}
                        />
                        {(categoryChartMetric === 'all' || categoryChartMetric === 'revenue') && (
                          <Bar
                            dataKey="revenue"
                            name="Sales Revenue"
                            fill="#10B981"
                            radius={[0, 5, 5, 0]}
                            barSize={categoryChartMetric === 'all' ? 7 : 14}
                            background={
                              categoryChartMetric === 'revenue'
                                ? { fill: '#F1F5F9', radius: 5 }
                                : undefined
                            }
                          />
                        )}
                        {(categoryChartMetric === 'all' || categoryChartMetric === 'profit') && (
                          <Bar
                            dataKey="profit"
                            name="Gross Profit"
                            fill="#3B82F6"
                            radius={[0, 5, 5, 0]}
                            barSize={categoryChartMetric === 'all' ? 7 : 14}
                            background={
                              categoryChartMetric === 'profit'
                                ? { fill: '#F1F5F9', radius: 5 }
                                : undefined
                            }
                          />
                        )}
                        {(categoryChartMetric === 'all' || categoryChartMetric === 'stock_value') && (
                          <Bar
                            dataKey="stock_value"
                            name="Stock Value"
                            fill="#F59E0B"
                            radius={[0, 5, 5, 0]}
                            barSize={categoryChartMetric === 'all' ? 7 : 14}
                            background={{ fill: '#F1F5F9', radius: 5 }}
                          />
                        )}
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400">
                      No category analytics available
                    </div>
                  )}
                </div>

                {!hasCategoryActivity && (
                  <p className="text-[11px] text-slate-500 text-center bg-white/80 py-1.5 px-3 rounded-lg border border-slate-200/70">
                    All categories are currently at ₹0 — add products in <strong>Stock</strong> or complete a <strong>Bill</strong> to see live comparison bars.
                  </p>
                )}
              </div>

              {/* Category Summary Table */}
              <div className="lg:col-span-7 overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <tr>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3 text-right">Products</th>
                      <th className="py-2.5 px-3 text-right">In-Stock Units</th>
                      <th className="py-2.5 px-3 text-right">Stock Value</th>
                      <th className="py-2.5 px-3 text-right">Units Sold</th>
                      <th className="py-2.5 px-3 text-right">Revenue</th>
                      <th className="py-2.5 px-3 text-right">Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {matchingCategoriesSummary.map((cat, idx) => {
                      const isSelected = selectedCategoryPill.toLowerCase() === cat.category.toLowerCase();
                      return (
                        <tr
                          key={cat.category}
                          onClick={() =>
                            setSelectedCategoryPill(isSelected ? 'All Categories' : cat.category)
                          }
                          className={`cursor-pointer transition ${
                            isSelected
                              ? 'bg-emerald-50/90 font-semibold'
                              : 'hover:bg-slate-50'
                          }`}
                          title="Click to filter products in this category"
                        >
                          <td className="py-2.5 px-3 flex items-center gap-2 font-semibold text-slate-900">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                            />
                            <span>{cat.category}</span>
                            {cat.percentage > 0 && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                                {cat.percentage}%
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-700 font-medium">
                            {cat.product_count}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-700">
                            {cat.stock_units}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-700 font-medium">
                            {formatCurrency(cat.stock_value)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-semibold text-slate-800">
                            {cat.units_sold}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                            {formatCurrency(cat.revenue)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-semibold text-emerald-700">
                            +{formatCurrency(cat.profit)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Category & Product Search Explorer */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Search className="w-4 h-4 text-emerald-600" />
                    Search Products by Category or Name
                  </h3>
                  <p className="text-xs text-slate-500">
                    Search any category name (e.g., &ldquo;Fertilizer&rdquo;, &ldquo;Pesticide&rdquo;, &ldquo;Seeds&rdquo;, &ldquo;Others&rdquo;) or click a category pill to see all products in that category.
                  </p>
                </div>

                {/* Search Input */}
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={categorySearchQuery}
                    onChange={(e) => setCategorySearchQuery(e.target.value)}
                    placeholder="Search category (e.g. Fertilizer, Others) or product..."
                    className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  {categorySearchQuery && (
                    <button
                      type="button"
                      onClick={() => setCategorySearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Category Filter Pills */}
              <div className="flex flex-wrap gap-1.5">
                {ALL_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategoryPill(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      selectedCategoryPill === cat
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Products in Selected/Searched Category */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-80">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">Product Name</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3 text-right">Current Stock</th>
                      <th className="py-2.5 px-3 text-right">Selling Price</th>
                      <th className="py-2.5 px-3 text-right">Units Sold</th>
                      <th className="py-2.5 px-3 text-right">Sales Revenue</th>
                      <th className="py-2.5 px-3 text-right">Gross Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCategoryProducts.length > 0 ? (
                      filteredCategoryProducts.map((prod) => (
                        <tr key={prod.id} className="hover:bg-slate-50 transition">
                          <td className="py-2.5 px-3 font-semibold text-slate-900 flex items-center gap-2">
                            <Package className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>{prod.product_name}</span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <Tag className="w-2.5 h-2.5" />
                              {prod.category}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-medium text-slate-700">
                            {prod.current_stock} {prod.unit}
                          </td>
                          <td className="py-2.5 px-3 text-right font-medium text-slate-800">
                            {formatCurrency(prod.selling_price)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-semibold text-slate-800">
                            {prod.units_sold} {prod.unit}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                            {formatCurrency(prod.revenue)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-semibold text-emerald-700">
                            +{formatCurrency(prod.profit)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                          No products found matching this category or search query.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Interactive Trends Chart */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-emerald-600" />
                  Sales Revenue & Profit Performance
                </h2>
                <p className="text-xs text-slate-500">
                  Visual timeline analysis of shop income and net margins
                </p>
              </div>

              {/* View toggle */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                <button
                  onClick={() => setActiveTab('day')}
                  className={`px-3 py-1 rounded-lg transition ${
                    activeTab === 'day' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Day-wise
                </button>
                <button
                  onClick={() => setActiveTab('month')}
                  className={`px-3 py-1 rounded-lg transition ${
                    activeTab === 'month' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setActiveTab('hourly')}
                  className={`px-3 py-1 rounded-lg transition ${
                    activeTab === 'hourly' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Hourly Rush
                </button>
              </div>
            </div>

            <div className="h-56 sm:h-72 w-full pt-2">
              {activeTab === 'day' && (
                (data?.day_wise && data.day_wise.length > 0) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.day_wise}>
                      <defs>
                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="colorProf" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} />
                      <YAxis
                        tick={{ fontSize: 11, fill: '#64748B' }}
                        tickFormatter={(v) => formatCompactCurrency(Number(v))}
                      />
                      <Tooltip
                        formatter={(val: any, name: string) => [
                          formatCurrency(Number(val)),
                          name === 'revenue' ? 'Sales Revenue' : 'Gross Profit',
                        ]}
                      />
                      <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }} />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        name="Sales Revenue"
                        stroke="#10B981"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorRev)"
                      />
                      <Area
                        type="monotone"
                        dataKey="profit"
                        name="Gross Profit"
                        stroke="#3B82F6"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorProf)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                    No sales recorded for this day-wise timeframe.
                  </div>
                )
              )}

              {activeTab === 'month' && (
                (data?.monthly && data.monthly.length > 0) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.monthly}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} />
                      <YAxis
                        tick={{ fontSize: 11, fill: '#64748B' }}
                        tickFormatter={(v) => formatCompactCurrency(Number(v))}
                      />
                      <Tooltip formatter={(val: any) => formatCurrency(Number(val))} />
                      <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }} />
                      <Bar dataKey="revenue" name="Total Revenue" fill="#10B981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="profit" name="Gross Profit" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                    No monthly aggregation data found.
                  </div>
                )
              )}

              {activeTab === 'hourly' && (
                (data?.hourly && data.hourly.some(h => h.orders > 0)) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.hourly}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748B' }} />
                      <YAxis
                        tick={{ fontSize: 11, fill: '#64748B' }}
                        tickFormatter={(v) => formatCompactCurrency(Number(v))}
                      />
                      <Tooltip
                        formatter={(val: any, name: string) => [
                          name === 'revenue' ? formatCurrency(Number(val)) : `${val} bills`,
                          name === 'revenue' ? 'Revenue' : 'Orders Placed',
                        ]}
                      />
                      <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }} />
                      <Bar dataKey="orders" name="Bills / Orders" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="revenue" name="Revenue" fill="#10B981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                    No sales recorded for the 24-hour cycle.
                  </div>
                )
              )}
            </div>
          </div>

          {/* Grid: Payment Breakdown & Top Selling Products */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Payment Method Distribution */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <PieIcon className="w-4 h-4 text-emerald-600" />
                  Payment Methods
                </h3>
                <p className="text-xs text-slate-500 mb-4">Cash vs UPI vs Credit distribution</p>

                {data?.payment_breakdown && data.payment_breakdown.length > 0 ? (
                  <div className="h-44 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data.payment_breakdown}
                          dataKey="amount"
                          nameKey="method"
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={70}
                          paddingAngle={3}
                        >
                          {data.payment_breakdown.map((_, idx) => (
                            <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(val: any) => formatCurrency(Number(val))} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-44 flex items-center justify-center text-xs text-slate-400">
                    No payment data recorded
                  </div>
                )}
              </div>

              {/* Legend List */}
              <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                {data?.payment_breakdown.map((item, idx) => (
                  <div key={item.method} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                      ></span>
                      <span className="font-medium text-slate-700">{item.method}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-900 font-semibold">
                      <span>{formatCurrency(item.amount)}</span>
                      <span className="text-[11px] font-normal text-slate-400">({item.percentage}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Fast-Moving Products */}
            <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      Top 10 High-Velocity Products
                    </h3>
                    <p className="text-xs text-slate-500">
                      Best performing inventory generating maximum shop volume
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                        <th className="py-2 px-2">#</th>
                        <th className="py-2 px-3">Product Name</th>
                        <th className="py-2 px-3 text-right">Units Sold</th>
                        <th className="py-2 px-3 text-right">Revenue</th>
                        <th className="py-2 px-3 text-right">Est. Profit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data?.top_products && data.top_products.length > 0 ? (
                        data.top_products.map((tp, idx) => (
                          <tr key={tp.product_name} className="hover:bg-slate-50 transition">
                            <td className="py-2.5 px-2 font-bold text-slate-400">
                              {idx + 1}
                            </td>
                            <td className="py-2.5 px-3 font-medium text-slate-900">
                              {tp.product_name}
                            </td>
                            <td className="py-2.5 px-3 text-right font-semibold text-slate-700">
                              {tp.quantity} {tp.unit}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                              {formatCurrency(tp.revenue)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-semibold text-emerald-700">
                              +{formatCurrency(tp.profit)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                            No product sales recorded in this period.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
