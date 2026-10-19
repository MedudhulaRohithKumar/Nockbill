import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  IndianRupee, 
  TrendingUp, 
  Package, 
  AlertTriangle, 
  Clock, 
  PlusCircle, 
  ScanLine, 
  FileText, 
  ArrowUpRight, 
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { reportsApi, getErrorMessage } from '../api';
import { DashboardSummary } from '../types';
import { useAuth } from '../context/AuthContext';
import { CameraScannerModal } from '../components/ocr/CameraScannerModal';
import { formatCurrency, formatCompactINR } from '../utils/formatters';


export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const fetchDashboard = async () => {
    setIsLoading(true);
    try {
      const data = await reportsApi.getDashboard();
      setSummary(data);
      setLoadError(null);
    } catch (err) {
      // Keep the last good data (if any) instead of faking ₹0 values,
      // and surface the failure so the owner doesn't misread the numbers.
      setLoadError(getErrorMessage(err, 'Could not load dashboard data'));
    } finally {
      setIsLoading(false);
    }
  };

  const showSkeleton = isLoading && !summary;
  const Skeleton: React.FC<{ className?: string }> = ({ className = 'h-6 sm:h-8 w-20' }) => (
    <span className={`inline-block align-middle bg-slate-200 rounded-lg animate-pulse ${className}`} />
  );
  const money = (value: unknown) =>
    showSkeleton ? <Skeleton /> : summary ? `₹${formatCompactINR(value)}` : '—';
  const count = (value: unknown) =>
    showSkeleton ? <Skeleton className="h-6 sm:h-8 w-8" /> : summary ? String(value ?? 0) : '—';
  const monthProfit = summary?.month_net_profit ?? 0;

  useEffect(() => {
    if (user?.id) {
      fetchDashboard();
    }
  }, [user?.id]);

  const handleOcrAddProduct = (item: any) => {
    sessionStorage.setItem('pending_bill_item', JSON.stringify(item));
    navigate('/billing');
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-5">
      {/* Top Header with Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Fertilizer Store Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Real-time stock, daily billing &amp; GST overview
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchDashboard}
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-brand-700 hover:border-brand-200 transition-all active:scale-95 shadow-sm"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsScannerOpen(true)}
            className="flex-1 sm:flex-initial bg-brand-800 hover:bg-brand-900 text-white font-bold py-2.5 px-3 sm:px-4 rounded-xl flex items-center justify-center gap-2 text-xs shadow-md transition-all active:scale-95"
          >
            <ScanLine className="w-4 h-4 text-emerald-300" />
            <span className="hidden xs:inline">OCR Scan</span>
            <span className="xs:hidden">Scan</span>
          </button>
          <button
            onClick={() => navigate('/billing')}
            className="flex-1 sm:flex-initial bg-brand-600 hover:bg-brand-500 text-white font-bold py-2.5 px-3 sm:px-4 rounded-xl flex items-center justify-center gap-2 text-xs shadow-md shadow-brand-600/30 transition-all active:scale-95"
          >
            <PlusCircle className="w-4 h-4" />
            <span className="hidden xs:inline">New Bill</span>
            <span className="xs:hidden">Bill</span>
          </button>
        </div>
      </div>

      {loadError && (
        <div
          role="alert"
          className="p-3 bg-red-50 text-red-800 border border-red-200 rounded-xl text-xs sm:text-sm flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
            <span className="truncate">
              {summary
                ? `Showing last loaded figures — refresh failed: ${loadError}`
                : `Dashboard data unavailable: ${loadError}`}
            </span>
          </div>
          <button
            onClick={fetchDashboard}
            disabled={isLoading}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-white border border-red-200 font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
          >
            {isLoading ? 'Retrying…' : 'Retry'}
          </button>
        </div>
      )}

      {/* KPI Cards Grid — 2 cols on mobile, 4 on lg */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Today's Sales */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider">Today's Sales</span>
            <div className="p-1.5 sm:p-2 rounded-xl bg-brand-50 text-brand-700">
              <IndianRupee className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-base sm:text-2xl font-black text-slate-900 leading-tight">
            {money(summary?.today_sales)}
          </div>
          <p className="text-[10px] text-slate-500 mt-1 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
            <span>{summary ? `${summary.today_bills ?? 0} bills today` : '—'}</span>
          </p>
        </div>

        {/* Monthly Revenue */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider">Month Sales</span>
            <div className="p-1.5 sm:p-2 rounded-xl bg-blue-50 text-blue-700">
              <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-base sm:text-2xl font-black text-slate-900 leading-tight">
            {money(summary?.month_sales ?? (summary as any)?.monthly_sales)}
          </div>
          <p className={`text-[10px] mt-1 font-medium ${monthProfit < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            {summary ? `${monthProfit < 0 ? 'Loss' : 'Profit'}: ₹${formatCompactINR(Math.abs(monthProfit))}` : 'Profit: —'}
          </p>
        </div>

        {/* Total Inventory Stock Value */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider">Stock Value</span>
            <div className="p-1.5 sm:p-2 rounded-xl bg-emerald-50 text-emerald-700">
              <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-base sm:text-2xl font-black text-slate-900 leading-tight">
            {money(summary?.total_inventory_value ?? (summary as any)?.stock_value)}
          </div>
          <p className="text-[10px] text-slate-500 mt-1 font-medium">
            Current in-warehouse
          </p>
        </div>

        {/* Alerts & Critical Stock */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider">Alerts</span>
            <div className="p-1.5 sm:p-2 rounded-xl bg-amber-50 text-amber-600">
              <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-base sm:text-2xl font-black text-amber-600">
              {count(summary?.low_stock_count)}
            </span>
            <span className="text-[10px] text-slate-500 font-medium">Low</span>
            <span className="text-slate-300">|</span>
            <span className="text-base sm:text-2xl font-black text-red-500">
              {count(summary?.near_expiry_count)}
            </span>
            <span className="text-[10px] text-slate-500 font-medium">Expiring</span>
          </div>
          <p className="text-[10px] text-amber-700 mt-1 font-medium">
            Needs attention
          </p>
        </div>
      </div>

      {/* Two Column Layout: Recent Bills & Critical Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
        {/* Left: Recent Invoices */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-brand-700" />
              <h3 className="font-bold text-sm text-slate-900">Recent Bills</h3>
            </div>
            <button
              onClick={() => navigate('/reports')}
              className="text-xs text-brand-700 hover:text-brand-900 font-semibold flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {summary?.recent_sales && summary.recent_sales.length > 0 ? (
            <>
              {/* Mobile: card list */}
              <div className="md:hidden divide-y divide-slate-100">
                {summary.recent_sales.map((sale) => (
                  <div key={sale.id} className="p-3.5 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-[11px] text-brand-800 bg-brand-50 px-1.5 py-0.5 rounded border border-brand-100">
                        {sale.invoice_number}
                      </span>
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                        {sale.payment_mode}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-xs text-slate-800">{sale.customer_name}</p>
                        <p className="text-[10px] text-slate-400">{sale.customer_phone || '—'}</p>
                      </div>
                      <span className="font-black text-sm text-slate-900">
                        ₹{formatCurrency(sale.grand_total)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop: table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold">
                    <tr>
                      <th className="py-2.5 px-4">Invoice</th>
                      <th className="py-2.5 px-4">Customer</th>
                      <th className="py-2.5 px-4">Mode</th>
                      <th className="py-2.5 px-4 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {summary.recent_sales.map((sale) => (
                      <tr key={sale.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-mono font-medium text-brand-800">
                          {sale.invoice_number}
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-semibold text-slate-800">{sale.customer_name}</p>
                          <p className="text-[10px] text-slate-400">{sale.customer_phone || 'No phone'}</p>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                            {sale.payment_mode}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-black text-slate-900">
                          ₹{formatCurrency(sale.grand_total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : showSkeleton ? (
            <div className="p-4 space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : !summary ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              Recent bills unavailable.
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400 text-xs">
              No bills yet. Tap "New Bill" to create one.
            </div>
          )}
        </div>

        {/* Right: Low Stock & Near Expiry Alerts */}
        <div className="lg:col-span-5 space-y-4">
          {/* Low Stock Alerts */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">
                  Low Stock ({summary?.low_stock_products?.length || 0})
                </h3>
              </div>
              <button
                onClick={() => navigate('/inventory?low_stock=true')}
                className="text-[11px] text-brand-700 font-semibold hover:underline"
              >
                Inventory
              </button>
            </div>

            <div className="space-y-2">
              {summary?.low_stock_products?.map((p) => (
                <div
                  key={p.id}
                  className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-200/70 flex items-center justify-between text-xs"
                >
                  <div className="overflow-hidden pr-2">
                    <p className="font-semibold text-slate-800 truncate">{p.name}</p>
                    <p className="text-[10px] text-slate-500">Min: {p.min_stock_level} {p.unit}</p>
                  </div>
                  <span className="font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-lg text-xs shrink-0">
                    {p.current_stock} {p.unit}
                  </span>
                </div>
              ))}
              {summary && (!summary.low_stock_products || summary.low_stock_products.length === 0) && (
                <p className="text-[11px] text-emerald-600 font-medium text-center py-2">
                  ✓ All stock levels are adequate
                </p>
              )}
              {showSkeleton && <Skeleton className="h-10 w-full" />}
            </div>
          </div>

          {/* Near Expiry Alerts */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-red-500" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">
                  Near Expiry ({summary?.near_expiry_products?.length || 0})
                </h3>
              </div>
              <button
                onClick={() => navigate('/inventory')}
                className="text-[11px] text-brand-700 font-semibold hover:underline"
              >
                Inspect
              </button>
            </div>

            <div className="space-y-2">
              {summary?.near_expiry_products?.map((p) => (
                <div
                  key={p.id}
                  className="p-2.5 rounded-xl bg-red-50/60 border border-red-200/70 flex items-center justify-between text-xs"
                >
                  <div className="overflow-hidden pr-2">
                    <p className="font-semibold text-slate-800 truncate">{p.name}</p>
                    <p className="text-[10px] font-mono text-red-700">Exp: {p.expiry_date}</p>
                  </div>
                  <span className="font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-lg text-xs shrink-0">
                    {p.current_stock} {p.unit}
                  </span>
                </div>
              ))}
              {summary && (!summary.near_expiry_products || summary.near_expiry_products.length === 0) && (
                <p className="text-[11px] text-emerald-600 font-medium text-center py-2">
                  ✓ No products near expiry
                </p>
              )}
              {showSkeleton && <Skeleton className="h-10 w-full" />}
            </div>
          </div>
        </div>
      </div>

      {/* OCR Scanner Modal */}
      <CameraScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onAddProductToBill={handleOcrAddProduct}
      />
    </div>
  );
};
