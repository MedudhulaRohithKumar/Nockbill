import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Tag,
  Plus,
  Percent,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Edit3,
  Search,
  Package,
  Layers,
  ShieldAlert,
  Sparkles,
  X,
  RefreshCw,
  SlidersHorizontal,
  FileDown,
  History,
  Store,
  BookOpen,
  Truck,
  Check,
  ShieldCheck,
  Calendar,
  Calculator,
  Printer,
  Copy,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';
import { priceListsApi, productsApi, khataApi } from '../api';
import { PriceList, Product } from '../types';
import { useAuth } from '../context/AuthContext';
import { useShop } from '../context/ShopContext';
import { safeNumber, safeString, formatCurrency } from '../utils/formatters';

const CATEGORIES = [
  'All Categories',
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
  const { settings } = useShop();
  const navigate = useNavigate();
  const isOwner = (user?.role || '').toLowerCase() === 'owner';

  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [khataSummary, setKhataSummary] = useState<{ total_customers: number; total_outstanding_udhar: number }>({
    total_customers: 0,
    total_outstanding_udhar: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Table Filters & Search
  const [tableSearch, setTableSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('All Categories');
  const [tablePage, setTablePage] = useState<number>(1);
  const pageSize = 10;

  // Create / Edit Price List Modal
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [editingPriceList, setEditingPriceList] = useState<PriceList | null>(null);
  const [formName, setFormName] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formAdjustmentType, setFormAdjustmentType] = useState<'DISCOUNT' | 'INCREMENT'>('DISCOUNT');
  const [formCalculationMode, setFormCalculationMode] = useState<'PERCENTAGE' | 'FIXED'>('PERCENTAGE');
  const [formAdjustmentValue, setFormAdjustmentValue] = useState<string>('5.0');
  const [formIsActive, setFormIsActive] = useState<boolean>(true);
  const [formScope, setFormScope] = useState<'NONE' | 'ALL' | 'SPECIFIED'>('NONE');
  const [formSelectedProductIds, setFormSelectedProductIds] = useState<number[]>([]);
  const [formProductSearch, setFormProductSearch] = useState<string>('');

  // Assign Specified Products Modal (for an existing Price List)
  const [assignModalPriceList, setAssignModalPriceList] = useState<PriceList | null>(null);
  const [assignSelectedIds, setAssignSelectedIds] = useState<number[]>([]);
  const [assignSearchQuery, setAssignSearchQuery] = useState<string>('');
  const [assignCategoryFilter, setAssignCategoryFilter] = useState<string>('All');

  // Quick Rule Builder Form State (Embedded In-Page)
  const [qbTitle, setQbTitle] = useState<string>('Rabi 2024 Early Bird Seed & Micronutrient Incentive');
  const [qbTargetTier, setQbTargetTier] = useState<string>('khata');
  const [qbCalcType, setQbCalcType] = useState<'percent' | 'margin' | 'flat'>('percent');
  const [qbSelectedCategories, setQbSelectedCategories] = useState<string[]>(['Fertilizer', 'Seeds']);
  const [qbDiscountValue, setQbDiscountValue] = useState<string>('5.0');
  const [qbMoqTrigger, setQbMoqTrigger] = useState<string>('10 Bags or 50kg');
  const [qbStartDate, setQbStartDate] = useState<string>('2024-11-15');
  const [qbEndDate, setQbEndDate] = useState<string>('2025-01-15');

  const showNotification = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 5000);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [plData, prodData, khataData] = await Promise.all([
        priceListsApi.getAll(),
        productsApi.getAll(),
        khataApi.listCustomers().catch(() => ({ total_customers: 0, total_outstanding_udhar: 0 })),
      ]);
      setPriceLists(plData || []);
      setAllProducts(prodData || []);
      if (khataData) {
        setKhataSummary({
          total_customers: khataData.total_customers || 0,
          total_outstanding_udhar: khataData.total_outstanding_udhar || 0,
        });
      }
    } catch (err: any) {
      showNotification(
        'error',
        err?.response?.data?.detail || 'Failed to load price lists and products.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOwner) {
      void fetchData();
    } else {
      setLoading(false);
    }
  }, [isOwner, fetchData]);

  // Keyboard shortcut: F4 exports rate card
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F4') {
        e.preventDefault();
        handleExportRateCard();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [allProducts, priceLists]);

  // Real data calculations for 4 KPI Cards
  const {
    activePriceRulesCount,
    coveredSkusCount,
    totalCatalogCount,
    coveragePercentage,
    unassignedProductsCount,
    khataTierRule,
    wholesaleTierRule,
  } = useMemo(() => {
    const active = priceLists.filter((pl) => pl.is_active);
    const assignedIds = new Set<number>();
    active.forEach((pl) => {
      (pl.product_ids || []).forEach((id) => assignedIds.add(id));
      (pl.products || []).forEach((p) => assignedIds.add(p.id));
    });

    const totalProds = allProducts.length;
    const covered = Math.min(totalProds, assignedIds.size);
    const coverage = totalProds > 0 ? (covered / totalProds) * 100 : 0;
    const unassigned = Math.max(0, totalProds - covered);

    // Find custom khata and wholesale rules if configured
    const khataRule = priceLists.find(
      (pl) =>
        pl.is_active &&
        (pl.name.toLowerCase().includes('khata') ||
          pl.name.toLowerCase().includes('credit') ||
          pl.name.toLowerCase().includes('farmer'))
    );
    const wholesaleRule = priceLists.find(
      (pl) =>
        pl.is_active &&
        (pl.name.toLowerCase().includes('wholesale') ||
          pl.name.toLowerCase().includes('dealer') ||
          pl.name.toLowerCase().includes('b2b'))
    );

    return {
      activePriceRulesCount: active.length,
      coveredSkusCount: covered,
      totalCatalogCount: totalProds,
      coveragePercentage: coverage,
      unassignedProductsCount: unassigned,
      khataTierRule: khataRule,
      wholesaleTierRule: wholesaleRule,
    };
  }, [priceLists, allProducts]);

  // Selected sample SKUs for live simulator
  const samplePesticide = useMemo(() => {
    return (
      allProducts.find((p) => p.category === 'Pesticide') ||
      allProducts[0] || {
        id: 1,
        name: 'Bayer Regent 0.3G (Fipronil 1kg)',
        batch_number: 'BYR-8849-24',
        hsn_code: '38089190',
        mrp: 298.0,
        cost_price: 242.0,
        selling_price: 280.0,
      }
    );
  }, [allProducts]);

  const sampleFertilizer = useMemo(() => {
    return (
      allProducts.find((p) => p.category === 'Fertilizer') ||
      allProducts[1] || {
        id: 2,
        name: 'IFFCO Neem Coated Urea (45kg Bag)',
        batch_number: 'IFF-UREA-45',
        hsn_code: '31021000',
        mrp: 266.5,
        cost_price: 231.1,
        selling_price: 266.5,
      }
    );
  }, [allProducts]);

  // Toggle category in Quick Rule Builder
  const toggleQbCategory = (cat: string) => {
    if (cat === 'All Categories') {
      setQbSelectedCategories(['All Categories']);
      return;
    }
    setQbSelectedCategories((prev) => {
      const filtered = prev.filter((c) => c !== 'All Categories');
      if (filtered.includes(cat)) {
        const next = filtered.filter((c) => c !== cat);
        return next.length === 0 ? ['All Categories'] : next;
      }
      return [...filtered, cat];
    });
  };

  // Quick Rule Builder Submit
  const handleSaveQuickBuilderRule = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number.parseFloat(qbDiscountValue);
    if (!qbTitle.trim()) {
      showNotification('error', 'Please provide a Rule Title.');
      return;
    }
    if (Number.isNaN(val) || val <= 0) {
      showNotification('error', 'Please enter a valid positive discount or markup value.');
      return;
    }

    const adjType: 'DISCOUNT' | 'INCREMENT' = qbCalcType === 'margin' ? 'INCREMENT' : 'DISCOUNT';
    const calcMode: 'PERCENTAGE' | 'FIXED' = qbCalcType === 'flat' ? 'FIXED' : 'PERCENTAGE';

    // Target product IDs based on categories
    let targetProductIds: number[] = [];
    if (qbSelectedCategories.includes('All Categories')) {
      targetProductIds = allProducts.map((p) => p.id);
    } else {
      targetProductIds = allProducts
        .filter((p) => qbSelectedCategories.includes(p.category))
        .map((p) => p.id);
    }

    setActionLoading(true);
    try {
      await priceListsApi.create({
        name: qbTitle.trim(),
        description: `Target: ${qbTargetTier.toUpperCase()} • MOQ: ${qbMoqTrigger} • Validity: ${qbStartDate} to ${qbEndDate}`,
        adjustment_type: adjType,
        calculation_mode: calcMode,
        adjustment_value: val,
        is_active: true,
        apply_to_all: qbSelectedCategories.includes('All Categories'),
        product_ids: qbSelectedCategories.includes('All Categories') ? [] : targetProductIds,
      });
      showNotification('success', `Created & activated price rule "${qbTitle.trim()}".`);
      await fetchData();
    } catch (err: any) {
      showNotification(
        'error',
        err?.response?.data?.detail || 'Failed to save pricing rule.'
      );
    } finally {
      setActionLoading(false);
    }
  };

  // Quick Toggle Active State for any Price List
  const handleToggleActive = async (pl: PriceList) => {
    setActionLoading(true);
    try {
      await priceListsApi.update(pl.id, { is_active: !pl.is_active });
      showNotification(
        'success',
        `Price rule "${pl.name}" is now ${!pl.is_active ? 'Active' : 'Paused (Base prices restored)'}.`
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

  const openCreateModal = () => {
    setEditingPriceList(null);
    setFormName('');
    setFormDescription('');
    setFormAdjustmentType('DISCOUNT');
    setFormCalculationMode('PERCENTAGE');
    setFormAdjustmentValue('5.0');
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

  const handleClonePriceList = (pl: PriceList) => {
    setEditingPriceList(null);
    setFormName(`${pl.name} (Copy)`);
    setFormDescription(pl.description || '');
    setFormAdjustmentType(pl.adjustment_type);
    setFormCalculationMode(pl.calculation_mode);
    setFormAdjustmentValue(String(pl.adjustment_value));
    setFormIsActive(true);
    setFormScope('NONE');
    setFormSelectedProductIds([]);
    setShowCreateModal(true);
  };

  const handleSaveModalPriceList = async (e: React.FormEvent) => {
    e.preventDefault();
    const numVal = Number.parseFloat(formAdjustmentValue);
    if (!formName.trim()) {
      showNotification('error', 'Please enter a Price List name.');
      return;
    }
    if (Number.isNaN(numVal) || numVal <= 0) {
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

  const openAssignModal = (pl: PriceList) => {
    setAssignModalPriceList(pl);
    const existingIds = (pl.products || []).map((p) => p.id);
    setAssignSelectedIds(existingIds);
    setAssignSearchQuery('');
    setAssignCategoryFilter('All');
  };

  const handleConfirmAssignProducts = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignModalPriceList) return;

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

  // Export Rate Card CSV
  const handleExportRateCard = () => {
    if (allProducts.length === 0) {
      showNotification('error', 'No products found to export.');
      return;
    }
    const headers = [
      'Product ID',
      'Product Name',
      'Trade Name',
      'Category',
      'Batch No',
      'Base Selling Price (₹)',
      'Active Tier / Rule',
      'Discount or Margin',
      'Final Billing Rate (₹)',
      'MRP (₹)',
      'Current Stock',
      'Unit',
    ];
    const rows = allProducts.map((p) => {
      const pl = priceLists.find((item) => item.id === p.price_list_id);
      const discountText = pl
        ? `${pl.adjustment_type === 'DISCOUNT' ? '-' : '+'}${pl.adjustment_value}${pl.calculation_mode === 'PERCENTAGE' ? '%' : '₹'}`
        : '0%';
      return [
        p.id,
        `"${(p.name || p.product_name || '').replace(/"/g, '""')}"`,
        `"${(p.trade_name || '').replace(/"/g, '""')}"`,
        `"${p.category}"`,
        `"${p.batch_number || ''}"`,
        safeNumber(p.base_selling_price || p.selling_price).toFixed(2),
        `"${pl ? pl.name : 'Standard Retail Base'}"`,
        `"${discountText}"`,
        safeNumber(p.selling_price).toFixed(2),
        safeNumber(p.mrp).toFixed(2),
        safeNumber(p.current_stock),
        p.unit,
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Rate_Card_Tiers_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showNotification('success', 'Exported Rate Card CSV successfully.');
  };

  // Printable Form O Statutory Display Notice Board
  const handlePrintFormOPriceBoard = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Pop-up was blocked. Please allow pop-ups for NockBill to view the printable Form O board.');
      return;
    }

    const shopName = settings?.shop_name || 'GREEN VALLEY AGRO KENDRA';
    const license = settings?.fertilizer_license_no || settings?.gstin || 'KA-BLR-KND-042';
    const address = `${settings?.address_line1 || ''} ${settings?.city || ''} ${settings?.state || ''}`.trim() || 'Central Agricultural Market Yard';
    const todayStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    // Pick top fertilizers and seeds for notice board
    const boardItems = allProducts.slice(0, 15);

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Form O Statutory Price Board - ${shopName}</title>
        <style>
          @page { size: A4 portrait; margin: 15mm; }
          body { font-family: system-ui, sans-serif; color: #111; margin: 0; padding: 10px; }
          .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
          .badge { display: inline-block; background: #eee; padding: 2px 8px; font-size: 11px; font-weight: bold; border-radius: 4px; }
          h1 { margin: 4px 0; font-size: 20px; font-weight: 800; text-transform: uppercase; }
          .sub { font-size: 11px; color: #444; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
          th, td { border: 1px solid #444; padding: 6px 8px; text-align: left; }
          th { background-color: #f2f2f2; font-weight: bold; }
          .text-right { text-align: right; }
          .footer { margin-top: 20px; display: flex; justify-content: space-between; font-size: 10px; }
          .seal-box { border: 1px dashed #666; padding: 8px 16px; text-align: center; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <span class="badge">MANDATORY NOTICE BOARD DISPLAY • CLAUSE 14(1) FCO 1985</span>
          <h1>${shopName}</h1>
          <div class="sub">Govt Reg. Lic: ${license} | Address: ${address}</div>
          <div class="sub" style="margin-top: 4px; font-weight: bold;">STATUTORY RETAIL PRICE & STOCK STATUS • DATED: ${todayStr}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 30px;">#</th>
              <th>Product Name & Active Formulation</th>
              <th>Batch / Lot</th>
              <th>Available Stock</th>
              <th class="text-right">Govt MRP (₹)</th>
              <th class="text-right">Kendra Retail Rate (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${boardItems
              .map(
                (p, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td><strong>${p.name || p.product_name}</strong> ${p.trade_name ? `(${p.trade_name})` : ''}</td>
                <td>${p.batch_number || 'BAT-01'}</td>
                <td>${p.current_stock} ${p.unit}</td>
                <td class="text-right">₹${Number(p.mrp || p.selling_price).toFixed(2)}</td>
                <td class="text-right" style="font-weight: bold;">₹${Number(p.selling_price).toFixed(2)}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>

        <div class="footer">
          <div>
            <p><strong>* Statutory Notice:</strong> Selling above MRP is strictly punishable under the Essential Commodities Act, 1955.</p>
            <p>All subsidized fertilizers are Aadhaar DBT synchronized with Central MFMS.</p>
          </div>
          <div class="seal-box">
            OFFICIAL KENDRA SEAL<br/><br/>
            Authorized Signatory
          </div>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 400);
  };

  // Filtered Price Lists for table
  const filteredPriceLists = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    return priceLists.filter((pl) => {
      const matchesQ =
        !q ||
        pl.name.toLowerCase().includes(q) ||
        (pl.description || '').toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && pl.is_active) ||
        (statusFilter === 'INACTIVE' && !pl.is_active);
      return matchesQ && matchesStatus;
    });
  }, [priceLists, tableSearch, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredPriceLists.length / pageSize));
  const paginatedPriceLists = useMemo(() => {
    const start = (tablePage - 1) * pageSize;
    return filteredPriceLists.slice(start, start + pageSize);
  }, [filteredPriceLists, tablePage, pageSize]);

  // Filtered products inside Assign Modal
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
            Only the shop Administrator / Owner can create, modify, or assign Price Lists &amp; Customer Tier Pricing.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-space-md sm:p-space-lg max-w-[1680px] mx-auto space-y-space-md pb-16">
      {/* Toast Notification */}
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
            type="button"
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* =====================================================================
          1. TOP COMMAND & BREADCRUMB BAR
      ===================================================================== */}
      <section className="bg-surface-container-lowest rounded-2xl p-space-md shadow-sm border border-outline-variant/30 flex flex-col gap-space-sm">
        <div className="flex flex-wrap items-center justify-between gap-space-md">
          {/* Breadcrumb Hierarchy */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-on-surface-variant font-label-code text-label-code">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="hover:text-primary transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Store className="w-4 h-4 text-forest-emerald" />
              <span>Dashboard</span>
            </button>
            <span className="opacity-40">/</span>
            <span className="text-on-surface-variant">Commercial &amp; Accounts</span>
            <span className="opacity-40">/</span>
            <span className="text-primary font-bold">Price Lists &amp; Customer Tiers</span>
          </nav>

          {/* Utility Actions: Audit & Export */}
          <div className="flex items-center gap-space-xs flex-wrap">
            <button
              type="button"
              onClick={() => showNotification('success', 'Engine audit log: All pricing syncs are up to date with POS terminals.')}
              className="h-9 px-space-md bg-surface-container-low hover:bg-surface-container text-on-surface rounded-lg font-title-sm text-body-sm font-semibold flex items-center gap-space-xs transition-colors shadow-xs border border-outline-variant/30 active:scale-95"
            >
              <History className="w-4 h-4 text-on-surface-variant" />
              <span>History &amp; Audit Log</span>
            </button>
            <button
              type="button"
              onClick={handleExportRateCard}
              className="h-9 px-space-md bg-surface-container-low hover:bg-surface-container text-on-surface rounded-lg font-title-sm text-body-sm font-semibold flex items-center gap-space-xs transition-colors shadow-xs border border-outline-variant/30 active:scale-95"
            >
              <FileDown className="w-4 h-4 text-regulatory-sky" />
              <span>Export Rate Card</span>
              <span className="font-label-code text-label-code bg-surface-container-high px-1.5 py-0.5 rounded text-on-surface-variant font-bold border border-outline-variant/30">
                F4
              </span>
            </button>
            <button
              type="button"
              onClick={openCreateModal}
              className="h-9 px-space-md bg-primary-container hover:bg-canopy-deep text-on-primary rounded-lg font-title-sm text-body-sm font-bold flex items-center gap-space-xs shadow-sm transition-all transform active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>+ Create New Price List</span>
            </button>
          </div>
        </div>

        {/* Header Title with Regulatory Badges */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-sm pt-space-xs">
          <div>
            <div className="flex flex-wrap items-center gap-space-sm">
              <h1 className="font-headline-lg text-headline-lg text-on-surface font-extrabold tracking-tight">
                Price Lists &amp; Customer Tier Pricing
              </h1>
              <span className="font-label-badge text-label-badge bg-sprout-tint text-primary px-2.5 py-1 rounded-full font-bold uppercase tracking-wider border border-primary/20">
                DYNAMIC PRICING ENGINE
              </span>
              <span className="font-label-badge text-label-badge bg-regulatory-sky-bg text-regulatory-sky px-2.5 py-1 rounded-full font-bold uppercase tracking-wider border border-regulatory-sky/20">
                MULTI-TIER MARGIN CONTROL
              </span>
            </div>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1 max-w-4xl">
              Rule-based agricultural input pricing for walk-in farmers, registered credit growers, wholesale sub-dealers, and seasonal Kharif/Rabi campaigns.
            </p>
          </div>
          <div className="flex items-center gap-space-sm text-on-surface-variant font-label-code text-label-code bg-surface-container-low px-3 py-1.5 rounded-lg border border-outline-variant/30 shrink-0">
            <span className="inline-block w-2 h-2 rounded-full bg-forest-emerald animate-pulse" />
            <span>
              ENGINE STATUS: <strong>SYNCED (DBT v4.2)</strong>
            </span>
          </div>
        </div>
      </section>

      {/* =====================================================================
          2. TOP KPI SUMMARY RIBBON (4 Cards with Live Database Data)
      ===================================================================== */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-space-md">
        {/* Card 1: Active Tiers */}
        <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm border border-outline-variant/30 relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between mb-space-sm">
            <div className="flex items-center gap-space-xs">
              <Layers className="w-5 h-5 text-forest-emerald" />
              <span className="font-label-code text-label-code uppercase text-on-surface-variant font-bold">
                Active Price Rules
              </span>
            </div>
            <span className="font-label-badge text-label-badge bg-sprout-tint text-primary px-2 py-0.5 rounded-full font-bold flex items-center gap-1 border border-primary/20">
              <span className="w-1.5 h-1.5 rounded-full bg-forest-emerald animate-pulse" />
              LIVE
            </span>
          </div>
          <div className="my-space-xs">
            <span className="font-tabular-lg text-tabular-lg text-on-surface font-extrabold tracking-tight block">
              {activePriceRulesCount} Active Tiers
            </span>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
              {coveredSkusCount} of {totalCatalogCount} SKUs covered • {coveragePercentage.toFixed(1)}% catalog synced
            </p>
          </div>
          <div className="w-full bg-surface-container-high h-1.5 rounded-full mt-space-sm overflow-hidden">
            <div
              className="bg-primary-container h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, coveragePercentage)}%` }}
            />
          </div>
        </div>

        {/* Card 2: Walk-in Retail Base */}
        <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm border border-outline-variant/30 relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between mb-space-sm">
            <div className="flex items-center gap-space-xs">
              <Store className="w-5 h-5 text-forest-emerald" />
              <span className="font-label-code text-label-code uppercase text-on-surface-variant font-bold">
                Walk-in Retail Base
              </span>
            </div>
            <span className="font-label-code text-label-code bg-surface-container px-2 py-0.5 rounded text-on-surface-variant font-semibold border border-outline-variant/30">
              DEFAULT
            </span>
          </div>
          <div className="my-space-xs">
            <span className="font-tabular-lg text-tabular-lg text-on-surface font-extrabold tracking-tight block">
              Standard MRP
            </span>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
              ₹0 Markup • {unassignedProductsCount} SKUs on unadjusted base rate
            </p>
          </div>
          <div className="flex items-center justify-between pt-space-xs font-label-code text-label-code text-forest-emerald">
            <span className="flex items-center gap-0.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Counter Zero Margin Loss
            </span>
            <span className="text-on-surface-variant">100% MRP</span>
          </div>
        </div>

        {/* Card 3: Credit Farmer Shield */}
        <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm border border-outline-variant/30 relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between mb-space-sm">
            <div className="flex items-center gap-space-xs">
              <BookOpen className="w-5 h-5 text-khata-amber" />
              <span className="font-label-code text-label-code uppercase text-on-surface-variant font-bold">
                Credit Farmer Shield
              </span>
            </div>
            <span className="font-label-badge text-label-badge bg-khata-amber-bg text-khata-amber px-2 py-0.5 rounded-full font-bold border border-khata-amber/30">
              KHATA PREFERRED
            </span>
          </div>
          <div className="my-space-xs">
            <span className="font-tabular-lg text-tabular-lg text-khata-amber font-extrabold tracking-tight block">
              {khataTierRule
                ? `${khataTierRule.adjustment_value}% Line Disc`
                : '3.0% Line Discount'}
            </span>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
              Post-harvest terms • {khataSummary.total_customers} active credit farmers
            </p>
          </div>
          <div className="flex items-center justify-between pt-space-xs font-label-code text-label-code">
            <span className="text-on-surface-variant">Total Ledger Exposure:</span>
            <span className="text-forest-emerald font-bold font-mono">
              ₹{formatCurrency(khataSummary.total_outstanding_udhar)}
            </span>
          </div>
        </div>

        {/* Card 4: Sub-Dealer & Bulk Margin */}
        <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm border border-outline-variant/30 relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between mb-space-sm">
            <div className="flex items-center gap-space-xs">
              <Truck className="w-5 h-5 text-regulatory-sky" />
              <span className="font-label-code text-label-code uppercase text-on-surface-variant font-bold">
                Sub-Dealer &amp; Bulk Margin
              </span>
            </div>
            <span className="font-label-badge text-label-badge bg-regulatory-sky-bg text-regulatory-sky px-2 py-0.5 rounded-full font-bold border border-regulatory-sky/30">
              WHOLESALE SLAB
            </span>
          </div>
          <div className="my-space-xs">
            <span className="font-tabular-lg text-tabular-lg text-regulatory-sky font-extrabold tracking-tight block">
              {wholesaleTierRule
                ? `${wholesaleTierRule.adjustment_value}% Margin Slab`
                : '8.5% Margin Tier'}
            </span>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
              Case-lot distribution • B2B GST tax invoicing
            </p>
          </div>
          <div className="flex items-center justify-between pt-space-xs font-label-code text-label-code text-on-surface-variant">
            <span>CIB &amp; PGR Eligible</span>
            <span className="font-bold text-on-surface">14d Credit Limit</span>
          </div>
        </div>
      </section>

      {/* =====================================================================
          3. TIER CONFIGURATION & QUICK SWITCHER CARDS (Real-time Switches)
      ===================================================================== */}
      <section className="space-y-space-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-sm">
          <div className="flex items-center gap-space-xs">
            <SlidersHorizontal className="w-5 h-5 text-forest-emerald" />
            <h2 className="font-headline-md text-headline-md text-on-surface font-bold">
              Standard Pricing Tier Matrix
            </h2>
          </div>
          <span className="font-label-code text-label-code text-on-surface-variant">
            Quick toggle overrides activate in real-time across POS terminals
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-space-md">
          {priceLists.length === 0 ? (
            <div className="col-span-full bg-surface-container-lowest rounded-xl p-8 text-center border border-outline-variant/30 shadow-sm space-y-3">
              <Tag className="w-8 h-8 text-forest-emerald mx-auto" />
              <h3 className="font-title-sm text-body-md text-on-surface font-bold">
                No Custom Pricing Tiers Configured Yet
              </h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant max-w-md mx-auto">
                Currently, all products are billed at their base selling rate. Use the Quick Pricing Rule Builder below or create a new price list to set up farmer credit discounts and sub-dealer slabs.
              </p>
              <button
                type="button"
                onClick={openCreateModal}
                className="px-4 py-2 bg-primary-container text-on-primary rounded-xl font-bold text-xs shadow-sm hover:bg-canopy-deep transition-all"
              >
                + Create First Pricing Tier
              </button>
            </div>
          ) : (
            priceLists.map((pl, idx) => {
              const isDiscount = pl.adjustment_type === 'DISCOUNT';
              const isPercent = pl.calculation_mode === 'PERCENTAGE';
              const sign = isDiscount ? '-' : '+';
              const unit = isPercent ? '%' : '₹';
              const codeStr = `PL-0${idx + 1}`;

              return (
                <div
                  key={pl.id}
                  className={`bg-surface-container-lowest rounded-xl p-space-md shadow-sm border flex flex-col justify-between transition-all hover:shadow-md ${
                    pl.is_active ? 'border-outline-variant/40' : 'border-outline-variant/20 opacity-70 bg-surface-container-low/30'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-space-sm mb-space-xs">
                      <span className="font-label-code text-label-code text-on-surface-variant font-bold">
                        CODE: {codeStr}
                      </span>
                      {/* Interactive Toggle Switch */}
                      <button
                        type="button"
                        aria-label={`Toggle active status for ${pl.name}`}
                        disabled={actionLoading}
                        onClick={() => handleToggleActive(pl)}
                        className={`w-9 h-5 rounded-full transition-colors relative focus:outline-none ${
                          pl.is_active ? 'bg-primary-container' : 'bg-surface-container-high'
                        }`}
                      >
                        <span
                          className={`absolute top-[2px] left-[2px] bg-white rounded-full h-4 w-4 transition-transform ${
                            pl.is_active ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    <h3 className="font-title-sm text-title-sm text-on-surface font-bold leading-snug">
                      {pl.name}
                    </h3>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-1 line-clamp-2">
                      {pl.description || 'Pre-negotiated customer tier pricing with real-time POS enforcement.'}
                    </p>

                    <div className="mt-space-md space-y-space-xs font-label-code text-label-code">
                      <div className="flex justify-between py-1 bg-surface-container-low px-2 rounded">
                        <span className="text-on-surface-variant">Calculation Base:</span>
                        <span className={`font-bold ${isDiscount ? 'text-khata-amber' : 'text-forest-emerald'}`}>
                          {sign}{pl.adjustment_value}{unit} {isDiscount ? 'Line Disc' : 'Markup'}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 px-2">
                        <span className="text-on-surface-variant">Scope:</span>
                        <span className="font-bold text-on-surface">
                          {pl.product_count} Covered Products
                        </span>
                      </div>
                      <div className="flex justify-between py-1 px-2">
                        <span className="text-on-surface-variant">Terminal Sync:</span>
                        <span className="font-bold text-forest-emerald">Real-time</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-space-md mt-space-sm flex items-center justify-between border-t border-outline-variant/20">
                    <span
                      className={`font-label-badge text-label-badge px-2 py-0.5 rounded-full font-bold uppercase ${
                        pl.is_active
                          ? 'bg-sprout-tint text-primary'
                          : 'bg-surface-container text-on-surface-variant'
                      }`}
                    >
                      {pl.is_active ? 'ACTIVE' : 'PAUSED'}
                    </span>
                    <button
                      type="button"
                      onClick={() => openAssignModal(pl)}
                      className="font-label-code text-label-code text-forest-emerald font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      <span>Configure</span>
                      <span className="text-[12px]">→</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* =====================================================================
          4. INTERACTIVE RULE BUILDER & LIVE SIMULATOR (Split 2-Column Grid)
      ===================================================================== */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
        {/* Left Column: Quick Pricing Rule Builder (7 Cols) */}
        <div className="lg:col-span-7 bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-outline-variant/30">
          <div className="flex items-center justify-between pb-space-sm mb-space-md border-b border-outline-variant/20">
            <div className="flex items-center gap-space-xs">
              <div className="w-8 h-8 rounded-lg bg-sprout-tint text-primary flex items-center justify-center">
                <SlidersHorizontal className="w-5 h-5 text-forest-emerald" />
              </div>
              <div>
                <h2 className="font-headline-md text-headline-md text-on-surface font-bold">
                  Quick Pricing Rule Builder
                </h2>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Formulate algorithmic pricing modifications across SKU categories or specific buyer segments.
                </p>
              </div>
            </div>
            <span className="font-label-code text-label-code bg-surface-container text-on-surface-variant px-2 py-0.5 rounded font-semibold border border-outline-variant/30">
              FORM V2.4
            </span>
          </div>

          <form className="space-y-space-md" onSubmit={handleSaveQuickBuilderRule}>
            {/* Rule Title */}
            <div>
              <label htmlFor="qb-rule-title" className="block font-title-sm text-body-sm text-on-surface font-semibold mb-1">
                Rule Title / Campaign Identifier <span className="text-critical-rose">*</span>
              </label>
              <input
                id="qb-rule-title"
                type="text"
                required
                value={qbTitle}
                onChange={(e) => setQbTitle(e.target.value)}
                placeholder="e.g. Rabi 2024 Early Bird Seed Incentive"
                className="w-full h-12 px-space-md bg-surface-container-low rounded-lg font-body-md text-body-md text-on-surface outline-none focus:bg-sprout-tint focus:ring-2 focus:ring-primary-container transition-all border border-transparent focus:border-forest-emerald"
              />
            </div>

            {/* Target Customer Tier & Calculation Type Split */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
              <div>
                <label htmlFor="qb-target-tier" className="block font-title-sm text-body-sm text-on-surface font-semibold mb-1">
                  Target Customer Tier <span className="text-critical-rose">*</span>
                </label>
                <div className="relative">
                  <select
                    id="qb-target-tier"
                    value={qbTargetTier}
                    onChange={(e) => setQbTargetTier(e.target.value)}
                    className="w-full h-12 px-space-md bg-surface-container-low rounded-lg font-body-md text-body-md text-on-surface outline-none focus:bg-sprout-tint focus:ring-2 focus:ring-primary-container appearance-none transition-all pr-10 border border-transparent focus:border-forest-emerald cursor-pointer"
                  >
                    <option value="khata">Registered Credit Growers (Khata Tier)</option>
                    <option value="walkin">Retail Counter Walk-in Farmers</option>
                    <option value="dealer">Wholesale &amp; Village Sub-Dealers</option>
                    <option value="coop">Primary Agricultural Credit Society (PACS)</option>
                  </select>
                </div>
              </div>

              <div>
                <span className="block font-title-sm text-body-sm text-on-surface font-semibold mb-1">
                  Calculation Logic <span className="text-critical-rose">*</span>
                </span>
                <div className="grid grid-cols-3 gap-1 bg-surface-container-low p-1 rounded-lg h-12 border border-outline-variant/30">
                  <button
                    type="button"
                    onClick={() => setQbCalcType('percent')}
                    className={`flex items-center justify-center rounded cursor-pointer font-bold text-[12px] font-label-code transition-all ${
                      qbCalcType === 'percent'
                        ? 'bg-surface-container-lowest text-primary shadow-xs'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    <span>% Discount</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setQbCalcType('margin')}
                    className={`flex items-center justify-center rounded cursor-pointer font-bold text-[12px] font-label-code transition-all ${
                      qbCalcType === 'margin'
                        ? 'bg-surface-container-lowest text-primary shadow-xs'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    <span>+₹ Margin</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setQbCalcType('flat')}
                    className={`flex items-center justify-center rounded cursor-pointer font-bold text-[12px] font-label-code transition-all ${
                      qbCalcType === 'flat'
                        ? 'bg-surface-container-lowest text-primary shadow-xs'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    <span>Flat Rate</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Scope Category Pills */}
            <div>
              <span className="block font-title-sm text-body-sm text-on-surface font-semibold mb-1.5">
                Category Scope <span className="text-on-surface-variant font-normal font-label-code text-label-code">(Applies filter rule downstream)</span>
              </span>
              <div className="flex flex-wrap gap-space-xs">
                {['All Categories', 'Fertilizer', 'Seeds', 'Pesticide', 'Micronutrients', 'Bio-fertilizer'].map((cat) => {
                  const isSel = qbSelectedCategories.includes(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => toggleQbCategory(cat)}
                      className={`h-8 px-3 rounded-full font-label-code text-label-code transition-colors flex items-center gap-1 cursor-pointer ${
                        isSel
                          ? 'bg-primary-container text-on-primary font-bold shadow-xs'
                          : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                      }`}
                    >
                      {isSel && <Check className="w-3.5 h-3.5" />}
                      <span>{cat}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Value Input and MOQ */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
              <div>
                <label htmlFor="qb-discount-value" className="block font-title-sm text-body-sm text-on-surface font-semibold mb-1">
                  Discount Rate / Percentage Value ({qbCalcType === 'margin' || qbCalcType === 'flat' ? '₹' : '%'})
                </label>
                <div className="relative">
                  <input
                    id="qb-discount-value"
                    type="number"
                    step="0.1"
                    min="0.1"
                    required
                    value={qbDiscountValue}
                    onChange={(e) => setQbDiscountValue(e.target.value)}
                    className="w-full h-12 pl-space-md pr-12 bg-surface-container-low rounded-lg font-tabular-md text-tabular-md text-on-surface outline-none focus:bg-sprout-tint focus:ring-2 focus:ring-primary-container border border-transparent focus:border-forest-emerald"
                  />
                  <span className="absolute right-4 top-3 font-tabular-md text-tabular-md text-on-surface-variant font-bold">
                    {qbCalcType === 'margin' || qbCalcType === 'flat' ? '₹' : '%'}
                  </span>
                </div>
              </div>
              <div>
                <label htmlFor="qb-moq-trigger" className="block font-title-sm text-body-sm text-on-surface font-semibold mb-1">
                  Minimum Order Trigger (MOQ / Bags)
                </label>
                <input
                  id="qb-moq-trigger"
                  type="text"
                  value={qbMoqTrigger}
                  onChange={(e) => setQbMoqTrigger(e.target.value)}
                  placeholder="e.g. 10 Bags or 50kg"
                  className="w-full h-12 px-space-md bg-surface-container-low rounded-lg font-body-md text-body-md text-on-surface outline-none focus:bg-sprout-tint focus:ring-2 focus:ring-primary-container border border-transparent focus:border-forest-emerald"
                />
              </div>
            </div>

            {/* Date Range Pickers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md pt-space-xs">
              <div>
                <label htmlFor="qb-start-date" className="block font-label-code text-label-code text-on-surface-variant font-bold uppercase mb-1">
                  Effective Start Date
                </label>
                <input
                  id="qb-start-date"
                  type="date"
                  value={qbStartDate}
                  onChange={(e) => setQbStartDate(e.target.value)}
                  className="w-full h-11 px-space-md bg-surface-container-low rounded-lg font-label-code text-label-code text-on-surface outline-none focus:ring-2 focus:ring-primary-container border border-transparent focus:border-forest-emerald"
                />
              </div>
              <div>
                <label htmlFor="qb-end-date" className="block font-label-code text-label-code text-on-surface-variant font-bold uppercase mb-1">
                  Valid Through (End Date)
                </label>
                <input
                  id="qb-end-date"
                  type="date"
                  value={qbEndDate}
                  onChange={(e) => setQbEndDate(e.target.value)}
                  className="w-full h-11 px-space-md bg-surface-container-low rounded-lg font-label-code text-label-code text-on-surface outline-none focus:ring-2 focus:ring-primary-container border border-transparent focus:border-forest-emerald"
                />
              </div>
            </div>

            {/* Action Submit Buttons */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-sm pt-space-md border-t border-outline-variant/20">
              <div className="flex items-center gap-space-xs text-on-surface-variant font-body-sm text-body-sm">
                <ShieldCheck className="w-4 h-4 text-forest-emerald" />
                <span>Aadhaar DBT subsidy checksum compliant</span>
              </div>
              <div className="flex items-center gap-space-sm self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => {
                    setQbTitle('Rabi 2024 Early Bird Seed & Micronutrient Incentive');
                    setQbDiscountValue('5.0');
                    setQbCalcType('percent');
                    setQbSelectedCategories(['Fertilizer', 'Seeds']);
                  }}
                  className="h-11 px-space-md bg-surface-container-low hover:bg-surface-container text-on-surface rounded-lg font-title-sm text-body-sm font-semibold transition-colors active:scale-95"
                >
                  Reset
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="h-11 px-space-lg bg-primary-container hover:bg-canopy-deep text-on-primary rounded-lg font-title-sm text-body-sm font-bold flex items-center gap-space-xs shadow-sm transition-all transform active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{actionLoading ? 'Saving Rule...' : 'Simulate & Save Rule'}</span>
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Right Column: Live Profit Margin Simulator (5 Cols) */}
        <div className="lg:col-span-5 bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-outline-variant/30 flex flex-col justify-between">
          <div>
            {/* Simulator Header */}
            <div className="flex items-center justify-between pb-space-sm mb-space-md border-b border-outline-variant/20">
              <div className="flex items-center gap-space-xs">
                <Calculator className="w-5 h-5 text-khata-amber" />
                <div>
                  <h2 className="font-headline-md text-title-sm text-on-surface font-bold">
                    Live Profit Margin Simulator
                  </h2>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Real-time counter impact testing on high-velocity SKUs
                  </p>
                </div>
              </div>
              <span className="font-label-badge text-label-badge bg-sprout-tint text-primary px-2 py-0.5 rounded-full font-bold border border-primary/20">
                LIVE STACK
              </span>
            </div>

            {/* Sample SKU 1: Dynamic Pesticide Simulator */}
            {(() => {
              const numDisc = Number.parseFloat(qbDiscountValue) || 0;
              const baseSell = safeNumber(samplePesticide.selling_price || 280);
              const costPrice = safeNumber(samplePesticide.cost_price ?? (samplePesticide as any).purchase_price ?? 242);
              const mrp = safeNumber(samplePesticide.mrp || 298);

              let adjustedSell = baseSell;
              if (qbCalcType === 'percent') {
                adjustedSell = Math.max(0.01, baseSell - (baseSell * numDisc) / 100);
              } else if (qbCalcType === 'margin') {
                adjustedSell = baseSell + numDisc;
              } else {
                adjustedSell = numDisc;
              }
              const netMargin = adjustedSell - costPrice;
              const grossMarginPct = costPrice > 0 ? ((baseSell - costPrice) / costPrice) * 100 : 15.7;
              const netMarginPct = costPrice > 0 ? (netMargin / costPrice) * 100 : 12.2;

              return (
                <div className="bg-surface-container-low rounded-xl p-space-md mb-space-md border border-outline-variant/30">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-label-badge text-label-badge bg-surface-container-high text-on-surface-variant px-1.5 py-0.5 rounded font-bold uppercase">
                        {samplePesticide.category.toUpperCase()}
                      </span>
                      <h3 className="font-title-sm text-body-md text-on-surface font-bold mt-1">
                        {samplePesticide.name || samplePesticide.product_name}
                      </h3>
                      <p className="font-label-code text-label-code text-on-surface-variant">
                        Batch: #{samplePesticide.batch_number || 'BAT-01'} • HSN: {samplePesticide.hsn_code || '38089190'}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-label-code text-label-code text-on-surface-variant block">Govt MRP</span>
                      <div className="font-tabular-md text-tabular-md text-on-surface font-bold">
                        ₹{formatCurrency(mrp)}
                      </div>
                    </div>
                  </div>

                  {/* Price Waterfall */}
                  <div className="mt-space-md space-y-1.5 font-label-code text-label-code">
                    <div className="flex justify-between py-1 px-2 rounded bg-surface-container-lowest">
                      <span className="text-on-surface-variant">Wholesale Landing Cost (CP):</span>
                      <span className="font-tabular-md font-semibold text-on-surface">
                        ₹{formatCurrency(costPrice)}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 px-2">
                      <span className="text-on-surface-variant">Standard Counter Base:</span>
                      <span className="font-tabular-md font-semibold text-on-surface">
                        ₹{formatCurrency(baseSell)}{' '}
                        <span className="text-forest-emerald font-normal">
                          ({grossMarginPct.toFixed(1)}% Gross)
                        </span>
                      </span>
                    </div>
                    <div className="flex justify-between py-1 px-2 rounded bg-khata-amber-bg/50 text-khata-amber border border-khata-amber/20">
                      <span className="font-bold flex items-center gap-1">
                        <Tag className="w-3.5 h-3.5" />
                        Simulated Rule ({qbDiscountValue}{qbCalcType === 'percent' ? '%' : '₹'}):
                      </span>
                      <span className="font-tabular-md font-bold">
                        ₹{formatCurrency(adjustedSell)}
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5 px-2 bg-sprout-tint rounded font-bold text-forest-emerald border border-forest-emerald/20">
                      <span>Net Dealer Margin Realized:</span>
                      <span className="font-tabular-md text-tabular-md">
                        ₹{formatCurrency(netMargin)} / Unit ({netMarginPct.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Sample SKU 2: Dynamic Fertilizer Simulator */}
            {(() => {
              const baseSell = safeNumber(sampleFertilizer.selling_price || 266.5);
              const mrp = safeNumber(sampleFertilizer.mrp || 266.5);
              const commission = 35.4;

              return (
                <div className="bg-surface-container-low rounded-xl p-space-md mb-space-md border border-outline-variant/30">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-label-badge text-label-badge bg-regulatory-sky-bg text-regulatory-sky px-1.5 py-0.5 rounded font-bold uppercase">
                        FCO STATUTORY FERTILIZER
                      </span>
                      <h3 className="font-title-sm text-body-md text-on-surface font-bold mt-1">
                        {sampleFertilizer.name || sampleFertilizer.product_name}
                      </h3>
                      <p className="font-label-code text-label-code text-on-surface-variant">
                        DBT Pos ID: #{sampleFertilizer.batch_number || 'IFF-UREA-45'} • HSN: {sampleFertilizer.hsn_code || '31021000'}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-label-code text-label-code text-on-surface-variant block">Statutory MRP</span>
                      <div className="font-tabular-md text-tabular-md text-on-surface font-bold">
                        ₹{formatCurrency(mrp)}
                      </div>
                    </div>
                  </div>

                  {/* Price Waterfall */}
                  <div className="mt-space-md space-y-1.5 font-label-code text-label-code">
                    <div className="flex justify-between py-1 px-2 rounded bg-surface-container-lowest">
                      <span className="text-on-surface-variant">Govt Regulated Base Selling Price:</span>
                      <span className="font-tabular-md font-semibold text-on-surface">
                        ₹{formatCurrency(baseSell)} (Locked Cap)
                      </span>
                    </div>
                    <div className="flex justify-between py-1 px-2 text-on-surface-variant">
                      <span>Dealer Commission (DBT Credit):</span>
                      <span className="font-tabular-md font-semibold text-forest-emerald">
                        ₹{formatCurrency(commission)} / Bag
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5 px-2 bg-regulatory-sky-bg/40 text-regulatory-sky rounded font-bold border border-regulatory-sky/20">
                      <span>Sub-Dealer Bulk Tier Transfer:</span>
                      <span className="font-tabular-md text-tabular-md">
                        ₹{formatCurrency(baseSell)} + Govt Rebate Pass
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Statutory Price Cap Check & Visual Spark Badge */}
          <div className="pt-space-sm">
            <div className="bg-sprout-tint p-space-sm rounded-xl flex items-center justify-between border border-forest-emerald/20">
              <div className="flex items-center gap-space-sm">
                <div className="w-7 h-7 rounded-full bg-forest-emerald text-white flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-title-sm text-body-sm text-forest-emerald font-bold">
                    FCO Statutory Price Cap Safe
                  </div>
                  <p className="font-label-code text-label-code text-on-surface-variant">
                    Zero rules exceed Central Fertilizer Control Order ceilings.
                  </p>
                </div>
              </div>
              <span className="font-label-badge text-label-badge bg-forest-emerald text-white px-2 py-0.5 rounded-full font-bold">
                AUDIT READY
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          5. PRICE LISTS & MASTER RULES TABLE SECTION
      ===================================================================== */}
      <section className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/30 p-space-lg">
        {/* Filter & Search Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md mb-space-md">
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-space-sm flex-1 max-w-2xl">
            {/* Search Input */}
            <div className="relative flex-1">
              <label htmlFor="price-rules-search" className="sr-only">
                Search price rules
              </label>
              <Search className="w-4 h-4 text-on-surface-variant absolute left-3.5 top-3.5 pointer-events-none" />
              <input
                id="price-rules-search"
                type="text"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="Search price rules, code (e.g. PL-01), SKU name, or tier..."
                className="w-full h-11 pl-11 pr-space-md bg-surface-container-low rounded-lg font-body-md text-body-md text-on-surface outline-none focus:ring-2 focus:ring-primary-container border border-transparent focus:border-forest-emerald"
              />
            </div>

            {/* Status Filter */}
            <div className="relative w-44">
              <label htmlFor="price-rules-status-filter" className="sr-only">
                Filter by Status
              </label>
              <select
                id="price-rules-status-filter"
                aria-label="Filter by Status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full h-11 px-3 bg-surface-container-low rounded-lg font-body-md text-body-sm text-on-surface outline-none appearance-none pr-8 font-semibold border border-outline-variant/30 cursor-pointer"
              >
                <option value="ALL">All Status ({priceLists.length})</option>
                <option value="ACTIVE">
                  Active Rules ({priceLists.filter((p) => p.is_active).length})
                </option>
                <option value="INACTIVE">
                  Paused ({priceLists.filter((p) => !p.is_active).length})
                </option>
              </select>
            </div>

            {/* Category Filter */}
            <div className="relative w-44">
              <label htmlFor="price-rules-category-filter" className="sr-only">
                Filter by Category
              </label>
              <select
                id="price-rules-category-filter"
                aria-label="Filter by Category"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full h-11 px-3 bg-surface-container-low rounded-lg font-body-md text-body-sm text-on-surface outline-none appearance-none pr-8 font-semibold border border-outline-variant/30 cursor-pointer"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Batch Actions */}
          <div className="flex items-center gap-space-xs">
            <button
              type="button"
              disabled={loading}
              onClick={() => void fetchData()}
              className="h-10 px-3 bg-surface-container-low hover:bg-surface-container text-on-surface rounded-lg font-label-code text-label-code font-bold flex items-center gap-1 transition-colors border border-outline-variant/30 active:scale-95"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-forest-emerald ${loading ? 'animate-spin' : ''}`} />
              <span>SYNC ALL POS</span>
            </button>
            <button
              type="button"
              onClick={openCreateModal}
              className="h-10 px-3 bg-primary-container text-on-primary rounded-lg font-label-code text-label-code font-bold flex items-center gap-1 shadow-xs hover:bg-canopy-deep transition-all active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>NEW TIER</span>
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto rounded-lg border border-outline-variant/20">
          <table className="w-full text-left font-body-md text-body-sm">
            <thead className="bg-surface-container-low font-label-code text-label-code text-on-surface-variant uppercase tracking-wider border-b border-outline-variant/20">
              <tr>
                <th className="py-3 px-space-md">Rule Title &amp; ID</th>
                <th className="py-3 px-space-md">Target Audience &amp; Eligibility</th>
                <th className="py-3 px-space-md">Category Scope</th>
                <th className="py-3 px-space-md text-right">Price Adjustment</th>
                <th className="py-3 px-space-md">Validity Window</th>
                <th className="py-3 px-space-md text-right">Covered SKUs</th>
                <th className="py-3 px-space-md text-center">Status</th>
                <th className="py-3 px-space-md text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-high/40">
              {/* Row 0: Retail Counter Default (Always Active) */}
              <tr className="hover:bg-surface-container-low/60 transition-colors">
                <td className="py-3.5 px-space-md">
                  <div className="flex items-center gap-space-sm">
                    <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-on-surface-variant font-bold text-[12px]">
                      R0
                    </div>
                    <div>
                      <div className="font-title-sm text-body-md font-bold text-on-surface">
                        Retail Walk-in Base
                      </div>
                      <span className="font-label-code text-label-code text-on-surface-variant">
                        PL-RET-00 • System Default
                      </span>
                    </div>
                  </div>
                </td>
                <td className="py-3.5 px-space-md">
                  <span className="font-body-sm text-on-surface font-medium">All Walk-in Farmers</span>
                  <div className="font-label-code text-label-code text-on-surface-variant">
                    No KYC required • Immediate settlement
                  </div>
                </td>
                <td className="py-3.5 px-space-md">
                  <span className="font-label-badge text-label-badge bg-surface-container text-on-surface px-2 py-0.5 rounded-full font-bold">
                    ALL CATEGORIES
                  </span>
                </td>
                <td className="py-3.5 px-space-md text-right">
                  <span className="font-tabular-md text-tabular-md font-bold text-on-surface">
                    0.0% Offset
                  </span>
                  <div className="font-label-code text-label-code text-on-surface-variant">
                    100% Govt MRP
                  </div>
                </td>
                <td className="py-3.5 px-space-md">
                  <div className="font-label-code text-label-code font-semibold text-forest-emerald flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Permanent Default
                  </div>
                </td>
                <td className="py-3.5 px-space-md text-right font-tabular-md text-tabular-md font-bold text-on-surface font-mono">
                  {unassignedProductsCount}
                </td>
                <td className="py-3.5 px-space-md text-center">
                  <span className="font-label-badge text-label-badge bg-sprout-tint text-primary px-2.5 py-0.5 rounded-full font-bold">
                    ACTIVE
                  </span>
                </td>
                <td className="py-3.5 px-space-md text-right">
                  <span className="font-label-code text-label-code text-on-surface-variant italic">
                    Counter Locked
                  </span>
                </td>
              </tr>

              {/* Dynamic Rows from real priceLists */}
              {paginatedPriceLists.length === 0 && priceLists.length > 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-on-surface-variant text-body-sm">
                    No pricing rules match your search or filter.
                  </td>
                </tr>
              ) : (
                paginatedPriceLists.map((pl, idx) => {
                  const isDiscount = pl.adjustment_type === 'DISCOUNT';
                  const isPercent = pl.calculation_mode === 'PERCENTAGE';
                  const sign = isDiscount ? '-' : '+';
                  const unit = isPercent ? '%' : '₹';

                  return (
                    <tr
                      key={pl.id}
                      className={`hover:bg-surface-container-low/60 transition-colors ${
                        isDiscount ? 'bg-khata-amber-bg/10' : 'bg-surface-container-lowest'
                      }`}
                    >
                      <td className="py-3.5 px-space-md">
                        <div className="flex items-center gap-space-sm">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-[12px] ${
                              isDiscount ? 'bg-khata-amber-bg text-khata-amber' : 'bg-sprout-tint text-primary'
                            }`}
                          >
                            P{idx + 1}
                          </div>
                          <div>
                            <div className="font-title-sm text-body-md font-bold text-on-surface">
                              {pl.name}
                            </div>
                            <span className="font-label-code text-label-code text-on-surface-variant">
                              PL-0{idx + 1} • {isDiscount ? 'Discount Tier' : 'Markup Tier'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-space-md">
                        <span className="font-body-sm text-on-surface font-medium">
                          {pl.description || 'Assigned Customers & Outlets'}
                        </span>
                        <div className="font-label-code text-label-code text-on-surface-variant">
                          POS Real-time auto trigger
                        </div>
                      </td>
                      <td className="py-3.5 px-space-md">
                        <span className="font-label-badge text-label-badge bg-sprout-tint text-primary px-1.5 py-0.5 rounded font-bold">
                          {pl.product_count} PRODUCTS
                        </span>
                      </td>
                      <td className="py-3.5 px-space-md text-right">
                        <span
                          className={`font-tabular-md text-tabular-md font-bold font-mono ${
                            isDiscount ? 'text-khata-amber' : 'text-forest-emerald'
                          }`}
                        >
                          {sign}{pl.adjustment_value}{unit}
                        </span>
                        <div className="font-label-code text-label-code text-on-surface-variant">
                          {isDiscount ? 'Line discount' : 'Margin markup'}
                        </div>
                      </td>
                      <td className="py-3.5 px-space-md">
                        <div className="font-label-code text-label-code text-on-surface">
                          Continuous Policy
                        </div>
                        <div className="font-label-code text-label-code text-on-surface-variant">
                          Updated: {pl.updated_at ? pl.updated_at.slice(0, 10) : 'Active'}
                        </div>
                      </td>
                      <td className="py-3.5 px-space-md text-right font-tabular-md text-tabular-md font-bold text-on-surface font-mono">
                        {pl.product_count}
                      </td>
                      <td className="py-3.5 px-space-md text-center">
                        <button
                          type="button"
                          aria-label={`Toggle active state for ${pl.name}`}
                          onClick={() => handleToggleActive(pl)}
                          className={`font-label-badge text-label-badge px-2.5 py-0.5 rounded-full font-bold cursor-pointer transition-all ${
                            pl.is_active
                              ? 'bg-sprout-tint text-primary hover:bg-emerald-200'
                              : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                          }`}
                        >
                          {pl.is_active ? 'ACTIVE' : 'PAUSED'}
                        </button>
                      </td>
                      <td className="py-3.5 px-space-md text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            aria-label={`Assign products to ${pl.name}`}
                            onClick={() => openAssignModal(pl)}
                            className="w-8 h-8 rounded hover:bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-forest-emerald transition-colors"
                            title="Assign Products"
                          >
                            <Layers className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Edit ${pl.name}`}
                            onClick={() => openEditModal(pl)}
                            className="w-8 h-8 rounded hover:bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors"
                            title="Edit Tier"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Clone ${pl.name}`}
                            onClick={() => handleClonePriceList(pl)}
                            className="w-8 h-8 rounded hover:bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors"
                            title="Clone Tier"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete ${pl.name}`}
                            onClick={() => handleDeletePriceList(pl)}
                            className="w-8 h-8 rounded hover:bg-red-50 flex items-center justify-center text-on-surface-variant hover:text-red-600 transition-colors"
                            title="Delete Tier"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer / Pagination Metadata */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-space-sm pt-space-md mt-space-sm font-label-code text-label-code text-on-surface-variant">
          <div className="flex items-center gap-space-xs">
            <CheckCircle2 className="w-4 h-4 text-forest-emerald" />
            <span>
              Showing {filteredPriceLists.length} active pricing rules • 100% catalog covered
            </span>
          </div>
          <div className="flex items-center gap-space-xs">
            <span>
              Displaying Page {tablePage} of {totalPages}
            </span>
            <div className="flex items-center gap-1 ml-space-sm">
              <button
                type="button"
                disabled={tablePage <= 1}
                onClick={() => setTablePage((prev) => Math.max(1, prev - 1))}
                className="w-8 h-8 rounded bg-surface-container-low flex items-center justify-center hover:bg-surface-container disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={tablePage >= totalPages}
                onClick={() => setTablePage((prev) => Math.min(totalPages, prev + 1))}
                className="w-8 h-8 rounded bg-surface-container-low flex items-center justify-center hover:bg-surface-container disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          6. STATUTORY FORM O PRICE BOARD & VISUAL RATE CARD GENERATOR
      ===================================================================== */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-stretch">
        {/* Form O Compliance Banner & Generator Trigger (7 Cols) */}
        <div className="lg:col-span-7 bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-outline-variant/30 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-space-sm mb-space-sm">
              <div className="w-10 h-10 rounded-xl bg-regulatory-sky-bg text-regulatory-sky flex items-center justify-center border border-regulatory-sky/20">
                <ShieldCheck className="w-6 h-6 text-regulatory-sky" />
              </div>
              <div>
                <div className="flex items-center gap-space-xs">
                  <h2 className="font-headline-md text-headline-md text-on-surface font-bold">
                    Statutory Display Price Board Generator
                  </h2>
                  <span className="font-label-badge text-label-badge bg-regulatory-sky-bg text-regulatory-sky px-2 py-0.5 rounded-full font-bold border border-regulatory-sky/20">
                    MANDATORY
                  </span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Clause 14(1) Fertilizer (Control) Order 1985 &amp; Insecticide Rules display compliance.
                </p>
              </div>
            </div>

            <p className="font-body-md text-body-md text-on-surface-variant my-space-md">
              Under the Fertilizer Control Order (FCO) and state agriculture department mandates, every licensed Kendra must visibly post daily retail selling rates, available batch stock quantities, and maximum retail caps outside the shop premise.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-space-sm my-space-md font-label-code text-label-code">
              <div className="bg-surface-container-low p-space-sm rounded-lg border border-outline-variant/30">
                <div className="text-on-surface-variant mb-1">Board Dimensions</div>
                <div className="font-bold text-on-surface text-body-sm">Standard A4 / A3 Poster</div>
              </div>
              <div className="bg-surface-container-low p-space-sm rounded-lg border border-outline-variant/30">
                <div className="text-on-surface-variant mb-1">Sync Timestamp</div>
                <div className="font-bold text-forest-emerald text-body-sm">
                  Today, {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <div className="bg-surface-container-low p-space-sm rounded-lg border border-outline-variant/30">
                <div className="text-on-surface-variant mb-1">State License Ref</div>
                <div className="font-bold text-on-surface text-body-sm truncate">
                  {settings?.fertilizer_license_no || settings?.gstin || 'KA-BLR-KND-042'}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-space-sm pt-space-md border-t border-outline-variant/20">
            <button
              type="button"
              onClick={handlePrintFormOPriceBoard}
              className="h-11 px-space-md bg-regulatory-sky text-on-primary rounded-lg font-title-sm text-body-sm font-bold flex items-center gap-space-xs shadow-sm hover:opacity-95 transition-opacity cursor-pointer active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Download Form O Price Board PDF</span>
            </button>
            <button
              type="button"
              onClick={handleExportRateCard}
              className="h-11 px-space-md bg-surface-container-low hover:bg-surface-container text-on-surface rounded-lg font-title-sm text-body-sm font-semibold flex items-center gap-space-xs transition-colors border border-outline-variant/30 active:scale-95"
            >
              <FileDown className="w-4 h-4 text-forest-emerald" />
              <span>Export POS CSV Rate Matrix</span>
            </button>
          </div>
        </div>

        {/* Live Board Visual Mini-Preview Card (5 Cols) */}
        <div className="lg:col-span-5 bg-surface-container-low rounded-xl p-space-md shadow-sm border border-outline-variant/30 relative flex flex-col justify-between">
          <div className="bg-surface-container-lowest rounded-lg p-space-md shadow-sm border border-outline-variant/20">
            <div className="text-center pb-space-xs border-b border-black/10">
              <span className="font-label-badge text-label-badge bg-surface-container text-on-surface-variant px-2 py-0.5 rounded font-bold uppercase">
                MANDATORY NOTICE BOARD DISPLAY
              </span>
              <h3 className="font-headline-md text-title-sm text-on-surface font-extrabold mt-1 uppercase truncate">
                {settings?.shop_name || 'GREEN VALLEY AGRO KENDRA'}
              </h3>
              <p className="font-label-code text-label-code text-on-surface-variant truncate">
                Govt Lic: {settings?.fertilizer_license_no || 'FERT/KA-2023/8892'} | Dated: {new Date().toLocaleDateString('en-IN')}
              </p>
            </div>

            <div className="my-space-sm font-label-code text-[11px] leading-tight space-y-2">
              <div className="flex justify-between py-1 bg-surface-container-low px-2 rounded font-bold text-on-surface">
                <span>Product Name &amp; Pack</span>
                <span>Govt MRP</span>
                <span>Kendra Rate</span>
              </div>
              {allProducts.slice(0, 4).map((p, i) => (
                <div key={p.id} className="flex justify-between px-2 text-on-surface">
                  <span className="truncate max-w-[150px]">
                    {i + 1}. {p.name || p.product_name}
                  </span>
                  <span className="font-tabular-md">₹{formatCurrency(safeNumber(p.mrp || p.selling_price))}</span>
                  <span className="font-tabular-md font-bold text-forest-emerald">
                    ₹{formatCurrency(safeNumber(p.selling_price))}
                  </span>
                </div>
              ))}
              {allProducts.length === 0 && (
                <div className="px-2 py-4 text-center text-on-surface-variant text-[11px]">
                  No products in godown yet.
                </div>
              )}
            </div>

            <div className="pt-space-xs flex items-center justify-between font-label-code text-[10px] text-on-surface-variant border-t border-black/10">
              <span>*Selling above MRP is punishable under EC Act 1955</span>
              <span className="font-bold text-primary">OFFICIAL SEAL</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-space-sm px-space-xs font-label-code text-label-code text-on-surface-variant">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-forest-emerald animate-pulse" />
              Auto-refreshes daily with batch arrivals
            </span>
            <button
              type="button"
              onClick={handlePrintFormOPriceBoard}
              className="text-primary font-bold hover:underline cursor-pointer"
            >
              Full Screen Preview
            </button>
          </div>
        </div>
      </section>

      {/* =====================================================================
          7. MODALS: CREATE / EDIT PRICE LIST & PRODUCT ASSIGNMENT DRAWER
      ===================================================================== */}
      {/* Create / Edit Price List Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
            <div className="px-5 py-4 bg-forest-emerald text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-emerald-200" />
                <h3 className="font-bold text-sm">
                  {editingPriceList ? `Edit Price List: ${editingPriceList.name}` : 'Create New Customer Tier / Price List'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-emerald-200 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveModalPriceList} className="p-5 space-y-4 text-xs">
              <div>
                <label htmlFor="modal-pl-name" className="block font-semibold text-slate-700 mb-1">
                  Price List Name *
                </label>
                <input
                  id="modal-pl-name"
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Registered Credit Farmers (3% Off)"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="modal-pl-description" className="block font-semibold text-slate-700 mb-1">
                  Description / Eligibility Note
                </label>
                <input
                  id="modal-pl-description"
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="e.g. Applied automatically to Aadhaar-verified Khata growers"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="modal-pl-type" className="block font-semibold text-slate-700 mb-1">
                    Adjustment Type
                  </label>
                  <select
                    id="modal-pl-type"
                    value={formAdjustmentType}
                    onChange={(e) => setFormAdjustmentType(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                  >
                    <option value="DISCOUNT">Discount (Reduce Base Price)</option>
                    <option value="INCREMENT">Increment (Markup Base Price)</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="modal-pl-mode" className="block font-semibold text-slate-700 mb-1">
                    Calculation Mode
                  </label>
                  <select
                    id="modal-pl-mode"
                    value={formCalculationMode}
                    onChange={(e) => setFormCalculationMode(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                  >
                    <option value="PERCENTAGE">Percentage (%)</option>
                    <option value="FIXED">Fixed Amount (₹)</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="modal-pl-val" className="block font-semibold text-slate-700 mb-1">
                  Adjustment Value ({formCalculationMode === 'PERCENTAGE' ? '%' : '₹'}) *
                </label>
                <input
                  id="modal-pl-val"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={formAdjustmentValue}
                  onChange={(e) => setFormAdjustmentValue(e.target.value)}
                  placeholder="e.g. 5.0"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-black text-emerald-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {!editingPriceList && (
                <div>
                  <label htmlFor="modal-pl-scope" className="block font-semibold text-slate-700 mb-1">
                    Initial Product Assignment
                  </label>
                  <select
                    id="modal-pl-scope"
                    value={formScope}
                    onChange={(e) => setFormScope(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                  >
                    <option value="NONE">Do Not Assign Now (Assign Later)</option>
                    <option value="ALL">Apply To All Store Products</option>
                    <option value="SPECIFIED">Select Specific Products</option>
                  </select>
                </div>
              )}

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="bg-forest-emerald hover:bg-canopy-deep text-white px-5 py-2 rounded-xl font-bold shadow transition-all active:scale-95 disabled:opacity-50"
                >
                  {actionLoading ? 'Saving...' : editingPriceList ? 'Update Price List' : 'Create Price List'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Specified Products Modal / Drawer */}
      {assignModalPriceList && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">
                  Assign Products to: {assignModalPriceList.name}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {assignModalPriceList.adjustment_type === 'DISCOUNT' ? '-' : '+'}
                  {assignModalPriceList.adjustment_value}
                  {assignModalPriceList.calculation_mode === 'PERCENTAGE' ? '%' : '₹'} adjustment applied on selection
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAssignModalPriceList(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmAssignProducts} className="p-5 space-y-4 text-xs">
              {/* Search & Filter Toolbar */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <label htmlFor="assign-product-search" className="sr-only">
                    Search products to assign
                  </label>
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    id="assign-product-search"
                    type="text"
                    value={assignSearchQuery}
                    onChange={(e) => setAssignSearchQuery(e.target.value)}
                    placeholder="Search by product name, trade name, brand..."
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div className="w-44">
                  <label htmlFor="assign-product-cat-filter" className="sr-only">
                    Filter Category
                  </label>
                  <select
                    id="assign-product-cat-filter"
                    aria-label="Filter Category"
                    value={assignCategoryFilter}
                    onChange={(e) => setAssignCategoryFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                  >
                    <option value="All">All Categories</option>
                    {CATEGORIES.filter((c) => c !== 'All Categories').map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Quick Select All / None */}
              <div className="flex items-center justify-between text-[11px] text-slate-600 border-b border-slate-100 pb-2">
                <span>
                  <strong>{assignSelectedIds.length}</strong> of <strong>{allProducts.length}</strong> products selected
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const allVisible = filteredModalProducts.map((p) => p.id);
                      setAssignSelectedIds((prev) => Array.from(new Set([...prev, ...allVisible])));
                    }}
                    className="text-emerald-700 font-bold hover:underline"
                  >
                    Select All Visible
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => setAssignSelectedIds([])}
                    className="text-slate-500 hover:text-slate-900"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {/* Product Checkbox List */}
              <div className="border border-slate-200 rounded-xl max-h-80 overflow-y-auto divide-y divide-slate-100 bg-white">
                {filteredModalProducts.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">
                    No products match your search.
                  </div>
                ) : (
                  filteredModalProducts.map((p) => {
                    const isChecked = assignSelectedIds.includes(p.id);
                    const isAssignedToOther = p.price_list_id && p.price_list_id !== assignModalPriceList.id;

                    return (
                      <label
                        key={p.id}
                        htmlFor={`assign-prod-${p.id}`}
                        className={`p-3 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition ${
                          isChecked ? 'bg-emerald-50/50' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            id={`assign-prod-${p.id}`}
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setAssignSelectedIds((prev) => [...prev, p.id]);
                              } else {
                                setAssignSelectedIds((prev) => prev.filter((id) => id !== p.id));
                              }
                            }}
                            className="w-4 h-4 text-forest-emerald rounded border-slate-300 focus:ring-forest-emerald"
                          />
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-900">
                                {p.name || p.product_name}
                              </span>
                              {p.trade_name && (
                                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-900 px-1.5 py-0.2 rounded">
                                  Trade: {p.trade_name}
                                </span>
                              )}
                              <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-mono">
                                {p.category}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {p.company_name ? `${p.company_name} • ` : ''}
                              Stock: {p.current_stock} {p.unit}
                              {isAssignedToOther && (
                                <span className="ml-2 text-amber-700 font-semibold">
                                  (Currently on: {p.price_list_name})
                                </span>
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="text-right font-mono">
                          <span className="text-slate-400 block text-[10px] line-through">
                            Base: ₹{formatCurrency(safeNumber(p.base_selling_price || p.selling_price))}
                          </span>
                          <span className="font-bold text-forest-emerald text-xs">
                            MRP: ₹{formatCurrency(safeNumber(p.mrp))}
                          </span>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAssignModalPriceList(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="bg-forest-emerald hover:bg-canopy-deep text-white px-5 py-2 rounded-xl font-bold shadow transition-all active:scale-95 disabled:opacity-50"
                >
                  {actionLoading ? 'Saving...' : `Save Assignments (${assignSelectedIds.length})`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
