import React, { useRef } from 'react';
import { Printer, Download, X, CheckCircle, Share2 } from 'lucide-react';
import { Sale, ShopSettings } from '../../types';
import { salesApi } from '../../api';

interface InvoiceReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale | null;
  settings: ShopSettings;
}

export const InvoiceReceiptModal: React.FC<InvoiceReceiptModalProps> = ({
  isOpen,
  onClose,
  sale,
  settings,
}) => {
  if (!isOpen || !sale) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    window.open(salesApi.getPdfUrl(sale.id), '_blank');
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[95vh]">
        {/* Top Control Bar (Hidden on print) */}
        <div className="no-print px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <span className="font-bold text-sm">Invoice #{sale.invoice_number} Generated</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="bg-brand-600 hover:bg-brand-500 text-white font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs shadow transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print Bill
            </button>
            <button
              onClick={handleDownloadPdf}
              className="bg-slate-700 hover:bg-slate-600 text-white font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs shadow transition-colors"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Invoice Container */}
        <div className="overflow-y-auto p-6 sm:p-8 bg-white text-slate-900 text-xs" id="printable-invoice">
          {/* Header */}
          <div className="border-b-2 border-slate-900 pb-4 mb-4 text-center">
            <p className="text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1">
              TAX INVOICE / RETAIL CASH MEMO
            </p>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tight">
              {settings.shop_name}
            </h1>
            <p className="text-xs text-slate-600 mt-1 font-medium">
              {settings.address_line1}, {settings.city}, {settings.state} - {settings.pincode}
            </p>
            <p className="text-xs text-slate-600">
              Phone: <strong>{settings.phone}</strong> | Email: {settings.email || 'N/A'}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 mt-2 font-mono text-[11px] bg-slate-50 py-1.5 px-3 rounded-lg border border-slate-200">
              <span><strong>GSTIN:</strong> {settings.gstin}</span>
              {settings.fertilizer_license_no && (
                <span><strong>Fertilizer Lic:</strong> {settings.fertilizer_license_no}</span>
              )}
              {settings.pesticide_license_no && (
                <span><strong>Pesticide Lic:</strong> {settings.pesticide_license_no}</span>
              )}
            </div>
          </div>

          {/* Invoice Meta and Customer Info */}
          <div className="grid grid-cols-2 gap-4 mb-5 pb-3 border-b border-slate-200">
            <div>
              <p className="text-[10px] font-bold uppercase text-slate-400">Billed To (Customer):</p>
              <p className="font-bold text-sm text-slate-900">{sale.customer_name}</p>
              {sale.customer_phone && <p>Phone: {sale.customer_phone}</p>}
              {sale.customer_address && <p>Village/Address: {sale.customer_address}</p>}
              {sale.customer_aadhar && <p className="font-mono text-[11px]">Aadhar No: {sale.customer_aadhar}</p>}
              {sale.customer_gstin && <p className="font-mono text-[11px]">GSTIN: {sale.customer_gstin}</p>}
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase text-slate-400">Invoice Details:</p>
              <p className="font-mono font-bold text-sm text-brand-800">#{sale.invoice_number}</p>
              <p>Date: {new Date(sale.invoice_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
              <p>Payment Mode: <strong className="uppercase bg-slate-100 px-1.5 py-0.5 rounded">{sale.payment_mode}</strong></p>
              <p className="text-[11px] text-slate-500">Status: {sale.status}</p>
            </div>
          </div>

          {/* Items Table */}
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-left border border-slate-300">
              <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300 text-[11px]">
                <tr>
                  <th className="py-2 px-2 border-r border-slate-300 w-8">#</th>
                  <th className="py-2 px-2 border-r border-slate-300">Product / Fertilizer</th>
                  <th className="py-2 px-2 border-r border-slate-300">Batch & Exp</th>
                  <th className="py-2 px-2 border-r border-slate-300 text-center">HSN</th>
                  <th className="py-2 px-2 border-r border-slate-300 text-right">Qty</th>
                  <th className="py-2 px-2 border-r border-slate-300 text-right">Rate</th>
                  <th className="py-2 px-2 border-r border-slate-300 text-right">Taxable</th>
                  <th className="py-2 px-2 border-r border-slate-300 text-right">GST%</th>
                  <th className="py-2 px-2 text-right">Total (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {sale.items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="py-1.5 px-2 border-r border-slate-300 text-slate-500 text-center">{idx + 1}</td>
                    <td className="py-1.5 px-2 border-r border-slate-300 font-semibold">{item.product_name}</td>
                    <td className="py-1.5 px-2 border-r border-slate-300 font-mono text-[10px]">
                      {item.batch_number} {item.expiry_date ? `| Exp: ${item.expiry_date}` : ''}
                    </td>
                    <td className="py-1.5 px-2 border-r border-slate-300 font-mono text-center">{item.hsn_code}</td>
                    <td className="py-1.5 px-2 border-r border-slate-300 text-right font-bold">
                      {item.quantity} {item.unit}
                    </td>
                    <td className="py-1.5 px-2 border-r border-slate-300 text-right">₹{item.unit_price.toFixed(2)}</td>
                    <td className="py-1.5 px-2 border-r border-slate-300 text-right">₹{item.taxable_amount.toFixed(2)}</td>
                    <td className="py-1.5 px-2 border-r border-slate-300 text-right">{item.gst_rate}%</td>
                    <td className="py-1.5 px-2 text-right font-bold">₹{item.total_amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tax Summary & Grand Total */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div className="space-y-2">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-[11px] space-y-1">
                <p className="font-bold text-slate-800">GST Breakdown:</p>
                <div className="flex justify-between text-slate-600">
                  <span>Total Taxable Amount:</span>
                  <span>₹{sale.total_taxable.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>CGST:</span>
                  <span>₹{sale.total_cgst.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>SGST:</span>
                  <span>₹{sale.total_sgst.toFixed(2)}</span>
                </div>
                {sale.total_igst > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>IGST:</span>
                    <span>₹{sale.total_igst.toFixed(2)}</span>
                  </div>
                )}
              </div>

              {settings.bank_account_no && (
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-[10px] space-y-0.5">
                  <p className="font-bold text-slate-800">Bank Details for Transfer / RTGS:</p>
                  <p>Bank: {settings.bank_name} | A/C: {settings.bank_account_no}</p>
                  <p>IFSC: {settings.bank_ifsc} | UPI ID: {settings.upi_id}</p>
                </div>
              )}
            </div>

            <div className="space-y-1 text-right">
              <div className="flex justify-between py-1 border-b border-slate-100 text-slate-600">
                <span>Subtotal (Gross):</span>
                <span>₹{sale.subtotal.toFixed(2)}</span>
              </div>
              {sale.total_discount > 0 && (
                <div className="flex justify-between py-1 border-b border-slate-100 text-emerald-700">
                  <span>Discount:</span>
                  <span>-₹{sale.total_discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between py-1 border-b border-slate-100 text-slate-600">
                <span>GST Tax:</span>
                <span>₹{(sale.total_cgst + sale.total_sgst + sale.total_igst).toFixed(2)}</span>
              </div>
              {sale.round_off !== 0 && (
                <div className="flex justify-between py-1 border-b border-slate-100 text-slate-500">
                  <span>Round Off:</span>
                  <span>{sale.round_off > 0 ? `+₹${sale.round_off.toFixed(2)}` : `-₹${Math.abs(sale.round_off).toFixed(2)}`}</span>
                </div>
              )}
              <div className="flex justify-between py-2 border-t-2 border-slate-900 font-bold text-base text-slate-900">
                <span>Grand Total:</span>
                <span className="font-black text-lg text-brand-900">₹{sale.grand_total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Terms & Signature */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200 text-[10px] text-slate-500">
            <div>
              <p className="font-bold text-slate-700 uppercase mb-0.5">Terms & Conditions:</p>
              <p className="whitespace-pre-line">{settings.terms_conditions || '1. Goods sold will not be returned.\n2. Store in dry place.'}</p>
            </div>
            <div className="text-right pt-6">
              <p className="font-bold text-slate-800">For {settings.shop_name}</p>
              <div className="h-10"></div>
              <p className="border-t border-slate-300 inline-block pt-1 font-semibold">Authorized Signatory</p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="no-print p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Done / Close
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="bg-brand-700 hover:bg-brand-600 text-white font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 text-xs shadow transition-all"
            >
              <Printer className="w-4 h-4" />
              Print Invoice
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
