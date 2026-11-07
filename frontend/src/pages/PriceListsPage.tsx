import React, { useState, useEffect, useMemo } from 'react';
import {
  Tag,
  Plus,
  Percent,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  Lock,
  Trash2,
  Edit3,
  Search,
  Package,
  Layers,
  ShieldAlert,
  Sparkles,
  X,
  RefreshCw,
  CheckSquare,
  Square,
  Power
} from 'lucide-react';
import { priceListsApi, productsApi } from '../api';
import { PriceList, Product } from '../types';
import { useAuth } from '../context/AuthContext';

const CATEGORIES = [
  'All',
  'Fertilizer',
  'Pesticide',
  'Seeds',
  'Micronutrients',
  'Bio-fertilizer',
  'Organic',
  'Others',
];

export const PriceListsPage: React.FC = () => {
  const { user } = useAuth();
  const isOwner = (user?.role || '').toLowerCase() === 'owner';

  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Create / Edit Price List Modal
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [editingPriceList, setEditingPriceList] = useState<PriceList | null>(null);
  const [formName, setFormName] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formAdjustmentType, setFormAdjustmentType] = useState<'DISCOUNT' | 'INCREMENT'>('DISCOUNT');
  const [formCalculationMode, setFormCalculationMode] = useState<'PERCENTAGE' | 'FIXED'>('PERCENTAGE');
  const [formAdjustmentValue, setFormAdjustmentValue] = useState<string>('');
  const [formIsActive, setFormIsActive] = useState<boolean>(true);
  const [formScope, setFormScope] = useState<'NONE' | 'ALL' | 'SPECIFIED'>('NONE');
  const [formSelectedProductIds, setFormSelectedProductIds] = useState<number[]>([]);
  const [formProductSearch, setFormProductSearch] = useState<string>('');

  // Assign Specified Products Modal (for an existing Price List)
  const [assignModalPriceList, setAssignModalPriceList] = useState<PriceList | null>(null);
  const [assignSelectedIds, setAssignSelectedIds] = useState<number[]>([]);
  const [assignSearchQuery, setAssignSearchQuery] = useState<string>('');
  const [assignCategoryFilter, setAssignCategoryFilter] = useState<string>('All');

  const showNotification = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 5000);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [plData, prodData] = await Promise.all([
        priceListsApi.getAll(),
        productsApi.getAll(),
      ]);
      setPriceLists(plData);
      setAllProducts(prodData);
    } catch (err: any) {
      showNotification(
        'error',
        err?.response?.data?.detail || 'Failed to load price lists and products.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOwner) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [isOwner]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(val || 0);

  const computePreviewPrice = (
    basePrice: number,
    adjType: 'DISCOUNT' | 'INCREMENT',
    calcMode: 'PERCENTAGE' | 'FIXED',
    adjVal: number
  ) => {
    const base = Number(basePrice || 0);
    const val = Number(adjVal || 0);
    if (val <= 0) return base;
    const delta = calcMode === 'PERCENTAGE' ? (base * val) / 100 : val;
    const result = adjType === 'DISCOUNT' ? Math.max(0, base - delta) : base + delta;
    return Math.round(result * 100) / 100;
  };

  const openCreateModal = () => {
    setEditingPriceList(null);
    setFormName('');
    setFormDescription('');
    setFormAdjustmentType('DISCOUNT');
    setFormCalculationMode('PERCENTAGE');
    setFormAdjustmentValue('');
    setFormIsActive(true);
    setFormScope('NONE');
    setFormSelectedProductIds([]);
    setFormProductSearch('');
    setShowCreateModal(true);
  };

  const openEditModal = (pl: PriceList) => {
    setEditingPriceList(pl);
    setFormName(pl.name);
    setFormDescription(pl.description || '');
    setFormAdjustmentType(pl.adjustment_type);
    setFormCalculationMode(pl.calculation_mode);
    setFormAdjustmentValue(String(pl.adjustment_value));
    setFormIsActive(pl.is_active);
    setFormScope('NONE');
    setFormSelectedProductIds([]);
    setShowCreateModal(true);
  };

  const handleSavePriceList = async (e: React.FormEvent) => {
    e.preventDefault();
    const numVal = parseFloat(formAdjustmentValue);
    if (!formName.trim()) {
      showNotification('error', 'Please enter a Price List name.');
      return;
    }
    if (isNaN(numVal) || numVal <= 0) {
      showNotification('error', 'Please enter a valid positive adjustment value.');
      return;
    }
    if (formCalculationMode === 'PERCENTAGE' && formAdjustmentType === 'DISCOUNT' && numVal >= 100) {
      showNotification('error', 'Percentage discount must be less than 100%.');
      return;
    }

    setActionLoading(true);
    try {
      if (editingPriceList) {
        await priceListsApi.update(editingPriceList.id, {
          name: formName.trim(),
          description: formDescription.trim() || undefined,
          adjustment_type: formAdjustmentType,
          calculation_mode: formCalculationMode,
          adjustment_value: numVal,
          is_active: formIsActive,
        });
        showNotification('success', `Updated price list "${formName.trim()}".`);
      } else {
        await priceListsApi.create({
          name: formName.trim(),
          description: formDescription.trim() || undefined,
          adjustment_type: formAdjustmentType,
          calculation_mode: formCalculationMode,
          adjustment_value: numVal,
          is_active: formIsActive,
          apply_to_all: formScope === 'ALL',
          product_ids: formScope === 'SPECIFIED' ? formSelectedProductIds : [],
        });
        showNotification('success', `Created price list "${formName.trim()}".`);
      }
      setShowCreateModal(false);
      await fetchData();
    } catch (err: any) {
      showNotification(
        'error',
        err?.response?.data?.detail || 'Failed to save price list.'
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleActive = async (pl: PriceList) => {
    setActionLoading(true);
    try {
      await priceListsApi.update(pl.id, { is_active: !pl.is_active });
      showNotification(
        'success',
        `Price list "${pl.name}" is now ${!pl.is_active ? 'Active' : 'Paused (Base prices restored)'}.`
      );
      await fetchData();
    } catch (err: any) {
      showNotification('error', err?.response?.data?.detail || 'Failed to toggle price list.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeletePriceList = async (pl: PriceList) => {
    if (
      !window.confirm(
        `Delete price list "${pl.name}"? All ${pl.product_count} assigned products will revert to their original base selling price.`
      )
    ) {
      return;
    }
    setActionLoading(true);
    try {
      await priceListsApi.delete(pl.id);
      showNotification('success', `Deleted price list "${pl.name}" and restored base prices.`);
      await fetchData();
    } catch (err: any) {
      showNotification('error', err?.response?.data?.detail || 'Failed to delete price list.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApplyToAllEligible = async (pl: PriceList) => {
    // Check if any product is already assigned to ANOTHER price list
    const conflictingProducts = allProducts.filter(
      (p) => p.price_list_id && p.price_list_id !== pl.id
    );
    const eligibleProducts = allProducts.filter(
      (p) => !p.price_list_id || p.price_list_id === pl.id
    );

    if (eligibleProducts.length === 0) {
      showNotification(
        'error',
        'All products are already assigned to other price lists. Remove them from their existing price list first.'
      );
      return;
    }

    setActionLoading(true);
    try {
      if (conflictingProducts.length === 0) {
        // Every product in the shop is eligible — use apply_to_all: true
        const res = await priceListsApi.assignProducts(pl.id, {
          apply_to_all: true,
          product_ids: [],
        });
        showNotification('success', res.message || `Applied "${pl.name}" to all products.`);
      } else {
        // Assign all eligible products that don't have a conflicting price list
        const eligibleIds = eligibleProducts.map((p) => p.id);
        const res = await priceListsApi.assignProducts(pl.id, {
          apply_to_all: false,
          product_ids: eligibleIds,
        });
        showNotification(
          'success',
          `${res.message} (${conflictingProducts.length} product(s) skipped because they already belong to another price list).`
        );
      }
      await fetchData();
    } catch (err: any) {
      showNotification(
        'error',
        err?.response?.data?.detail || 'Failed to apply price list to products.'
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnassignProduct = async (pl: PriceList, productId: number, productName: string) => {
    setActionLoading(true);
    try {
      await priceListsApi.unassignProducts(pl.id, {
        unassign_all: false,
        product_ids: [productId],
      });
      showNotification(
        'success',
        `Removed "${productName}" from "${pl.name}" and restored its base price.`
      );
      await fetchData();
    } catch (err: any) {
      showNotification('error', err?.response?.data?.detail || 'Failed to remove product.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnassignAllFromList = async (pl: PriceList) => {
    if (
      !window.confirm(
        `Remove all ${pl.product_count} products from "${pl.name}" and restore their base prices?`
      )
    ) {
      return;
    }
    setActionLoading(true);
    try {
      await priceListsApi.unassignProducts(pl.id, {
        unassign_all: true,
        product_ids: [],
      });
      showNotification('success', `Cleared all products from "${pl.name}".`);
      await fetchData();
    } catch (err: any) {
      showNotification('error', err?.response?.data?.detail || 'Failed to unassign products.');
    } finally {
      setActionLoading(false);
    }
  };

  const openAssignModal = (pl: PriceList) => {
    setAssignModalPriceList(pl);
    // Pre-select products that are currently assigned to this price list
    const existingIds = (pl.products || []).map((p) => p.id);
    setAssignSelectedIds(existingIds);
    setAssignSearchQuery('');
    setAssignCategoryFilter('All');
  };

  const handleConfirmAssignProducts = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignModalPriceList) return;

    // Determine newly added vs removed products compared to current assignment
    const currentIds = new Set((assignModalPriceList.products || []).map((p) => p.id));
    const nextIds = new Set(assignSelectedIds);

    const toAssign = assignSelectedIds.filter((id) => !currentIds.has(id) || currentIds.has(id));
    const toUnassign = Array.from(currentIds).filter((id) => !nextIds.has(id));

    setActionLoading(true);
    try {
      if (toUnassign.length > 0) {
        await priceListsApi.unassignProducts(assignModalPriceList.id, {
          unassign_all: false,
          product_ids: toUnassign,
        });
      }
      if (toAssign.length > 0) {
        await priceListsApi.assignProducts(assignModalPriceList.id, {
          apply_to_all: false,
          product_ids: toAssign,
        });
      }
      showNotification(
        'success',
        `Updated product assignments for "${assignModalPriceList.name}".`
      );
      setAssignModalPriceList(null);
      await fetchData();
    } catch (err: any) {
      showNotification(
        'error',
        err?.response?.data?.detail || 'Failed to assign specified products.'
      );
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered products inside the "Assign Specified Products" modal
  const filteredModalProducts = useMemo(() => {
    const q = assignSearchQuery.trim().toLowerCase();
    return allProducts.filter((p) => {
      const cat = p.category || 'Fertilizer';
      const matchesCat =
        assignCategoryFilter === 'All' ||
        cat.toLowerCase() === assignCategoryFilter.toLowerCase();
      if (!q) return matchesCat;
      const matchesQ =
        (p.name || p.product_name || '').toLowerCase().includes(q) ||
        cat.toLowerCase().includes(q) ||
        (p.company_name || '').toLowerCase().includes(q) ||
        (p.product_code || '').toLowerCase().includes(q);
      return matchesCat && matchesQ;
    });
  }, [allProducts, assignSearchQuery, assignCategoryFilter]);

  // Filtered products inside the Create Modal when Scope === 'SPECIFIED'
  const filteredCreateModalProducts = useMemo(() => {
    const q = formProductSearch.trim().toLowerCase();
    return allProducts.filter((p) => {
      if (!q) return true;
      const cat = p.category || 'Fertilizer';
      return (
        p.name.toLowerCase().includes(q) ||
        cat.toLowerCase().includes(q) ||
        (p.company_name || '').toLowerCase().includes(q)
      );
    });
  }, [allProducts, formProductSearch]);

  if (!isOwner) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="bg-white border border-red-200 rounded-2xl p-8 text-center shadow-sm space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-bold text-slate-900">
            Admin / Owner Access Required
          </h1>
          <p className="text-xs text-slate-600 max-w-md mx-auto">
            Only the shop Administrator / Owner can create, modify, or assign Price Lists (Discounts &amp; Price Increments).
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Notification Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-xs font-semibold max-w-md animate-in fade-in slide-in-from-top-2 ${
            toast.type === 'success'
              ? 'bg-emerald-950 text-emerald-100 border-emerald-700'
              : 'bg-red-950 text-red-100 border-red-700'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          )}
          <span className="flex-1">{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl shrink-0">
            <Tag className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900">
                Price Lists (Discounts &amp; Price Increments)
              </h1>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                Admin / Owner Only
              </span>
            </div>
            <p className="text-xs md:text-sm text-slate-500 mt-0.5">
              Create discount or price-increase lists and apply them to all products or specified products. Each product can have at most one active price list at a time.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchData}
            disabled={loading || actionLoading}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            New Price List
          </button>
        </div>
      </div>

      {/* Policy Banner */}
      <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-2.5 text-xs text-emerald-950">
          <Sparkles className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5 sm:mt-0" />
          <span>
            <strong>Exclusive Product Rule:</strong> No two price lists can be added to the same product. Products already assigned to a price list are automatically locked from other price lists until unassigned.
          </span>
        </div>
        <div className="text-xs font-semibold text-emerald-800 shrink-0">
          {allProducts.filter((p) => p.price_list_id).length} / {allProducts.length} Products Assigned
        </div>
      </div>

      {/* Price Lists Grid */}
      {loading ? (
        <div className="min-h-[260px] bg-white rounded-2xl border border-slate-200 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-slate-500 font-medium">Loading price lists...</p>
          </div>
        </div>
      ) : priceLists.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto">
            <Tag className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900">No Price Lists Created Yet</h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Create your first Price List to apply a flat or percentage Discount or Price Increase across all products or selected products.
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            Create First Price List
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {priceLists.map((pl) => {
            const isDiscount = pl.adjustment_type === 'DISCOUNT';
            const badgeText =
              pl.calculation_mode === 'PERCENTAGE'
                ? `${isDiscount ? '-' : '+'}${pl.adjustment_value}% ${isDiscount ? 'Discount' : 'Increment'}`
                : `${isDiscount ? '-' : '+'}₹${pl.adjustment_value} ${isDiscount ? 'Discount' : 'Increment'}`;

            return (
              <div
                key={pl.id}
                className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition ${
                  pl.is_active ? 'border-slate-200' : 'border-slate-200 opacity-75'
                }`}
              >
                {/* Card Header */}
                <div className="p-5 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${
                          isDiscount
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-blue-100 text-blue-800 border border-blue-200'
                        }`}
                      >
                        {isDiscount ? (
                          <ArrowDownRight className="w-3.5 h-3.5" />
                        ) : (
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        )}
                        {badgeText}
                      </span>

                      <h2 className="text-base font-bold text-slate-900">{pl.name}</h2>

                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                          pl.is_active
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {pl.is_active ? 'Active' : 'Paused'}
                      </span>

                      <span className="text-xs text-slate-500 font-medium">
                        • {pl.product_count} Product{pl.product_count === 1 ? '' : 's'} Assigned
                      </span>
                    </div>

                    {pl.description && (
                      <p className="text-xs text-slate-500">{pl.description}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => openAssignModal(pl)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold transition shadow-xs"
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                      Assign Specified Products
                    </button>

                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleApplyToAllEligible(pl)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-semibold transition"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      Apply to All Products
                    </button>

                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleToggleActive(pl)}
                      className="flex items-center gap-1 px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
                      title={pl.is_active ? 'Pause price list' : 'Activate price list'}
                    >
                      <Power className="w-3.5 h-3.5" />
                      {pl.is_active ? 'Pause' : 'Activate'}
                    </button>

                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => openEditModal(pl)}
                      className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition"
                      title="Edit Price List"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleDeletePriceList(pl)}
                      className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition"
                      title="Delete Price List"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Assigned Products List */}
                <div className="p-4 bg-slate-50/50">
                  {pl.products && pl.products.length > 0 ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          Assigned Products ({pl.products.length})
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUnassignAllFromList(pl)}
                          className="text-xs font-semibold text-red-600 hover:text-red-700"
                        >
                          Remove All Products
                        </button>
                      </div>

                      <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl max-h-64">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold sticky top-0">
                            <tr>
                              <th className="py-2 px-3">Product Name</th>
                              <th className="py-2 px-3">Category</th>
                              <th className="py-2 px-3 text-right">Base Price</th>
                              <th className="py-2 px-3 text-right">Adjusted Selling Price</th>
                              <th className="py-2 px-3 text-right">Stock</th>
                              <th className="py-2 px-3 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {pl.products.map((prod) => (
                              <tr key={prod.id} className="hover:bg-slate-50">
                                <td className="py-2 px-3 font-semibold text-slate-900">
                                  {prod.product_name}
                                </td>
                                <td className="py-2 px-3">
                                  <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700">
                                    {prod.category || 'Fertilizer'}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-right text-slate-500 line-through">
                                  {formatCurrency(prod.base_selling_price)}
                                </td>
                                <td className="py-2 px-3 text-right font-bold text-emerald-700">
                                  {formatCurrency(prod.selling_price)}
                                </td>
                                <td className="py-2 px-3 text-right text-slate-700">
                                  {prod.current_stock} {prod.unit}
                                </td>
                                <td className="py-2 px-3 text-right">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleUnassignProduct(pl, prod.id, prod.product_name)
                                    }
                                    className="text-red-600 hover:text-red-800 font-semibold text-[11px]"
                                  >
                                    Remove
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="py-4 text-center text-xs text-slate-500">
                      No products assigned yet. Click <strong>Assign Specified Products</strong> or{' '}
                      <strong>Apply to All Products</strong> above.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ================================================================== */}
      {/* MODAL 1: Create / Edit Price List                                  */}
      {/* ================================================================== */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden my-8">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                  <Tag className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {editingPriceList ? 'Edit Price List' : 'Create New Price List'}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Configure discount or price increase rules for your catalog
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePriceList} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Price List Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Kharif Season 10% Discount, Bulk Dealer Rate, MRP Revision +5%"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Description (Optional)
                  </label>
                  <input
                    type="text"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Short note about this discount or price increase"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Adjustment Type: Discount vs Increment */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Adjustment Type *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormAdjustmentType('DISCOUNT')}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                        formAdjustmentType === 'DISCOUNT'
                          ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <ArrowDownRight className="w-4 h-4" />
                      Discount (-)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormAdjustmentType('INCREMENT')}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                        formAdjustmentType === 'INCREMENT'
                          ? 'bg-blue-700 text-white border-blue-700 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <ArrowUpRight className="w-4 h-4" />
                      Price Increase (+)
                    </button>
                  </div>
                </div>

                {/* Calculation Mode: Percentage vs Fixed */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Calculation Mode *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormCalculationMode('PERCENTAGE')}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                        formCalculationMode === 'PERCENTAGE'
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Percent className="w-3.5 h-3.5" />
                      Percentage (%)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormCalculationMode('FIXED')}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                        formCalculationMode === 'FIXED'
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span>₹</span>
                      Fixed Amount (₹)
                    </button>
                  </div>
                </div>

                {/* Adjustment Value */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {formAdjustmentType === 'DISCOUNT' ? 'Discount' : 'Price Increment'} Value (
                    {formCalculationMode === 'PERCENTAGE' ? '%' : '₹'}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={formAdjustmentValue}
                    onChange={(e) => setFormAdjustmentValue(e.target.value)}
                    placeholder={
                      formCalculationMode === 'PERCENTAGE'
                        ? 'e.g. 10 (for 10%)'
                        : 'e.g. 50 (for ₹50)'
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Product Application Scope (Only on Create) */}
              {!editingPriceList && (
                <div className="pt-3 border-t border-slate-100 space-y-3">
                  <label className="block text-xs font-bold text-slate-700">
                    Initial Product Assignment
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormScope('NONE')}
                      className={`p-2.5 rounded-xl border text-xs font-semibold text-left transition ${
                        formScope === 'NONE'
                          ? 'bg-emerald-50 border-emerald-600 text-emerald-900'
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      <div className="font-bold">Assign Later</div>
                      <div className="text-[11px] text-slate-500">Create price list first</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormScope('ALL')}
                      className={`p-2.5 rounded-xl border text-xs font-semibold text-left transition ${
                        formScope === 'ALL'
                          ? 'bg-emerald-50 border-emerald-600 text-emerald-900'
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      <div className="font-bold">Apply to All Products</div>
                      <div className="text-[11px] text-slate-500">All unassigned products</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormScope('SPECIFIED')}
                      className={`p-2.5 rounded-xl border text-xs font-semibold text-left transition ${
                        formScope === 'SPECIFIED'
                          ? 'bg-emerald-50 border-emerald-600 text-emerald-900'
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      <div className="font-bold">Specified Products</div>
                      <div className="text-[11px] text-slate-500">Choose specific products</div>
                    </button>
                  </div>

                  {formScope === 'SPECIFIED' && (
                    <div className="space-y-2 pt-2">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={formProductSearch}
                          onChange={(e) => setFormProductSearch(e.target.value)}
                          placeholder="Search products by name or category..."
                          className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                        />
                      </div>

                      <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                        {filteredCreateModalProducts.map((p) => {
                          const hasOtherList = Boolean(p.price_list_id);
                          const isChecked = formSelectedProductIds.includes(p.id);
                          const basePrice = p.base_selling_price ?? p.selling_price;
                          const preview = computePreviewPrice(
                            basePrice,
                            formAdjustmentType,
                            formCalculationMode,
                            parseFloat(formAdjustmentValue) || 0
                          );

                          return (
                            <div
                              key={p.id}
                              onClick={() => {
                                if (hasOtherList) return;
                                setFormSelectedProductIds((prev) =>
                                  prev.includes(p.id)
                                    ? prev.filter((id) => id !== p.id)
                                    : [...prev, p.id]
                                );
                              }}
                              className={`p-2.5 flex items-center justify-between text-xs ${
                                hasOtherList
                                  ? 'bg-slate-50 opacity-60 cursor-not-allowed'
                                  : 'hover:bg-emerald-50/40 cursor-pointer'
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                {hasOtherList ? (
                                  <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                                ) : isChecked ? (
                                  <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                                ) : (
                                  <Square className="w-4 h-4 text-slate-400 shrink-0" />
                                )}
                                <div>
                                  <div className="font-semibold text-slate-900">{p.name}</div>
                                  <div className="text-[11px] text-slate-500">
                                    Category: {p.category || 'Fertilizer'}
                                    {hasOtherList && (
                                      <span className="ml-2 text-amber-700 font-semibold">
                                        • Locked (Assigned to {p.price_list_name || 'another Price List'})
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="text-slate-400 line-through mr-1.5">
                                  {formatCurrency(basePrice)}
                                </span>
                                <span className="font-bold text-emerald-700">
                                  {formatCurrency(preview)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-sm"
                >
                  {actionLoading
                    ? 'Saving...'
                    : editingPriceList
                    ? 'Update Price List'
                    : 'Create Price List'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* MODAL 2: Assign Specified Products (Enforces 1 Price List / Prod)  */}
      {/* ================================================================== */}
      {assignModalPriceList && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full overflow-hidden my-8">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Package className="w-5 h-5 text-emerald-600" />
                  Assign Specified Products to &ldquo;{assignModalPriceList.name}&rdquo;
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select the products that should use this price list. Products already assigned to a different price list are locked so no two price lists can be added to the same product.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAssignModalPriceList(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmAssignProducts} className="p-5 space-y-4">
              {/* Search & Category Filter */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={assignSearchQuery}
                    onChange={(e) => setAssignSearchQuery(e.target.value)}
                    placeholder="Search by product name, category (e.g. Fertilizer, Others), or company..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                  />
                </div>
              </div>

              {/* Category Filter Pills */}
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setAssignCategoryFilter(cat)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                      assignCategoryFilter === cat
                        ? 'bg-emerald-700 text-white'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Product List */}
              <div className="max-h-80 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                {filteredModalProducts.length > 0 ? (
                  filteredModalProducts.map((p) => {
                    const lockedByOtherList =
                      Boolean(p.price_list_id) &&
                      p.price_list_id !== assignModalPriceList.id;
                    const isSelected = assignSelectedIds.includes(p.id);
                    const basePrice = p.base_selling_price ?? p.selling_price;
                    const newPrice = computePreviewPrice(
                      basePrice,
                      assignModalPriceList.adjustment_type,
                      assignModalPriceList.calculation_mode,
                      assignModalPriceList.adjustment_value
                    );

                    return (
                      <div
                        key={p.id}
                        onClick={() => {
                          if (lockedByOtherList) return;
                          setAssignSelectedIds((prev) =>
                            prev.includes(p.id)
                              ? prev.filter((id) => id !== p.id)
                              : [...prev, p.id]
                          );
                        }}
                        className={`p-3 flex items-center justify-between gap-3 text-xs transition ${
                          lockedByOtherList
                            ? 'bg-amber-50/40 opacity-70 cursor-not-allowed'
                            : isSelected
                            ? 'bg-emerald-50/70 cursor-pointer'
                            : 'hover:bg-slate-50 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {lockedByOtherList ? (
                            <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                          ) : isSelected ? (
                            <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400 shrink-0" />
                          )}

                          <div>
                            <div className="font-semibold text-slate-900 flex items-center gap-2">
                              <span>{p.name}</span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                                {p.category || 'Fertilizer'}
                              </span>
                            </div>
                            {lockedByOtherList ? (
                              <div className="text-[11px] font-semibold text-amber-800 mt-0.5">
                                Locked: Already assigned to price list &ldquo;
                                {p.price_list_name || `#${p.price_list_id}`}&rdquo; (No two price lists can be added to the same product)
                              </div>
                            ) : (
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                Stock: {p.current_stock} {p.unit}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-[11px] text-slate-400 line-through">
                            Base: {formatCurrency(basePrice)}
                          </div>
                          <div className="font-bold text-emerald-700">
                            New: {formatCurrency(newPrice)}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-8 text-center text-xs text-slate-400">
                    No products match your filter.
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <div className="text-xs font-semibold text-slate-600">
                  {assignSelectedIds.length} product(s) selected for &ldquo;{assignModalPriceList.name}&rdquo;
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAssignModalPriceList(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-sm"
                  >
                    {actionLoading ? 'Applying...' : 'Save Product Assignments'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
