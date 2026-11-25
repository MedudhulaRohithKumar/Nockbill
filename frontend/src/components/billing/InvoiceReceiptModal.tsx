import React, { useEffect, useState } from 'react';
import { Printer, Download, X, CheckCircle, Share2, QrCode, Truck } from 'lucide-react';
import { Sale, ShopSettings, InvoiceTemplateId } from '../../types';
import { salesApi, settingsApi } from '../../api';
import api from '../../api/client';
import { safeNumber, formatCurrency, buildWhatsAppInvoiceUrl } from '../../utils/formatters';
import { EWayBillModal } from './EWayBillModal';

interface InvoiceDocumentViewProps {
  sale: Sale;
  settings: ShopSettings;
}

export const InvoiceDocumentView: React.FC<InvoiceDocumentViewProps> = ({ sale, settings }) => {
  const template: InvoiceTemplateId = settings.invoice_template || 'CLASSIC_GST';
  const accentColor = settings.invoice_accent_color || '#15803d';
  const showLogo = settings.invoice_show_logo !== false && Boolean(settings.logo_path);
  const showLicenses = settings.invoice_show_licenses !== false;
  const showBank = settings.invoice_show_bank_details !== false && Boolean(settings.bank_account_no || settings.upi_id);
  const showBatch = settings.invoice_show_batch_expiry !== false;
  const showHsn = settings.invoice_show_hsn !== false;
  const signatureLabel = settings.invoice_signature_label || 'Authorized Signatory';
  const footerNote = settings.invoice_footer_note || 'Thank you for your business! Visit again.';

  const [upiQrSvg, setUpiQrSvg] = useState<string | null>(null);

  useEffect(() => {
    const vpa = (settings.upi_id || '').trim();
    if (!showBank || !vpa) {
      setUpiQrSvg(null);
      return;
    }
    let active = true;
    settingsApi
      .getUpiQr({
        amount: safeNumber(sale.grand_total, 0),
        invoice_number: sale.invoice_number,
        upi_id: vpa,
      })
      .then((res) => {
        if (active && res?.qr_svg_data_uri) {
          setUpiQrSvg(res.qr_svg_data_uri);
        }
      })
      .catch(() => {
        if (active) setUpiQrSvg(null);
      });
    return () => {
      active = false;
    };
  }, [showBank, settings.upi_id, sale.grand_total, sale.invoice_number]);
  const formattedDate =
    sale.invoice_date || sale.sale_date
      ? new Date((sale.invoice_date || sale.sale_date) as string).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      : 'N/A';
  const paymentDisplay =
    sale.notes && (sale.notes.includes('Split Payment:') || sale.notes.includes('Payment Split:'))
      ? sale.notes.replace(/Payment Split:|Split Payment:/g, '').trim()
      : sale.payment_mode || sale.payment_method || 'CASH';

  const totalGst =
    sale.gst_amount ??
    safeNumber(sale.total_cgst) + safeNumber(sale.total_sgst) + safeNumber(sale.total_igst);

  if (template === 'THERMAL_80MM') {
    return (
      <div className="max-w-xs mx-auto bg-white text-slate-900 font-mono text-[11px] p-4 border border-dashed border-slate-300 rounded-xl shadow-sm">
        <div className="text-center border-b border-dashed border-slate-400 pb-2.5 mb-2.5 space-y-1">
          {showLogo && settings.logo_path && (
            <img
              src={settings.logo_path}
              alt={settings.shop_name}
              className="h-10 max-w-[140px] object-contain mx-auto mb-1"
            />
          )}
          <div className="font-black text-sm uppercase tracking-tight" style={{ color: accentColor }}>
            {settings.shop_name}
          </div>
          {settings.invoice_header_tagline && (
            <div className="text-[10px] text-slate-600">{settings.invoice_header_tagline}</div>
          )}
          <div className="text-[10px] text-slate-600">
            {[settings.address_line1, settings.city, settings.pincode].filter(Boolean).join(', ')}
          </div>
          {settings.phone && <div className="text-[10px]">Ph: {settings.phone}</div>}
          {settings.gstin && <div className="text-[10px] font-bold">GSTIN: {settings.gstin}</div>}
          {showLicenses && settings.fertilizer_license_no && (
            <div className="text-[9px] text-slate-500">Fert Lic: {settings.fertilizer_license_no}</div>
          )}
        </div>

        <div className="border-b border-dashed border-slate-400 pb-2 mb-2 text-[10px] space-y-0.5">
          <div className="flex justify-between">
            <span>BILL: #{sale.invoice_number}</span>
            <span>{formattedDate}</span>
          </div>
          <div className="flex justify-between">
            <span className="truncate">CUST: {sale.customer_name || 'Walk-in'}</span>
            <span>{paymentDisplay}</span>
          </div>
          {sale.customer_phone && <div>MOB: {sale.customer_phone}</div>}
        </div>

        <div className="border-b border-dashed border-slate-400 pb-2 mb-2 space-y-1.5">
          <div className="flex justify-between font-bold text-[10px] border-b border-slate-200 pb-1">
            <span>ITEM</span>
            <span>QTY x RATE = AMT</span>
          </div>
          {sale.items.map((item, idx) => (
            <div key={idx} className="text-[10px]">
              <div className="font-bold text-slate-900">
                {idx + 1}. {item.product_name}
              </div>
              {showBatch && item.batch_number && (
                <div className="text-[9px] text-slate-500">
                  Batch: {item.batch_number} {item.expiry_date ? `| Exp: ${item.expiry_date}` : ''}
                </div>
              )}
              <div className="flex justify-between text-slate-700">
                <span>
                  {item.quantity} {item.unit || 'u'} x ₹{formatCurrency(item.unit_price ?? item.price)} ({safeNumber(item.gst_rate)}% GST)
                </span>
                <span className="font-bold">₹{formatCurrency(item.total_amount ?? item.total)}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-1 text-[10px] border-b border-dashed border-slate-400 pb-2 mb-2">
          <div className="flex justify-between">
            <span>Taxable Subtotal:</span>
            <span>₹{formatCurrency(sale.total_taxable ?? sale.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>CGST + SGST:</span>
            <span>₹{formatCurrency(totalGst)}</span>
          </div>
          {safeNumber(sale.total_discount) > 0 && (
            <div className="flex justify-between text-emerald-700">
              <span>Discount:</span>
              <span>-₹{formatCurrency(sale.total_discount)}</span>
            </div>
          )}
          <div
            className="flex justify-between font-black text-xs pt-1 border-t border-slate-300"
            style={{ color: accentColor }}
          >
            <span>GRAND TOTAL:</span>
            <span>₹{formatCurrency(sale.grand_total)}</span>
          </div>
        </div>

        {showBank && settings.upi_id && (
          <div className="text-center text-[10px] border-b border-dashed border-slate-300 pb-2 mb-1.5 space-y-1">
            <div>
              Scan to Pay via UPI: <strong>{settings.upi_id}</strong>
            </div>
            {upiQrSvg && (
              <img
                src={upiQrSvg}
                alt="Dynamic UPI Payment QR"
                className="w-28 h-28 mx-auto border border-slate-200 rounded-lg p-1 bg-white"
              />
            )}
          </div>
        )}
        <div className="text-center text-[9px] text-slate-500 space-y-1">
          <p className="whitespace-pre-line">{settings.terms_conditions}</p>
          <p className="font-bold text-slate-700 pt-1">{footerNote}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-white text-slate-900 text-xs ${
        template === 'COMPACT_RETAIL' ? 'p-4 border border-slate-300 rounded-xl' : ''
      }`}
    >
      {/* Header Variant 1: MODERN_CORPORATE */}
      {template === 'MODERN_CORPORATE' && (
        <div className="mb-5 rounded-2xl overflow-hidden border border-slate-200">
          <div
            className="p-4 sm:p-5 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
            style={{ backgroundColor: accentColor }}
          >
            <div className="flex items-center gap-3.5">
              {showLogo && settings.logo_path && (
                <div className="bg-white p-2 rounded-xl shadow-sm shrink-0">
                  <img
                    src={settings.logo_path}
                    alt={settings.shop_name}
                    className="h-12 w-auto max-w-[120px] object-contain"
                  />
                </div>
              )}
              <div>
                <span className="text-[10px] uppercase tracking-widest font-bold opacity-85 block">
                  GST Tax Invoice
                </span>
                <h1 className="text-lg sm:text-2xl font-black tracking-tight uppercase">
                  {settings.shop_name}
                </h1>
                {settings.invoice_header_tagline && (
                  <p className="text-[11px] opacity-90 mt-0.5">{settings.invoice_header_tagline}</p>
                )}
              </div>
            </div>
            <div className="sm:text-right bg-black/20 backdrop-blur-sm px-3.5 py-2.5 rounded-xl border border-white/15">
              <div className="text-[10px] uppercase tracking-wider opacity-80">Invoice No.</div>
              <div className="font-mono font-black text-sm sm:text-base">#{sale.invoice_number}</div>
              <div className="text-[11px] opacity-90">Date: {formattedDate}</div>
            </div>
          </div>
          <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
            <span>
              {[settings.address_line1, settings.city, settings.state, settings.pincode]
                .filter(Boolean)
                .join(', ')}
            </span>
            <span>
              Ph: <strong>{settings.phone || 'N/A'}</strong>
              {settings.gstin ? ` | GSTIN: ${settings.gstin}` : ''}
            </span>
          </div>
          {showLicenses &&
            (settings.fertilizer_license_no || settings.pesticide_license_no || settings.seed_license_no) && (
              <div className="px-4 py-1.5 bg-white border-t border-slate-100 flex flex-wrap gap-4 text-[10px] font-mono text-slate-600">
                {settings.fertilizer_license_no && (
                  <span>
                    <strong>Fertilizer Lic:</strong> {settings.fertilizer_license_no}
                  </span>
                )}
                {settings.pesticide_license_no && (
                  <span>
                    <strong>Pesticide Lic:</strong> {settings.pesticide_license_no}
                  </span>
                )}
                {settings.seed_license_no && (
                  <span>
                    <strong>Seed Lic:</strong> {settings.seed_license_no}
                  </span>
                )}
              </div>
            )}
        </div>
      )}

      {/* Header Variant 2: COMPACT_RETAIL */}
      {template === 'COMPACT_RETAIL' && (
        <div
          className="border-b-2 pb-3 mb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
          style={{ borderColor: accentColor }}
        >
          <div className="flex items-center gap-3">
            {showLogo && settings.logo_path && (
              <img
                src={settings.logo_path}
                alt={settings.shop_name}
                className="h-11 w-auto max-w-[110px] object-contain"
              />
            )}
            <div>
              <h1 className="text-base sm:text-lg font-black uppercase" style={{ color: accentColor }}>
                {settings.shop_name}
              </h1>
              {settings.invoice_header_tagline && (
                <p className="text-[10px] text-slate-500">{settings.invoice_header_tagline}</p>
              )}
              <p className="text-[10px] text-slate-600">
                {[settings.address_line1, settings.city, settings.pincode].filter(Boolean).join(', ')} | Ph:{' '}
                <strong>{settings.phone}</strong>
              </p>
            </div>
          </div>
          <div className="sm:text-right font-mono text-[11px]">
            <div className="font-bold text-slate-900">TAX INVOICE #{sale.invoice_number}</div>
            <div className="text-slate-600">Date: {formattedDate}</div>
            {settings.gstin && <div className="text-[10px] text-slate-500">GSTIN: {settings.gstin}</div>}
          </div>
        </div>
      )}

      {/* Header Variant 3: CLASSIC_GST (Default) */}
      {template === 'CLASSIC_GST' && (
        <div className="border-b-2 pb-4 mb-4 text-center" style={{ borderColor: accentColor }}>
          <p className="text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1">
            TAX INVOICE / RETAIL CASH MEMO
          </p>
          {showLogo && settings.logo_path && (
            <img
              src={settings.logo_path}
              alt={settings.shop_name}
              className="h-14 w-auto max-w-[160px] object-contain mx-auto my-1.5"
            />
          )}
          <h1
            className="text-lg sm:text-2xl font-black uppercase tracking-tight"
            style={{ color: accentColor }}
          >
            {settings.shop_name}
          </h1>
          {settings.invoice_header_tagline && (
            <p className="text-[11px] font-semibold text-slate-600 mt-0.5">
              {settings.invoice_header_tagline}
            </p>
          )}
          <p className="text-[11px] sm:text-xs text-slate-600 mt-1 font-medium">
            {[settings.address_line1, settings.city, settings.state, settings.pincode]
              .filter(Boolean)
              .join(', ')}
          </p>
          <p className="text-[11px] sm:text-xs text-slate-600">
            Phone: <strong>{settings.phone}</strong> | Email: {settings.email || 'N/A'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 mt-2 font-mono text-[10px] sm:text-[11px] bg-slate-50 py-1.5 px-3 rounded-lg border border-slate-200">
            <span>
              <strong>GSTIN:</strong> {settings.gstin || 'UNREGISTERED'}
            </span>
            {showLicenses && settings.fertilizer_license_no && (
              <span>
                <strong>Fertilizer Lic:</strong> {settings.fertilizer_license_no}
              </span>
            )}
            {showLicenses && settings.pesticide_license_no && (
              <span>
                <strong>Pesticide Lic:</strong> {settings.pesticide_license_no}
              </span>
            )}
            {showLicenses && settings.seed_license_no && (
              <span>
                <strong>Seed Lic:</strong> {settings.seed_license_no}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Invoice Meta and Customer Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4 pb-3 border-b border-slate-200">
        <div>
          <p className="text-[10px] font-bold uppercase text-slate-400">Billed To (Customer):</p>
          <p className="font-bold text-sm text-slate-900">{sale.customer_name}</p>
          {sale.customer_phone && <p>Phone: {sale.customer_phone}</p>}
          {sale.customer_address && <p>Village/Address: {sale.customer_address}</p>}
          {sale.customer_aadhar && <p className="font-mono text-[11px]">Aadhar No: {sale.customer_aadhar}</p>}
          {sale.customer_gstin && <p className="font-mono text-[11px]">GSTIN: {sale.customer_gstin}</p>}
        </div>
        <div className="sm:text-right">
          <p className="text-[10px] font-bold uppercase text-slate-400">Invoice Details:</p>
          <p className="font-mono font-bold text-sm" style={{ color: accentColor }}>
            #{sale.invoice_number}
          </p>
          <p>Date: {formattedDate}</p>
          <div className="flex sm:justify-end items-center gap-1.5 flex-wrap my-0.5">
            <span className="text-slate-500">Payment:</span>
            <span className="font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded text-[11px]">
              {paymentDisplay}
            </span>
          </div>
          <p className="text-[11px] text-slate-500">Status: {sale.status || 'Completed'}</p>
          {sale.eway_bill_no && (
            <p className="text-[11px] font-mono text-emerald-800 font-bold mt-0.5">
              E-Way Bill: {sale.eway_bill_no}
            </p>
          )}
          {sale.vehicle_no && (
            <p className="text-[11px] font-mono text-slate-700">
              Vehicle No: {sale.vehicle_no}
            </p>
          )}
        </div>
      </div>

      {/* Items Table */}
      <div className="overflow-x-auto mb-4">
        <table className="w-full text-left border border-slate-300">
          <thead
            className="font-bold border-b border-slate-300 text-[11px]"
            style={
              template === 'MODERN_CORPORATE'
                ? { backgroundColor: accentColor, color: '#ffffff' }
                : { backgroundColor: '#f1f5f9', color: '#1e293b' }
            }
          >
            <tr>
              <th className="py-2 px-2 border-r border-slate-300/60 w-8">#</th>
              <th className="py-2 px-2 border-r border-slate-300/60">Product / Description</th>
              {showBatch && <th className="py-2 px-2 border-r border-slate-300/60">Batch &amp; Exp</th>}
              {showHsn && <th className="py-2 px-2 border-r border-slate-300/60 text-center">HSN</th>}
              <th className="py-2 px-2 border-r border-slate-300/60 text-right">Qty</th>
              <th className="py-2 px-2 border-r border-slate-300/60 text-right">Rate</th>
              <th className="py-2 px-2 border-r border-slate-300/60 text-right">Taxable</th>
              <th className="py-2 px-2 border-r border-slate-300/60 text-right">GST%</th>
              <th className="py-2 px-2 text-right">Total (₹)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {sale.items.map((item, idx) => (
              <tr key={idx} className="hover:bg-slate-50/50">
                <td className="py-1.5 px-2 border-r border-slate-300 text-slate-500 text-center">{idx + 1}</td>
                <td className="py-1.5 px-2 border-r border-slate-300 font-semibold">{item.product_name}</td>
                {showBatch && (
                  <td className="py-1.5 px-2 border-r border-slate-300 font-mono text-[10px]">
                    {item.batch_number || '-'} {item.expiry_date ? `| Exp: ${item.expiry_date}` : ''}
                  </td>
                )}
                {showHsn && (
                  <td className="py-1.5 px-2 border-r border-slate-300 font-mono text-center">
                    {item.hsn_code || '31021000'}
                  </td>
                )}
                <td className="py-1.5 px-2 border-r border-slate-300 text-right font-bold">
                  {item.quantity} {item.unit || 'Bags'}
                </td>
                <td className="py-1.5 px-2 border-r border-slate-300 text-right">
                  ₹{formatCurrency(item.unit_price ?? item.price)}
                </td>
                <td className="py-1.5 px-2 border-r border-slate-300 text-right">
                  ₹
                  {formatCurrency(
                    item.taxable_amount ??
                      safeNumber(item.unit_price ?? item.price) * safeNumber(item.quantity, 1),
                  )}
                </td>
                <td className="py-1.5 px-2 border-r border-slate-300 text-right">
                  {safeNumber(item.gst_rate)}%
                </td>
                <td className="py-1.5 px-2 text-right font-bold">
                  ₹{formatCurrency(item.total_amount ?? item.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tax Summary & Grand Total */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-5">
        <div className="space-y-2">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-[11px] space-y-1">
            <p className="font-bold text-slate-800">GST Breakdown:</p>
            <div className="flex justify-between text-slate-600">
              <span>Total Taxable Amount:</span>
              <span>₹{formatCurrency(sale.total_taxable ?? sale.subtotal)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>CGST:</span>
              <span>₹{formatCurrency(sale.total_cgst ?? safeNumber(sale.gst_amount) / 2)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>SGST:</span>
              <span>₹{formatCurrency(sale.total_sgst ?? safeNumber(sale.gst_amount) / 2)}</span>
            </div>
            {safeNumber(sale.total_igst) > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>IGST:</span>
                <span>₹{formatCurrency(sale.total_igst)}</span>
              </div>
            )}
          </div>

          {showBank && (
            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-[10px] flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <p className="font-bold text-slate-800 flex items-center gap-1">
                  <QrCode className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Bank &amp; Instant UPI QR Payment:</span>
                </p>
                {settings.bank_account_no && (
                  <p>
                    Bank: {settings.bank_name || '-'} | A/C: {settings.bank_account_no}
                  </p>
                )}
                <p>
                  {settings.bank_ifsc ? `IFSC: ${settings.bank_ifsc}` : ''}
                  {settings.bank_ifsc && settings.upi_id ? ' | ' : ''}
                  {settings.upi_id ? `UPI ID: ${settings.upi_id}` : ''}
                </p>
                {settings.upi_id && (
                  <p className="text-[9px] text-emerald-700 font-semibold">
                    Scan QR with GPay / PhonePe / Paytm for ₹{formatCurrency(sale.grand_total)}
                  </p>
                )}
              </div>
              {upiQrSvg && (
                <img
                  src={upiQrSvg}
                  alt="Dynamic UPI Payment QR"
                  className="w-20 h-20 shrink-0 border border-slate-200 rounded-lg p-1 bg-white"
                />
              )}
            </div>
          )}
        </div>

        <div className="space-y-1 sm:text-right bg-slate-50 sm:bg-transparent p-3 sm:p-0 rounded-lg border sm:border-0 border-slate-200">
          <div className="flex justify-between py-1 border-b border-slate-100 text-slate-600 text-xs">
            <span>Subtotal (Gross):</span>
            <span className="font-semibold text-slate-800">₹{formatCurrency(sale.subtotal)}</span>
          </div>
          {safeNumber(sale.total_discount) > 0 && (
            <div className="flex justify-between py-1 border-b border-slate-100 text-emerald-700 text-xs">
              <span>Discount:</span>
              <span>-₹{formatCurrency(sale.total_discount)}</span>
            </div>
          )}
          <div className="flex justify-between py-1 border-b border-slate-100 text-slate-600 text-xs">
            <span>GST Tax:</span>
            <span>₹{formatCurrency(totalGst)}</span>
          </div>
          {safeNumber(sale.round_off) !== 0 && (
            <div className="flex justify-between py-1 border-b border-slate-100 text-slate-500 text-xs">
              <span>Round Off:</span>
              <span>
                {safeNumber(sale.round_off) > 0
                  ? `+₹${formatCurrency(sale.round_off)}`
                  : `-₹${formatCurrency(Math.abs(safeNumber(sale.round_off)))}`}
              </span>
            </div>
          )}
          <div
            className="flex justify-between py-2 border-t-2 font-bold text-base text-slate-900"
            style={{ borderColor: accentColor }}
          >
            <span>Grand Total:</span>
            <span className="font-black text-lg" style={{ color: accentColor }}>
              ₹{formatCurrency(sale.grand_total)}
            </span>
          </div>
        </div>
      </div>

      {/* Terms & Signature */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-200 text-[10px] text-slate-500">
        <div>
          <p className="font-bold text-slate-700 uppercase mb-0.5">Terms &amp; Conditions:</p>
          <p className="whitespace-pre-line">
            {settings.terms_conditions ||
              '1. Goods sold will not be returned.\n2. Store in cool and dry place.'}
          </p>
        </div>
        <div className="sm:text-right pt-4 sm:pt-6">
          <p className="font-bold text-slate-800">For {settings.shop_name}</p>
          <div className="h-8 sm:h-10"></div>
          <p className="border-t border-slate-300 inline-block pt-1 font-semibold">{signatureLabel}</p>
        </div>
      </div>

      {footerNote && (
        <div className="mt-4 pt-2.5 border-t border-dashed border-slate-200 text-center text-[10px] font-semibold text-slate-500">
          {footerNote}
        </div>
      )}
    </div>
  );
};

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
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !sale) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    try {
      const res = await api.get(`/invoices/${sale.id}/pdf`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Invoice_${sale.invoice_number || sale.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch {
      window.open(salesApi.getPdfUrl(sale.id), '_blank');
    }
  };

  const handleShareWhatsApp = () => {
    const waUrl = buildWhatsAppInvoiceUrl(sale.customer_phone, sale, settings);
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  const [isEWayOpen, setIsEWayOpen] = useState(false);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="invoice-modal-title"
      className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[95vh]">
        {/* Top Control Bar (Hidden on print) */}
        <div className="no-print px-3 sm:px-5 py-3 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 shrink-0" />
            <span id="invoice-modal-title" className="font-bold text-xs sm:text-sm truncate">
              Invoice #{sale.invoice_number}
            </span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-2.5 sm:px-3 py-1.5 rounded-lg flex items-center gap-1 text-[11px] sm:text-xs shadow transition-colors active:scale-95"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>WhatsApp Bill</span>
            </button>
            <button
              type="button"
              onClick={() => setIsEWayOpen(true)}
              className={`${
                Number(sale.grand_total || 0) >= 50000
                  ? 'bg-indigo-600 hover:bg-indigo-500 font-bold ring-2 ring-indigo-400'
                  : 'bg-slate-700 hover:bg-slate-600'
              } text-white font-semibold px-2.5 sm:px-3 py-1.5 rounded-lg flex items-center gap-1 text-[11px] sm:text-xs shadow transition-colors active:scale-95`}
              title="Generate Government GST E-Way Bill JSON"
            >
              <Truck className="w-3.5 h-3.5" />
              <span>E-Way Bill</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="bg-brand-600 hover:bg-brand-500 text-white font-semibold px-2.5 sm:px-3 py-1.5 rounded-lg flex items-center gap-1 text-[11px] sm:text-xs shadow transition-colors active:scale-95"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="bg-slate-700 hover:bg-slate-600 text-white font-semibold px-2.5 sm:px-3 py-1.5 rounded-lg flex items-center gap-1 text-[11px] sm:text-xs shadow transition-colors active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              <span>PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Invoice Container */}
        <div className="overflow-y-auto p-4 sm:p-8 bg-white text-slate-900 text-xs" id="printable-invoice">
          <InvoiceDocumentView sale={sale} settings={settings} />
        </div>

        {/* Modal Footer */}
        <div className="no-print p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Done / Close
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="bg-brand-700 hover:bg-brand-600 text-white font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 text-xs shadow transition-all"
            >
              <Printer className="w-4 h-4" />
              Print Invoice
            </button>
          </div>
        </div>
      </div>

      {isEWayOpen && (
        <EWayBillModal
          isOpen={isEWayOpen}
          onClose={() => setIsEWayOpen(false)}
          sale={sale}
          onEWayBillSaved={(updated) => {
            Object.assign(sale, updated);
          }}
        />
      )}
    </div>
  );
};
