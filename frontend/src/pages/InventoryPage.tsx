import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  AlertTriangle, 
  Clock, 
  Edit, 
  Trash2, 
  Layers, 
  ArrowUpDown,
  CheckCircle2,
  X,
  Package,
  Barcode,
  RotateCcw,
  Sparkles,
  Zap,
  Printer,
  ChevronRight,
  TrendingUp,
  Info
} from 'lucide-react';
import { productsApi, inventoryApi, getErrorMessage } from '../api';
import { Product, ProductVariant, RefillRecommendation } from '../types';
import { safeNumber, safeString, formatCurrency } from '../utils/formatters';

export const InventoryPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [recommendations, setRecommendations] = useState<RefillRecommendation[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [filterType, setFilterType] = useState<'ALL' | 'LOW_STOCK' | 'NEAR_EXPIRY'>('ALL');
  const [isLoading, setIsLoading] = useState(true);

  // Add / Edit Modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [productVariants, setProductVariants] = useState<ProductVariant[]>([]);

  // Duplicate Check State
  const [duplicateAlert, setDuplicateAlert] = useState<{
    exists: boolean;
    message: string;
    product?: Product;
  } | null>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);

  // Stock Adjustment Modal state
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [adjustType, setAdjustType] = useState<'DAMAGE' | 'AUDIT_CORRECTION' | 'RETURN'>('AUDIT_CORRECTION');
  const [adjustQty, setAdjustQty] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState('');

  // Refill Stock Modal state
  const [isRefillModalOpen, setIsRefillModalOpen] = useState(false);
  const [refillProductId, setRefillProductId] = useState<number | null>(null);
  const [refillQty, setRefillQty] = useState<number>(10);
  const [refillUnit, setRefillUnit] = useState<string>('Bags');
  const [refillBatch, setRefillBatch] = useState<string>('');
  const [refillExpiry, setRefillExpiry] = useState<string>('');
  const [refillPurchasePrice, setRefillPurchasePrice] = useState<number>(0);
  const [refillSellingPrice, setRefillSellingPrice] = useState<number>(0);
  const [refillMrp, setRefillMrp] = useState<number>(0);
  const [refillSupplier, setRefillSupplier] = useState<string>('');
  const [refillInvoice, setRefillInvoice] = useState<string>('');
  const [refillNotes, setRefillNotes] = useState<string>('');
  const [refillSubmitting, setRefillSubmitting] = useState(false);
  const [refillProductSearch, setRefillProductSearch] = useState<string>('');

  // Barcode Print Modal state
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const [selectedBarcodeProduct, setSelectedBarcodeProduct] = useState<Product | null>(null);

  const loadProducts = async () => {
    setIsLoading(true);
    try {
      const [data, recs] = await Promise.all([
        productsApi.getAll(),
        productsApi.getRefillRecommendations().catch(() => [])
      ]);
      setProducts(data);
      setRecommendations(recs || []);
    } catch {
      // Local fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  // Filter effect
  useEffect(() => {
    let list = [...products];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p => {
        const pName = safeString(p.name || p.product_name).toLowerCase();
        const pBatch = safeString(p.batch_number || p.product_code).toLowerCase();
        const pHsn = safeString(p.hsn_code).toLowerCase();
        const pBarcode = safeString(p.barcode).toLowerCase();
        const pCompany = safeString(p.company_name).toLowerCase();
        return pName.includes(q) || pBatch.includes(q) || pHsn.includes(q) || pBarcode.includes(q) || pCompany.includes(q);
      });
    }

    if (selectedCategory !== 'ALL') {
      list = list.filter(p => safeString(p.category).toLowerCase() === selectedCategory.toLowerCase());
    }

    if (filterType === 'LOW_STOCK') {
      list = list.filter(p => safeNumber(p.current_stock) <= safeNumber(p.min_stock_level ?? p.minimum_stock ?? 20));
    } else if (filterType === 'NEAR_EXPIRY') {
      const ninetyDaysFromNow = new Date();
      ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);
      list = list.filter(p => {
        if (!p.expiry_date) return false;
        const expTime = new Date(p.expiry_date).getTime();
        return !isNaN(expTime) && expTime <= ninetyDaysFromNow.getTime();
      });
    }

    setFilteredProducts(list);
  }, [products, search, selectedCategory, filterType]);

  // Debounced duplicate product check when typing in Add modal
  useEffect(() => {
    if (!isEditModalOpen || editingProduct?.id) {
      setDuplicateAlert(null);
      return;
    }

    const name = editingProduct?.name || (editingProduct as any)?.product_name;
    if (!name || name.trim().length < 3) {
      setDuplicateAlert(null);
      return;
    }

    const timer = setTimeout(async () => {
      setCheckingDuplicate(true);
      try {
        const res = await productsApi.checkDuplicate(name, editingProduct?.company_name);
        setDuplicateAlert(res.exists ? res : null);
      } catch (err) {
        console.error('Duplicate check error', err);
      } finally {
        setCheckingDuplicate(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [editingProduct?.name, editingProduct?.company_name, isEditModalOpen, editingProduct?.id]);

  // Select Product for Refill Helper
  const selectProductForRefill = (prod: Product) => {
    setRefillProductId(prod.id);
    setRefillUnit(prod.unit || 'Bags');
    setRefillPurchasePrice(prod.purchase_price ?? prod.cost_price ?? 0);
    setRefillSellingPrice(prod.selling_price ?? 0);
    setRefillMrp(prod.mrp ?? prod.selling_price ?? 0);
    setRefillBatch(prod.batch_number || `BATCH-${Math.floor(1000 + Math.random() * 9000)}`);
    setRefillExpiry(prod.expiry_date || '');
    setRefillSupplier(prod.company_name || 'Stock Refill Supplier');
  };

  // Open Refill Modal helper
  const openRefillModal = (prod?: Product | null, suggestedQty: number = 20) => {
    if (prod) {
      selectProductForRefill(prod);
      setRefillQty(suggestedQty);
    } else {
      setRefillProductId(null);
      setRefillQty(suggestedQty);
      setRefillUnit('Bags');
      setRefillBatch(`BATCH-${Math.floor(1000 + Math.random() * 9000)}`);
      setRefillExpiry('');
      setRefillPurchasePrice(0);
      setRefillSellingPrice(0);
      setRefillMrp(0);
      setRefillSupplier('');
    }
    setRefillProductSearch('');
    setRefillInvoice(`INV-${Math.floor(100000 + Math.random() * 900000)}`);
    setRefillNotes('Periodic replenishment');
    setIsRefillModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    if (duplicateAlert?.exists && !editingProduct.id) {
      alert('This product already exists. Please use Refill Stock instead to avoid creating duplicate barcodes.');
      return;
    }

    const prodName = editingProduct.name || (editingProduct as any).product_name || '';
    const payload = {
      ...editingProduct,
      product_name: prodName,
      name: prodName,
      purchase_price: editingProduct.cost_price ?? (editingProduct as any).purchase_price ?? 0,
      cost_price: editingProduct.cost_price ?? (editingProduct as any).purchase_price ?? 0,
      selling_price: editingProduct.selling_price ?? 0,
      minimum_stock: editingProduct.min_stock_level ?? (editingProduct as any).minimum_stock ?? 20,
      min_stock_level: editingProduct.min_stock_level ?? (editingProduct as any).minimum_stock ?? 20,
      variants: productVariants,
    };

    try {
      if (editingProduct.id) {
        await productsApi.update(editingProduct.id, payload);
      } else {
        await productsApi.create(payload);
      }
      setIsEditModalOpen(false);
      setEditingProduct(null);
      setProductVariants([]);
      loadProducts();
    } catch (err: any) {
      alert(getErrorMessage(err, 'Failed to save product'));
    }
  };

  const handleRefillSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refillProductId) return;

    setRefillSubmitting(true);
    try {
      await productsApi.refillStock({
        product_id: refillProductId,
        quantity: refillQty,
        unit: refillUnit,
        batch_number: refillBatch,
        expiry_date: refillExpiry,
        purchase_price: refillPurchasePrice,
        selling_price: refillSellingPrice,
        mrp: refillMrp,
        supplier_name: refillSupplier,
        invoice_number: refillInvoice,
        notes: refillNotes,
      });
      setIsRefillModalOpen(false);
      loadProducts();
      alert('Stock successfully refilled and purchase inward recorded!');
    } catch (err: any) {
      alert(getErrorMessage(err, 'Failed to refill stock'));
    } finally {
      setRefillSubmitting(false);
    }
  };

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProduct) return;

    try {
      await inventoryApi.adjustStock({
        product_id: adjustingProduct.id,
        adjustment_type: adjustType,
        quantity: adjustQty,
        reason: adjustReason
      });
      setIsAdjustModalOpen(false);
      setAdjustingProduct(null);
      loadProducts();
    } catch (err: any) {
      alert(getErrorMessage(err, 'Failed to adjust stock'));
    }
  };

  const addVariantRow = () => {
    setProductVariants([
      ...productVariants,
      {
        variant_name: '',
        unit_size: 1,
        unit: editingProduct?.unit || 'Kg',
        purchase_price: editingProduct?.cost_price || 0,
        selling_price: editingProduct?.selling_price || 0,
        mrp: editingProduct?.mrp || 0,
        stock: 0,
      }
    ]);
  };

  const updateVariantRow = (index: number, field: keyof ProductVariant, value: any) => {
    const updated = [...productVariants];
    (updated[index] as any)[field] = value;
    setProductVariants(updated);
  };

  const removeVariantRow = (index: number) => {
    setProductVariants(productVariants.filter((_, i) => i !== index));
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-50 text-emerald-800 rounded-xl">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Fertilizer Inventory & Warehouse
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                Barcodes, multi-unit packagings, batch lifecycle, duplicate checks & intelligent refills
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Refill Button */}
          <button
            onClick={() => {
              openRefillModal(null);
            }}
            className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-2.5 px-4 rounded-xl flex items-center gap-2 text-xs shadow-md transition-all active:scale-95"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Refill Stock</span>
          </button>

          {/* Add Product Button */}
          <button
            onClick={() => {
              setEditingProduct({
                name: '',
                company_name: '',
                category: 'Fertilizer',
                hsn_code: '31021000',
                unit: 'Bags',
                current_stock: 0,
                cost_price: 0,
                selling_price: 0,
                mrp: 0,
                gst_rate: 5,
                batch_number: 'B-' + Math.floor(1000 + Math.random() * 9000),
                min_stock_level: 20,
              });
              setProductVariants([]);
              setDuplicateAlert(null);
              setIsEditModalOpen(true);
            }}
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-4 rounded-xl flex items-center gap-2 text-xs shadow-md transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Product</span>
          </button>
        </div>
      </div>

      {/* Smart Refill Recommendations Banner */}
      {recommendations && recommendations.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-50/50 to-orange-50 border border-amber-200/80 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-amber-500 text-white rounded-lg shadow-sm">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  Fast-Moving Products: Recommended for Refill
                  <span className="text-[11px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full font-bold">
                    {recommendations.length} Needs Attention
                  </span>
                </h3>
                <p className="text-xs text-slate-600">
                  Calculated using 30-day sales velocity and stock depletion forecasts
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            {recommendations.slice(0, 6).map((rec) => {
              const matchedProd = products.find(p => p.id === rec.product_id);
              const isCrit = rec.urgency === 'CRITICAL';
              return (
                <div
                  key={rec.product_id}
                  className="bg-white p-3.5 rounded-xl border border-amber-200/70 shadow-xs flex flex-col justify-between hover:shadow-md transition"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-bold text-xs text-slate-900 line-clamp-1">
                        {rec.product_name}
                      </span>
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                          isCrit
                            ? 'bg-red-100 text-red-700 ring-1 ring-red-300'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {rec.urgency}
                      </span>
                    </div>
                    {rec.company_name && (
                      <p className="text-[10px] text-slate-400">{rec.company_name}</p>
                    )}

                    <div className="mt-2.5 grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2 rounded-lg">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Stock Left:</span>
                        <span className="font-bold text-slate-900">
                          {rec.current_stock} {rec.unit}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Est. Days Left:</span>
                        <span className={`font-bold ${isCrit ? 'text-red-600' : 'text-amber-600'}`}>
                          {rec.days_of_stock_left} Days
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] text-slate-500">
                      Sold {rec.units_sold_30d} {rec.unit} in 30d
                    </span>
                    <button
                      onClick={() => matchedProd && openRefillModal(matchedProd, rec.suggested_refill_quantity)}
                      className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Refill {rec.suggested_refill_quantity}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          {/* Search box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search product, barcode (890...), batch, or company..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-brand-500 focus:bg-white focus:outline-none"
            />
          </div>

          {/* Alert Filter Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilterType('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                filterType === 'ALL'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All ({products.length})
            </button>
            <button
              onClick={() => setFilterType('LOW_STOCK')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                filterType === 'LOW_STOCK'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Low Stock
            </button>
            <button
              onClick={() => setFilterType('NEAR_EXPIRY')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                filterType === 'NEAR_EXPIRY'
                  ? 'bg-red-600 text-white'
                  : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              Expiring Soon
            </button>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pt-1 pb-0.5 text-xs">
          {['ALL', 'Fertilizer', 'Pesticide', 'Seeds', 'Micronutrients', 'Bio-fertilizer', 'Organic'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-brand-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Product List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 text-[11px]">
              <tr>
                <th className="py-3 px-4">Fertilizer / Product</th>
                <th className="py-3 px-3">Barcode</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3 text-center">Batch / Expiry</th>
                <th className="py-3 px-3 text-right">Cost Price</th>
                <th className="py-3 px-3 text-right">Selling Rate</th>
                <th className="py-3 px-4 text-center">Stock Level</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.map((p) => {
                const isLow = safeNumber(p.current_stock) <= safeNumber(p.min_stock_level ?? p.minimum_stock ?? 20);
                const costPrice = safeNumber(p.cost_price ?? p.purchase_price);
                const sellingPrice = safeNumber(p.selling_price);
                const prodName = p.name || p.product_name || 'Fertilizer Product';
                const batchNo = p.batch_number || p.product_code || 'N/A';
                const unitStr = p.unit || 'Bags';
                const barcodeStr = p.barcode || String(10000 + p.id);

                return (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="font-bold text-slate-900">{prodName}</p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            {p.company_name ? `${p.company_name} • ` : ''}
                            Unit: {unitStr}
                            {p.variants && p.variants.length > 1 ? ` • ${p.variants.length} packaging variants` : ''}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <button
                        onClick={() => {
                          setSelectedBarcodeProduct({ ...p, barcode: barcodeStr });
                          setIsBarcodeModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md font-mono text-[11px] font-semibold border border-slate-300"
                        title="Click to preview & print barcode"
                      >
                        <Barcode className="w-3.5 h-3.5 text-slate-600" />
                        {barcodeStr}
                      </button>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                        {p.category}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="font-mono text-slate-700 text-[11px] font-semibold block">{batchNo}</span>
                      <span className="text-[10px] text-slate-400">{p.expiry_date || '-'}</span>
                    </td>
                    <td className="py-3 px-3 text-right font-medium text-slate-600">
                      {formatCurrency(costPrice)}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-slate-900">
                      {formatCurrency(sellingPrice)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-black ${
                        isLow
                          ? 'bg-red-100 text-red-700 ring-1 ring-red-300'
                          : 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
                      }`}>
                        {safeNumber(p.current_stock)} {unitStr}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openRefillModal(p)}
                          className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Refill Stock"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setAdjustingProduct(p);
                            setAdjustQty(0);
                            setAdjustReason('');
                            setIsAdjustModalOpen(true);
                          }}
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Adjust Stock"
                        >
                          <ArrowUpDown className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setEditingProduct(p);
                            setProductVariants(p.variants || []);
                            setDuplicateAlert(null);
                            setIsEditModalOpen(true);
                          }}
                          className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit Product"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Refill Stock Modal */}
      {isRefillModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="px-5 py-4 bg-emerald-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-emerald-300" />
                <h3 className="font-bold text-sm">Refill Existing Stock & Inward Goods</h3>
              </div>
              <button
                onClick={() => setIsRefillModalOpen(false)}
                className="text-emerald-200 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRefillSubmit} className="p-5 space-y-4 text-xs">
              {/* Product Selector - Searchable Typeahead for 1000+ products */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Product to Refill *
                </label>
                {refillProductId ? (
                  (() => {
                    const sel = products.find(p => p.id === refillProductId);
                    if (!sel) return null;
                    return (
                      <div className="bg-emerald-50/80 border border-emerald-300 rounded-xl p-3 flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-xs">
                              {sel.name || sel.product_name}
                            </span>
                            <span className="font-mono text-[10px] font-bold bg-white text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-200">
                              Code: {sel.barcode || sel.product_code}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 mt-0.5">
                            {sel.company_name ? `${sel.company_name} • ` : ''}
                            Current Stock: <strong className="text-emerald-800">{sel.current_stock} {sel.unit}</strong>
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setRefillProductId(null);
                            setRefillProductSearch('');
                          }}
                          className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 hover:underline px-2 py-1"
                        >
                          Change Product
                        </button>
                      </div>
                    );
                  })()
                ) : (
                  <div className="relative space-y-1.5">
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={refillProductSearch}
                        onChange={(e) => setRefillProductSearch(e.target.value)}
                        placeholder="Search 1000+ products by name, company, or 5-digit code..."
                        className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none shadow-xs"
                        autoFocus
                      />
                    </div>

                    {/* Filtered suggestions list */}
                    <div className="border border-slate-200 rounded-xl max-h-48 overflow-y-auto divide-y divide-slate-100 bg-white shadow-md">
                      {products
                        .filter((p) => {
                          if (!refillProductSearch.trim()) return true;
                          const q = refillProductSearch.toLowerCase();
                          const pName = safeString(p.name || p.product_name).toLowerCase();
                          const pComp = safeString(p.company_name).toLowerCase();
                          const pBar = safeString(p.barcode).toLowerCase();
                          const pCode = safeString(p.product_code).toLowerCase();
                          return pName.includes(q) || pComp.includes(q) || pBar.includes(q) || pCode.includes(q);
                        })
                        .slice(0, 30)
                        .map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              selectProductForRefill(p);
                              setRefillProductSearch('');
                            }}
                            className="w-full text-left p-2.5 hover:bg-emerald-50/70 transition flex items-center justify-between text-xs"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-800">{p.name || p.product_name}</span>
                                <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1 rounded">
                                  {p.barcode || p.product_code}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500">
                                {p.company_name ? `${p.company_name} • ` : ''}
                                Stock: <strong className="text-emerald-700">{p.current_stock} {p.unit}</strong>
                              </p>
                            </div>
                            <span className="text-[11px] font-bold text-emerald-700 font-mono">
                              ₹{formatCurrency(p.selling_price)}
                            </span>
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Quantity and Unit */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Inward Quantity to Add *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.1"
                    required
                    value={refillQty}
                    onChange={(e) => setRefillQty(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 font-black text-sm text-emerald-800 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Unit of Measure</label>
                  <select
                    value={refillUnit}
                    onChange={(e) => setRefillUnit(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="Bags">Bags</option>
                    <option value="Kg">Kg (Kilograms)</option>
                    <option value="Grams">Grams</option>
                    <option value="Litres">Litres</option>
                    <option value="ml">ml (Millilitres)</option>
                    <option value="Bottles">Bottles</option>
                    <option value="Packets">Packets</option>
                  </select>
                </div>
              </div>

              {/* Batch & Expiry */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">New / Current Batch No.</label>
                  <input
                    type="text"
                    value={refillBatch}
                    onChange={(e) => setRefillBatch(e.target.value)}
                    className="w-full px-2.5 py-1.5 font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Expiry Date</label>
                  <input
                    type="date"
                    value={refillExpiry}
                    onChange={(e) => setRefillExpiry(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Pricing */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Inward Cost Price (₹)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={refillPurchasePrice}
                    onChange={(e) => setRefillPurchasePrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Selling Price (₹)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={refillSellingPrice}
                    onChange={(e) => setRefillSellingPrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">MRP (₹)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={refillMrp}
                    onChange={(e) => setRefillMrp(parseFloat(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Supplier & Inward Bill No */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Supplier / Depot Name</label>
                  <input
                    type="text"
                    value={refillSupplier}
                    onChange={(e) => setRefillSupplier(e.target.value)}
                    placeholder="e.g. IFFCO Central Depot"
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Supplier Invoice / Bill No.</label>
                  <input
                    type="text"
                    value={refillInvoice}
                    onChange={(e) => setRefillInvoice(e.target.value)}
                    placeholder="e.g. INV-9921"
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Inward Notes</label>
                <input
                  type="text"
                  value={refillNotes}
                  onChange={(e) => setRefillNotes(e.target.value)}
                  placeholder="e.g. Arrived via truck, bags checked"
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsRefillModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={refillSubmitting}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white px-5 py-2 rounded-xl font-bold shadow flex items-center gap-1.5 transition-all"
                >
                  {refillSubmitting ? 'Refilling...' : 'Confirm Refill & Add Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {isEditModalOpen && editingProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden my-6">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">
                {editingProduct.id ? 'Edit Product Details' : 'Add New Product (Generates Barcode & Packaging)'}
              </h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-5 space-y-4 text-xs max-h-[80vh] overflow-y-auto">
              {/* Duplicate Prevention Alert */}
              {duplicateAlert?.exists && !editingProduct.id && (
                <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-amber-900 text-xs">
                        Product Already Exists in Database!
                      </h4>
                      <p className="text-[11px] text-amber-800 mt-0.5">
                        {duplicateAlert.message}
                      </p>
                      <p className="text-[10px] text-amber-700 mt-1">
                        Creating another product will generate a duplicate barcode and cause confusion. Please refill the existing stock instead.
                      </p>
                    </div>
                  </div>

                  {duplicateAlert.product && (
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          const existing = duplicateAlert.product!;
                          setIsEditModalOpen(false);
                          openRefillModal(existing);
                        }}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-sm"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Refill This Product Instead
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Product Basic Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Product Name *</label>
                  <input
                    type="text"
                    required
                    value={editingProduct.name || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                    placeholder="e.g. Chlorpyrifos 20% EC"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  {checkingDuplicate && (
                    <span className="text-[10px] text-slate-400">Checking duplicate...</span>
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Company / Brand</label>
                  <input
                    type="text"
                    value={editingProduct.company_name || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, company_name: e.target.value })}
                    placeholder="e.g. Dhanuka Agritech"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={editingProduct.category || 'Fertilizer'}
                    onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="Fertilizer">Fertilizer</option>
                    <option value="Pesticide">Pesticide</option>
                    <option value="Seeds">Seeds</option>
                    <option value="Micronutrients">Micronutrients</option>
                    <option value="Bio-fertilizer">Bio-fertilizer</option>
                    <option value="Organic">Organic</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Primary Unit</label>
                  <select
                    value={editingProduct.unit || 'Bags'}
                    onChange={(e) => setEditingProduct({ ...editingProduct, unit: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="Bags">Bags</option>
                    <option value="Kg">Kg</option>
                    <option value="Grams">Grams</option>
                    <option value="Litres">Litres</option>
                    <option value="ml">ml</option>
                    <option value="Bottles">Bottles</option>
                    <option value="Packets">Packets</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">HSN Code</label>
                  <input
                    type="text"
                    value={editingProduct.hsn_code || '31021000'}
                    onChange={(e) => setEditingProduct({ ...editingProduct, hsn_code: e.target.value })}
                    className="w-full px-2.5 py-1.5 font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Batch & Expiry */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Batch Number</label>
                  <input
                    type="text"
                    value={editingProduct.batch_number || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, batch_number: e.target.value })}
                    className="w-full px-2.5 py-1.5 font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Expiry Date</label>
                  <input
                    type="date"
                    value={editingProduct.expiry_date || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, expiry_date: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Default Pricing & Stock */}
              <div className="grid grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Purchase Price (₹)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={editingProduct.cost_price ?? 0}
                    onChange={(e) => setEditingProduct({ ...editingProduct, cost_price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Selling Rate (₹)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={editingProduct.selling_price ?? 0}
                    onChange={(e) => setEditingProduct({ ...editingProduct, selling_price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2.5 py-1.5 font-bold text-slate-900 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">GST Rate %</label>
                  <select
                    value={editingProduct.gst_rate ?? 5}
                    onChange={(e) => setEditingProduct({ ...editingProduct, gst_rate: parseInt(e.target.value) })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="0">0% (Exempt)</option>
                    <option value="5">5% (Fertilizers)</option>
                    <option value="12">12%</option>
                    <option value="18">18% (Pesticides)</option>
                    <option value="28">28%</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Opening Stock</label>
                  <input
                    type="number"
                    value={editingProduct.current_stock ?? 0}
                    onChange={(e) => setEditingProduct({ ...editingProduct, current_stock: parseInt(e.target.value) || 0 })}
                    className="w-full px-2.5 py-1.5 font-black border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Multi-Unit Packaging Variants Section */}
              <div className="border border-slate-200 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs">
                      Packaging & Size Variants (e.g. 250ml, 500ml, 1 Litre)
                    </h4>
                    <p className="text-[10px] text-slate-500">
                      Configure different bottle/packet sizes with individual selling rates
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addVariantRow}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-bold text-xs flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    Add Packaging
                  </button>
                </div>

                {productVariants.length > 0 && (
                  <div className="space-y-2 pt-2">
                    {productVariants.map((v, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg text-xs">
                        <input
                          type="text"
                          placeholder="Pack Name (e.g. 250ml Bottle)"
                          value={v.variant_name}
                          onChange={(e) => updateVariantRow(idx, 'variant_name', e.target.value)}
                          className="w-1/3 px-2 py-1 bg-white border border-slate-300 rounded text-xs"
                          required
                        />
                        <input
                          type="number"
                          placeholder="Size (250)"
                          value={v.unit_size}
                          onChange={(e) => updateVariantRow(idx, 'unit_size', parseFloat(e.target.value) || 0)}
                          className="w-20 px-2 py-1 bg-white border border-slate-300 rounded text-xs"
                          required
                        />
                        <input
                          type="text"
                          placeholder="Unit (ml/kg)"
                          value={v.unit}
                          onChange={(e) => updateVariantRow(idx, 'unit', e.target.value)}
                          className="w-20 px-2 py-1 bg-white border border-slate-300 rounded text-xs"
                          required
                        />
                        <input
                          type="number"
                          placeholder="Selling ₹"
                          value={v.selling_price}
                          onChange={(e) => updateVariantRow(idx, 'selling_price', parseFloat(e.target.value) || 0)}
                          className="w-24 px-2 py-1 bg-white border border-slate-300 rounded text-xs font-bold text-slate-900"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => removeVariantRow(idx)}
                          className="p-1 text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={duplicateAlert?.exists && !editingProduct.id}
                  className={`px-5 py-2 rounded-xl font-bold shadow transition-all ${
                    duplicateAlert?.exists && !editingProduct.id
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                      : 'bg-emerald-700 hover:bg-emerald-800 text-white'
                  }`}
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Barcode Print Modal */}
      {isBarcodeModalOpen && selectedBarcodeProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden p-6 space-y-4 text-center">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                <Barcode className="w-4 h-4 text-emerald-700" />
                Product Barcode Label
              </h3>
              <button onClick={() => setIsBarcodeModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Printable Label Card */}
            <div className="p-4 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 space-y-2 text-slate-900">
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                Kisan Seva Kendra
              </p>
              <h4 className="font-bold text-sm leading-tight text-slate-900">
                {selectedBarcodeProduct.name || selectedBarcodeProduct.product_name}
              </h4>
              <p className="text-xs text-slate-500">
                Net Qty: {selectedBarcodeProduct.unit || 'Pack'}
              </p>

              {/* Barcode Graphic */}
              <div className="py-2 flex flex-col items-center">
                <div className="flex items-center justify-center gap-0.5 h-12 w-48 bg-white p-1 border border-slate-200">
                  {/* CSS barcode simulation lines */}
                  {[3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 1, 4, 2, 3, 1, 2, 4, 1].map((w, i) => (
                    <div
                      key={i}
                      className="bg-black h-full"
                      style={{ width: `${w * 2}px` }}
                    />
                  ))}
                </div>
                <span className="font-mono text-xs font-bold tracking-widest text-slate-800 mt-1">
                  {selectedBarcodeProduct.barcode}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs font-bold pt-2 border-t border-slate-200">
                <span>MRP: ₹{selectedBarcodeProduct.mrp || selectedBarcodeProduct.selling_price}</span>
                <span className="text-emerald-700">GST: {selectedBarcodeProduct.gst_rate}%</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Label
              </button>
              <button
                onClick={() => setIsBarcodeModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {isAdjustModalOpen && adjustingProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">Adjust Stock: {adjustingProduct.name || adjustingProduct.product_name}</h3>
              <button
                onClick={() => setIsAdjustModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAdjustStock} className="p-5 space-y-3.5 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-slate-500">Current Warehouse Stock:</p>
                <p className="text-lg font-black text-brand-900">
                  {adjustingProduct.current_stock} {adjustingProduct.unit}
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Adjustment Type</label>
                <select
                  value={adjustType}
                  onChange={(e) => setAdjustType(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="AUDIT_CORRECTION">Audit Count Correction (+/-)</option>
                  <option value="DAMAGE">Damaged / Leaked Bags (-)</option>
                  <option value="RETURN">Customer Return (+)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Quantity Adjustment (positive or negative number)
                </label>
                <input
                  type="number"
                  required
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(parseInt(e.target.value) || 0)}
                  placeholder="e.g. -5 or +10"
                  className="w-full px-3 py-2 font-black text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Reason / Note</label>
                <input
                  type="text"
                  required
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="e.g. Monthly godown physical verification"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-emerald-700 hover:bg-emerald-800 text-white px-5 py-2 rounded-xl font-bold shadow transition-all"
                >
                  Confirm Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
