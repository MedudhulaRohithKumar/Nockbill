import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  ShieldCheck
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

export const InventoryPage: React.FC = () => {
  const { settings } = useShop();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // `catalog` backs modal helpers (refill typeahead, trade-name resolution); `pageItems` backs the table.
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [pageItems, setPageItems] = useState<Product[]>([]);
  const [pageTotal, setPageTotal] = useState(0);
  const [alertItems, setAlertItems] = useState<Product[] | null>(null);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const requestSeq = useRef(0);
  const [recommendations, setRecommendations] = useState<RefillRecommendation[]>([]);
  const [search, setSearch] = useState('');
  const initialCategoryParam = searchParams.get('category');
  const [selectedCategory, setSelectedCategory] = useState<string>(
    initialCategoryParam && initialCategoryParam.toUpperCase() !== 'ALL'
      ? normalizeCategory(initialCategoryParam)
      : 'ALL'
  );
  const [filterType, setFilterType] = useState<'ALL' | 'LOW_STOCK' | 'NEAR_EXPIRY'>('ALL');
  const [isLoading, setIsLoading] = useState(true);

  // Debounce server-side search; any change of search/category/alert-filter resets to page 1.
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(handle);
  }, [search]);
  const filterKey = `${debouncedSearch}|${selectedCategory}|${filterType}`;
  const [pageState, setPageState] = useState({ key: filterKey, page: 1 });
  const page = pageState.key === filterKey ? pageState.page : 1;
  const setPage = (next: number) => setPageState({ key: filterKey, page: next });

  // Merge of everything known client-side (used by modals / lookups)
  const products = useMemo(() => mergeProductsById(pageItems, catalog), [pageItems, catalog]);

  // Keep selectedCategory synchronized with sidebar dropdown URL (?category=...)
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

  // Add / Edit Modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [productVariants, setProductVariants] = useState<ProductVariant[]>([]);
  const [tradeNameManuallyEdited, setTradeNameManuallyEdited] = useState(false);
  const [enableVariantsForOthers, setEnableVariantsForOthers] = useState(false);

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

  // Barcode Print Modal state
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const [selectedBarcodeProduct, setSelectedBarcodeProduct] = useState<Product | null>(null);

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

  // Load the visible table page (server-side pagination, or all pages when an alert filter needs client-side filtering)
  const loadPage = async () => {
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
      // Keep the previous page on transient failures
    } finally {
      if (seq === requestSeq.current) setIsLoading(false);
    }
  };

  // Per-category totals via X-Total-Count (limit=1 requests) so tabs stay accurate beyond one page
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
      // Counts are cosmetic; ignore failures
    }
  };

  const loadCatalog = async () => {
    try {
      const [data, recs] = await Promise.all([
        productsApi.getAll(),
        productsApi.getRefillRecommendations().catch(() => [])
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filterKey]);

  useEffect(() => {
    void loadCatalog();
    void loadCategoryCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rows rendered in the table (server page, or a local slice when an alert filter is active)
  const filteredProducts = useMemo(() => {
    if (alertItems === null) return pageItems;
    const start = (page - 1) * INVENTORY_PAGE_SIZE;
    return alertItems.slice(start, start + INVENTORY_PAGE_SIZE);
  }, [pageItems, alertItems, page]);

  const totalPages = getTotalPages(pageTotal, INVENTORY_PAGE_SIZE);
  const pageRange = getPageRange(page, pageTotal, INVENTORY_PAGE_SIZE);

  // Resolve Trade Name suggestions for Add/Edit Product Modal
  const editTradeResolution = useMemo(() => {
    const pName = editingProduct?.name || editingProduct?.product_name || '';
    const cName = editingProduct?.company_name || '';
    return resolveTradeName(pName, cName, products);
  }, [editingProduct?.name, editingProduct?.product_name, editingProduct?.company_name, products]);

  // Resolve Trade Name suggestions for Refill Stock Modal
  const selectedRefillProduct = useMemo(
    () => products.find(p => p.id === refillProductId) || null,
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

    const timer = setTimeout(() => {
      void (async () => {
        setCheckingDuplicate(true);
        try {
          const res = await productsApi.checkDuplicate(name, editingProduct?.company_name, undefined, editingProduct?.trade_name);
          setDuplicateAlert(res.exists ? res : null);
        } catch (err) {
          console.error('Duplicate check error', err);
        } finally {
          setCheckingDuplicate(false);
        }
      })();
    }, 400);

    return () => clearTimeout(timer);
  }, [editingProduct?.name, editingProduct?.company_name, editingProduct?.trade_name, isEditModalOpen, editingProduct?.id]);

  // Select Product for Refill Helper
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

  // Open Refill Modal helper
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

    // Keep only category-relevant compliance attributes
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
        reason: sanitizeTextInput(adjustReason, 300)
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

  const activeFilterCategoryConfig = selectedCategory !== 'ALL' ? getCategoryConfig(selectedCategory) : null;

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
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  {activeFilterCategoryConfig
                    ? `${activeFilterCategoryConfig.label} Inventory`
                    : 'Agri Inventory & Warehouse'}
                </h1>
                {activeFilterCategoryConfig && (
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${activeFilterCategoryConfig.badgeClass}`}>
                    {activeFilterCategoryConfig.regulationTag}
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-500">
                {activeFilterCategoryConfig
                  ? `${activeFilterCategoryConfig.shortDescription} • ${activeFilterCategoryConfig.gstHint}`
                  : 'FCO, Insecticides Act & Seeds Act compliant inventory, dynamic fields, smart units & refills'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Price Lists Button (Owner Only) */}
          {user?.role === 'owner' && (
            <button
              type="button"
              onClick={() => navigate('/price-lists')}
              className="bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold py-2.5 px-4 rounded-xl flex items-center gap-2 text-xs shadow-xs transition-all active:scale-95"
            >
              <Tag className="w-4 h-4 text-amber-600" />
              <span>Price Lists (Discounts / Increments)</span>
            </button>
          )}

          {/* Refill Button */}
          <button
            type="button"
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
            type="button"
            onClick={() => openAddProductModal()}
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-4 rounded-xl flex items-center gap-2 text-xs shadow-md transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>
              {activeFilterCategoryConfig ? `Add ${activeFilterCategoryConfig.label}` : 'Add New Product'}
            </span>
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

      {/* Filter Tabs, Category Dropdown & Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-2.5 flex-1">
            {/* Search box */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search product, CIB/NPK/Lot, category, barcode, batch, or company..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-brand-500 focus:bg-white focus:outline-none"
              />
            </div>

            {/* Category Selector Dropdown */}
            <div className="w-full sm:w-56 shrink-0">
              <CustomSelect
                size="sm"
                value={selectedCategory}
                onChange={(val) => handleCategorySelect(val)}
                placeholder="Filter by Category"
                options={[
                  { value: 'ALL', label: `All Categories (${categoryCounts.ALL || 0})` },
                  ...INVENTORY_CATEGORIES.map((catId) => ({
                    value: catId,
                    label: `${INVENTORY_CATEGORY_CONFIGS[catId].label} (${categoryCounts[catId] || 0})`,
                  })),
                ]}
              />
            </div>
          </div>

          {/* Alert Filter Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setFilterType('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                filterType === 'ALL'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All ({categoryCounts.ALL ?? pageTotal})
            </button>
            <button
              type="button"
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
              type="button"
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

        {/* Category Pills with Live Counts */}
        <div className="flex items-center gap-2 overflow-x-auto pt-1 pb-0.5 text-xs">
          <button
            type="button"
            onClick={() => handleCategorySelect('ALL')}
            className={`px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all ${
              selectedCategory === 'ALL'
                ? 'bg-brand-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All ({categoryCounts.ALL || 0})
          </button>
          {INVENTORY_CATEGORIES.map((catId) => {
            const cfg = INVENTORY_CATEGORY_CONFIGS[catId];
            const isSelected = selectedCategory === catId;
            return (
              <button
                key={catId}
                type="button"
                onClick={() => handleCategorySelect(catId)}
                className={`px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all inline-flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-brand-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotClass}`} />
                <span>{cfg.label}</span>
                <span className={`text-[10px] ${isSelected ? 'text-emerald-300' : 'text-slate-400'}`}>
                  ({categoryCounts[catId] || 0})
                </span>
              </button>
            );
          })}
        </div>

        {/* Active Category Compliance Strip */}
        {activeFilterCategoryConfig && (
          <div className={`rounded-xl border px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px] ${activeFilterCategoryConfig.accentBgClass}`}>
            <div className="flex items-center gap-2 flex-wrap">
              <ShieldCheck className="w-4 h-4 text-slate-700 shrink-0" />
              <span className="font-bold text-slate-900">{activeFilterCategoryConfig.label} Rules:</span>
              <span className="text-slate-700">
                Units: <strong className="font-mono">{activeFilterCategoryConfig.allowedUnits.join(', ')}</strong>
              </span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-700">
                Tracking: <strong>{activeFilterCategoryConfig.batchField.label}</strong>
                {activeFilterCategoryConfig.dateFields.showWarrantyField
                  ? ' + Warranty (Months)'
                  : ` + ${activeFilterCategoryConfig.dateFields.mfgLabel.replace(' (Optional)', '')} & ${activeFilterCategoryConfig.dateFields.expiryLabel.replace(' (Optional)', '')}`}
              </span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-700 font-semibold">{activeFilterCategoryConfig.gstHint}</span>
            </div>
            <button
              type="button"
              onClick={() => openAddProductModal(activeFilterCategoryConfig.id)}
              className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[11px] font-bold inline-flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              New {activeFilterCategoryConfig.label}
            </button>
          </div>
        )}
      </div>

      {/* Product List - Responsive Dual View */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* MOBILE VIEW (< md): Touch-Friendly Product Cards */}
        <div className="md:hidden p-3 space-y-3 bg-slate-50/50">
          {filteredProducts.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No products match your search or filter.
            </div>
          ) : (
            filteredProducts.map((p) => {
              const catCfg = getCategoryConfig(p.category);
              const attrBadges = getCategoryAttributeBadges(p.category, p.category_attributes);
              const isLow = safeNumber(p.current_stock) <= safeNumber(p.min_stock_level ?? p.minimum_stock ?? 20);
              const costPrice = safeNumber(p.cost_price ?? p.purchase_price);
              const sellingPrice = safeNumber(p.selling_price);
              const prodName = p.name || p.product_name || 'Fertilizer Product';
              const batchNo = p.batch_number || p.product_code || 'N/A';
              const unitStr = normalizeUnit(p.unit);
              const barcodeStr = p.barcode || String(10000 + p.id);
              const warrantyVal = p.category_attributes?.warranty_months;
              const dateSummary = catCfg.dateFields.showWarrantyField
                ? warrantyVal
                  ? `Warranty: ${warrantyVal}M`
                  : 'No Expiry'
                : `${catCfg.dateFields.expiryShortLabel}: ${p.expiry_date || (catCfg.dateFields.expiryRequired ? '-' : 'N/A')}`;

              return (
                <div
                  key={p.id}
                  className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs space-y-2.5"
                >
                  {/* Card Header: Name, Category, Barcode */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${catCfg.badgeClass}`}>
                          {catCfg.label}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedBarcodeProduct({ ...p, barcode: barcodeStr });
                            setIsBarcodeModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-mono font-semibold border border-slate-200"
                        >
                          <Barcode className="w-3 h-3 text-slate-500" />
                          <span>{barcodeStr}</span>
                        </button>
                      </div>
                      <h4 className="font-bold text-sm text-slate-900 mt-1 leading-tight">
                        {prodName}
                      </h4>
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        {p.trade_name && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                            Trade: {p.trade_name}
                          </span>
                        )}
                        {p.company_name && (
                          <span className="text-[11px] text-slate-500">{p.company_name}</span>
                        )}
                      </div>
                      {attrBadges.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap mt-1">
                          {attrBadges.map((b, i) => (
                            <span key={i} className={`px-1.5 py-0.5 rounded border text-[9px] font-bold ${b.toneClass}`}>
                              {b.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Stock level badge */}
                    <div className={`px-2.5 py-1 rounded-xl text-center shrink-0 ${
                      isLow
                        ? 'bg-red-50 text-red-700 ring-1 ring-red-300'
                        : 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
                    }`}>
                      <span className="block text-[10px] font-semibold uppercase leading-none">Stock</span>
                      <span className="font-black text-xs font-mono">
                        {safeNumber(p.current_stock)} {unitStr}
                      </span>
                    </div>
                  </div>

                  {/* Pricing and Batch Info */}
                  <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Selling Rate:</span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-black text-slate-900 text-sm font-mono">
                          ₹{formatCurrency(sellingPrice)}
                        </span>
                        {p.base_selling_price && p.base_selling_price !== sellingPrice && (
                          <span className="text-[10px] text-slate-400 line-through font-mono">
                            ₹{formatCurrency(p.base_selling_price)}
                          </span>
                        )}
                      </div>
                      {p.price_list_name && p.price_list_active && (
                        <span className={`inline-flex items-center gap-0.5 mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          p.price_list_type === 'DISCOUNT'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          <Tag className="w-2.5 h-2.5" />
                          {p.price_list_name}
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Cost / Inward:</span>
                      <span className="font-semibold text-slate-600 font-mono">
                        ₹{formatCurrency(costPrice)}
                      </span>
                    </div>
                    <div className="col-span-2 pt-1 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
                      <span>{catCfg.batchField.shortLabel}: <strong className="font-mono text-slate-700">{batchNo}</strong></span>
                      <span>{dateSummary}</span>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => openRefillModal(p)}
                      className="flex-1 py-2 px-3 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Refill Stock</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAdjustingProduct(p);
                        setAdjustQty(0);
                        setAdjustReason('');
                        setIsAdjustModalOpen(true);
                      }}
                      className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1 transition"
                      title="Adjust Stock"
                    >
                      <ArrowUpDown className="w-3.5 h-3.5" />
                      <span>Adjust</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditProductModal(p)}
                      className="p-2 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-xl transition"
                      title="Edit Product"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* DESKTOP VIEW (>= md): Full Detail Data Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 text-[11px]">
              <tr>
                <th className="py-3 px-4">Product &amp; Compliance Info</th>
                <th className="py-3 px-3">Barcode</th>
                <th className="py-3 px-3">Category / GST</th>
                <th className="py-3 px-3 text-center">Batch / Lot &amp; Validity</th>
                <th className="py-3 px-3 text-right">Cost Price</th>
                <th className="py-3 px-3 text-right">Selling Rate</th>
                <th className="py-3 px-4 text-center">Stock Level</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.map((p) => {
                const catCfg = getCategoryConfig(p.category);
                const attrBadges = getCategoryAttributeBadges(p.category, p.category_attributes);
                const isLow = safeNumber(p.current_stock) <= safeNumber(p.min_stock_level ?? p.minimum_stock ?? 20);
                const costPrice = safeNumber(p.cost_price ?? p.purchase_price);
                const sellingPrice = safeNumber(p.selling_price);
                const prodName = p.name || p.product_name || 'Fertilizer Product';
                const batchNo = p.batch_number || p.product_code || 'N/A';
                const unitStr = normalizeUnit(p.unit);
                const barcodeStr = p.barcode || String(10000 + p.id);
                const warrantyVal = p.category_attributes?.warranty_months;
                const validityText = catCfg.dateFields.showWarrantyField
                  ? warrantyVal
                    ? `Warranty: ${warrantyVal}M`
                    : 'No Expiry'
                  : p.expiry_date
                  ? `${catCfg.dateFields.expiryShortLabel}: ${p.expiry_date}`
                  : catCfg.dateFields.expiryRequired
                  ? `${catCfg.dateFields.expiryShortLabel}: -`
                  : 'No Expiry';

                return (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-bold text-slate-900">{prodName}</p>
                            {p.trade_name && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                                Trade: {p.trade_name}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 font-mono">
                            {p.company_name ? `${p.company_name} • ` : ''}
                            Unit: {unitStr}
                            {p.hsn_code ? ` • HSN: ${p.hsn_code}` : ''}
                            {p.variants && p.variants.length > 1 ? ` • ${p.variants.length} pack sizes` : ''}
                          </p>
                          {attrBadges.length > 0 && (
                            <div className="flex items-center gap-1 flex-wrap mt-1">
                              {attrBadges.map((b, i) => (
                                <span key={i} className={`px-1.5 py-0.5 rounded border text-[9px] font-bold ${b.toneClass}`}>
                                  {b.label}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <button
                        type="button"
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
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${catCfg.badgeClass}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${catCfg.dotClass}`} />
                        {catCfg.label}
                      </span>
                      <span className="block text-[10px] text-slate-400 font-mono mt-0.5">
                        GST {safeNumber(p.gst_rate)}%
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="font-mono text-slate-700 text-[11px] font-semibold block">
                        <span className="text-[10px] font-sans text-slate-400 mr-1">{catCfg.batchField.shortLabel}:</span>
                        {batchNo}
                      </span>
                      <span className="text-[10px] text-slate-500">{validityText}</span>
                    </td>
                    <td className="py-3 px-3 text-right font-medium text-slate-600">
                      {formatCurrency(costPrice)}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="font-bold text-slate-900">
                        {formatCurrency(sellingPrice)}
                      </div>
                      {p.base_selling_price && p.base_selling_price !== sellingPrice && (
                        <div className="text-[10px] text-slate-400 line-through font-mono">
                          {formatCurrency(p.base_selling_price)}
                        </div>
                      )}
                      {p.price_list_name && p.price_list_active && (
                        <span className={`inline-flex items-center gap-0.5 mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          p.price_list_type === 'DISCOUNT'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}>
                          <Tag className="w-2.5 h-2.5" />
                          {p.price_list_name}
                        </span>
                      )}
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
                          type="button"
                          onClick={() => openRefillModal(p)}
                          className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Refill Stock"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
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
                          type="button"
                          onClick={() => openEditProductModal(p)}
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

        {/* Pagination controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 py-3 border-t border-slate-200 bg-slate-50/60 text-xs text-slate-600">
          <span data-testid="inventory-page-summary">
            Showing <strong>{pageRange.start}–{pageRange.end}</strong> of <strong>{pageTotal}</strong>
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage(clampPage(page - 1, pageTotal, INVENTORY_PAGE_SIZE))}
              disabled={page <= 1 || isLoading}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold hover:bg-slate-100 disabled:opacity-50"
            >
              Prev
            </button>
            <span className="font-mono font-semibold">Page {page} / {totalPages}</span>
            <button
              type="button"
              onClick={() => setPage(clampPage(page + 1, pageTotal, INVENTORY_PAGE_SIZE))}
              disabled={page >= totalPages || isLoading}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold hover:bg-slate-100 disabled:opacity-50"
            >
              Next
            </button>
          </div>
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

            <form onSubmit={(e) => { void handleRefillSubmit(e); }} className="p-5 space-y-4 text-xs">
              {/* Product Selector - Searchable Typeahead for 1000+ products */}
              <div>
                <label htmlFor="refill-product-search" className="block font-semibold text-slate-700 mb-1">
                  Product to Refill *
                </label>
                {refillProductId ? (
                  (() => {
                    const sel = products.find(p => p.id === refillProductId);
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
                        placeholder="Search 1000+ products by name, trade name, company, or 5-digit code..."
                        className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none shadow-xs"
                      />
                    </div>

                    {/* Filtered suggestions list */}
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

              {/* Company / Brand & Trade Name (Product + Brand Mapping) */}
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
                {refillTradeResolution.relatedMappings.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    <span className="text-[10px] font-bold text-emerald-800">Known Brand Trade Names:</span>
                    {refillTradeResolution.relatedMappings.map((m, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setRefillCompanyName(m.company);
                          setRefillTradeName(m.trade_name);
                          setRefillTradeManuallyEdited(true);
                        }}
                        className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 transition"
                      >
                        {m.company} → <strong>{m.trade_name}</strong>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Quantity and Unit */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="refill-qty" className="block font-semibold text-slate-700 mb-1">Inward Quantity to Add *</label>
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
                  <label className="block font-semibold text-slate-700">
                    <span className="block mb-1">Unit of Measure</span>
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
                  </label>
                </div>
              </div>

              {/* Dynamic Batch / Lot & Dates */}
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
                  <label htmlFor="refill-purchase-price" className="block font-semibold text-slate-700 mb-1">Inward Cost Price (₹)</label>
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
                  <label htmlFor="refill-selling-price" className="block font-semibold text-slate-700 mb-1">Selling Price (₹)</label>
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
                  <label htmlFor="refill-mrp" className="block font-semibold text-slate-700 mb-1">MRP (₹)</label>
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
                  <label htmlFor="refill-supplier" className="block font-semibold text-slate-700 mb-1">Supplier / Depot Name</label>
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
                  <label htmlFor="refill-invoice" className="block font-semibold text-slate-700 mb-1">Supplier Invoice / Bill No.</label>
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
                <label htmlFor="refill-notes" className="block font-semibold text-slate-700 mb-1">Inward Notes</label>
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
                  className="bg-emerald-700 hover:bg-emerald-800 text-white px-5 py-2 rounded-xl font-bold shadow flex items-center gap-1.5 transition-all"
                >
                  {refillSubmitting ? 'Refilling...' : 'Confirm Refill & Add Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Product Modal (Category-Driven Dynamic Fields) */}
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
              <h3 className="font-bold text-sm">Adjust Stock: {adjustingProduct.name || adjustingProduct.product_name}</h3>
              <button
                onClick={() => setIsAdjustModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={(e) => { void handleAdjustStock(e); }} className="p-5 space-y-3.5 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-slate-500">Current Warehouse Stock:</p>
                <p className="text-lg font-black text-brand-900">
                  {adjustingProduct.current_stock} {adjustingProduct.unit}
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700">
                  <span className="block mb-1">Adjustment Type</span>
                  <CustomSelect
                    value={adjustType}
                    onChange={(val) => setAdjustType(val as any)}
                    options={[
                      { value: 'AUDIT_CORRECTION', label: 'Audit Count Correction (+/-)' },
                      { value: 'DAMAGE', label: 'Damaged / Leaked Bags (-)' },
                      { value: 'RETURN', label: 'Customer Return (+)' },
                    ]}
                  />
                </label>
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
                  className="w-full px-3 py-2 font-black text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="adjust-stock-reason" className="block font-semibold text-slate-700 mb-1">Reason / Note</label>
                <input
                  id="adjust-stock-reason"
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
