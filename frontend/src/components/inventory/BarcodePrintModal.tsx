import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Barcode,
  Printer,
  Download,
  X,
  Sparkles,
} from 'lucide-react';
import JsBarcode from 'jsbarcode';
import { Product, ShopSettings } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { sortBatchesByCategoryRule } from '../../config/inventoryCategories';
import { downloadPdfFromApi, openPdfForPrintFromApi } from '../../utils/pdfExport';
import { CustomSelect } from '../common/CustomSelect';

interface BarcodePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
  shopSettings?: ShopSettings;
}

const LABEL_DIMENSIONS: Record<string, { width: string; height: string; name: string; desc: string }> = {
  '50x25': { width: '50mm', height: '25mm', name: '50mm × 25mm (Standard)', desc: 'Standard 2" × 1" thermal sticker roll' },
  '50x30': { width: '50mm', height: '30mm', name: '50mm × 30mm (Detailed)', desc: 'Extra space for batch & expiry details' },
  '38x25': { width: '38mm', height: '25mm', name: '38mm × 25mm (Compact)', desc: 'Compact sticker for small bottles & packets' },
  'a4_sheet': { width: '210mm', height: '297mm', name: 'A4 Sticker Sheet (24 Grid)', desc: '3 × 8 grid for standard A4 sticker paper' },
};

export const BarcodePrintModal: React.FC<BarcodePrintModalProps> = ({
  isOpen,
  onClose,
  product,
  shopSettings,
}) => {
  const orderedBatches = useMemo(
    () => sortBatchesByCategoryRule(product.batches || [], product.category),
    [product.batches, product.category]
  );

  const [labelSize, setLabelSize] = useState<'50x25' | '50x30' | '38x25' | 'a4_sheet'>('50x25');
  const [copies, setCopies] = useState<number>(1);
  const [includeShop, setIncludeShop] = useState(true);
  const [includePrice, setIncludePrice] = useState(true);
  const [includeBatch, setIncludeBatch] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<number | undefined>(
    orderedBatches.length > 0 ? orderedBatches[0].id : undefined
  );

  const previewSvgRef = useRef<SVGSVGElement | null>(null);

  const barcodeValue = product.barcode || String(10000 + product.id);
  const shopName = shopSettings?.shop_name || 'NockBill Solutions';
  const selectedBatch = orderedBatches.find((b) => b.id === selectedBatchId) || orderedBatches[0];
  const displayPrice =
    selectedBatch && selectedBatch.selling_price > 0
      ? selectedBatch.selling_price
      : product.selling_price || product.mrp;

  useEffect(() => {
    if (orderedBatches.length > 0 && !orderedBatches.some((b) => b.id === selectedBatchId)) {
      setSelectedBatchId(orderedBatches[0].id);
    }
  }, [orderedBatches, selectedBatchId]);

  // Generate crisp Code-128 SVG preview using JsBarcode
  useEffect(() => {
    if (previewSvgRef.current && barcodeValue) {
      try {
        JsBarcode(previewSvgRef.current, barcodeValue, {
          format: 'CODE128',
          width: 1.6,
          height: labelSize === '50x30' ? 36 : 28,
          displayValue: true,
          font: 'monospace',
          fontSize: 10,
          textMargin: 2,
          margin: 1,
        });
      } catch (err) {
        console.error('Failed to render barcode SVG:', err);
      }
    }
  }, [barcodeValue, labelSize, isOpen]);

  if (!isOpen) return null;

  const pdfParams = {
    label_size: labelSize,
    copies,
    include_shop: includeShop,
    include_price: includePrice,
    include_batch: includeBatch,
    batch_id: selectedBatch?.id && selectedBatch.id > 0 ? selectedBatch.id : undefined,
  };

  const fallbackFilename = `Barcode_${barcodeValue}_${labelSize}.pdf`;

  const handlePrint = async () => {
    setPdfError(null);
    setIsExporting(true);
    try {
      await openPdfForPrintFromApi(`/products/${product.id}/barcode-label.pdf`, fallbackFilename, pdfParams);
    } catch {
      setPdfError('Unable to generate barcode label PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadPdf = async () => {
    setPdfError(null);
    setIsExporting(true);
    try {
      await downloadPdfFromApi(`/products/${product.id}/barcode-label.pdf`, fallbackFilename, pdfParams);
    } catch {
      setPdfError('Unable to download barcode label PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-xl w-full max-h-[92vh] overflow-y-auto flex flex-col my-auto border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-900 dark:bg-slate-950 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Barcode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-sm text-white">Print Barcode Label</h3>
              <p className="text-[11px] text-slate-400">Exact label-sized thermal sticker PDF</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
            aria-label="Close barcode label modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto max-h-[80vh]">
          {pdfError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/60 text-xs font-semibold text-rose-700 dark:text-rose-300">
              {pdfError}
            </div>
          )}

          {/* Product Pill */}
          <div className="bg-slate-50 dark:bg-slate-800/70 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div>
              <h4 className="font-black text-xs sm:text-sm text-slate-900 dark:text-slate-100">
                {product.name || product.product_name}
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {product.company_name ? `${product.company_name} • ` : ''}Net Content: {product.unit || 'Pack'}
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono text-xs font-black text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/60">
                {barcodeValue}
              </p>
              <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                MRP: ₹{formatCurrency(displayPrice)}
              </p>
            </div>
          </div>

          {/* Live Label Preview */}
          <div className="flex flex-col items-center">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              Live Label Sticker Preview ({LABEL_DIMENSIONS[labelSize]?.name})
            </p>

            <div className="p-4 bg-slate-100 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 w-full flex items-center justify-center">
              <div
                data-keep-light="true"
                className="bg-white rounded-lg shadow-sm border border-slate-300 p-2 text-center flex flex-col items-center justify-between transition-all"
                style={{
                  width: labelSize === '38x25' ? '180px' : labelSize === '50x30' ? '250px' : '230px',
                  minHeight: labelSize === '50x30' ? '125px' : '105px',
                }}
              >
                {includeShop && (
                  <p className="text-[10px] font-extrabold uppercase text-emerald-800 leading-tight truncate w-full">
                    {shopName}
                  </p>
                )}

                <h5 className="font-black text-xs text-slate-900 leading-tight truncate w-full mt-0.5">
                  {product.name || product.product_name} {product.unit ? `(${product.unit})` : ''}
                </h5>

                {/* SVG Barcode rendered via JsBarcode */}
                <div className="my-1 flex items-center justify-center w-full">
                  <svg ref={previewSvgRef} className="max-w-full h-auto" />
                </div>

                {(includePrice || (includeBatch && selectedBatch)) && (
                  <div className="flex items-center justify-between w-full text-[10px] font-bold text-slate-800 px-1 border-t border-slate-100 pt-1">
                    {includePrice ? (
                      <span>MRP: ₹{formatCurrency(displayPrice)}</span>
                    ) : (
                      <span />
                    )}
                    {includeBatch && selectedBatch && (
                      <span className="font-mono text-[9px] text-slate-600">
                        B: {selectedBatch.batch_number}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Controls & Options */}
          <div className="space-y-3.5 bg-slate-50/70 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
            {/* Label Size Selector */}
            <div>
              <label className="block">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 mb-1.5">
                  Target Label Format
                </span>
                <CustomSelect
                  value={labelSize}
                  onChange={(val) => setLabelSize(val as '50x25' | '50x30' | '38x25' | 'a4_sheet')}
                  options={[
                    { value: '50x25', label: '50mm × 25mm (Standard 2"×1" Thermal Roll) - Recommended' },
                    { value: '50x30', label: '50mm × 30mm (Large Thermal Roll with Batch)' },
                    { value: '38x25', label: '38mm × 25mm (Compact Sticker)' },
                    { value: 'a4_sheet', label: 'A4 Sticker Sheet (24 Labels - 3×8 Grid)' },
                  ]}
                />
              </label>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                {LABEL_DIMENSIONS[labelSize]?.desc}
              </p>
            </div>

            {/* Copies */}
            {labelSize !== 'a4_sheet' && (
              <div>
                <label htmlFor="barcode-copies-input" className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1">
                  Number of Copies (Stickers to Print)
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {[1, 2, 5, 10, 20].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setCopies(num)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        copies === num
                          ? 'bg-emerald-800 text-white shadow-sm ring-1 ring-emerald-500'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {num} {num === 1 ? 'copy' : 'copies'}
                    </button>
                  ))}
                  <div className="flex-1 min-w-[70px]">
                    <input
                      id="barcode-copies-input"
                      type="number"
                      min="1"
                      max="100"
                      value={copies}
                      onChange={(e) => setCopies(Math.max(1, Number.parseInt(e.target.value, 10) || 1))}
                      className="w-full px-2.5 py-1 text-xs font-bold text-center border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                      placeholder="Custom"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Toggle Content Options */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <label className="flex items-center gap-2 cursor-pointer p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800">
                <input
                  type="checkbox"
                  checked={includeShop}
                  onChange={(e) => setIncludeShop(e.target.checked)}
                  className="rounded text-emerald-700 focus:ring-emerald-500"
                />
                <span className="font-semibold text-slate-700 dark:text-slate-200 text-[11px]">Shop Name</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800">
                <input
                  type="checkbox"
                  checked={includePrice}
                  onChange={(e) => setIncludePrice(e.target.checked)}
                  className="rounded text-emerald-700 focus:ring-emerald-500"
                />
                <span className="font-semibold text-slate-700 dark:text-slate-200 text-[11px]">MRP / Price</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800">
                <input
                  type="checkbox"
                  checked={includeBatch}
                  onChange={(e) => setIncludeBatch(e.target.checked)}
                  className="rounded text-emerald-700 focus:ring-emerald-500"
                />
                <span className="font-semibold text-slate-700 dark:text-slate-200 text-[11px]">Batch &amp; Expiry</span>
              </label>
            </div>

            {/* Batch Selector if includeBatch is true */}
            {includeBatch && orderedBatches.length > 0 && (
              <div>
                <label className="block">
                  <span className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1">
                    Select Batch for Label
                  </span>
                  <CustomSelect
                    value={String(selectedBatch?.id || '')}
                    onChange={(val) => setSelectedBatchId(Number.parseInt(val, 10))}
                    options={orderedBatches.map((b, idx) => ({
                      value: String(b.id),
                      label: `${idx === 0 ? '★ Sell 1st • ' : ''}Batch ${b.batch_number} (Exp: ${b.expiry_date || 'Non-expiring'}, Stock: ${b.current_stock})`,
                    }))}
                  />
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950/70 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center sm:text-left">
            Exact 1-page per sticker PDF • Zero screen print clutter
          </p>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              disabled={isExporting}
              onClick={() => { void handleDownloadPdf(); }}
              className="flex-1 sm:flex-initial px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors border border-slate-200 dark:border-slate-700 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PDF</span>
            </button>

            <button
              type="button"
              disabled={isExporting}
              onClick={() => { void handlePrint(); }}
              className="flex-1 sm:flex-initial px-5 py-2.5 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-900/20 active:scale-95 transition-all disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>
                {labelSize === 'a4_sheet' ? 'Open A4 Sheet PDF (24)' : `Print Label PDF (${copies} ${copies === 1 ? 'sticker' : 'stickers'})`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
