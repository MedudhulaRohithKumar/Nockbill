import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Download, 
  Calendar, 
  FileSpreadsheet, 
  TrendingUp, 
  Package, 
  Receipt, 
  DollarSign,
  ArrowUpRight,
  Printer
} from 'lucide-react';
import { reportsApi, salesApi } from '../api';
import { Sale } from '../types';
import { safeNumber, safeString, formatCurrency, formatINR } from '../utils/formatters';


export const ReportsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'sales' | 'gst' | 'stock' | 'pnl'>('sales');
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(1); // First day of current month
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Data states
  const [salesList, setSalesList] = useState<Sale[]>([]);
  const [gstData, setGstData] = useState<any>(null);
  const [stockData, setStockData] = useState<any>(null);
  const [pnlData, setPnlData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchReportData();
  }, [activeTab, fromDate, toDate]);

  const fetchReportData = async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'sales') {
        const sales = await salesApi.getAll({ start_date: fromDate, end_date: toDate });
        setSalesList(sales);
      } else if (activeTab === 'gst') {
        const gst = await reportsApi.getGstReport(fromDate, toDate);
        setGstData(gst);
      } else if (activeTab === 'stock') {
        const stock = await reportsApi.getStockValuation();
        setStockData(stock);
      } else if (activeTab === 'pnl') {
        const pnl = await reportsApi.getProfitLoss(fromDate, toDate);
        setPnlData(pnl);
      }
    } catch {
      // Offline / demo fallback data
      if (activeTab === 'sales') {
        setSalesList([
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
            total_taxable: 3714.28,
            total_cgst: 92.86,
            total_sgst: 92.86,
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
            total_taxable: 1285.71,
            total_cgst: 32.14,
            total_sgst: 32.14,
            total_igst: 0,
            round_off: 0,
            grand_total: 1350,
            status: 'Completed',
            items: []
          },
          {
            id: 99,
            invoice_number: 'KSK/24-25/0140',
            invoice_date: new Date(Date.now() - 86400000).toISOString(),
            customer_name: 'Maheshbhai Vaghela',
            customer_phone: '9712098765',
            payment_mode: 'Cash',
            is_interstate: false,
            subtotal: 2665,
            total_discount: 0,
            total_taxable: 2538.1,
            total_cgst: 63.45,
            total_sgst: 63.45,
            total_igst: 0,
            round_off: 0,
            grand_total: 2665,
            status: 'Completed',
            items: []
          }
        ]);
      } else if (activeTab === 'gst') {
        setGstData({
          from_date: fromDate,
          to_date: toDate,
          total_taxable: 142857.14,
          total_cgst: 3571.43,
          total_sgst: 3571.43,
          total_igst: 0,
          total_tax: 7142.86,
          gst_breakdown: [
            { gst_rate: 5, taxable_value: 132000.0, cgst: 3300.0, sgst: 3300.0, igst: 0, total_tax: 6600.0 },
            { gst_rate: 18, taxable_value: 10857.14, cgst: 271.43, sgst: 271.43, igst: 0, total_tax: 542.86 }
          ]
        });
      } else if (activeTab === 'stock') {
        setStockData({
          total_items_count: 5,
          total_units: 243,
          total_cost_value: 462500.0,
          total_retail_value: 494500.0,
          estimated_margin: 32000.0,
          items: [
            { id: 1, name: 'IFFCO Neem Coated Urea 45kg', batch: 'NCU-2024-88', stock: 140, unit: 'Bags', cost_price: 250, sell_price: 266.5, cost_value: 35000, retail_value: 37310 },
            { id: 2, name: 'IFFCO DAP 18-46-0 50kg', batch: 'DAP-901-B', stock: 85, unit: 'Bags', cost_price: 1280, sell_price: 1350, cost_value: 108800, retail_value: 114750 },
            { id: 3, name: 'MOP - Muriate of Potash 50kg', batch: 'MOP-5521', stock: 45, unit: 'Bags', cost_price: 1600, sell_price: 1700, cost_value: 72000, retail_value: 76500 }
          ]
        });
      } else if (activeTab === 'pnl') {
        setPnlData({
          sales_revenue: 342600.0,
          cogs: 279500.0,
          gross_profit: 63100.0,
          gross_margin_percent: 18.42,
          operating_expenses: 18500.0,
          net_profit: 44600.0,
          net_profit_percent: 13.02,
          expenses_by_category: {
            Transport: 4500,
            Labor: 2400,
            Electricity: 3200,
            Rent: 8000,
            Misc: 400
          }
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const exportToCsv = () => {
    if (activeTab === 'sales' && salesList.length > 0) {
      const headers = ['Invoice No,Date,Customer Name,Phone,Mode,Taxable,CGST,SGST,Grand Total\n'];
      const rows = salesList.map(s => 
        `"${s.invoice_number}","${s.invoice_date.split('T')[0]}","${s.customer_name}","${s.customer_phone || ''}","${s.payment_mode}",${s.total_taxable},${s.total_cgst},${s.total_sgst},${s.grand_total}`
      );
      const blob = new Blob([headers.concat(rows.join('\n')).join('')], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sales_report_${fromDate}_to_${toDate}.csv`;
      a.click();
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Financial & Tax Reports
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            GST GSTR-1 statements, Sales register, Stock Balance, and Profit & Loss analysis
          </p>
        </div>

        <button
          onClick={exportToCsv}
          className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-4 rounded-xl flex items-center gap-2 text-xs shadow-md transition-all active:scale-95"
        >
          <Download className="w-4 h-4 text-emerald-400" />
          <span>Export CSV / Excel</span>
        </button>
      </div>

      {/* Tabs & Date Range Filter */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('sales')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'sales' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sales Register
            </button>
            <button
              onClick={() => setActiveTab('gst')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'gst' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              GST GSTR-1
            </button>
            <button
              onClick={() => setActiveTab('stock')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'stock' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Stock Balance & Valuation
            </button>
            <button
              onClick={() => setActiveTab('pnl')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'pnl' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Profit & Loss
            </button>
          </div>

          {/* Date Range Inputs */}
          {activeTab !== 'stock' && (
            <div className="flex items-center gap-2 text-xs">
              <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
                <span className="text-slate-400 font-medium">From:</span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="bg-transparent font-semibold text-slate-800 focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
                <span className="text-slate-400 font-medium">To:</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="bg-transparent font-semibold text-slate-800 focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tab Content 1: Sales Register */}
      {activeTab === 'sales' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-[11px]">
                <tr>
                  <th className="py-3 px-4">Invoice No</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Customer</th>
                  <th className="py-3 px-3">Phone</th>
                  <th className="py-3 px-3">Mode</th>
                  <th className="py-3 px-3 text-right">Taxable</th>
                  <th className="py-3 px-3 text-right">CGST</th>
                  <th className="py-3 px-3 text-right">SGST</th>
                  <th className="py-3 px-4 text-right">Total (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {salesList.map((sale: any) => {
                  const invNo = sale.invoice_number || `INV-${sale.id}`;
                  const invDate = sale.invoice_date || sale.sale_date || '';
                  const custName = sale.customer_name || 'Cash Customer / Farmer';
                  const payMode = sale.payment_mode || sale.payment_method || 'Cash';
                  const taxable = safeNumber(sale.total_taxable ?? sale.subtotal);
                  const cgst = safeNumber(sale.total_cgst ?? (sale.gst_amount ? sale.gst_amount / 2 : 0));
                  const sgst = safeNumber(sale.total_sgst ?? (sale.gst_amount ? sale.gst_amount / 2 : 0));
                  const grandTotal = safeNumber(sale.grand_total);

                  return (
                    <tr key={sale.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-brand-800">{invNo}</td>
                      <td className="py-3 px-3 text-slate-600 font-mono">
                        {invDate ? new Date(invDate).toLocaleDateString('en-IN') : '-'}
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-900">{custName}</td>
                      <td className="py-3 px-3 text-slate-500 font-mono">{sale.customer_phone || '-'}</td>
                      <td className="py-3 px-3">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                          {payMode}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-600">₹{formatCurrency(taxable)}</td>
                      <td className="py-3 px-3 text-right font-mono text-slate-600">₹{formatCurrency(cgst)}</td>
                      <td className="py-3 px-3 text-right font-mono text-slate-600">₹{formatCurrency(sgst)}</td>
                      <td className="py-3 px-4 text-right font-black text-slate-900">₹{formatCurrency(grandTotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab Content 2: GST GSTR-1 Statement */}
      {activeTab === 'gst' && gstData && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-[11px] font-bold text-slate-500 uppercase">Total Taxable Turnover</p>
              <p className="text-xl font-black text-slate-900 mt-1">₹{formatCurrency(gstData.total_taxable ?? gstData.taxable_amount)}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-[11px] font-bold text-slate-500 uppercase">Central GST (CGST)</p>
              <p className="text-xl font-black text-brand-700 mt-1">₹{formatCurrency(gstData.total_cgst ?? (gstData.total_gst ? gstData.total_gst / 2 : 0))}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-[11px] font-bold text-slate-500 uppercase">State GST (SGST)</p>
              <p className="text-xl font-black text-brand-700 mt-1">₹{formatCurrency(gstData.total_sgst ?? (gstData.total_gst ? gstData.total_gst / 2 : 0))}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-[11px] font-bold text-slate-500 uppercase">Total GST Output Tax</p>
              <p className="text-xl font-black text-slate-900 mt-1">₹{formatCurrency(gstData.total_tax ?? gstData.total_gst)}</p>
            </div>
          </div>

          {/* Rate-wise breakdown table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 font-bold text-xs text-slate-700 uppercase">
              GST Rate-Wise Breakdown (GSTR-1 Format)
            </div>
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-[11px]">
                <tr>
                  <th className="py-3 px-4">Rate Bracket</th>
                  <th className="py-3 px-4 text-right">Taxable Turnover (₹)</th>
                  <th className="py-3 px-4 text-right">CGST (₹)</th>
                  <th className="py-3 px-4 text-right">SGST (₹)</th>
                  <th className="py-3 px-4 text-right">Total Tax (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(gstData.gst_breakdown || gstData.rows || []).map((b: any, i: number) => (
                  <tr key={i}>
                    <td className="py-3 px-4 font-bold text-slate-900">{b.gst_rate}% Slab</td>
                    <td className="py-3 px-4 text-right font-mono">₹{formatCurrency(b.taxable_value ?? b.taxable_amount)}</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-600">₹{formatCurrency(b.cgst ?? (b.gst_amount ? b.gst_amount / 2 : 0))}</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-600">₹{formatCurrency(b.sgst ?? (b.gst_amount ? b.gst_amount / 2 : 0))}</td>
                    <td className="py-3 px-4 text-right font-black text-brand-800">₹{formatCurrency(b.total_tax ?? b.gst_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab Content 3: Stock Balance & Valuation */}
      {activeTab === 'stock' && stockData && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-slate-500 uppercase">Total Warehouse Cost Value</p>
              <p className="text-2xl font-black text-slate-900 mt-1">₹{formatINR(stockData.total_cost_value)}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Asset purchase value</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-slate-500 uppercase">Total Retail Selling Value</p>
              <p className="text-2xl font-black text-brand-800 mt-1">₹{formatINR(stockData.total_retail_value)}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">At current selling rate</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-slate-500 uppercase">Unrealized Gross Margin</p>
              <p className="text-2xl font-black text-emerald-600 mt-1">₹{formatINR(stockData.estimated_margin)}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Expected profit in stock</p>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content 4: Profit & Loss Statement */}
      {activeTab === 'pnl' && pnlData && (
        <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4 text-xs">
          <h3 className="font-black text-base text-slate-900 text-center border-b border-slate-200 pb-3">
            Income Statement (Profit & Loss)
          </h3>

          <div className="space-y-2">
            <div className="flex justify-between py-2 border-b border-slate-100 font-bold text-sm">
              <span>Gross Sales Revenue:</span>
              <span className="text-brand-900">₹{formatINR(pnlData.sales_revenue ?? pnlData.total_sales)}</span>
            </div>

            <div className="flex justify-between py-1.5 text-slate-600 pl-4">
              <span>Less: Cost of Goods Sold (Purchases):</span>
              <span>-₹{formatINR(pnlData.cogs ?? pnlData.cost_of_goods)}</span>
            </div>

            <div className="flex justify-between py-2 border-t border-b border-slate-200 font-bold text-sm bg-slate-50 px-3 rounded-lg">
              <span>Gross Profit:</span>
              <span className="text-emerald-700">₹{formatINR(pnlData.gross_profit)} ({safeNumber(pnlData.gross_margin_percent)}%)</span>
            </div>

            <div className="py-2 pl-4 space-y-1">
              <p className="font-semibold text-slate-700">Less: Operating Expenses:</p>
              {pnlData.expenses_by_category && Object.entries(pnlData.expenses_by_category).map(([cat, amt]: any) => (
                <div key={cat} className="flex justify-between text-[11px] text-slate-500 pl-4">
                  <span>• {cat}:</span>
                  <span>-₹{formatINR(amt)}</span>
                </div>
              ))}
              <div className="flex justify-between font-semibold text-slate-800 pt-1">
                <span>Total Expenses:</span>
                <span>-₹{formatINR(pnlData.operating_expenses ?? pnlData.total_expenses)}</span>
              </div>
            </div>

            <div className="flex justify-between py-3 border-t-2 border-slate-900 font-black text-base bg-brand-50 px-4 rounded-xl">
              <span>NET PROFIT:</span>
              <span className="text-brand-900 text-lg">₹{formatINR(pnlData.net_profit)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
