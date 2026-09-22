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
  Package
} from 'lucide-react';
import { productsApi, inventoryApi } from '../api';
import { Product } from '../types';
import { safeNumber, safeString, formatCurrency } from '../utils/formatters';

export const InventoryPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [filterType, setFilterType] = useState<'ALL' | 'LOW_STOCK' | 'NEAR_EXPIRY'>('ALL');
  const [isLoading, setIsLoading] = useState(true);

  // Add / Edit Modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);

  // Stock Adjustment Modal state
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [adjustType, setAdjustType] = useState<'DAMAGE' | 'AUDIT_CORRECTION' | 'RETURN'>('AUDIT_CORRECTION');
  const [adjustQty, setAdjustQty] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState('');

  const loadProducts = async () => {
    setIsLoading(true);
    try {
      const data = await productsApi.getAll();
      setProducts(data);
    } catch {
      // Demo mock fallback
      setProducts([
        {
          id: 1,
          name: 'IFFCO Neem Coated Urea (45 Kg)',
          category: 'Fertilizer',
          hsn_code: '31021000',
          unit: 'Bags',
          current_stock: 140,
          cost_price: 250,
          selling_price: 266.5,
          mrp: 266.5,
          gst_rate: 5,
          batch_number: 'NCU-2024-88',
          expiry_date: '2027-04-30',
          min_stock_level: 50,
          is_active: true
        },
        {
          id: 2,
          name: 'IFFCO DAP 18-46-0 (50 Kg)',
          category: 'Fertilizer',
          hsn_code: '31053000',
          unit: 'Bags',
          current_stock: 18,
          cost_price: 1280,
          selling_price: 1350.0,
          mrp: 1350.0,
          gst_rate: 5,
          batch_number: 'DAP-901-B',
          expiry_date: '2026-11-20',
          min_stock_level: 25,
          is_active: true
        },
        {
          id: 3,
          name: 'MOP - Muriate of Potash 60% (50 Kg)',
          category: 'Fertilizer',
          hsn_code: '31042000',
          unit: 'Bags',
          current_stock: 45,
          cost_price: 1600,
          selling_price: 1700.0,
          mrp: 1700.0,
          gst_rate: 5,
          batch_number: 'MOP-5521',
          expiry_date: '2027-01-15',
          min_stock_level: 20,
          is_active: true
        },
        {
          id: 4,
          name: 'UPL Saaf Fungicide (500g)',
          category: 'Pesticide',
          hsn_code: '38089290',
          unit: 'Packets',
          current_stock: 8,
          cost_price: 450,
          selling_price: 520.0,
          mrp: 550.0,
          gst_rate: 18,
          batch_number: 'SAF-24-09',
          expiry_date: '2026-06-30',
          min_stock_level: 15,
          is_active: true
        },
        {
          id: 5,
          name: 'Bayer Confidor Insecticide (100ml)',
          category: 'Pesticide',
          hsn_code: '38089199',
          unit: 'Bottles',
          current_stock: 12,
          cost_price: 320,
          selling_price: 380.0,
          mrp: 410.0,
          gst_rate: 18,
          batch_number: 'BC-2023-41',
          expiry_date: '2024-10-15',
          min_stock_level: 10,
          is_active: true
        }
      ]);
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
        return pName.includes(q) || pBatch.includes(q) || pHsn.includes(q);
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

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    if (!editingProduct.name && !(editingProduct as any).product_name) return;

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
    };

    try {
      if (editingProduct.id) {
        await productsApi.update(editingProduct.id, payload);
      } else {
        await productsApi.create(payload);
      }
      setIsEditModalOpen(false);
      setEditingProduct(null);
      loadProducts();
    } catch {
      // Local demo fallback
      if (editingProduct.id) {
        setProducts(products.map(p => p.id === editingProduct.id ? { ...p, ...payload } as Product : p));
      } else {
        setProducts([...products, { ...payload, id: Date.now(), is_active: true } as Product]);
      }
      setIsEditModalOpen(false);
      setEditingProduct(null);
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
    } catch {
      // Local fallback
      setProducts(products.map(p => {
        if (p.id === adjustingProduct.id) {
          return { ...p, current_stock: Math.max(0, safeNumber(p.current_stock) + adjustQty) };
        }
        return p;
      }));
      setIsAdjustModalOpen(false);
      setAdjustingProduct(null);
    }
  };


  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Fertilizer Inventory & Warehouse
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Real-time stock counts, batch management, expiry tracking, and adjustments
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setEditingProduct({
                name: '',
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
              setIsEditModalOpen(true);
            }}
            className="bg-brand-700 hover:bg-brand-600 text-white font-bold py-2.5 px-4 rounded-xl flex items-center gap-2 text-xs shadow-md transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Product</span>
          </button>
        </div>
      </div>

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
              placeholder="Search fertilizer name, batch, or HSN code..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-brand-500 focus:bg-white focus:outline-none"
            />
          </div>

          {/* Alert Filter Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilterType('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                filterType === 'ALL'
                  ? 'bg-brand-800 text-white'
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
                  ? 'bg-slate-900 text-white shadow-sm'
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
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3 text-center">Batch No.</th>
                <th className="py-3 px-3 text-center">HSN</th>
                <th className="py-3 px-3 text-right">Cost Price</th>
                <th className="py-3 px-3 text-right">Selling Rate</th>
                <th className="py-3 px-3 text-center">GST%</th>
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
                const hsnCode = p.hsn_code || '31021000';
                const unitStr = p.unit || 'Bags';

                return (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-900">{prodName}</p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        Unit: {unitStr} {p.expiry_date ? `• Exp: ${p.expiry_date}` : ''}
                      </p>
                    </td>
                    <td className="py-3 px-3">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                        {p.category || 'Fertilizer'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-[11px] text-slate-700">
                      {batchNo}
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-[11px] text-slate-500">
                      {hsnCode}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-600">
                      ₹{formatCurrency(costPrice)}
                    </td>
                    <td className="py-3 px-3 text-right font-black text-brand-800">
                      ₹{formatCurrency(sellingPrice)}
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-slate-700">
                      {safeNumber(p.gst_rate)}%
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
                          onClick={() => {
                            setAdjustingProduct(p);
                            setAdjustQty(0);
                            setAdjustReason('');
                            setIsAdjustModalOpen(true);
                          }}
                          className="p-1.5 text-slate-500 hover:text-brand-700 hover:bg-brand-50 rounded-lg transition-colors"
                          title="Adjust Stock"
                        >
                          <ArrowUpDown className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setEditingProduct(p);
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

      {/* Add / Edit Product Modal */}
      {isEditModalOpen && editingProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="px-5 py-4 bg-brand-800 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">
                {editingProduct.id ? 'Edit Product Details' : 'Add New Fertilizer / Chemical'}
              </h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-brand-200 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Product Name *</label>
                <input
                  type="text"
                  required
                  value={editingProduct.name || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  placeholder="e.g. IFFCO Neem Coated Urea"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={editingProduct.category || 'Fertilizer'}
                    onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
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
                  <label className="block font-semibold text-slate-700 mb-1">Unit</label>
                  <select
                    value={editingProduct.unit || 'Bags'}
                    onChange={(e) => setEditingProduct({ ...editingProduct, unit: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  >
                    <option value="Bags">Bags</option>
                    <option value="Kg">Kg</option>
                    <option value="Litres">Litres</option>
                    <option value="Bottles">Bottles</option>
                    <option value="Packets">Packets</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">HSN Code</label>
                  <input
                    type="text"
                    value={editingProduct.hsn_code || '31021000'}
                    onChange={(e) => setEditingProduct({ ...editingProduct, hsn_code: e.target.value })}
                    className="w-full px-2.5 py-1.5 font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Batch Number</label>
                  <input
                    type="text"
                    value={editingProduct.batch_number || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, batch_number: e.target.value })}
                    className="w-full px-2.5 py-1.5 font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Expiry Date</label>
                  <input
                    type="date"
                    value={editingProduct.expiry_date || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, expiry_date: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Cost Price (₹)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={editingProduct.cost_price ?? 0}
                    onChange={(e) => setEditingProduct({ ...editingProduct, cost_price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Selling Rate (₹)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={editingProduct.selling_price ?? 0}
                    onChange={(e) => setEditingProduct({ ...editingProduct, selling_price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2.5 py-1.5 font-bold text-brand-800 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">GST Rate %</label>
                  <select
                    value={editingProduct.gst_rate ?? 5}
                    onChange={(e) => setEditingProduct({ ...editingProduct, gst_rate: parseInt(e.target.value) })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  >
                    <option value="0">0% (Exempt)</option>
                    <option value="5">5% (Fertilizers)</option>
                    <option value="12">12%</option>
                    <option value="18">18% (Pesticides)</option>
                    <option value="28">28%</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Current Stock Qty</label>
                  <input
                    type="number"
                    value={editingProduct.current_stock ?? 0}
                    onChange={(e) => setEditingProduct({ ...editingProduct, current_stock: parseInt(e.target.value) || 0 })}
                    className="w-full px-2.5 py-1.5 font-black border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Min Stock Alert Level</label>
                  <input
                    type="number"
                    value={editingProduct.min_stock_level ?? 20}
                    onChange={(e) => setEditingProduct({ ...editingProduct, min_stock_level: parseInt(e.target.value) || 0 })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>
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
                  className="bg-brand-700 hover:bg-brand-600 text-white px-5 py-2 rounded-xl font-bold shadow transition-all"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {isAdjustModalOpen && adjustingProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">Adjust Stock: {adjustingProduct.name}</h3>
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
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
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
                  className="w-full px-3 py-2 font-black text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
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
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
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
                  className="bg-brand-700 hover:bg-brand-600 text-white px-5 py-2 rounded-xl font-bold shadow transition-all"
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
