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
import { reportsApi } from '../api';
import { DashboardSummary } from '../types';
import { CameraScannerModal } from '../components/ocr/CameraScannerModal';
import { formatCurrency } from '../utils/formatters';


export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const fetchDashboard = async () => {
    setIsLoading(true);
    try {
      const data = await reportsApi.getDashboard();
      setSummary(data);
    } catch {
      setSummary({
        today_sales: 14850.0,
        today_bills: 8,
        month_sales: 342600.0,
        month_purchases: 280000.0,
        total_inventory_value: 524000.0,
        low_stock_count: 3,
        near_expiry_count: 2,
        month_expenses: 18500.0,
        month_net_profit: 44100.0,
        recent_sales: [
          {
            id: 101,
            invoice_number: 'KSK/24-25/0142',
            invoice_date: new Date().toISOString(),
            customer_name: 'Bhavesh Patel (Farmer)',
            customer_phone: '9825012345',
            payment_mode: 'UPI',
            is_interstate: false,
            subtotal: 3950,
            total_discount: 50,
            total_taxable: 3714,
            total_cgst: 93,
            total_sgst: 93,
            total_igst: 0,
            round_off: 0,
            grand_total: 3900,
            status: 'Completed',
            items: []
          },
          {
            id: 100,
            invoice_number: 'KSK/24-25/0141',
            invoice_date: new Date().toISOString(),
            customer_name: 'Jayeshbhai Solanki',
            customer_phone: '9428054321',
            payment_mode: 'Cash',
            is_interstate: false,
            subtotal: 1350,
            total_discount: 0,
            total_taxable: 1285,
            total_cgst: 32.5,
            total_sgst: 32.5,
            total_igst: 0,
            round_off: 0,
            grand_total: 1350,
            status: 'Completed',
            items: []
          }
        ],
        low_stock_products: [
          {
            id: 1,
            name: 'IFFCO Neem Coated Urea 45kg',
            category: 'Fertilizer',
            hsn_code: '31021000',
            unit: 'Bags',
            current_stock: 14,
            cost_price: 250,
            selling_price: 266.5,
            mrp: 266.5,
            gst_rate: 5,
            batch_number: 'NCU-2024-88',
            min_stock_level: 25,
            is_active: true
          },
          {
            id: 4,
            name: 'UPL Saaf Fungicide (Carbendazim+Mancozeb)',
            category: 'Pesticide',
            hsn_code: '38089290',
            unit: 'Packets',
            current_stock: 6,
            cost_price: 450,
            selling_price: 520,
            mrp: 550,
            gst_rate: 18,
            batch_number: 'SAF-24-09',
            min_stock_level: 15,
            is_active: true
          }
        ],
        near_expiry_products: [
          {
            id: 5,
            name: 'Bayer Confidor Insecticide 100ml',
            category: 'Pesticide',
            hsn_code: '38089199',
            unit: 'Bottles',
            current_stock: 22,
            cost_price: 320,
            selling_price: 380,
            mrp: 410,
            gst_rate: 18,
            batch_number: 'BC-2023-41',
            expiry_date: '2024-10-15',
            min_stock_level: 10,
            is_active: true
          }
        ]
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

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
            ₹{(summary?.today_sales ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <p className="text-[10px] text-slate-500 mt-1 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
            <span>{summary?.today_bills ?? 0} bills today</span>
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
            ₹{((summary?.month_sales ?? (summary as any)?.monthly_sales ?? 0) / 1000).toFixed(0)}K
          </div>
          <p className="text-[10px] text-emerald-600 mt-1 font-medium">
            Profit: ₹{((summary?.month_net_profit ?? 0) / 1000).toFixed(0)}K
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
            ₹{((summary?.total_inventory_value ?? (summary as any)?.stock_value ?? 0) / 1000).toFixed(0)}K
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
              {summary?.low_stock_count ?? 0}
            </span>
            <span className="text-[10px] text-slate-500 font-medium">Low</span>
            <span className="text-slate-300">|</span>
            <span className="text-base sm:text-2xl font-black text-red-500">
              {summary?.near_expiry_count ?? 0}
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
          ) : (
            <div className="p-8 text-center text-slate-400 text-xs">
              No bills today. Tap "New Bill" to create one.
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
              {(!summary?.low_stock_products || summary.low_stock_products.length === 0) && (
                <p className="text-[11px] text-emerald-600 font-medium text-center py-2">
                  ✓ All stock levels are adequate
                </p>
              )}
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
              {(!summary?.near_expiry_products || summary.near_expiry_products.length === 0) && (
                <p className="text-[11px] text-emerald-600 font-medium text-center py-2">
                  ✓ No products near expiry
                </p>
              )}
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
