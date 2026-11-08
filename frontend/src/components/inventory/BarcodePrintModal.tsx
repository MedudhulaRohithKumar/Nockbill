import React, { useState, useEffect, useRef } from 'react';
import { 
  Barcode, 
  Printer, 
  Download, 
  X, 
  Check, 
  Settings2, 
  Copy, 
  FileText,
  Sparkles,
  Layers
} from 'lucide-react';
import JsBarcode from 'jsbarcode';
import { Product, ProductBatch, ShopSettings } from '../../types';
import { productsApi } from '../../api';
import { formatCurrency, safeNumber } from '../../utils/formatters';
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
  const [labelSize, setLabelSize] = useState<'50x25' | '50x30' | '38x25' | 'a4_sheet'>('50x25');
  const [copies, setCopies] = useState<number>(1);
  const [includeShop, setIncludeShop] = useState(true);
  const [includePrice, setIncludePrice] = useState(true);
  const [includeBatch, setIncludeBatch] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState<number | undefined>(
    product.batches && product.batches.length > 0 ? product.batches[0].id : undefined
  );

  const previewSvgRef = useRef<SVGSVGElement | null>(null);

  const barcodeValue = product.barcode || String(10000 + product.id);
  const shopName = shopSettings?.shop_name || 'NockBill Solutions';
  const selectedBatch = product.batches?.find(b => b.id === selectedBatchId);

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

  // Print using an isolated hidden iframe with exact @page dimensions
  const handlePrint = () => {
    const dim = LABEL_DIMENSIONS[labelSize] || LABEL_DIMENSIONS['50x25'];
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.top = '-9999px';
    iframe.style.left = '-9999px';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    // Grab serialized SVG markup
    const svgMarkup = previewSvgRef.current ? previewSvgRef.current.outerHTML : '';

    let contentHtml = '';

    if (labelSize === 'a4_sheet') {
      // 24 labels on A4 (3 cols x 8 rows)
      const singleLabel = `
        <div class="a4-cell">
          ${includeShop ? `<div class="shop-title">${shopName}</div>` : ''}
          <div class="prod-title">${product.name || product.product_name} ${product.unit ? `(${product.unit})` : ''}</div>
          <div class="barcode-wrapper">${svgMarkup}</div>
          <div class="meta-row">
            ${includePrice ? `<span>MRP: ₹${formatCurrency(product.selling_price || product.mrp)}</span>` : ''}
            ${includeBatch && selectedBatch ? `<span class="batch-tag">B:${selectedBatch.batch_number}</span>` : ''}
          </div>
        </div>
      `;
      contentHtml = `
        <div class="a4-grid">
          ${Array.from({ length: 24 }).map(() => singleLabel).join('')}
        </div>
      `;
    } else {
      // Single label pages for thermal printers
      const singleLabelHtml = `
        <div class="label-page">
          ${includeShop ? `<div class="shop-title">${shopName}</div>` : ''}
          <div class="prod-title">${product.name || product.product_name} ${product.unit ? `(${product.unit})` : ''}</div>
          <div class="barcode-wrapper">${svgMarkup}</div>
          <div class="meta-row">
            ${includePrice ? `<span>MRP: ₹${formatCurrency(product.selling_price || product.mrp)}</span>` : ''}
            ${includeBatch && selectedBatch ? `<span class="batch-tag">B:${selectedBatch.batch_number}</span>` : ''}
          </div>
        </div>
      `;
      contentHtml = Array.from({ length: copies }).map(() => singleLabelHtml).join('');
    }

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Barcode_${barcodeValue}</title>
          <style>
            @page {
              size: ${dim.width} ${dim.height};
              margin: 0;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            html, body {
              margin: 0;
              padding: 0;
              background: #fff;
              color: #000;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            }
            .label-page {
              width: ${dim.width};
              height: ${dim.height};
              page-break-after: always;
              break-after: page;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: space-between;
              padding: 1.5mm 1mm;
              text-align: center;
              overflow: hidden;
            }
            .label-page:last-child {
              page-break-after: avoid;
              break-after: avoid;
            }
            .shop-title {
              font-size: 7.5px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.3px;
              color: #1b5e20;
              line-height: 1;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              max-width: 100%;
            }
            .prod-title {
              font-size: 8.5px;
              font-weight: 900;
              line-height: 1.1;
              margin-top: 0.5px;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              max-width: 100%;
            }
            .barcode-wrapper {
              display: flex;
              justify-content: center;
              align-items: center;
              margin: 0.5mm 0;
              width: 100%;
            }
            .barcode-wrapper svg {
              max-width: 96%;
              height: auto;
              max-height: ${labelSize === '50x30' ? '12mm' : '9mm'};
            }
            .meta-row {
              font-size: 7.5px;
              font-weight: 800;
              line-height: 1;
              display: flex;
              justify-content: space-between;
              align-items: center;
              width: 100%;
              padding: 0 1mm;
            }
            .batch-tag {
              font-family: monospace;
              font-size: 6.5px;
              color: #333;
            }
            /* A4 grid styles */
            .a4-grid {
              display: grid;
              grid-template-columns: repeat(3, 64mm);
              grid-template-rows: repeat(8, 34mm);
              gap: 2mm 3mm;
              padding: 8mm 6mm;
            }
            .a4-cell {
              border: 0.5px dashed #ccc;
              border-radius: 4px;
              padding: 2mm 1.5mm;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: space-between;
              text-align: center;
              overflow: hidden;
            }
          </style>
        </head>
        <body>
          ${contentHtml}
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1500);
    }, 300);
  };

  const handleDownloadPdf = () => {
    const url = productsApi.getBarcodePdfUrl(product.id, {
      label_size: labelSize,
      copies: copies,
      include_batch: includeBatch,
      batch_id: selectedBatchId,
    });
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col my-auto border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Barcode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-sm text-white">Print Barcode Label</h3>
              <p className="text-[11px] text-slate-400">Exact label-sized thermal sticker formatting</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto max-h-[80vh]">
          {/* Product Pill */}
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 flex items-center justify-between">
            <div>
              <h4 className="font-black text-xs sm:text-sm text-slate-900">{product.name || product.product_name}</h4>
              <p className="text-[11px] text-slate-500">
                {product.company_name ? `${product.company_name} • ` : ''}Net Content: {product.unit || 'Pack'}
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono text-xs font-black text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                {barcodeValue}
              </p>
              <p className="text-[11px] font-bold text-slate-700 mt-0.5">
                MRP: ₹{formatCurrency(product.selling_price || product.mrp)}
              </p>
            </div>
          </div>

          {/* Live Label Preview */}
          <div className="flex flex-col items-center">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-emerald-600" />
              Live Label Sticker Preview ({LABEL_DIMENSIONS[labelSize]?.name})
            </p>

            <div className="p-4 bg-slate-100 rounded-2xl border border-slate-200 w-full flex items-center justify-center">
              <div 
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

                <div className="flex items-center justify-between w-full text-[10px] font-bold text-slate-800 px-1 border-t border-slate-100 pt-1">
                  {includePrice && (
                    <span>MRP: ₹{formatCurrency(product.selling_price || product.mrp)}</span>
                  )}
                  {includeBatch && selectedBatch && (
                    <span className="font-mono text-[9px] text-slate-600">
                      B: {selectedBatch.batch_number}
                    </span>
                  )}
                  {(!includeBatch || !selectedBatch) && (
                    <span className="text-emerald-700">GST {product.gst_rate || 5}%</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Controls & Options */}
          <div className="space-y-3.5 bg-slate-50/70 p-4 rounded-2xl border border-slate-200">
            {/* Label Size Selector */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Target Label Format
              </label>
              <CustomSelect
                value={labelSize}
                onChange={(val) => setLabelSize(val as any)}
                options={[
                  { value: '50x25', label: '50mm × 25mm (Standard 2"×1" Thermal Roll) - Recommended' },
                  { value: '50x30', label: '50mm × 30mm (Large Thermal Roll with Batch)' },
                  { value: '38x25', label: '38mm × 25mm (Compact Sticker)' },
                  { value: 'a4_sheet', label: 'A4 Sticker Sheet (24 Labels - 3×8 Grid)' },
                ]}
              />
              <p className="text-[10px] text-slate-500 mt-1">
                {LABEL_DIMENSIONS[labelSize]?.desc}
              </p>
            </div>

            {/* Copies */}
            {labelSize !== 'a4_sheet' && (
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Number of Copies (Stickers to Print)
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 5, 10, 20].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setCopies(num)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        copies === num
                          ? 'bg-emerald-800 text-white shadow-sm ring-1 ring-emerald-500'
                          : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {num} {num === 1 ? 'copy' : 'copies'}
                    </button>
                  ))}
                  <div className="flex-1 min-w-[70px]">
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={copies}
                      onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-2.5 py-1 text-xs font-bold text-center border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                      placeholder="Custom"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Toggle Content Options */}
            <div className="pt-2 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <label className="flex items-center gap-2 cursor-pointer p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={includeShop}
                  onChange={(e) => setIncludeShop(e.target.checked)}
                  className="rounded text-emerald-700 focus:ring-emerald-500"
                />
                <span className="font-semibold text-slate-700 text-[11px]">Shop Name</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={includePrice}
                  onChange={(e) => setIncludePrice(e.target.checked)}
                  className="rounded text-emerald-700 focus:ring-emerald-500"
                />
                <span className="font-semibold text-slate-700 text-[11px]">MRP &amp; GST</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={includeBatch}
                  onChange={(e) => setIncludeBatch(e.target.checked)}
                  className="rounded text-emerald-700 focus:ring-emerald-500"
                />
                <span className="font-semibold text-slate-700 text-[11px]">Batch &amp; Expiry</span>
              </label>
            </div>

            {/* Batch Selector if includeBatch is true */}
            {includeBatch && product.batches && product.batches.length > 0 && (
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Select Batch for Label
                </label>
                <CustomSelect
                  value={String(selectedBatchId || '')}
                  onChange={(val) => setSelectedBatchId(parseInt(val))}
                  options={product.batches.map(b => ({
                    value: String(b.id),
                    label: `Batch ${b.batch_number} (Exp: ${b.expiry_date || 'N/A'}, Stock: ${b.current_stock})`
                  }))}
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[11px] text-slate-500 text-center sm:text-left">
            Exact 1-page per sticker format • Zero blank pages
          </p>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="flex-1 sm:flex-initial px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors border border-slate-200"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PDF</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 sm:flex-initial px-5 py-2.5 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-900/20 active:scale-95 transition-all"
            >
              <Printer className="w-4 h-4" />
              <span>
                {labelSize === 'a4_sheet' ? 'Print A4 Sheet (24)' : `Print Label (${copies} ${copies === 1 ? 'sticker' : 'stickers'})`}
              </span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
