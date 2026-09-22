import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, 
  Upload, 
  X, 
  Check, 
  Sparkles, 
  AlertCircle, 
  RefreshCw, 
  Scan,
  Maximize2,
  HelpCircle,
  FileText
} from 'lucide-react';
import { ocrApi, productsApi } from '../../api';
import { OCRCandidate, Product, SaleItem } from '../../types';

interface CameraScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddProductToBill: (item: Partial<SaleItem>) => void;
}

export const CameraScannerModal: React.FC<CameraScannerModalProps> = ({
  isOpen,
  onClose,
  onAddProductToBill,
}) => {
  const [activeTab, setActiveTab] = useState<'camera' | 'upload' | 'sample'>('camera');
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [candidate, setCandidate] = useState<OCRCandidate | null>(null);
  const [matchedProduct, setMatchedProduct] = useState<Product | null>(null);

  // Live video stream state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isStreamActive, setIsStreamActive] = useState(false);

  // Editable candidate fields
  const [formName, setFormName] = useState('');
  const [formBatch, setFormBatch] = useState('');
  const [formExpiry, setFormExpiry] = useState('');
  const [formMrp, setFormMrp] = useState<number>(0);
  const [formPrice, setFormPrice] = useState<number>(0);
  const [formHsn, setFormHsn] = useState('31021000');
  const [formGst, setFormGst] = useState<number>(5);
  const [formQty, setFormQty] = useState<number>(1);
  const [formUnit, setFormUnit] = useState('Bags');

  useEffect(() => {
    if (isOpen && activeTab === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, activeTab]);

  const startCamera = async () => {
    setError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera not supported in this browser. Please use the file upload option.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setIsStreamActive(true);
      }
    } catch (err: any) {
      console.warn('Live stream camera error:', err);
      setIsStreamActive(false);
      // Not a fatal error, user can still use the direct camera snapshot button or upload
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
      setIsStreamActive(false);
    }
  };

  const captureVideoFrame = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setCapturedImage(dataUrl);
      stopCamera();

      // Convert dataUrl to File
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' });
          processImageFile(file);
        }
      }, 'image/jpeg', 0.85);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setCapturedImage(reader.result as string);
    };
    reader.readAsDataURL(file);

    processImageFile(file);
  };

  const processImageFile = async (file: File) => {
    setIsScanning(true);
    setError(null);
    try {
      const result: any = await ocrApi.scanImage(file);
      setCandidate(result);
      applyCandidateToForm(result);
    } catch (err: any) {
      console.error('OCR scan failed:', err);
      const errorMsg = err.response?.data?.detail || err.message || 'Unable to read photo. Retake photo with clear lighting.';
      setError(errorMsg);
    } finally {
      setIsScanning(false);
    }
  };

  const applyCandidateToForm = async (cand: any) => {
    setFormName(cand.product_name || '');
    setFormBatch(cand.batch_number || 'B-NEW');
    setFormExpiry(cand.expiry_date || '');
    const priceVal = cand.selling_price || cand.price || cand.mrp || 0;
    setFormMrp(cand.mrp || priceVal);
    setFormPrice(priceVal);
    setFormHsn(cand.hsn_code || '31021000');
    setFormGst(cand.gst_rate ?? 5);
    setFormUnit(cand.unit || 'Bags');
    setFormQty(1);

    if (cand.matched_product) {
      setMatchedProduct(cand.matched_product);
      if (cand.matched_product.selling_price) setFormPrice(cand.matched_product.selling_price);
      if (cand.matched_product.hsn_code) setFormHsn(cand.matched_product.hsn_code);
      if (cand.matched_product.gst_rate) setFormGst(cand.matched_product.gst_rate);
    } else {
      // Attempt to match with local inventory search
      try {
        const searchTerm = (cand.product_name || '').split(' ')[0];
        if (searchTerm) {
          const allProducts = await productsApi.getAll({ search: searchTerm });
          if (allProducts && allProducts.length > 0) {
            const found = allProducts[0];
            setMatchedProduct(found);
            if (!priceVal) setFormPrice(found.selling_price);
            setFormHsn(found.hsn_code);
            setFormGst(found.gst_rate);
          }
        }
      } catch {
        // Ignore inventory match failure
      }
    }
  };

  const loadSampleFertilizer = (type: 'urea' | 'dap' | 'potash') => {
    let sample: OCRCandidate;
    if (type === 'urea') {
      sample = {
        product_name: 'IFFCO Neem Coated Urea 45kg',
        batch_number: 'NCU-2024-88',
        expiry_date: '2027-05-30',
        mrp: 266.5,
        selling_price: 266.5,
        cost_price: 250.0,
        unit: 'Bags',
        gst_rate: 5,
        hsn_code: '31021000',
        confidence: 0.98,
        raw_text: 'IFFCO NEEM COATED UREA (45 KG)\nBATCH: NCU-2024-88\nEXP: MAY 2027\nMRP: RS 266.50\nHSN: 31021000\nGST: 5%'
      };
      setCapturedImage('https://images.unsplash.com/photo-1592417817098-8f3d6910985c?w=500&auto=format&fit=crop&q=60');
    } else if (type === 'dap') {
      sample = {
        product_name: 'IFFCO DAP (Di-Ammonium Phosphate) 50kg',
        batch_number: 'DAP-901-B',
        expiry_date: '2026-11-20',
        mrp: 1350.0,
        selling_price: 1350.0,
        cost_price: 1275.0,
        unit: 'Bags',
        gst_rate: 5,
        hsn_code: '31053000',
        confidence: 0.96,
        raw_text: 'IFFCO DAP 18-46-0 (50 KG)\nBATCH: DAP-901-B\nEXPIRY: 20/11/2026\nMRP: RS 1350.00\nHSN: 31053000'
      };
      setCapturedImage('https://images.unsplash.com/photo-1628352081506-83c43123ed6d?w=500&auto=format&fit=crop&q=60');
    } else {
      sample = {
        product_name: 'Coromandel Gromor 14-35-14 (50kg)',
        batch_number: 'CG-4521-G',
        expiry_date: '2026-08-15',
        mrp: 1470.0,
        selling_price: 1470.0,
        cost_price: 1390.0,
        unit: 'Bags',
        gst_rate: 5,
        hsn_code: '31052000',
        confidence: 0.92,
        raw_text: 'COROMANDEL GROMOR 14-35-14 COMPLEX FERTILIZER\nBATCH: CG-4521-G\nEXP: 15/08/2026\nMRP: RS 1470.00'
      };
      setCapturedImage('https://images.unsplash.com/photo-1585314062340-f1a5a7c9328d?w=500&auto=format&fit=crop&q=60');
    }
    setCandidate(sample);
    applyCandidateToForm(sample);
  };

  const handleConfirmAdd = () => {
    if (!formName.trim()) {
      setError('Please provide a valid product name');
      return;
    }

    const taxable = (formPrice * formQty) / (1 + formGst / 100);
    const taxTotal = (formPrice * formQty) - taxable;
    const cgst = taxTotal / 2;
    const sgst = taxTotal / 2;

    const saleItem: Partial<SaleItem> = {
      product_id: matchedProduct?.id || candidate?.product_id || 1,
      product_name: formName,
      batch_number: formBatch,
      expiry_date: formExpiry,
      hsn_code: formHsn,
      unit: formUnit,
      quantity: formQty,
      unit_price: formPrice,
      mrp: formMrp || formPrice,
      discount_percent: 0,
      discount_amount: 0,
      taxable_amount: Math.round(taxable * 100) / 100,
      gst_rate: formGst,
      cgst_amount: Math.round(cgst * 100) / 100,
      sgst_amount: Math.round(sgst * 100) / 100,
      igst_amount: 0,
      total_amount: Math.round(formPrice * formQty * 100) / 100,
    };

    onAddProductToBill(saleItem);
    handleClose();
  };

  const handleClose = () => {
    stopCamera();
    setCapturedImage(null);
    setCandidate(null);
    setMatchedProduct(null);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-brand-800 to-brand-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-lg">
              <Scan className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">AI Fertilizer Camera Scanner</h3>
              <p className="text-xs text-brand-200">Point phone camera at fertilizer bag / bottle to extract details</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 text-brand-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab selection */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-2">
          <button
            onClick={() => { setActiveTab('camera'); startCamera(); }}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'camera'
                ? 'border-brand-700 text-brand-800 bg-white rounded-t-lg shadow-sm'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Camera className="w-4 h-4" />
            Phone Camera
          </button>
          <button
            onClick={() => { setActiveTab('upload'); stopCamera(); }}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'upload'
                ? 'border-brand-700 text-brand-800 bg-white rounded-t-lg shadow-sm'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Upload className="w-4 h-4" />
            Photo Upload
          </button>
          <button
            onClick={() => { setActiveTab('sample'); stopCamera(); }}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'sample'
                ? 'border-brand-700 text-brand-800 bg-white rounded-t-lg shadow-sm'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="w-4 h-4 text-accent-500" />
            Sample Fertilizers
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Tab 1: Live Camera / Mobile Native Camera */}
          {activeTab === 'camera' && !capturedImage && (
            <div className="space-y-3">
              <div className="relative aspect-video sm:aspect-[4/3] bg-black rounded-xl overflow-hidden flex items-center justify-center border-2 border-dashed border-brand-500/40 shadow-inner">
                {isStreamActive ? (
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    {/* Viewfinder overlay */}
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div className="w-4/5 h-3/5 border-2 border-emerald-400 rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.4)] relative">
                        <div className="absolute -top-6 left-0 right-0 text-center">
                          <span className="bg-emerald-600/90 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider">
                            Align text inside frame
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center p-6 text-slate-300 space-y-3">
                    <Camera className="w-12 h-12 mx-auto text-emerald-400 opacity-80" />
                    <div>
                      <p className="text-sm font-medium text-white">Live Camera Not Active</p>
                      <p className="text-xs text-slate-400 mt-1">Tap below to snap a picture using your mobile camera</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-2.5">
                {isStreamActive ? (
                  <button
                    onClick={captureVideoFrame}
                    className="flex-1 bg-brand-700 hover:bg-brand-600 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-brand-900/20 active:scale-95 transition-all"
                  >
                    <Scan className="w-5 h-5" />
                    Capture & Extract Text
                  </button>
                ) : (
                  <label className="flex-1 bg-brand-700 hover:bg-brand-600 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2.5 cursor-pointer shadow-lg shadow-brand-900/20 text-center active:scale-95 transition-all">
                    <Camera className="w-5 h-5" />
                    <span>Open Phone Camera (Full Resolution)</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                  </label>
                )}

                <label className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors text-xs">
                  <Upload className="w-4 h-4" />
                  <span>Choose from Gallery</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
              </div>
            </div>
          )}

          {/* Tab 2: Upload File */}
          {activeTab === 'upload' && !capturedImage && (
            <div className="border-2 border-dashed border-slate-300 hover:border-brand-500 rounded-2xl p-8 text-center bg-slate-50/50 hover:bg-brand-50/20 transition-all cursor-pointer">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
                id="ocr-file-input"
              />
              <label htmlFor="ocr-file-input" className="cursor-pointer block space-y-3">
                <div className="w-14 h-14 mx-auto bg-brand-100 text-brand-700 rounded-2xl flex items-center justify-center shadow-sm">
                  <Upload className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">Click or drag fertilizer photo here</p>
                  <p className="text-xs text-slate-500 mt-1">Supports JPG, PNG, WEBP (Bags, Bottles, Invoices)</p>
                </div>
              </label>
            </div>
          )}

          {/* Tab 3: Sample Quick Test */}
          {activeTab === 'sample' && !capturedImage && (
            <div className="space-y-3">
              <p className="text-xs text-slate-600 font-medium">
                Testing on desktop without a camera? Click any popular fertilizer below to simulate instant OCR text extraction:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  onClick={() => loadSampleFertilizer('urea')}
                  className="p-3 border border-emerald-200 rounded-xl bg-emerald-50/60 hover:bg-emerald-100/70 text-left transition-all group"
                >
                  <span className="text-xs font-bold text-emerald-900 block group-hover:text-emerald-700">IFFCO Urea 45kg</span>
                  <span className="text-[11px] text-emerald-700 block mt-0.5">MRP ₹266.50 • 5% GST</span>
                  <span className="text-[10px] bg-emerald-200/80 text-emerald-800 px-1.5 py-0.5 rounded mt-2 inline-block font-mono">
                    Batch: NCU-2024-88
                  </span>
                </button>

                <button
                  onClick={() => loadSampleFertilizer('dap')}
                  className="p-3 border border-amber-200 rounded-xl bg-amber-50/60 hover:bg-amber-100/70 text-left transition-all group"
                >
                  <span className="text-xs font-bold text-amber-900 block group-hover:text-amber-700">IFFCO DAP 50kg</span>
                  <span className="text-[11px] text-amber-700 block mt-0.5">MRP ₹1350.00 • 5% GST</span>
                  <span className="text-[10px] bg-amber-200/80 text-amber-800 px-1.5 py-0.5 rounded mt-2 inline-block font-mono">
                    Batch: DAP-901-B
                  </span>
                </button>

                <button
                  onClick={() => loadSampleFertilizer('potash')}
                  className="p-3 border border-blue-200 rounded-xl bg-blue-50/60 hover:bg-blue-100/70 text-left transition-all group"
                >
                  <span className="text-xs font-bold text-blue-900 block group-hover:text-blue-700">Coromandel Gromor</span>
                  <span className="text-[11px] text-blue-700 block mt-0.5">MRP ₹1470.00 • 5% GST</span>
                  <span className="text-[10px] bg-blue-200/80 text-blue-800 px-1.5 py-0.5 rounded mt-2 inline-block font-mono">
                    Batch: CG-4521-G
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Scanning Animation State */}
          {isScanning && (
            <div className="p-8 text-center space-y-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="relative w-16 h-16 mx-auto">
                <RefreshCw className="w-16 h-16 text-brand-600 animate-spin opacity-40" />
                <Sparkles className="w-8 h-8 text-brand-700 absolute inset-0 m-auto animate-pulse" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">Reading Fertilizer Package via AI OCR...</p>
                <p className="text-xs text-slate-500 mt-1">Extracting Brand Name, Batch No, Expiry Date, MRP & HSN</p>
              </div>
            </div>
          )}

          {/* Captured Image & Extracted Information Form */}
          {candidate && !isScanning && (
            <div className="space-y-4">
              {/* Top Banner: Verification Alert */}
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-900">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 font-bold" />
                  <span>
                    <strong>OCR Complete:</strong> Confidence: {typeof candidate.confidence === 'number' ? Math.round(candidate.confidence * 100) : 92}%. Please review values below.
                  </span>
                </div>
                <button
                  onClick={() => {
                    setCandidate(null);
                    setCapturedImage(null);
                    if (activeTab === 'camera') startCamera();
                  }}
                  className="text-emerald-700 underline hover:text-emerald-900 font-semibold"
                >
                  Retake Photo
                </button>
              </div>

              {/* Two columns: Image Preview + Verified Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
                {/* Left side: Thumbnail preview */}
                {capturedImage && (
                  <div className="sm:col-span-4 space-y-2">
                    <div className="aspect-[4/3] rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                      <img src={capturedImage} alt="Captured" className="w-full h-full object-cover" />
                    </div>
                    {candidate.raw_text && (
                      <details className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded border border-slate-200">
                        <summary className="cursor-pointer font-medium text-slate-700">Extracted Raw Text</summary>
                        <pre className="mt-1 font-mono text-[10px] whitespace-pre-wrap max-h-24 overflow-y-auto">
                          {candidate.raw_text}
                        </pre>
                      </details>
                    )}
                  </div>
                )}

                {/* Right side: Editable Fields Form */}
                <div className={`${capturedImage ? 'sm:col-span-8' : 'sm:col-span-12'} space-y-3`}>
                  {/* Product Name */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Product Name *
                    </label>
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    {/* Batch Number */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                        Batch No.
                      </label>
                      <input
                        type="text"
                        value={formBatch}
                        onChange={(e) => setFormBatch(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                      />
                    </div>

                    {/* Expiry Date */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                        Expiry Date
                      </label>
                      <input
                        type="date"
                        value={formExpiry}
                        onChange={(e) => setFormExpiry(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    {/* MRP */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                        MRP (₹)
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        value={formMrp}
                        onChange={(e) => setFormMrp(parseFloat(e.target.value) || 0)}
                        className="w-full px-2.5 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                      />
                    </div>

                    {/* Selling Price */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                        Selling Rate (₹) *
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        value={formPrice}
                        onChange={(e) => setFormPrice(parseFloat(e.target.value) || 0)}
                        className="w-full px-2.5 py-1.5 text-xs font-bold text-brand-800 border border-brand-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none bg-brand-50/40"
                      />
                    </div>

                    {/* Quantity */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                        Quantity
                      </label>
                      <div className="flex items-center">
                        <input
                          type="number"
                          min="1"
                          value={formQty}
                          onChange={(e) => setFormQty(parseInt(e.target.value) || 1)}
                          className="w-full px-2.5 py-1.5 text-xs font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    {/* HSN */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                        HSN Code
                      </label>
                      <input
                        type="text"
                        value={formHsn}
                        onChange={(e) => setFormHsn(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                      />
                    </div>

                    {/* GST Rate */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                        GST Rate %
                      </label>
                      <select
                        value={formGst}
                        onChange={(e) => setFormGst(parseInt(e.target.value))}
                        className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                      >
                        <option value="0">0% (Exempt)</option>
                        <option value="5">5% (Fertilizers)</option>
                        <option value="12">12%</option>
                        <option value="18">18% (Pesticides)</option>
                        <option value="28">28%</option>
                      </select>
                    </div>

                    {/* Unit */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                        Unit
                      </label>
                      <select
                        value={formUnit}
                        onChange={(e) => setFormUnit(e.target.value)}
                        className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                      >
                        <option value="Bags">Bags</option>
                        <option value="Kg">Kg</option>
                        <option value="Litres">Litres</option>
                        <option value="Bottles">Bottles</option>
                        <option value="Packets">Packets</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancel
          </button>

          {candidate && (
            <button
              onClick={handleConfirmAdd}
              className="bg-brand-700 hover:bg-brand-600 text-white font-bold px-6 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-brand-900/20 active:scale-95 transition-all text-xs"
            >
              <Check className="w-4 h-4" />
              Add Product to Bill (₹{(formPrice * formQty).toFixed(2)})
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
