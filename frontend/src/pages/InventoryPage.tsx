import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Search,
  AlertTriangle,
  Clock,
  Edit,
  ArrowUpDown,
  X,
  Package,
  Barcode,
  RotateCcw,
  Zap,
  Tag,
  ShieldCheck,
  Download,
  Printer,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  CheckCircle2,
  Warehouse,
  FileText,
  BadgeAlert,
  Layers,
} from 'lucide-react';
import { productsApi, inventoryApi, getErrorMessage } from '../api';
import { Product, ProductVariant, RefillRecommendation } from '../types';
import {
  safeNumber,
  safeString,
  formatCurrency,
  sanitizeTextInput,
  sanitizeCodeInput,
  clampNonNegative,
  resolveTradeName,
} from '../utils/formatters';
import { INVENTORY_PAGE_SIZE, clampPage, getPageRange, getTotalPages } from '../utils/pagination';
import { filterByAlert, mergeProductsById } from '../utils/inventoryFilters';
import { CustomSelect } from '../components/common/CustomSelect';
import { useShop } from '../context/ShopContext';
import { useAuth } from '../context/AuthContext';
import { BarcodePrintModal } from '../components/inventory/BarcodePrintModal';
import { ProductFormModal } from '../components/inventory/ProductFormModal';
import { MetricInfoTooltip } from '../components/common/MetricInfoTooltip';
import {
  INVENTORY_CATEGORIES,
  INVENTORY_CATEGORY_CONFIGS,
  InventoryCategoryId,
  normalizeCategory,
  normalizeUnit,
  getCategoryConfig,
  getAllowedVariantUnits,
  getCategoryAttributeBadges,
} from '../config/inventoryCategories';

function toDateInputValue(raw?: string | null): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  if (/^\d{4}-\d{2}$/.test(trimmed)) return `${trimmed}-01`;
  return trimmed;
}

function getExpiryBadge(expiryDate?: string | null) {
  if (!expiryDate) {
    return {
      label: 'Stable (No Expiry)',
      colorClass: 'bg-sprout-tint text-forest-emerald border border-forest-emerald/20',
      iconClass: 'text-forest-emerald',
      isCritical: false,
    };
  }
  const exp = new Date(expiryDate);
  if (Number.isNaN(exp.getTime())) {
    return {
      label: expiryDate,
      colorClass: 'bg-surface-container text-on-surface-variant border border-outline-variant/40',
      iconClass: 'text-on-surface-variant',
      isCritical: false,
    };
  }
  const diffDays = Math.ceil((exp.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) {
    return {
      label: `EXPIRED (${Math.abs(diffDays)}d ago)`,
      colorClass: 'bg-critical-rose-bg text-critical-rose border border-critical-rose/30',
      iconClass: 'text-critical-rose',
      isCritical: true,
    };
  }
  if (diffDays <= 30) {
    return {
      label: `${diffDays} Days Left (${expiryDate})`,
      colorClass: 'bg-critical-rose-bg text-critical-rose border border-critical-rose/30',
      iconClass: 'text-critical-rose',
      isCritical: true,
    };
  }
  if (diffDays <= 60) {
    return {
      label: `${diffDays} Days Watch (${expiryDate})`,
      colorClass: 'bg-khata-amber-bg text-khata-amber border border-khata-amber/30',
      iconClass: 'text-khata-amber',
      isCritical: false,
    };
  }
  return {
    label: `Healthy (${expiryDate})`,
    colorClass: 'bg-sprout-tint text-forest-emerald border border-forest-emerald/20',
    iconClass: 'text-forest-emerald',
    isCritical: false,
  };
}

export const InventoryPage: React.FC = () => {
  const { settings } = useShop();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Core Data
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [pageItems, setPageItems] = useState<Product[]>([]);
  const [pageTotal, setPageTotal] = useState(0);
  const [alertItems, setAlertItems] = useState<Product[] | null>(null);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const requestSeq = useRef(0);
  const [recommendations, setRecommendations] = useState<RefillRecommendation[]>([]);

  // Search & Filters
  const [search, setSearch] = useState('');
  const initialCategoryParam = searchParams.get('category');
  const [selectedCategory, setSelectedCategory] = useState<string>(
    initialCategoryParam && initialCategoryParam.toUpperCase() !== 'ALL'
      ? normalizeCategory(initialCategoryParam)
      : 'ALL'
  );
  const [filterType, setFilterType] = useState<'ALL' | 'LOW_STOCK' | 'NEAR_EXPIRY'>('ALL');
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);

  // Debounce search
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(handle);
  }, [search]);

  const filterKey = `${debouncedSearch}|${selectedCategory}|${filterType}|${selectedLocation}`;
  const [pageState, setPageState] = useState({ key: filterKey, page: 1 });
  const page = pageState.key === filterKey ? pageState.page : 1;
  const setPage = (next: number) => setPageState({ key: filterKey, page: next });

  // Merge client-side products for lookup
  const products = useMemo(() => mergeProductsById(pageItems, catalog), [pageItems, catalog]);

  // Preview product for 50x25mm thermal label simulator
  const [selectedPreviewProductId, setSelectedPreviewProductId] = useState<number | null>(null);
  const previewProduct = useMemo<Product | null>(() => {
    if (selectedPreviewProductId !== null) {
      const found = products.find((p) => p.id === selectedPreviewProductId);
      if (found) return found;
    }
    return pageItems[0] || catalog[0] || null;
  }, [selectedPreviewProductId, products, pageItems, catalog]);

  // Keep selectedCategory synchronized with URL query params
  useEffect(() => {
    const paramCat = searchParams.get('category');
    if (!paramCat || paramCat.toUpperCase() === 'ALL') {
      setSelectedCategory('ALL');
    } else {
      setSelectedCategory(normalizeCategory(paramCat));
    }
  }, [searchParams]);

  const handleCategorySelect = (cat: string) => {
    const normalized = cat === 'ALL' ? 'ALL' : normalizeCategory(cat);
    setSelectedCategory(normalized);
    if (normalized === 'ALL') {
      setSearchParams({}, { replace: true });
    } else {
      setSearchParams({ category: normalized }, { replace: true });
    }
  };

  // Keyboard shortcut: F2 focuses search omnibar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        const searchInput = document.getElementById('inventory-search');
        if (searchInput) {
          searchInput.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Modals state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [productVariants, setProductVariants] = useState<ProductVariant[]>([]);
  const [tradeNameManuallyEdited, setTradeNameManuallyEdited] = useState(false);
  const [enableVariantsForOthers, setEnableVariantsForOthers] = useState(false);

  // Duplicate Check
  const [duplicateAlert, setDuplicateAlert] = useState<{
    exists: boolean;
    message: string;
    product?: Product;
  } | null>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);

  // Stock Adjustment Modal
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [adjustType, setAdjustType] = useState<'DAMAGE' | 'AUDIT_CORRECTION' | 'RETURN'>('AUDIT_CORRECTION');
  const [adjustQty, setAdjustQty] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState('');

  // Refill Stock Modal
  const [isRefillModalOpen, setIsRefillModalOpen] = useState(false);
  const [refillProductId, setRefillProductId] = useState<number | null>(null);
  const [refillCompanyName, setRefillCompanyName] = useState<string>('');
  const [refillTradeName, setRefillTradeName] = useState<string>('');
  const [refillTradeManuallyEdited, setRefillTradeManuallyEdited] = useState(false);
  const [refillQty, setRefillQty] = useState<number>(10);
  const [refillUnit, setRefillUnit] = useState<string>('Bags');
  const [refillBatch, setRefillBatch] = useState<string>('');
  const [refillMfgDate, setRefillMfgDate] = useState<string>('');
  const [refillExpiry, setRefillExpiry] = useState<string>('');
  const [refillPurchasePrice, setRefillPurchasePrice] = useState<number>(0);
  const [refillSellingPrice, setRefillSellingPrice] = useState<number>(0);
  const [refillMrp, setRefillMrp] = useState<number>(0);
  const [refillSupplier, setRefillSupplier] = useState<string>('');
  const [refillInvoice, setRefillInvoice] = useState<string>('');
  const [refillNotes, setRefillNotes] = useState<string>('');
  const [refillSubmitting, setRefillSubmitting] = useState(false);
  const [refillProductSearch, setRefillProductSearch] = useState<string>('');

  // Barcode Print Modal
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const [selectedBarcodeProduct, setSelectedBarcodeProduct] = useState<Product | null>(null);

  // Real data calculations for 4 KPI cards
  const {
    totalValuation,
    totalCount,
    fertValue,
    pestValue,
    seedsValue,
    microValue,
    adequateCount,
    adequatePercent,
    lowStockCount,
    lowStockItems,
    nearExpiryCount,
    nearExpiryValue,
  } = useMemo(() => {
    let totVal = 0;
    let fertVal = 0;
    let pestVal = 0;
    let seedsVal = 0;
    let microVal = 0;
    let adequate = 0;
    let lowCount = 0;
    const lowNames: string[] = [];
    let expiringCount = 0;
    let expiringVal = 0;

    const now = new Date();
    const in60Days = new Date();
    in60Days.setDate(now.getDate() + 60);

    const sourceList = catalog.length > 0 ? catalog : pageItems;

    sourceList.forEach((p) => {
      const stock = safeNumber(p.current_stock);
      const sellPrice = safeNumber(p.selling_price || p.mrp);
      const itemVal = stock * sellPrice;
      totVal += itemVal;

      const cat = normalizeCategory(p.category);
      if (cat === 'Fertilizer') fertVal += itemVal;
      else if (cat === 'Pesticide') pestVal += itemVal;
      else if (cat === 'Seeds') seedsVal += itemVal;
      else microVal += itemVal;

      const minStock = safeNumber(p.min_stock_level ?? (p as any).minimum_stock ?? 20);
      if (stock > minStock) {
        adequate += 1;
      } else {
        lowCount += 1;
        if (lowNames.length < 3) {
          lowNames.push(p.name || p.product_name || 'Item');
        }
      }

      if (p.expiry_date) {
        const exp = new Date(p.expiry_date);
        if (!Number.isNaN(exp.getTime()) && exp <= in60Days) {
          expiringCount += 1;
          expiringVal += itemVal;
        }
      }
    });

    const totCount = categoryCounts.ALL || sourceList.length;
    const adqPct = totCount > 0 ? Math.min(100, Math.max(0, (adequate / (sourceList.length || 1)) * 100)) : 100;

    return {
      totalValuation: totVal,
      totalCount: totCount,
      fertValue: fertVal,
      pestValue: pestVal,
      seedsValue: seedsVal,
      microValue: microVal,
      adequateCount: adequate,
      adequatePercent: adqPct,
      lowStockCount: lowCount,
      lowStockItems: lowNames,
      nearExpiryCount: expiringCount,
      nearExpiryValue: expiringVal,
    };
  }, [catalog, pageItems, categoryCounts]);

  // Load the visible table page
  const loadPage = useCallback(async () => {
    const seq = ++requestSeq.current;
    setIsLoading(true);
    try {
      const category = selectedCategory === 'ALL' ? undefined : selectedCategory;
      if (filterType === 'ALL') {
        const { items, total } = await productsApi.getPage({
          skip: (page - 1) * INVENTORY_PAGE_SIZE,
          limit: INVENTORY_PAGE_SIZE,
          search: debouncedSearch || undefined,
          category,
        });
        if (seq !== requestSeq.current) return;
        if (items.length === 0 && total > 0 && page > 1) {
          setPage(clampPage(page, total, INVENTORY_PAGE_SIZE));
          return;
        }
        setPageItems(items);
        setPageTotal(total);
        setAlertItems(null);
      } else {
        const all = await productsApi.getAllPages({ search: debouncedSearch || undefined, category });
        if (seq !== requestSeq.current) return;
        const matched = filterByAlert(all, filterType);
        setAlertItems(matched);
        setPageTotal(matched.length);
      }
    } catch {
      // Keep previous page on transient failure
    } finally {
      if (seq === requestSeq.current) setIsLoading(false);
    }
  }, [selectedCategory, filterType, debouncedSearch, page]);

  // Load Category Counts
  const loadCategoryCounts = async () => {
    try {
      const [all, ...perCategory] = await Promise.all([
        productsApi.getPage({ limit: 1 }),
        ...INVENTORY_CATEGORIES.map((cat) => productsApi.getPage({ limit: 1, category: cat })),
      ]);
      const counts: Record<string, number> = { ALL: all.total };
      INVENTORY_CATEGORIES.forEach((cat, idx) => {
        counts[cat] = perCategory[idx].total;
      });
      setCategoryCounts(counts);
    } catch {
      // Non-critical counts
    }
  };

  // Load Catalog
  const loadCatalog = async () => {
    try {
      const [data, recs] = await Promise.all([
        productsApi.getAll(),
        productsApi.getRefillRecommendations().catch(() => []),
      ]);
      setCatalog(data);
      setRecommendations(recs || []);
    } catch {
      // Local fallback
    }
  };

  const loadProducts = async () => {
    await Promise.all([loadCatalog(), loadPage(), loadCategoryCounts()]);
  };

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  useEffect(() => {
    void loadCatalog();
    void loadCategoryCounts();
  }, []);

  // Filter products by location if location selected
  const filteredProducts = useMemo(() => {
    let source = alertItems !== null ? alertItems.slice((page - 1) * INVENTORY_PAGE_SIZE, page * INVENTORY_PAGE_SIZE) : pageItems;
    if (selectedLocation !== 'all') {
      source = source.filter((p) => {
        const loc = String(p.category_attributes?.rack_location || p.category_attributes?.storage_bay || '').toLowerCase();
        if (selectedLocation === 'bay-a') return loc.includes('a') || p.category === 'Fertilizer';
        if (selectedLocation === 'bay-b') return loc.includes('b') || p.category === 'Fertilizer';
        if (selectedLocation === 'cold-cellar') return loc.includes('cold') || loc.includes('cellar') || p.category === 'Seeds';
        if (selectedLocation === 'counter') return loc.includes('counter') || loc.includes('shelf');
        return true;
      });
    }
    return source;
  }, [pageItems, alertItems, page, selectedLocation]);

  const totalPages = getTotalPages(pageTotal, INVENTORY_PAGE_SIZE);
  const pageRange = getPageRange(page, pageTotal, INVENTORY_PAGE_SIZE);

  // Active category rules for Add/Edit modal
  const activeEditCategoryConfig = useMemo(
    () => getCategoryConfig(editingProduct?.category),
    [editingProduct?.category]
  );

  const allowedEditVariantUnits = useMemo(
    () => getAllowedVariantUnits(editingProduct?.unit, editingProduct?.category),
    [editingProduct?.unit, editingProduct?.category]
  );

  const openAddProductModal = (categoryOverride?: string) => {
    const targetCategory: InventoryCategoryId =
      categoryOverride && categoryOverride !== 'ALL'
        ? normalizeCategory(categoryOverride)
        : selectedCategory !== 'ALL'
        ? normalizeCategory(selectedCategory)
        : 'Fertilizer';
    const cfg = getCategoryConfig(targetCategory);
    setEditingProduct({
      name: '',
      company_name: '',
      trade_name: '',
      category: cfg.id,
      hsn_code: '',
      unit: cfg.defaultUnit,
      current_stock: 0,
      cost_price: 0,
      selling_price: 0,
      mrp: 0,
      gst_rate: cfg.defaultGstRate,
      batch_number: '',
      manufacture_date: '',
      expiry_date: '',
      category_attributes: {},
      min_stock_level: 20,
      is_active: true,
    });
    setTradeNameManuallyEdited(false);
    setProductVariants([]);
    setEnableVariantsForOthers(false);
    setDuplicateAlert(null);
    setIsEditModalOpen(true);
  };

  const openEditProductModal = (p: Product) => {
    const normalizedCat = normalizeCategory(p.category);
    const normalizedUnitVal = normalizeUnit(p.unit);
    const existingVariants = (p.variants || []).map((v) => ({
      ...v,
      unit: normalizeUnit(v.unit),
    }));
    setEditingProduct({
      ...p,
      category: normalizedCat,
      unit: normalizedUnitVal,
      manufacture_date: toDateInputValue(p.manufacture_date),
      expiry_date: toDateInputValue(p.expiry_date),
      category_attributes: { ...(p.category_attributes || {}) },
      is_active: p.is_active ?? true,
    });
    setTradeNameManuallyEdited(Boolean(p.trade_name));
    setProductVariants(existingVariants);
    setEnableVariantsForOthers(normalizedCat !== 'Others' || existingVariants.length > 1);
    setDuplicateAlert(null);
    setIsEditModalOpen(true);
  };

  const handleEditCategoryChange = (newCategory: string) => {
    if (!editingProduct) return;
    const nextCfg = getCategoryConfig(newCategory);
    const currentUnitNorm = normalizeUnit(editingProduct.unit);
    const nextUnit = nextCfg.allowedUnits.includes(currentUnitNorm)
      ? currentUnitNorm
      : nextCfg.defaultUnit;
    const nextAllowedVariantUnits = getAllowedVariantUnits(nextUnit, nextCfg.id);

    setEditingProduct({
      ...editingProduct,
      category: nextCfg.id,
      unit: nextUnit,
      gst_rate: nextCfg.defaultGstRate,
      expiry_date: nextCfg.dateFields.showExpiryDate ? editingProduct.expiry_date || '' : '',
      manufacture_date: nextCfg.dateFields.showMfgDate ? editingProduct.manufacture_date || '' : '',
    });

    if (nextCfg.packagingVariantsMode === 'optional_collapsed') {
      setEnableVariantsForOthers(productVariants.length > 1);
    }

    if (productVariants.length > 0) {
      setProductVariants(
        productVariants.map((v) => ({
          ...v,
          unit: nextAllowedVariantUnits.includes(normalizeUnit(v.unit))
            ? normalizeUnit(v.unit)
            : nextAllowedVariantUnits[0],
        }))
      );
    }
  };

  const handleEditUnitChange = (newUnit: string) => {
    if (!editingProduct) return;
    const nextUnit = normalizeUnit(newUnit);
    const nextAllowedVariantUnits = getAllowedVariantUnits(nextUnit, editingProduct.category);
    setEditingProduct({ ...editingProduct, unit: nextUnit });
    if (productVariants.length > 0) {
      setProductVariants(
        productVariants.map((v) => ({
          ...v,
          unit: nextAllowedVariantUnits.includes(normalizeUnit(v.unit))
            ? normalizeUnit(v.unit)
            : nextAllowedVariantUnits[0],
        }))
      );
    }
  };

  // Resolve Trade Name suggestions for Add/Edit Product Modal
  const editTradeResolution = useMemo(() => {
    const pName = editingProduct?.name || editingProduct?.product_name || '';
    const cName = editingProduct?.company_name || '';
    return resolveTradeName(pName, cName, products);
  }, [editingProduct?.name, editingProduct?.product_name, editingProduct?.company_name, products]);

  // Refill helper
  const selectProductForRefill = (prod: Product) => {
    const prodName = prod.name || prod.product_name || '';
    const compName = prod.company_name || '';
    const resolved = prod.trade_name || resolveTradeName(prodName, compName, products).suggested;

    setRefillProductId(prod.id);
    setRefillCompanyName(compName);
    setRefillTradeName(resolved);
    setRefillTradeManuallyEdited(false);
    setRefillUnit(normalizeUnit(prod.unit));
    setRefillPurchasePrice(prod.purchase_price ?? prod.cost_price ?? 0);
    setRefillSellingPrice(prod.selling_price ?? 0);
    setRefillMrp(prod.mrp ?? prod.selling_price ?? 0);
    setRefillBatch(prod.batch_number || '');
    setRefillMfgDate(toDateInputValue(prod.manufacture_date));
    setRefillExpiry(toDateInputValue(prod.expiry_date));
    setRefillSupplier(prod.company_name || 'Stock Refill Supplier');
  };

  const openRefillModal = (prod?: Product | null, suggestedQty: number = 20) => {
    if (prod) {
      selectProductForRefill(prod);
      setRefillQty(suggestedQty);
    } else {
      setRefillProductId(null);
      setRefillCompanyName('');
      setRefillTradeName('');
      setRefillTradeManuallyEdited(false);
      setRefillQty(suggestedQty);
      setRefillUnit('Bags');
      setRefillBatch('');
      setRefillMfgDate('');
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

  const selectedRefillProduct = useMemo(
    () => products.find((p) => p.id === refillProductId) || null,
    [products, refillProductId]
  );

  const refillCategoryConfig = useMemo(
    () => getCategoryConfig(selectedRefillProduct?.category),
    [selectedRefillProduct?.category]
  );

  const refillTradeResolution = useMemo(() => {
    const pName = selectedRefillProduct?.name || selectedRefillProduct?.product_name || '';
    return resolveTradeName(pName, refillCompanyName, products);
  }, [selectedRefillProduct, refillCompanyName, products]);

  // Duplicate product check
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
    const timer = setTimeout(() => {
      void (async () => {
        setCheckingDuplicate(true);
        try {
          const res = await productsApi.checkDuplicate(name, editingProduct?.company_name, undefined, editingProduct?.trade_name);
          setDuplicateAlert(res.exists ? res : null);
        } catch {
          // ignore duplicate check failure
        } finally {
          setCheckingDuplicate(false);
        }
      })();
    }, 400);
    return () => clearTimeout(timer);
  }, [editingProduct?.name, editingProduct?.company_name, editingProduct?.trade_name, isEditModalOpen, editingProduct?.id]);

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    if (duplicateAlert?.exists && !editingProduct.id) {
      alert('This product already exists. Please use Refill Stock instead to avoid creating duplicate barcodes.');
      return;
    }

    const catConfig = getCategoryConfig(editingProduct.category);
    const prodName = sanitizeTextInput(editingProduct.name || (editingProduct as any).product_name || '', 200).trim();
    if (!prodName) {
      alert('Please enter a valid Product Name.');
      return;
    }

    const cleanBatch = sanitizeCodeInput(editingProduct.batch_number || '', 60).trim();
    if (catConfig.batchField.required && !cleanBatch) {
      alert(`${catConfig.batchField.label} is mandatory for ${catConfig.label} products.`);
      return;
    }

    const cleanMfgDate = (editingProduct.manufacture_date || '').trim();
    const cleanExpiryDate = catConfig.dateFields.showExpiryDate
      ? (editingProduct.expiry_date || '').trim()
      : '';

    if (catConfig.dateFields.showMfgDate && catConfig.dateFields.mfgRequired && !cleanMfgDate) {
      alert(`${catConfig.dateFields.mfgLabel} is mandatory for ${catConfig.label} products.`);
      return;
    }
    if (catConfig.dateFields.showExpiryDate && catConfig.dateFields.expiryRequired && !cleanExpiryDate) {
      alert(`${catConfig.dateFields.expiryLabel} is mandatory for ${catConfig.label} products.`);
      return;
    }

    const compName = sanitizeTextInput(editingProduct.company_name || '', 200).trim();
    const tradeName = sanitizeTextInput(
      editingProduct.trade_name || editTradeResolution.suggested || `${compName} ${prodName}`.trim(),
      200
    ).trim();

    const allowedExtraKeys = new Set<string>([
      ...catConfig.extraFields.map((f) => f.key),
      ...(catConfig.dateFields.showWarrantyField ? ['warranty_months'] : []),
    ]);
    const cleanedAttrs: Record<string, string | number | boolean> = {};
    if (editingProduct.category_attributes) {
      for (const [k, v] of Object.entries(editingProduct.category_attributes)) {
        if (!allowedExtraKeys.has(k) || v === undefined || v === null) continue;
        const valStr = typeof v === 'string' ? sanitizeTextInput(v, 150).trim() : v;
        if (valStr !== '') {
          cleanedAttrs[k] = valStr;
        }
      }
    }

    const effectiveVariants =
      catConfig.packagingVariantsMode === 'optional_collapsed' && !enableVariantsForOthers
        ? []
        : productVariants;

    const payload = {
      ...editingProduct,
      product_name: prodName,
      name: prodName,
      company_name: compName,
      trade_name: tradeName,
      category: catConfig.id,
      unit: normalizeUnit(editingProduct.unit || catConfig.defaultUnit),
      hsn_code: sanitizeCodeInput(editingProduct.hsn_code || '', 30),
      batch_number: cleanBatch,
      manufacture_date: catConfig.dateFields.showMfgDate ? cleanMfgDate : '',
      expiry_date: cleanExpiryDate,
      category_attributes: cleanedAttrs,
      purchase_price: clampNonNegative(editingProduct.cost_price ?? (editingProduct as any).purchase_price ?? 0),
      cost_price: clampNonNegative(editingProduct.cost_price ?? (editingProduct as any).purchase_price ?? 0),
      selling_price: clampNonNegative(editingProduct.selling_price ?? 0),
      current_stock: clampNonNegative(editingProduct.current_stock ?? 0),
      minimum_stock: clampNonNegative(editingProduct.min_stock_level ?? (editingProduct as any).minimum_stock ?? 20),
      min_stock_level: clampNonNegative(editingProduct.min_stock_level ?? (editingProduct as any).minimum_stock ?? 20),
      variants: effectiveVariants,
      is_active: editingProduct.is_active ?? true,
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
      setTradeNameManuallyEdited(false);
      void loadProducts();
    } catch (err: any) {
      alert(getErrorMessage(err, 'Failed to save product'));
    }
  };

  const handleRefillSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refillProductId) {
      alert('Please select a product to refill.');
      return;
    }
    if (refillQty <= 0) {
      alert('Refill quantity must be greater than 0.');
      return;
    }

    const cleanCompany = sanitizeTextInput(refillCompanyName, 200).trim();
    const cleanTrade = sanitizeTextInput(
      refillTradeName || refillTradeResolution.suggested,
      200
    ).trim();

    setRefillSubmitting(true);
    try {
      await productsApi.refillStock({
        product_id: refillProductId,
        quantity: clampNonNegative(refillQty),
        unit: normalizeUnit(refillUnit),
        company_name: cleanCompany || undefined,
        trade_name: cleanTrade || undefined,
        batch_number: sanitizeCodeInput(refillBatch, 60),
        manufacture_date: refillCategoryConfig.dateFields.showMfgDate ? refillMfgDate || undefined : undefined,
        expiry_date: refillCategoryConfig.dateFields.showExpiryDate ? refillExpiry : undefined,
        purchase_price: clampNonNegative(refillPurchasePrice),
        selling_price: clampNonNegative(refillSellingPrice),
        mrp: clampNonNegative(refillMrp),
        supplier_name: sanitizeTextInput(refillSupplier, 200),
        invoice_number: sanitizeCodeInput(refillInvoice, 60),
        notes: sanitizeTextInput(refillNotes, 400),
      });
      setIsRefillModalOpen(false);
      void loadProducts();
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
    if (!adjustQty || adjustQty === 0) {
      alert('Please enter a non-zero quantity adjustment.');
      return;
    }

    try {
      await inventoryApi.adjustStock({
        product_id: adjustingProduct.id,
        adjustment_type: adjustType,
        quantity: Math.abs(adjustQty),
        reason: sanitizeTextInput(adjustReason, 300),
      });
      setIsAdjustModalOpen(false);
      setAdjustingProduct(null);
      void loadProducts();
    } catch (err: any) {
      alert(getErrorMessage(err, 'Failed to adjust stock'));
    }
  };

  const addVariantRow = () => {
    const defaultVariantUnit = allowedEditVariantUnits[0] || normalizeUnit(editingProduct?.unit);
    setProductVariants([
      ...productVariants,
      {
        variant_name: '',
        unit_size: 1,
        unit: defaultVariantUnit,
        purchase_price: editingProduct?.cost_price || 0,
        selling_price: editingProduct?.selling_price || 0,
        mrp: editingProduct?.mrp || 0,
        stock: 0,
      },
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

  // Export Stock CSV
  const handleExportStock = () => {
    const source = catalog.length > 0 ? catalog : pageItems;
    if (source.length === 0) {
      alert('No inventory items to export.');
      return;
    }
    const headers = [
      'ID',
      'Product Name',
      'Trade Name',
      'Brand / Company',
      'Category',
      'HSN Code',
      'Batch Number',
      'Mfg Date',
      'Expiry Date',
      'Current Stock',
      'Unit',
      'Cost Price (₹)',
      'Selling Price (₹)',
      'MRP (₹)',
      'GST Rate (%)',
      'Stock Value (₹)',
    ];
    const rows = source.map((p) => [
      p.id,
      `"${(p.name || p.product_name || '').replace(/"/g, '""')}"`,
      `"${(p.trade_name || '').replace(/"/g, '""')}"`,
      `"${(p.company_name || '').replace(/"/g, '""')}"`,
      `"${p.category}"`,
      `"${p.hsn_code || ''}"`,
      `"${p.batch_number || ''}"`,
      p.manufacture_date || '',
      p.expiry_date || '',
      safeNumber(p.current_stock),
      p.unit,
      safeNumber(p.cost_price ?? p.purchase_price),
      safeNumber(p.selling_price),
      safeNumber(p.mrp),
      safeNumber(p.gst_rate),
      (safeNumber(p.current_stock) * safeNumber(p.selling_price || p.mrp)).toFixed(2),
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Inventory_Godown_Stock_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-space-md sm:p-space-lg max-w-[1680px] mx-auto space-y-space-md">
      {/* =====================================================================
          1. INTERACTIVE TOP ACTION HEADER & BREADCRUMB
      ===================================================================== */}
      <div className="bg-surface-container-lowest rounded-2xl p-space-md shadow-sm border border-outline-variant/30 flex flex-col xl:flex-row xl:items-center justify-between gap-space-md">
        <div className="flex flex-col gap-1">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="text-body-sm text-on-surface-variant hover:text-primary cursor-pointer flex items-center gap-1 font-medium"
            >
              <Warehouse className="w-4 h-4 text-forest-emerald" />
              <span>Dashboard</span>
            </button>
            <span className="text-outline-variant text-[14px]">/</span>
            <span className="text-body-sm text-on-surface-variant">Warehouse &amp; Godown</span>
            <span className="text-outline-variant text-[14px]">/</span>
            <span className="text-body-sm text-primary font-semibold">Inventory &amp; Stock</span>
          </nav>

          <div className="flex flex-wrap items-center gap-space-sm mt-1">
            <h1 className="text-2xl font-black text-on-surface tracking-tight font-display">
              Inventory &amp; Godown Stock
            </h1>
            <span className="font-label-code text-label-code bg-surface-container-high text-on-surface px-2.5 py-1 rounded-md font-bold uppercase tracking-wider">
              /inventory
            </span>
            <span className="font-label-badge text-label-badge bg-sprout-tint text-forest-emerald px-2.5 py-1 rounded-full font-bold flex items-center gap-1 border border-forest-emerald/20">
              <span className="w-1.5 h-1.5 rounded-full bg-forest-emerald animate-pulse"></span>
              FCO / CIB COMPLIANT
            </span>
          </div>

          <p className="text-body-sm text-on-surface-variant max-w-3xl">
            Real-time physical stock balancing, statutory batch shelf-life control, dynamic chemical formulations &amp; ESC/POS thermal barcode labeling.
          </p>
        </div>

        {/* Action Bar */}
        <div className="flex flex-wrap items-center gap-2.5 self-start xl:self-center">
          {/* Owner Price Lists */}
          {user?.role === 'owner' && (
            <button
              type="button"
              onClick={() => navigate('/price-lists')}
              className="px-3.5 py-2.5 rounded-xl bg-surface-container-low text-on-surface hover:bg-surface-container font-semibold text-xs border border-outline-variant/30 flex items-center gap-2 transition-all active:scale-95"
            >
              <Tag className="w-3.5 h-3.5 text-amber-600" />
              <span>Price Lists</span>
            </button>
          )}

          {/* Export Stock */}
          <button
            type="button"
            onClick={handleExportStock}
            className="px-3.5 py-2.5 rounded-xl bg-surface-container-low text-on-surface hover:bg-surface-container font-semibold text-xs border border-outline-variant/30 flex items-center gap-2 transition-all active:scale-95"
          >
            <Download className="w-3.5 h-3.5 text-slate-700" />
            <span>Export Stock</span>
          </button>

          {/* 50x25mm Thermal Engine */}
          <button
            type="button"
            onClick={() => {
              if (previewProduct) {
                setSelectedBarcodeProduct(previewProduct);
                setIsBarcodeModalOpen(true);
              } else {
                alert('Please select or onboard a product to generate barcode labels.');
              }
            }}
            className="px-3.5 py-2.5 rounded-xl bg-surface-container-low text-forest-emerald hover:bg-sprout-tint font-bold text-xs border border-forest-emerald/30 flex items-center gap-2 transition-all active:scale-95"
          >
            <Barcode className="w-3.5 h-3.5" />
            <span>50x25mm Engine</span>
          </button>

          {/* Stock Audit Correction */}
          <button
            type="button"
            onClick={() => {
              if (previewProduct) {
                setAdjustingProduct(previewProduct);
                setAdjustQty(0);
                setAdjustReason('');
                setIsAdjustModalOpen(true);
              } else if (pageItems[0]) {
                setAdjustingProduct(pageItems[0]);
                setAdjustQty(0);
                setAdjustReason('');
                setIsAdjustModalOpen(true);
              } else {
                openRefillModal(null);
              }
            }}
            className="px-3.5 py-2.5 rounded-xl bg-surface-container-low text-on-surface hover:bg-surface-container font-bold text-xs border border-outline-variant/40 flex items-center gap-2 transition-all active:scale-95"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-700" />
            <span>Stock Audit +/-</span>
          </button>

          {/* Refill Inward Stock */}
          <button
            type="button"
            onClick={() => openRefillModal(null)}
            className="px-4 py-2.5 rounded-xl bg-forest-emerald text-white hover:bg-canopy-deep font-bold text-xs flex items-center gap-2 shadow-sm transition-all active:scale-95"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Refill Stock</span>
          </button>

          {/* Onboard New SKU */}
          <button
            type="button"
            onClick={() => openAddProductModal()}
            className="px-4 py-2.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 font-bold text-xs flex items-center gap-2 shadow-md transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>+ New SKU Onboard</span>
          </button>
        </div>
      </div>

      {/* =====================================================================
          2. KPI RIBBON (4 Metric Cards with Subtle Glass Gradients)
      ===================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-space-md">
        {/* Card 1: Valuation */}
        <div className="bg-surface-container-lowest rounded-2xl p-space-md shadow-sm border border-outline-variant/30 relative flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="font-label-badge text-label-badge text-on-surface-variant uppercase tracking-wider font-bold">
                  Total Stock Valuation
                </span>
                <MetricInfoTooltip
                  title="Total Stock Valuation"
                  description="Real-time financial valuation of all products currently stocked across retail counter and warehouse godown bays."
                  formula="Sum(Current Stock × Selling Price)"
                />
              </div>
              <span className="font-label-code text-label-code bg-sprout-tint dark:bg-emerald-950/70 text-forest-emerald dark:text-emerald-300 px-1.5 py-0.5 rounded font-bold border border-forest-emerald/20 dark:border-emerald-800/60">
                Live Ledger
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-forest-emerald dark:text-emerald-400 font-mono tracking-tight">
                ₹{formatCurrency(totalValuation)}
              </span>
              <span className="font-label-code text-label-code text-on-surface-variant font-semibold">
                / {totalCount} SKUs
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 bg-surface-container-low dark:bg-slate-800/80 rounded-xl px-2.5 py-2 flex items-center justify-between text-on-surface-variant dark:text-slate-200 text-xs">
            <div className="flex flex-col">
              <span className="font-label-code text-label-code text-slate-700 dark:text-slate-200 font-medium">Fert: ₹{formatCurrency(fertValue)}</span>
              <span className="font-label-code text-label-code text-slate-700 dark:text-slate-200 font-medium">Pest: ₹{formatCurrency(pestValue)}</span>
            </div>
            <div className="w-px h-6 bg-outline-variant/40 dark:bg-slate-700" />
            <div className="flex flex-col text-right">
              <span className="font-label-code text-label-code text-slate-700 dark:text-slate-200 font-medium">Seeds: ₹{formatCurrency(seedsValue)}</span>
              <span className="font-label-code text-label-code text-slate-700 dark:text-slate-200 font-medium">Micro: ₹{formatCurrency(microValue)}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Adequate Stock Health */}
        <div className="bg-surface-container-lowest rounded-2xl p-space-md shadow-sm border border-outline-variant/30 relative flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="font-label-badge text-label-badge text-on-surface-variant uppercase tracking-wider font-bold">
                  Adequate Stock Health
                </span>
                <MetricInfoTooltip
                  title="Adequate Stock Health"
                  description="Percentage of catalog SKUs currently stocked comfortably above their minimum reorder buffer levels."
                  formula="(Adequate SKUs / Total SKUs) × 100"
                />
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-forest-emerald animate-pulse" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-on-surface font-mono tracking-tight">
                {adequateCount} SKUs
              </span>
              <span className="font-label-code text-label-code text-forest-emerald font-bold">
                {adequatePercent.toFixed(1)}% OK
              </span>
            </div>
          </div>
          <div className="mt-3">
            <div className="w-full bg-surface-container-high rounded-full h-2 overflow-hidden flex">
              <div
                className="bg-forest-emerald h-full rounded-full transition-all duration-500"
                style={{ width: `${adequatePercent}%` }}
              />
            </div>
            <span className="font-label-code text-label-code text-on-surface-variant mt-1.5 block">
              {lowStockCount} below minimum buffer threshold
            </span>
          </div>
        </div>

        {/* Card 3: Reorder Level Alerts */}
        <div className="bg-surface-container-lowest rounded-2xl p-space-md shadow-sm border border-outline-variant/30 relative flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="font-label-badge text-label-badge text-on-surface-variant uppercase tracking-wider font-bold">
                  Reorder Level Alerts
                </span>
                <MetricInfoTooltip
                  title="Reorder Level Alerts"
                  description="Items that have fallen below their configured minimum buffer threshold and need inward purchase orders."
                  formula="Active SKUs where Current Stock <= Minimum Buffer Stock"
                  tip="Raise purchase orders with distributors to replenish stock before peak customer demand."
                />
              </div>
              <span className="font-label-badge text-label-badge bg-khata-amber-bg text-khata-amber px-2 py-0.5 rounded-full font-bold border border-khata-amber/30">
                ATTENTION
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-khata-amber font-mono tracking-tight">
                {lowStockCount} SKUs
              </span>
              <span className="font-label-code text-label-code text-on-surface-variant font-semibold">
                Under Buffer
              </span>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="font-label-code text-label-code text-on-surface-variant truncate max-w-[160px]">
              {lowStockItems.length > 0 ? lowStockItems.join(', ') : 'All buffers maintained'}
            </span>
            <button
              type="button"
              onClick={() => navigate('/purchases')}
              className="font-label-code text-label-code bg-khata-amber text-white px-2.5 py-1 rounded-lg font-bold hover:bg-amber-800 transition-colors whitespace-nowrap active:scale-95"
            >
              Raise Inward PO
            </button>
          </div>
        </div>

        {/* Card 4: Near Expiry Radar */}
        <div className="bg-surface-container-lowest rounded-2xl p-space-md shadow-sm border border-outline-variant/30 relative flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="font-label-badge text-label-badge text-on-surface-variant uppercase tracking-wider font-bold">
                  Expiry Radar (&lt;60 Days)
                </span>
                <MetricInfoTooltip
                  title="Expiry Radar (<60 Days)"
                  description="Batches expiring within 60 days that must be sold under FIFO priority or returned to distributors under FCO rules."
                  formula="Active Batches where (Expiry Date - Today) <= 60 Days"
                  tip="Prioritize these batches during billing or apply clearance discounts to prevent stock write-offs."
                  align="right"
                />
              </div>
              <span className="font-label-badge text-label-badge bg-critical-rose-bg text-critical-rose px-2 py-0.5 rounded-full font-bold border border-critical-rose/30">
                CRITICAL
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-critical-rose font-mono tracking-tight">
                {nearExpiryCount} Batches
              </span>
              <span className="font-label-code text-label-code text-critical-rose font-semibold">
                ₹{formatCurrency(nearExpiryValue)} at Risk
              </span>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="font-label-code text-label-code text-on-surface-variant">
              FCO Inspection Watch
            </span>
            <button
              type="button"
              onClick={() => setFilterType((prev) => (prev === 'NEAR_EXPIRY' ? 'ALL' : 'NEAR_EXPIRY'))}
              className="font-label-code text-label-code bg-critical-rose text-white px-2.5 py-1 rounded-lg font-bold hover:bg-rose-800 transition-colors active:scale-95"
            >
              {filterType === 'NEAR_EXPIRY' ? 'Clear Filter' : '1-Click Markdown'}
            </button>
          </div>
        </div>
      </div>

      {/* Smart Refill Recommendations Banner */}
      {recommendations && recommendations.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-50/50 to-orange-50 border border-amber-200/80 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-amber-500 text-white rounded-lg shadow-sm">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                  Fast-Moving Products: Recommended for Refill
                  <span className="text-[10px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full font-bold">
                    {recommendations.length} Needs Attention
                  </span>
                </h2>
                <p className="text-[11px] text-slate-600">
                  Calculated using 30-day sales velocity and stock depletion forecasts
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            {recommendations.slice(0, 3).map((rec) => {
              const matchedProd = products.find((p) => p.id === rec.product_id);
              const isCrit = rec.urgency === 'CRITICAL';
              return (
                <div
                  key={rec.product_id}
                  className="bg-white p-3 rounded-xl border border-amber-200/70 shadow-xs flex flex-col justify-between hover:shadow-md transition"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-bold text-xs text-slate-900 line-clamp-1">
                        {rec.product_name}
                      </span>
                      <span
                        className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
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

                    <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2 rounded-lg">
                      <div>
                        <span className="text-slate-400 block text-[9px]">Stock Left:</span>
                        <span className="font-bold text-slate-900">
                          {rec.current_stock} {rec.unit}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px]">Est. Days Left:</span>
                        <span className={`font-bold ${isCrit ? 'text-red-600' : 'text-amber-600'}`}>
                          {rec.days_of_stock_left} Days
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] text-slate-500">
                      Sold {rec.units_sold_30d} {rec.unit} in 30d
                    </span>
                    <button
                      type="button"
                      onClick={() => matchedProd && openRefillModal(matchedProd, rec.suggested_refill_quantity)}
                      className="px-2 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-xs"
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

      {/* =====================================================================
          3. CATEGORY NAV PILLS
      ===================================================================== */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        <button
          type="button"
          onClick={() => handleCategorySelect('ALL')}
          className={`flex items-center gap-2 px-space-md py-2.5 rounded-xl font-semibold text-xs transition-all shadow-sm ${
            selectedCategory === 'ALL'
              ? 'bg-primary text-on-primary'
              : 'bg-surface-container-lowest text-on-surface-variant hover:text-on-surface hover:bg-surface-container border border-outline-variant/30'
          }`}
        >
          <span>All Categories</span>
          <span
            className={`font-label-code text-label-code px-2 py-0.5 rounded-full font-bold ${
              selectedCategory === 'ALL'
                ? 'bg-primary-container text-on-primary-container'
                : 'bg-surface-container-high text-on-surface-variant'
            }`}
          >
            {categoryCounts.ALL || 0}
          </span>
        </button>

        {INVENTORY_CATEGORIES.map((catId) => {
          const cfg = INVENTORY_CATEGORY_CONFIGS[catId];
          const isSelected = selectedCategory === catId;
          const count = categoryCounts[catId] || 0;
          return (
            <button
              key={catId}
              type="button"
              onClick={() => handleCategorySelect(catId)}
              className={`flex items-center gap-2 px-space-md py-2.5 rounded-xl font-semibold text-xs transition-all shadow-sm whitespace-nowrap ${
                isSelected
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container-lowest text-on-surface-variant hover:text-on-surface hover:bg-surface-container border border-outline-variant/30'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotClass}`} />
              <span>{cfg.label}</span>
              <span
                className={`font-label-code text-label-code px-2 py-0.5 rounded-full font-bold ${
                  isSelected
                    ? 'bg-primary-container text-on-primary-container'
                    : 'bg-surface-container-high text-on-surface-variant'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* =====================================================================
          4. OMNIBAR & FAST FILTER STRIP
      ===================================================================== */}
      <div className="bg-surface-container-lowest rounded-2xl p-space-md shadow-sm border border-outline-variant/30 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-space-md">
        {/* Search Input with Monospace Hint */}
        <div className="relative flex-1">
          <label htmlFor="inventory-search" className="sr-only">
            Search Inventory
          </label>
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-on-surface-variant">
            <Search className="w-5 h-5 text-on-surface-variant" />
          </div>
          <input
            id="inventory-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Brand Name, Active Chemical Molecule (e.g. Fipronil, Mancozeb), HSN, or Batch No..."
            className="w-full h-12 pl-10 pr-16 bg-surface-container-low rounded-xl font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:bg-sprout-tint focus:ring-2 focus:ring-forest-emerald transition-all border border-transparent focus:border-forest-emerald"
          />
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <span className="font-label-code text-label-code bg-surface-container text-on-surface-variant px-2 py-0.5 rounded font-bold border border-outline-variant/40">
              F2
            </span>
          </div>
        </div>

        {/* Godown Dropdown Selector & Quick Toggles */}
        <div className="flex flex-wrap items-center gap-space-sm">
          <div className="flex items-center gap-2 bg-surface-container-low px-3 py-2 rounded-xl text-on-surface border border-outline-variant/30">
            <Warehouse className="w-5 h-5 text-forest-emerald shrink-0" />
            <label htmlFor="storage-bay-select" className="sr-only">
              Filter by storage bay
            </label>
            <select
              id="storage-bay-select"
              aria-label="Filter by storage bay"
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="bg-transparent font-title-sm text-body-sm text-on-surface focus:outline-none cursor-pointer"
            >
              <option value="all">All Godown Locations (Bay A, B, Cold Storage, Counter)</option>
              <option value="bay-a">Main Godown Bay A (Fertilizers)</option>
              <option value="bay-b">Godown Bay B (DAP/Potash)</option>
              <option value="cold-cellar">Cold Cellar C1 (Hybrid Seeds)</option>
              <option value="counter">Counter Shelf &amp; Displays</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-surface-container-low p-1 rounded-xl border border-outline-variant/30">
            <button
              type="button"
              id="toggle-low-stock"
              onClick={() => setFilterType((prev) => (prev === 'LOW_STOCK' ? 'ALL' : 'LOW_STOCK'))}
              className={`px-2.5 py-1.5 rounded-lg text-body-sm font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                filterType === 'LOW_STOCK'
                  ? 'bg-khata-amber text-white shadow-xs'
                  : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
              }`}
            >
              <AlertTriangle className="w-4 h-4 text-khata-amber" />
              <span>Low Stock</span>
            </button>
            <button
              type="button"
              id="toggle-near-expiry"
              onClick={() => setFilterType((prev) => (prev === 'NEAR_EXPIRY' ? 'ALL' : 'NEAR_EXPIRY'))}
              className={`px-2.5 py-1.5 rounded-lg text-body-sm font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                filterType === 'NEAR_EXPIRY'
                  ? 'bg-critical-rose text-white shadow-xs'
                  : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
              }`}
            >
              <Clock className="w-4 h-4 text-critical-rose" />
              <span>Near Expiry</span>
            </button>
          </div>
        </div>
      </div>

      {/* =====================================================================
          5. MAIN CONTENT GRID: PRIMARY TABLE (8 COLS) + TACTICAL RIGHT RAIL (4 COLS)
      ===================================================================== */}
      <div className="grid grid-cols-1 2xl:grid-cols-12 gap-space-md items-start">
        {/* Left Column: Primary Data Table (8 Cols on 2XL) */}
        <div className="2xl:col-span-8 flex flex-col gap-space-md">
          <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 overflow-hidden">
            {/* Table Header Metabar */}
            <div className="px-space-md py-space-sm bg-surface-container-low flex items-center justify-between text-on-surface-variant font-label-code text-label-code border-b border-outline-variant/20">
              <div className="flex items-center gap-2">
                <span className="font-bold uppercase tracking-wider text-on-surface">
                  Registered SKUs &amp; Active Batches
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-outline-variant" />
                <span>
                  Showing {pageRange.start}–{pageRange.end} of {pageTotal} Records
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-forest-emerald font-bold">
                  <span className="w-2 h-2 rounded-full bg-forest-emerald animate-pulse" />
                  FIFO Rule Active
                </span>
                <span>Sorted by Velocity</span>
              </div>
            </div>

            {/* Table Container */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low/50 text-on-surface-variant font-label-badge text-label-badge uppercase tracking-wider border-b border-outline-variant/20">
                    <th className="py-space-sm pl-space-md pr-space-sm">SKU / Chemical Trade Info</th>
                    <th className="py-space-sm px-space-sm">Active Batch &amp; Shelf Life</th>
                    <th className="py-space-sm px-space-sm">Storage &amp; Bay Qty</th>
                    <th className="py-space-sm px-space-sm text-right">Pricing &amp; Margin</th>
                    <th className="py-space-sm pl-space-sm pr-space-md text-right">Row Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-high text-on-surface font-body-md text-body-md">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-on-surface-variant text-body-sm">
                        {isLoading ? (
                          <div className="flex items-center justify-center gap-2">
                            <span className="w-4 h-4 border-2 border-forest-emerald border-t-transparent rounded-full animate-spin" />
                            <span>Loading live godown inventory...</span>
                          </div>
                        ) : (
                          'No products match your search or filter.'
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p) => {
                      const catCfg = getCategoryConfig(p.category);
                      const isLow = safeNumber(p.current_stock) <= safeNumber(p.min_stock_level ?? (p as any).minimum_stock ?? 20);
                      const costPrice = safeNumber(p.cost_price ?? p.purchase_price);
                      const sellingPrice = safeNumber(p.selling_price);
                      const prodName = p.name || p.product_name || 'Agri Product';
                      const batchNo = p.batch_number || p.product_code || 'BAT-01';
                      const unitStr = normalizeUnit(p.unit);
                      const expiryBadge = getExpiryBadge(p.expiry_date);
                      const minStock = safeNumber(p.min_stock_level ?? (p as any).minimum_stock ?? 20);
                      const currentStock = safeNumber(p.current_stock);
                      const bufferPct = Math.min(100, Math.max(8, minStock > 0 ? (currentStock / (minStock * 2)) * 100 : 100));
                      const rackLoc = String(p.category_attributes?.rack_location || p.category_attributes?.storage_bay || 'Main Godown');

                      return (
                        <tr
                          key={p.id}
                          onClick={() => setSelectedPreviewProductId(p.id)}
                          className={`hover:bg-sprout-tint/30 transition-colors group cursor-pointer ${
                            previewProduct?.id === p.id ? 'bg-sprout-tint/40' : ''
                          }`}
                        >
                          {/* Col 1: SKU / Chemical Trade Info */}
                          <td className="py-space-md pl-space-md pr-space-sm">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-title-sm text-body-md text-on-surface font-bold">
                                  {prodName}
                                </span>
                                <span className={`font-label-badge text-label-badge px-1.5 py-0.5 rounded-full font-bold ${catCfg.badgeClass}`}>
                                  {catCfg.regulationTag}
                                </span>
                              </div>
                              <span className="text-body-sm text-on-surface-variant">
                                {p.trade_name ? `Trade: ${p.trade_name} • ` : ''}
                                {p.company_name ? `${p.company_name} • ` : ''}
                                {catCfg.label}
                              </span>
                              <div className="flex items-center gap-2 mt-1">
                                {p.hsn_code && (
                                  <span className="font-label-code text-label-code bg-surface-container text-on-surface-variant px-1.5 py-0.5 rounded">
                                    HSN {p.hsn_code}
                                  </span>
                                )}
                                <span className="font-label-code text-label-code text-on-surface-variant flex items-center gap-1">
                                  <Layers className="w-3.5 h-3.5 text-forest-emerald" />
                                  {rackLoc}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Col 2: Active Batch & Shelf Life */}
                          <td className="py-space-md px-space-sm">
                            <div className="flex flex-col">
                              <span className="font-label-code text-label-code font-bold text-on-surface">
                                Batch: {batchNo}
                              </span>
                              {p.manufacture_date && (
                                <span className="font-label-code text-label-code text-on-surface-variant">
                                  Mfg: {p.manufacture_date}
                                </span>
                              )}
                              <div className="mt-1">
                                <span className={`font-label-badge text-label-badge px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-1 ${expiryBadge.colorClass}`}>
                                  <Clock className="w-3 h-3" />
                                  {expiryBadge.label}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Col 3: Storage & Bay Qty */}
                          <td className="py-space-md px-space-sm">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span className={`font-tabular-md text-tabular-md font-bold ${isLow ? 'text-critical-rose' : 'text-on-surface'}`}>
                                  {currentStock} {unitStr}
                                </span>
                                <span className={`font-label-badge text-label-badge px-1.5 py-0.5 rounded font-bold ${
                                  isLow ? 'bg-khata-amber-bg text-khata-amber' : 'bg-sprout-tint text-forest-emerald'
                                }`}>
                                  Buffer {minStock}
                                </span>
                              </div>
                              <div className="w-28 bg-surface-container-high rounded-full h-1.5 mt-1.5 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${isLow ? 'bg-critical-rose' : 'bg-forest-emerald'}`}
                                  style={{ width: `${bufferPct}%` }}
                                />
                              </div>
                              <span className="font-label-code text-label-code text-on-surface-variant mt-1">
                                {rackLoc}
                              </span>
                            </div>
                          </td>

                          {/* Col 4: Pricing & Margin */}
                          <td className="py-space-md px-space-sm text-right">
                            <div className="flex flex-col items-end">
                              <span className="font-tabular-md text-tabular-md font-bold text-forest-emerald font-mono">
                                ₹{formatCurrency(sellingPrice)}
                              </span>
                              <span className="font-label-code text-label-code text-on-surface-variant font-mono">
                                MRP: ₹{formatCurrency(safeNumber(p.mrp))} | CP: ₹{formatCurrency(costPrice)}
                              </span>
                              <span className="font-label-code text-label-code bg-surface-container text-on-surface-variant px-1.5 py-0.5 rounded mt-0.5 font-mono">
                                GST {safeNumber(p.gst_rate)}%
                              </span>
                            </div>
                          </td>

                          {/* Col 5: Row Actions */}
                          <td className="py-space-md pl-space-sm pr-space-md text-right">
                            <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => {
                                  setAdjustingProduct(p);
                                  setAdjustQty(0);
                                  setAdjustReason('');
                                  setIsAdjustModalOpen(true);
                                }}
                                className="w-8 h-8 rounded-lg bg-surface-container hover:bg-primary hover:text-white flex items-center justify-center text-on-surface-variant transition-all active:scale-95"
                                title="Stock Adjustment"
                              >
                                <SlidersHorizontal className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedBarcodeProduct(p);
                                  setIsBarcodeModalOpen(true);
                                }}
                                className="w-8 h-8 rounded-lg bg-surface-container hover:bg-primary hover:text-white flex items-center justify-center text-on-surface-variant transition-all active:scale-95"
                                title="Generate Barcode"
                              >
                                <Barcode className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => openRefillModal(p)}
                                className="w-8 h-8 rounded-lg bg-surface-container hover:bg-forest-emerald hover:text-white flex items-center justify-center text-on-surface-variant transition-all active:scale-95"
                                title="Refill Stock"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditProductModal(p)}
                                className="w-8 h-8 rounded-lg bg-surface-container hover:bg-surface-container-highest text-on-surface-variant flex items-center justify-center transition-all active:scale-95"
                                title="Edit SKU"
                              >
                                <Edit className="w-4 h-4" />
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

            {/* Sticky Persistent Ledger Summary Row & Pagination */}
            <div className="bg-surface-container-low px-space-md py-space-sm flex flex-wrap items-center justify-between gap-space-sm border-t border-outline-variant/20">
              <div className="flex items-center gap-space-md flex-wrap text-xs">
                <span className="font-label-code text-label-code text-on-surface font-bold">
                  TOTAL REGISTERED ITEMS: {totalCount}
                </span>
                <span className="font-label-code text-label-code text-forest-emerald font-semibold">
                  ● ACTIVE BATCHES: {catalog.length || pageTotal}
                </span>
                <span className="font-label-code text-label-code text-critical-rose font-semibold">
                  ● EXPIRING &lt;60D: {nearExpiryCount}
                </span>
              </div>
              <div className="flex items-center gap-space-sm font-label-code text-label-code text-on-surface">
                <span>
                  Page {page} of {totalPages}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPage(clampPage(page - 1, pageTotal, INVENTORY_PAGE_SIZE))}
                    disabled={page <= 1 || isLoading}
                    className="w-7 h-7 rounded-lg bg-surface-container flex items-center justify-center hover:bg-surface-container-high transition-colors disabled:opacity-40"
                    title="Previous Page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage(clampPage(page + 1, pageTotal, INVENTORY_PAGE_SIZE))}
                    disabled={page >= totalPages || isLoading}
                    className="w-7 h-7 rounded-lg bg-surface-container flex items-center justify-center hover:bg-surface-container-high transition-colors disabled:opacity-40"
                    title="Next Page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Inward Inspection & Regulatory Audit Alert */}
          <div className="bg-surface-container-lowest rounded-2xl p-space-md shadow-sm border border-outline-variant/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-space-md">
            <div className="flex items-center gap-space-md">
              <div className="w-12 h-12 rounded-xl bg-sprout-tint flex items-center justify-center text-forest-emerald shrink-0 border border-forest-emerald/20">
                <ShieldCheck className="w-7 h-7 text-forest-emerald" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-title-sm text-body-md text-on-surface font-bold">
                    Form O &amp; Pesticide Principal Certificate Log
                  </h2>
                  <span className="font-label-badge text-label-badge bg-sprout-tint text-primary px-2 py-0.5 rounded-full font-bold border border-primary/20">
                    IN COMPLIANCE
                  </span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                  Every insecticide &amp; chemical compound batch in godown has an active FCO/CIB marketing authorization link on file.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
              <button
                type="button"
                onClick={() => navigate('/khata?tab=compliance')}
                className="px-space-md py-2.5 rounded-xl bg-surface-container-low text-on-surface hover:bg-surface-container font-semibold text-xs transition-all flex items-center gap-1.5 border border-outline-variant/30 active:scale-95"
              >
                <FileText className="w-4 h-4 text-forest-emerald" />
                <span>View Statutory Log</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/khata?tab=compliance')}
                className="px-space-md py-2.5 rounded-xl bg-forest-emerald text-white hover:bg-canopy-deep font-semibold text-xs transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
              >
                <Download className="w-4 h-4" />
                <span>Download Form A / Form O PDF</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Tactical Right Rail (4 Cols on 2XL) */}
        <div className="2xl:col-span-4 flex flex-col gap-space-md">
          {/* Widget 1: Real-time 50x25mm ESC/POS Thermal Label Simulator */}
          <div className="bg-surface-container-lowest rounded-2xl p-space-md shadow-sm border border-outline-variant/30 flex flex-col gap-space-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-forest-emerald" />
                <h2 className="font-title-sm text-body-md text-on-surface font-bold">
                  50x25mm Thermal Label Preview
                </h2>
              </div>
              <span className="font-label-code text-label-code bg-surface-container text-on-surface-variant px-1.5 py-0.5 rounded font-bold border border-outline-variant/40">
                ESC/POS
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Live preview of high-contrast barcode sticker for product packaging &amp; godown pallet scan. Click any table row to switch preview.
            </p>

            {/* 50x25mm Label Simulator Box */}
            <div className="bg-surface-container-low p-space-md rounded-xl flex items-center justify-center border border-outline-variant/30">
              <div data-keep-light="true" className="w-[280px] bg-white rounded-md p-3 shadow-md flex flex-col items-center justify-between text-black select-none border border-black/10">
                {/* Header info on label */}
                <div className="w-full flex justify-between items-start border-b border-black/20 pb-1 text-[10px] leading-tight font-sans">
                  <span className="font-bold tracking-tight uppercase truncate max-w-[150px]">
                    {settings?.shop_name || 'NockBill Agro Solutions'}
                  </span>
                  <span className="font-mono text-[9px] font-bold">
                    {settings?.gstin || '29AAAAA0000A1Z5'}
                  </span>
                </div>

                {/* Product Name */}
                <div className="w-full my-1 text-center">
                  <span className="font-bold text-xs leading-none uppercase tracking-tight block truncate font-sans">
                    {previewProduct?.name || previewProduct?.product_name || 'IFFCO Neem Coated Urea'}
                  </span>
                  <span className="text-[10px] text-black/70 font-sans block truncate">
                    {previewProduct?.trade_name ? `Trade: ${previewProduct.trade_name} • ` : ''}
                    {previewProduct?.unit ? `Unit: ${previewProduct.unit}` : '45kg Bag'}
                  </span>
                </div>

                {/* Barcode SVG graphic simulation */}
                <div className="w-full my-1 flex flex-col items-center">
                  <svg className="w-full h-11" preserveAspectRatio="none" viewBox="0 0 200 40">
                    {/* Simulated Code-128 Pattern */}
                    <rect x="0" y="0" width="3" height="40" fill="#000000" />
                    <rect x="5" y="0" width="2" height="40" fill="#000000" />
                    <rect x="9" y="0" width="4" height="40" fill="#000000" />
                    <rect x="15" y="0" width="2" height="40" fill="#000000" />
                    <rect x="20" y="0" width="5" height="40" fill="#000000" />
                    <rect x="27" y="0" width="2" height="40" fill="#000000" />
                    <rect x="31" y="0" width="3" height="40" fill="#000000" />
                    <rect x="36" y="0" width="1" height="40" fill="#000000" />
                    <rect x="40" y="0" width="4" height="40" fill="#000000" />
                    <rect x="46" y="0" width="2" height="40" fill="#000000" />
                    <rect x="50" y="0" width="3" height="40" fill="#000000" />
                    <rect x="55" y="0" width="4" height="40" fill="#000000" />
                    <rect x="61" y="0" width="2" height="40" fill="#000000" />
                    <rect x="65" y="0" width="3" height="40" fill="#000000" />
                    <rect x="70" y="0" width="5" height="40" fill="#000000" />
                    <rect x="77" y="0" width="2" height="40" fill="#000000" />
                    <rect x="81" y="0" width="4" height="40" fill="#000000" />
                    <rect x="87" y="0" width="1" height="40" fill="#000000" />
                    <rect x="91" y="0" width="3" height="40" fill="#000000" />
                    <rect x="96" y="0" width="4" height="40" fill="#000000" />
                    <rect x="102" y="0" width="2" height="40" fill="#000000" />
                    <rect x="106" y="0" width="5" height="40" fill="#000000" />
                    <rect x="113" y="0" width="2" height="40" fill="#000000" />
                    <rect x="117" y="0" width="3" height="40" fill="#000000" />
                    <rect x="122" y="0" width="2" height="40" fill="#000000" />
                    <rect x="126" y="0" width="4" height="40" fill="#000000" />
                    <rect x="132" y="0" width="1" height="40" fill="#000000" />
                    <rect x="135" y="0" width="3" height="40" fill="#000000" />
                    <rect x="140" y="0" width="5" height="40" fill="#000000" />
                    <rect x="147" y="0" width="2" height="40" fill="#000000" />
                    <rect x="151" y="0" width="4" height="40" fill="#000000" />
                    <rect x="157" y="0" width="2" height="40" fill="#000000" />
                    <rect x="161" y="0" width="3" height="40" fill="#000000" />
                    <rect x="166" y="0" width="5" height="40" fill="#000000" />
                    <rect x="173" y="0" width="2" height="40" fill="#000000" />
                    <rect x="177" y="0" width="4" height="40" fill="#000000" />
                    <rect x="183" y="0" width="2" height="40" fill="#000000" />
                    <rect x="187" y="0" width="3" height="40" fill="#000000" />
                    <rect x="192" y="0" width="4" height="40" fill="#000000" />
                    <rect x="198" y="0" width="2" height="40" fill="#000000" />
                  </svg>
                  <span className="font-mono text-[10px] tracking-widest font-bold mt-0.5">
                    {previewProduct?.barcode || previewProduct?.product_code || (previewProduct?.id ? String(10000 + previewProduct.id) : '890123456789')}
                  </span>
                </div>

                {/* Price & Batch Row */}
                <div className="w-full border-t border-black/20 pt-1 flex justify-between items-end font-mono text-[9px] leading-tight">
                  <div className="flex flex-col text-left">
                    <span>MRP: ₹{formatCurrency(safeNumber(previewProduct?.mrp || previewProduct?.selling_price || 0))}</span>
                    <span className="font-bold text-xs">
                      RATE: ₹{formatCurrency(safeNumber(previewProduct?.selling_price || 0))}
                    </span>
                  </div>
                  <div className="flex flex-col text-right">
                    <span>B: {previewProduct?.batch_number || 'UF-982'}</span>
                    <span>EXP: {previewProduct?.expiry_date ? previewProduct.expiry_date.slice(0, 7) : '10/26'}</span>
                    <span className="font-bold text-[8px] uppercase">
                      {String(previewProduct?.category_attributes?.rack_location || 'BAY A-01')}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Print Action */}
            <div className="flex items-center gap-2 mt-1">
              <button
                type="button"
                onClick={() => {
                  if (previewProduct) {
                    setSelectedBarcodeProduct(previewProduct);
                    setIsBarcodeModalOpen(true);
                  }
                }}
                className="flex-1 h-10 rounded-xl bg-forest-emerald text-white hover:bg-canopy-deep font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm active:scale-95"
              >
                <Barcode className="w-4 h-4" />
                <span>Print Thermal Barcodes</span>
              </button>
            </div>
          </div>

          {/* NOTE: Godown Bay Utilization widget is omitted as ordered by user ("Godown bay utilization not required") */}

          {/* Widget 3: Live Quick Audit Checklist */}
          <div className="bg-surface-container-lowest rounded-2xl p-space-md shadow-sm border border-outline-variant/30 flex flex-col gap-space-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-title-sm text-body-md text-on-surface font-bold">
                Inspector Readiness
              </h2>
              <span className="font-label-badge text-label-badge bg-sprout-tint text-primary px-2 py-0.5 rounded-full font-bold border border-primary/20">
                VERIFIED
              </span>
            </div>
            <div className="flex flex-col gap-2 mt-1">
              <div className="flex items-center gap-2 text-body-sm text-on-surface">
                <CheckCircle2 className="w-4 h-4 text-forest-emerald shrink-0" />
                <span>
                  Daily Physical Stock Reconciliation: <strong className="font-semibold text-forest-emerald">Done</strong>
                </span>
              </div>
              <div className="flex items-center gap-2 text-body-sm text-on-surface">
                <CheckCircle2 className="w-4 h-4 text-forest-emerald shrink-0" />
                <span>
                  Govt DBT Fertilizer POS Sync: <strong className="font-semibold text-forest-emerald">Real-time</strong>
                </span>
              </div>
              <div className="flex items-center gap-2 text-body-sm text-on-surface">
                <CheckCircle2 className="w-4 h-4 text-forest-emerald shrink-0" />
                <span>
                  Expired Agrochemical Discard Ledger: <strong className="font-semibold text-forest-emerald">Signed</strong>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          6. MODALS PRESERVED: PRODUCT FORM, REFILL, ADJUST, BARCODE
      ===================================================================== */}
      {/* Refill Stock Modal */}
      {isRefillModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="px-5 py-4 bg-forest-emerald text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-emerald-200" />
                <h3 className="font-bold text-sm">Refill Existing Stock &amp; Inward Goods</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsRefillModalOpen(false)}
                className="text-emerald-200 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={(e) => { void handleRefillSubmit(e); }} className="p-5 space-y-4 text-xs">
              <div>
                <label htmlFor="refill-product-search" className="block font-semibold text-slate-700 mb-1">
                  Product to Refill *
                </label>
                {refillProductId ? (
                  (() => {
                    const sel = products.find((p) => p.id === refillProductId);
                    if (!sel) return null;
                    return (
                      <div className="bg-emerald-50/80 border border-emerald-300 rounded-xl p-3 flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 text-xs">
                              {sel.name || sel.product_name}
                            </span>
                            {sel.trade_name && (
                              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-900 px-1.5 py-0.5 rounded border border-emerald-300">
                                Trade: {sel.trade_name}
                              </span>
                            )}
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
                        id="refill-product-search"
                        type="text"
                        value={refillProductSearch}
                        onChange={(e) => setRefillProductSearch(e.target.value)}
                        placeholder="Search products by name, trade name, company, or code..."
                        className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none shadow-xs"
                      />
                    </div>

                    <div className="border border-slate-200 rounded-xl max-h-48 overflow-y-auto divide-y divide-slate-100 bg-white shadow-md">
                      {products
                        .filter((p) => {
                          if (!refillProductSearch.trim()) return true;
                          const q = refillProductSearch.toLowerCase();
                          const pName = safeString(p.name || p.product_name).toLowerCase();
                          const pTrade = safeString(p.trade_name).toLowerCase();
                          const pCat = safeString(p.category).toLowerCase();
                          const pComp = safeString(p.company_name).toLowerCase();
                          const pBar = safeString(p.barcode).toLowerCase();
                          const pCode = safeString(p.product_code).toLowerCase();
                          return pName.includes(q) || pTrade.includes(q) || pCat.includes(q) || pComp.includes(q) || pBar.includes(q) || pCode.includes(q);
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
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-slate-800">{p.name || p.product_name}</span>
                                {p.trade_name && (
                                  <span className="text-[10px] font-bold bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-200">
                                    Trade: {p.trade_name}
                                  </span>
                                )}
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

              {/* Company / Brand & Trade Name */}
              <div className="bg-emerald-50/50 border border-emerald-200/80 rounded-xl p-3 space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="refill-company-name" className="block font-semibold text-slate-700 mb-1">
                      Company / Brand Name
                    </label>
                    <input
                      id="refill-company-name"
                      type="text"
                      maxLength={120}
                      value={refillCompanyName}
                      onChange={(e) => {
                        const nextCompany = e.target.value;
                        setRefillCompanyName(nextCompany);
                        if (!refillTradeManuallyEdited) {
                          const sel = products.find((p) => p.id === refillProductId);
                          const pName = sel ? sel.name || sel.product_name || '' : '';
                          const resolved = resolveTradeName(pName, nextCompany, products);
                          setRefillTradeName(resolved.suggested);
                        }
                      }}
                      placeholder="e.g. Bayer, Syngenta, IFFCO"
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="refill-trade-name" className="block font-semibold text-emerald-900 mb-1">
                      Trade Name (Product + Brand)
                    </label>
                    <input
                      id="refill-trade-name"
                      type="text"
                      maxLength={150}
                      value={refillTradeName}
                      onChange={(e) => {
                        setRefillTradeName(e.target.value);
                        setRefillTradeManuallyEdited(true);
                      }}
                      placeholder="e.g. Confidor, Actara, Coragen"
                      className="w-full px-2.5 py-1.5 bg-white font-bold text-emerald-900 border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Quantity and Unit */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="refill-qty" className="block font-semibold text-slate-700 mb-1">
                    Inward Quantity to Add *
                  </label>
                  <input
                    id="refill-qty"
                    type="number"
                    step="0.01"
                    min="0.1"
                    required
                    value={refillQty}
                    onChange={(e) => setRefillQty(Number.parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 font-black text-sm text-emerald-800 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="refill-unit-select" className="block font-semibold text-slate-700 mb-1">
                    Unit of Measure
                  </label>
                  <CustomSelect
                    value={normalizeUnit(refillUnit)}
                    onChange={(val) => setRefillUnit(val)}
                    options={(() => {
                      const allowed = selectedRefillProduct
                        ? refillCategoryConfig.allowedUnits
                        : ['Bags', 'Kg', 'Grams', 'Litre', 'ml', 'Packets', 'Pouches', 'Tons', 'Pieces', 'Nos', 'Sets', 'Meters', 'Rolls'];
                      const current = normalizeUnit(refillUnit);
                      const list = allowed.includes(current) ? allowed : [current, ...allowed];
                      return list.map((u) => ({ value: u, label: u }));
                    })()}
                  />
                </div>
              </div>

              {/* Batch & Dates */}
              <div className={`grid grid-cols-1 ${refillCategoryConfig.dateFields.showExpiryDate ? 'sm:grid-cols-3' : 'sm:grid-cols-1'} gap-3`}>
                <div>
                  <label htmlFor="refill-batch" className="block font-semibold text-slate-700 mb-1">
                    New / Current {refillCategoryConfig.batchField.label}
                  </label>
                  <input
                    id="refill-batch"
                    type="text"
                    value={refillBatch}
                    onChange={(e) => setRefillBatch(e.target.value)}
                    placeholder={refillCategoryConfig.batchField.placeholder}
                    className="w-full px-2.5 py-1.5 font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                {refillCategoryConfig.dateFields.showMfgDate && (
                  <div>
                    <label htmlFor="refill-mfg-date" className="block font-semibold text-slate-700 mb-1">
                      {refillCategoryConfig.dateFields.mfgLabel}
                    </label>
                    <input
                      id="refill-mfg-date"
                      type="date"
                      value={refillMfgDate}
                      onChange={(e) => setRefillMfgDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                )}
                {refillCategoryConfig.dateFields.showExpiryDate && (
                  <div>
                    <label htmlFor="refill-expiry" className="block font-semibold text-slate-700 mb-1">
                      {refillCategoryConfig.dateFields.expiryLabel}
                    </label>
                    <input
                      id="refill-expiry"
                      type="date"
                      value={refillExpiry}
                      onChange={(e) => setRefillExpiry(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Pricing */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="refill-purchase-price" className="block font-semibold text-slate-700 mb-1">
                    Inward Cost Price (₹)
                  </label>
                  <input
                    id="refill-purchase-price"
                    type="number"
                    step="0.5"
                    value={refillPurchasePrice}
                    onChange={(e) => setRefillPurchasePrice(Number.parseFloat(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="refill-selling-price" className="block font-semibold text-slate-700 mb-1">
                    Selling Price (₹)
                  </label>
                  <input
                    id="refill-selling-price"
                    type="number"
                    step="0.5"
                    value={refillSellingPrice}
                    onChange={(e) => setRefillSellingPrice(Number.parseFloat(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="refill-mrp" className="block font-semibold text-slate-700 mb-1">
                    MRP (₹)
                  </label>
                  <input
                    id="refill-mrp"
                    type="number"
                    step="0.5"
                    value={refillMrp}
                    onChange={(e) => setRefillMrp(Number.parseFloat(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Supplier & Inward Bill No */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="refill-supplier" className="block font-semibold text-slate-700 mb-1">
                    Supplier / Depot Name
                  </label>
                  <input
                    id="refill-supplier"
                    type="text"
                    value={refillSupplier}
                    onChange={(e) => setRefillSupplier(e.target.value)}
                    placeholder="e.g. IFFCO Central Depot"
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="refill-invoice" className="block font-semibold text-slate-700 mb-1">
                    Supplier Invoice / Bill No.
                  </label>
                  <input
                    id="refill-invoice"
                    type="text"
                    value={refillInvoice}
                    onChange={(e) => setRefillInvoice(e.target.value)}
                    placeholder="e.g. INV-9921"
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="refill-notes" className="block font-semibold text-slate-700 mb-1">
                  Inward Notes
                </label>
                <input
                  id="refill-notes"
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
                  className="bg-forest-emerald hover:bg-canopy-deep text-white px-5 py-2 rounded-xl font-bold shadow flex items-center gap-1.5 transition-all"
                >
                  {refillSubmitting ? 'Refilling...' : 'Confirm Refill & Add Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Product Form Modal (Add / Edit SKU) */}
      <ProductFormModal
        isOpen={isEditModalOpen}
        editingProduct={editingProduct}
        setEditingProduct={setEditingProduct}
        products={products}
        categoryConfig={activeEditCategoryConfig}
        allowedVariantUnits={allowedEditVariantUnits}
        productVariants={productVariants}
        enableVariantsForOthers={enableVariantsForOthers}
        setEnableVariantsForOthers={setEnableVariantsForOthers}
        tradeNameManuallyEdited={tradeNameManuallyEdited}
        setTradeNameManuallyEdited={setTradeNameManuallyEdited}
        editTradeResolution={editTradeResolution}
        duplicateAlert={duplicateAlert}
        checkingDuplicate={checkingDuplicate}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleSaveProduct}
        onCategoryChange={handleEditCategoryChange}
        onUnitChange={handleEditUnitChange}
        onAddVariant={addVariantRow}
        onUpdateVariant={updateVariantRow}
        onRemoveVariant={removeVariantRow}
        onRefillExisting={(existing) => {
          setIsEditModalOpen(false);
          openRefillModal(existing);
        }}
      />

      {/* Barcode Print Modal */}
      {isBarcodeModalOpen && selectedBarcodeProduct && (
        <BarcodePrintModal
          isOpen={isBarcodeModalOpen}
          onClose={() => {
            setIsBarcodeModalOpen(false);
            setSelectedBarcodeProduct(null);
          }}
          product={selectedBarcodeProduct}
          shopSettings={settings}
        />
      )}

      {/* Stock Adjustment Modal */}
      {isAdjustModalOpen && adjustingProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">
                Adjust Stock: {adjustingProduct.name || adjustingProduct.product_name}
              </h3>
              <button
                type="button"
                onClick={() => setIsAdjustModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={(e) => { void handleAdjustStock(e); }} className="p-5 space-y-3.5 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 block">Current Warehouse Stock:</span>
                <span className="text-lg font-black text-forest-emerald font-mono block">
                  {adjustingProduct.current_stock} {adjustingProduct.unit}
                </span>
              </div>

              <div>
                <label htmlFor="adjust-type-select" className="block font-semibold text-slate-700 mb-1">
                  Adjustment Type
                </label>
                <CustomSelect
                  value={adjustType}
                  onChange={(val) => setAdjustType(val as any)}
                  options={[
                    { value: 'AUDIT_CORRECTION', label: 'Audit Count Correction (+/-)' },
                    { value: 'DAMAGE', label: 'Damaged / Leaked Bags (-)' },
                    { value: 'RETURN', label: 'Customer Return (+)' },
                  ]}
                />
              </div>

              <div>
                <label htmlFor="adjust-stock-qty" className="block font-semibold text-slate-700 mb-1">
                  Quantity Adjustment (positive or negative number)
                </label>
                <input
                  id="adjust-stock-qty"
                  type="number"
                  required
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(Number.parseInt(e.target.value, 10) || 0)}
                  placeholder="e.g. -5 or +10"
                  className="w-full px-3 py-2 font-black text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-forest-emerald focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="adjust-stock-reason" className="block font-semibold text-slate-700 mb-1">
                  Reason / Note
                </label>
                <input
                  id="adjust-stock-reason"
                  type="text"
                  required
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="e.g. Monthly godown physical verification"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-forest-emerald focus:outline-none"
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
                  className="bg-forest-emerald hover:bg-canopy-deep text-white px-5 py-2 rounded-xl font-bold shadow transition-all"
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
