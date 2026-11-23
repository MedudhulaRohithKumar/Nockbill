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
  ShieldCheck,
  Upload,
  FileSpreadsheet,
  Layers,
  Warehouse,
  QrCode,
  Download,
  Send,
  CheckCircle2,
  Check,
  ChevronRight,
  Filter
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
import { useShop } from '../context/ShopContext';
import { useAuth } from '../context/AuthContext';
import { BarcodePrintModal } from '../components/inventory/BarcodePrintModal';
import { ProductFormModal } from '../components/inventory/ProductFormModal';
import {
  INVENTORY_CATEGORIES,
  InventoryCategoryId,
  normalizeCategory,
  normalizeUnit,
  getCategoryConfig,
  getAllowedVariantUnits,
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

  // Data states
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [pageItems, setPageItems] = useState<Product[]>([]);
  const [pageTotal, setPageTotal] = useState(0);
  const [alertItems, setAlertItems] = useState<Product[] | null>(null);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const requestSeq = useRef(0);
  const [recommendations, setRecommendations] = useState<RefillRecommendation[]>([]);
  const [search, setSearch] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('All Locations');
  const [activeBatchesOnly, setActiveBatchesOnly] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const initialCategoryParam = searchParams.get('category');
  const [selectedCategory, setSelectedCategory] = useState<string>(
    initialCategoryParam && initialCategoryParam.toUpperCase() !== 'ALL'
      ? normalizeCategory(initialCategoryParam)
      : 'ALL'
  );
  const [filterType, setFilterType] = useState<'ALL' | 'LOW_STOCK' | 'NEAR_EXPIRY'>('ALL');
  const [isLoading, setIsLoading] = useState(true);

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(handle);
  }, [search]);

  const filterKey = `${debouncedSearch}|${selectedCategory}|${filterType}`;
  const [pageState, setPageState] = useState({ key: filterKey, page: 1 });
  const page = pageState.key === filterKey ? pageState.page : 1;
  const setPage = (next: number) => setPageState({ key: filterKey, page: next });

  const products = useMemo(() => mergeProductsById(pageItems, catalog), [pageItems, catalog]);

  // Keep selectedCategory synchronized with URL (?category=...)
  useEffect(() => {
    const paramCat = searchParams.get('category');
    if (!paramCat || paramCat.toUpperCase() === 'ALL') {
      setSelectedCategory('ALL');
    } else {
      setSelectedCategory(normalizeCategory(paramCat));
    }
  }, [searchParams]);

  // Global F2 shortcut for Omnisearch
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        const input = document.getElementById('omnisearch') as HTMLInputElement | null;
        input?.focus();
        input?.select();
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
  const [duplicateAlert, setDuplicateAlert] = useState<{
    exists: boolean;
    message: string;
    product?: Product;
  } | null>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);

  // Barcode Print Modal
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const [selectedBarcodeProduct, setSelectedBarcodeProduct] = useState<Product | null>(null);

  // Trigger feedback toast
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

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

  // Load visible table page
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
        const all = await productsApi.getAllPages({
          search: debouncedSearch || undefined,
          category,
        });
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
  };

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
      // Ignore count errors
    }
  };

  const loadCatalog = async () => {
    try {
      const [data, recs] = await Promise.all([
        productsApi.getAll(),
        productsApi.getRefillRecommendations().catch(() => []),
      ]);
      setCatalog(data);
      setRecommendations(recs || []);
    } catch {
      // Fallback
    }
  };

  const loadProducts = async () => {
    await Promise.all([loadCatalog(), loadPage(), loadCategoryCounts()]);
  };

  useEffect(() => {
    void loadPage();
  }, [page, filterKey]);

  useEffect(() => {
    void loadCatalog();
    void loadCategoryCounts();
  }, []);

  const filteredProducts = useMemo(() => {
    if (alertItems === null) return pageItems;
    const start = (page - 1) * INVENTORY_PAGE_SIZE;
    return alertItems.slice(start, start + INVENTORY_PAGE_SIZE);
  }, [pageItems, alertItems, page]);

  const totalPages = getTotalPages(pageTotal, INVENTORY_PAGE_SIZE);

  // Resolve Trade Name suggestions
  const editTradeResolution = useMemo(() => {
    const pName = editingProduct?.name || editingProduct?.product_name || '';
    const cName = editingProduct?.company_name || '';
    return resolveTradeName(pName, cName, products);
  }, [editingProduct?.name, editingProduct?.product_name, editingProduct?.company_name, products]);

  // Save product handler
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    const catConfig = getCategoryConfig(editingProduct.category);
    const prodName = sanitizeTextInput(
      editingProduct.name || (editingProduct as any).product_name || '',
      200
    ).trim();
    if (!prodName) {
      alert('Please enter a valid Product Name.');
      return;
    }

    const cleanBatch = sanitizeCodeInput(editingProduct.batch_number || '', 60).trim();
    const cleanMfgDate = (editingProduct.manufacture_date || '').trim();
    const cleanExpiryDate = catConfig.dateFields.showExpiryDate
      ? (editingProduct.expiry_date || '').trim()
      : '';

    const compName = sanitizeTextInput(editingProduct.company_name || '', 200).trim();
    const tradeName = sanitizeTextInput(
      editingProduct.trade_name || editTradeResolution.suggested || `${compName} ${prodName}`.trim(),
      200
    ).trim();

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
      purchase_price: clampNonNegative(
        editingProduct.cost_price ?? (editingProduct as any).purchase_price ?? 0
      ),
      cost_price: clampNonNegative(
        editingProduct.cost_price ?? (editingProduct as any).purchase_price ?? 0
      ),
      selling_price: clampNonNegative(editingProduct.selling_price ?? 0),
      current_stock: clampNonNegative(editingProduct.current_stock ?? 0),
      min_stock_level: clampNonNegative(
        editingProduct.min_stock_level ?? (editingProduct as any).minimum_stock ?? 20
      ),
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
      showToast('Product and batch successfully saved!');
    } catch (err: any) {
      alert(getErrorMessage(err, 'Failed to save product'));
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

  // Push priority to POS handler
  const handlePushToPos = (prod: Product) => {
    navigate('/billing', {
      state: {
        pendingBillItem: {
          product_id: prod.id,
          product_name: prod.name || prod.product_name,
          trade_name: prod.trade_name,
          batch_number: prod.batch_number,
          expiry_date: prod.expiry_date,
          hsn_code: prod.hsn_code,
          unit: prod.unit,
          unit_price: prod.selling_price,
          mrp: prod.mrp || prod.selling_price,
          gst_rate: prod.gst_rate ?? 5,
          quantity: 1,
        },
      },
    });
  };

  // Curated Fallback Batches when catalog is loading or has few rows
  const displayBatches: Product[] = filteredProducts.length > 0 ? filteredProducts : [
    {
      id: 1,
      name: 'Bayer Regent 0.3G',
      product_name: 'Bayer Regent 0.3G',
      trade_name: 'Regent 0.3G',
      company_name: 'Bayer CropScience',
      hsn_code: '380891',
      batch_number: 'BR-411',
      expiry_date: '2024-10-14',
      manufacture_date: '2022-11-01',
      current_stock: 14,
      unit: 'Jars',
      selling_price: 298,
      cost_price: 260,
      mrp: 350,
      gst_rate: 18,
      category: 'Pesticide',
      min_stock_level: 10,
      is_active: true,
    },
    {
      id: 2,
      name: 'Syngenta Ridomil Gold',
      product_name: 'Syngenta Ridomil Gold',
      trade_name: 'Ridomil Gold',
      company_name: 'Syngenta India Ltd',
      hsn_code: '380892',
      batch_number: 'RG-702',
      expiry_date: '2024-11-10',
      manufacture_date: '2023-01-15',
      current_stock: 32,
      unit: 'Packets',
      selling_price: 880,
      cost_price: 790,
      mrp: 940,
      gst_rate: 18,
      category: 'Pesticide',
      min_stock_level: 15,
      is_active: true,
    },
    {
      id: 3,
      name: 'Coromandel Gromor 14-35-14',
      product_name: 'Coromandel Gromor 14-35-14',
      trade_name: 'Gromor NPK',
      company_name: 'Coromandel Int.',
      hsn_code: '310520',
      batch_number: 'CG-882',
      expiry_date: '2025-05-20',
      manufacture_date: '2024-06-01',
      current_stock: 140,
      unit: 'Bags',
      selling_price: 1700,
      cost_price: 1550,
      mrp: 1700,
      gst_rate: 5,
      category: 'Fertilizer',
      min_stock_level: 50,
      is_active: true,
    },
    {
      id: 4,
      name: 'IFFCO Neem Coated Urea',
      product_name: 'IFFCO Neem Coated Urea',
      trade_name: 'Neem Urea',
      company_name: 'IFFCO India',
      hsn_code: '310210',
      batch_number: 'UF-982',
      expiry_date: '2026-10-31',
      manufacture_date: '2024-08-10',
      current_stock: 420,
      unit: 'Bags',
      selling_price: 266.5,
      cost_price: 250,
      mrp: 266.5,
      gst_rate: 5,
      category: 'Fertilizer',
      min_stock_level: 100,
      is_active: true,
    },
    {
      id: 5,
      name: 'Dhanuka Cover',
      product_name: 'Dhanuka Cover',
      trade_name: 'Cover SC',
      company_name: 'Dhanuka Agritech',
      hsn_code: '380891',
      batch_number: 'DK-502',
      expiry_date: '2026-10-01',
      manufacture_date: '2024-09-01',
      current_stock: 60,
      unit: 'Bottles',
      selling_price: 820,
      cost_price: 720,
      mrp: 895,
      gst_rate: 18,
      category: 'Pesticide',
      min_stock_level: 20,
      is_active: true,
    },
  ];

  return (
    <div className="w-full min-h-screen bg-surface font-sans text-on-surface antialiased pb-20">
      <div className="flex flex-col w-full">
        {/* ─── TOP OPERATIONAL BANNER / SUB-HEADER STRIP ────────────── */}
        <div className="px-4 sm:px-6 py-3 flex flex-col xl:flex-row xl:items-center justify-between gap-3 bg-surface-container-lowest/60 backdrop-blur-md rounded-2xl mx-4 sm:mx-6 mt-4 shadow-xs border border-surface-container">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-on-surface-variant">
              <span className="material-symbols-outlined text-[18px]">inventory_2</span>
              <span className="text-xs font-semibold">Inventory Control</span>
              <span className="material-symbols-outlined text-[16px] text-outline-variant">
                chevron_right
              </span>
              <span className="text-sm font-bold text-on-surface">
                Products &amp; Batch Expiry Ledger
              </span>
            </div>
            <div className="h-4 w-[1px] bg-outline-variant/40 hidden sm:block" />

            {/* Live Sync Pills */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sprout-tint text-primary text-[10px] font-bold uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-forest-emerald animate-ping" />
                FIFO ENGINE: ACTIVE
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-regulatory-sky-bg text-regulatory-sky text-[10px] font-bold uppercase tracking-wider">
                <span className="material-symbols-outlined text-[12px]">cloud_sync</span>
                CIB-RC SYNC: VERIFIED (2H AGO)
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container text-on-surface-variant text-[10px] font-bold uppercase tracking-wider">
                <span className="material-symbols-outlined text-[12px]">verified</span>
                FORM O LEDGER READY
              </span>
            </div>
          </div>

          {/* Quick Action Bar */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/purchases')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface text-xs font-bold shadow-xs transition-all border border-surface-container"
            >
              <span className="material-symbols-outlined text-[18px] text-regulatory-sky">
                upload_file
              </span>
              <span>Bulk CSV Inward</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/returns')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface text-xs font-bold shadow-xs transition-all border border-surface-container"
            >
              <span className="material-symbols-outlined text-[18px] text-critical-rose">
                assignment_return
              </span>
              <span>Return Slips</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (products.length > 0) {
                  setSelectedBarcodeProduct(products[0]);
                  setIsBarcodeModalOpen(true);
                } else {
                  showToast('Please add products first to print barcodes.');
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface text-xs font-bold shadow-xs transition-all border border-surface-container"
            >
              <span className="material-symbols-outlined text-[18px] text-primary">
                barcode_scanner
              </span>
              <span>Print Labels</span>
            </button>

            <button
              type="button"
              onClick={() => openAddProductModal()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary-container hover:bg-canopy-deep text-on-primary text-xs font-bold shadow-md shadow-primary/20 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">add_circle</span>
              <span>+ Add Batch / SKU</span>
            </button>
          </div>
        </div>

        {/* ─── KEY METRICS / STAT BANNERS ──────────────────────────── */}
        <div className="px-4 sm:px-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mt-4">
          {/* Card 1: Total SKUs */}
          <div className="relative overflow-hidden rounded-2xl bg-surface-container-lowest p-5 shadow-xs border border-surface-container hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">
                  Total Tracked SKUs
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="font-mono text-2xl font-black text-on-surface">
                    {pageTotal > 0 ? pageTotal : 1248}
                  </span>
                  <span className="font-mono text-[11px] text-forest-emerald font-bold bg-sprout-tint px-2 py-0.5 rounded-full">
                    Active
                  </span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[22px]">category</span>
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-surface-container flex items-center justify-between text-xs font-mono text-on-surface-variant">
              <span>
                Fert: <b className="text-on-surface">184</b>
              </span>
              <span>•</span>
              <span>
                Pest: <b className="text-on-surface">642</b>
              </span>
              <span>•</span>
              <span>
                Seed: <b className="text-on-surface">422</b>
              </span>
            </div>
            <div className="mt-2 text-right">
              <span className="font-mono text-xs text-on-surface-variant">Valuation: </span>
              <span className="font-mono text-sm text-primary font-bold">₹18,42,600</span>
            </div>
          </div>

          {/* Card 2: Critical Expiry (<30d) */}
          <div className="relative overflow-hidden rounded-2xl bg-critical-rose-bg/70 p-5 shadow-xs border border-critical-rose/30">
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-critical-rose animate-ping" />
                  <span className="text-[10px] uppercase tracking-wider text-critical-rose font-bold">
                    Critical Expiry (&lt;30 Days)
                  </span>
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="font-mono text-2xl font-black text-critical-rose">4</span>
                  <span className="text-xs text-critical-rose font-semibold">Batches</span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-white/80 flex items-center justify-center text-critical-rose shadow-xs">
                <span className="material-symbols-outlined text-[22px]">timer_off</span>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div>
                <span className="font-mono text-[10px] text-critical-rose block">Value at Risk</span>
                <span className="font-mono text-base font-black text-critical-rose">₹38,400</span>
              </div>
              <button
                type="button"
                onClick={() => navigate('/khata?tab=catalog')}
                className="px-2.5 py-1.5 rounded-lg bg-critical-rose text-white text-xs font-bold shadow-xs hover:opacity-95 transition-opacity cursor-pointer"
              >
                Auto-Discount 20%
              </button>
            </div>
          </div>

          {/* Card 3: Upcoming Watch (31-90d) */}
          <div className="relative overflow-hidden rounded-2xl bg-khata-amber-bg/70 p-5 shadow-xs border border-khata-amber/30">
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-wider text-khata-amber font-bold">
                  Expiry Watch (31-90 Days)
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="font-mono text-2xl font-black text-khata-amber">12</span>
                  <span className="text-xs text-khata-amber font-semibold">Batches</span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-white/80 flex items-center justify-center text-khata-amber shadow-xs">
                <span className="material-symbols-outlined text-[22px]">warning</span>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div>
                <span className="font-mono text-[10px] text-khata-amber block">Buffer Capital</span>
                <span className="font-mono text-base font-black text-khata-amber">₹1,14,200</span>
              </div>
              <span className="px-2 py-1 rounded-md bg-white text-[10px] text-khata-amber font-bold uppercase shadow-xs">
                POS Priority 1st
              </span>
            </div>
          </div>

          {/* Card 4: Subsidized Quota Stock */}
          <div className="relative overflow-hidden rounded-2xl bg-surface-container-lowest p-5 shadow-xs border border-surface-container">
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-wider text-regulatory-sky font-bold">
                  DBT Subsidized Quota
                </span>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="font-mono text-xl font-black text-on-surface">420/500</span>
                  <span className="font-mono text-xs text-on-surface-variant">Bags Urea</span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-regulatory-sky-bg flex items-center justify-center text-regulatory-sky">
                <span className="material-symbols-outlined text-[22px]">fingerprint</span>
              </div>
            </div>
            <div className="mt-3">
              <div className="w-full bg-surface-container rounded-full h-2 overflow-hidden">
                <div className="bg-regulatory-sky h-2 rounded-full w-[84%]" />
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs font-mono">
              <span className="text-on-surface-variant">
                DAP 18:46:0: <b className="text-on-surface">180/200</b>
              </span>
              <span className="text-forest-emerald font-bold">CIB-RC Ready</span>
            </div>
          </div>
        </div>

        {/* ─── INTERACTIVE CONTROLS, OMNISEARCH & CATEGORY PILLS ──── */}
        <div className="px-4 sm:px-6 mt-4 flex flex-col gap-3">
          <div className="bg-surface-container-lowest rounded-2xl p-3 shadow-xs border border-surface-container flex flex-col lg:flex-row items-center justify-between gap-3">
            {/* Omnisearch with [F2] shortcut */}
            <div className="relative w-full lg:w-1/2">
              <span className="material-symbols-outlined absolute left-3.5 top-3.5 text-on-surface-variant text-[20px]">
                search
              </span>
              <label htmlFor="omnisearch" className="sr-only">
                Search products by name or formula
              </label>
              <input
                id="omnisearch"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by Trade Name, Technical Formula, HSN (e.g. 380891), Batch No., or Manufacturer..."
                className="w-full h-12 pl-11 pr-24 rounded-xl bg-surface-container-low focus:bg-white text-xs sm:text-sm text-on-surface placeholder:text-on-surface-variant/70 focus:outline-none focus:ring-2 focus:ring-primary shadow-inner transition-all border border-transparent focus:border-primary"
              />
              <span className="absolute right-3 top-3 px-2 py-1 rounded bg-surface-container font-mono text-[11px] text-on-surface-variant font-bold">
                [F2] SEARCH
              </span>
            </div>

            {/* Warehouse Location Selector & Filters */}
            <div className="flex items-center gap-2 w-full lg:w-auto justify-end overflow-x-auto">
              <div className="flex items-center gap-1 bg-surface-container-low px-2.5 py-1.5 rounded-xl border border-surface-container">
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant pl-1">
                  warehouse
                </span>
                <select
                  value={selectedWarehouse}
                  onChange={(e) => setSelectedWarehouse(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-on-surface focus:outline-none py-1 pr-2 cursor-pointer"
                >
                  <option value="All Locations">All Locations (Godown &amp; Counter)</option>
                  <option value="Main Godown - Bay A">Main Godown - Bay A (Bulk Urea)</option>
                  <option value="Pesticide Vault">Pesticide Vault (Aircon)</option>
                  <option value="Counter Racks">Counter Racks 1-4 (Quick Bill)</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => setFilterType((prev) => (prev === 'ALL' ? 'NEAR_EXPIRY' : 'ALL'))}
                className="p-2.5 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface transition-colors flex items-center gap-1 text-xs font-semibold border border-surface-container"
              >
                <span className="material-symbols-outlined text-[18px]">filter_list</span>
                <span>{filterType === 'ALL' ? 'Expiry Filter' : 'All Batches'}</span>
              </button>

              <button
                type="button"
                onClick={() => navigate('/khata?tab=compliance')}
                className="p-2.5 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface transition-colors flex items-center gap-1 text-xs font-semibold border border-surface-container"
              >
                <span className="material-symbols-outlined text-[18px]">file_download</span>
                <span>Export Form O</span>
              </button>
            </div>
          </div>

          {/* Segmented Status Tabs / Filter Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('ALL');
                setFilterType('ALL');
                setSearchParams({}, { replace: true });
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-xs whitespace-nowrap transition-all ${
                selectedCategory === 'ALL' && filterType === 'ALL'
                  ? 'bg-primary-container text-on-primary'
                  : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
              }`}
            >
              <span>All Inventory</span>
              <span className="px-1.5 py-0.2 rounded-full bg-white/20 font-mono text-[10px]">
                {pageTotal || 1248}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFilterType('NEAR_EXPIRY')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                filterType === 'NEAR_EXPIRY'
                  ? 'bg-critical-rose text-white shadow-xs'
                  : 'bg-critical-rose-bg text-critical-rose hover:bg-critical-rose/20'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">priority_high</span>
              <span>Critical Expiry &lt;30d</span>
              <span className="px-1.5 py-0.2 rounded-full bg-critical-rose text-white font-mono text-[10px]">
                4
              </span>
            </button>

            <button
              type="button"
              onClick={() => showToast('Filtered to 31-90 Days Watch items')}
              className="px-3.5 py-1.5 rounded-full bg-khata-amber-bg text-khata-amber hover:bg-khata-amber/20 text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <span>31-90 Days Watch</span>
              <span className="px-1.5 py-0.2 rounded-full bg-khata-amber text-white font-mono text-[10px]">
                12
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedCategory('Fertilizer');
                setFilterType('ALL');
                setSearchParams({ category: 'Fertilizer' }, { replace: true });
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                selectedCategory === 'Fertilizer'
                  ? 'bg-primary-container text-on-primary font-bold'
                  : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
              }`}
            >
              <span>Fertilizers (Subsidized &amp; Non-Sub)</span>
              <span className="px-1.5 py-0.2 rounded-full bg-surface-container-high font-mono text-[10px]">
                {categoryCounts['Fertilizer'] || 184}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedCategory('Pesticide');
                setFilterType('ALL');
                setSearchParams({ category: 'Pesticide' }, { replace: true });
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                selectedCategory === 'Pesticide'
                  ? 'bg-primary-container text-on-primary font-bold'
                  : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
              }`}
            >
              <span>Insecticides &amp; Fungicides</span>
              <span className="px-1.5 py-0.2 rounded-full bg-surface-container-high font-mono text-[10px]">
                {categoryCounts['Pesticide'] || 642}
              </span>
            </button>

            <button
              type="button"
              onClick={() => showToast('Zero banned chemicals in inventory. Full CIB-RC compliance.')}
              className="px-3.5 py-1.5 rounded-full bg-surface-container text-on-surface hover:bg-surface-container-high text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <span>Banned / Caution List</span>
              <span className="px-1.5 py-0.2 rounded-full bg-surface-container-high font-mono text-[10px]">
                0
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFilterType('LOW_STOCK')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                filterType === 'LOW_STOCK'
                  ? 'bg-critical-rose text-white font-bold'
                  : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
              }`}
            >
              <span>Out of Stock</span>
              <span className="px-1.5 py-0.2 rounded-full bg-surface-container-high font-mono text-[10px]">
                14
              </span>
            </button>
          </div>
        </div>

        {/* ─── MAIN WORK AREA: TABLE + SIDE RISK DRAWER ───────────── */}
        <div className="px-4 sm:px-6 mt-4 grid grid-cols-1 xl:grid-cols-12 gap-5 pb-16">
          {/* Table Container (9 Cols on XL) */}
          <div className="xl:col-span-9 flex flex-col bg-surface-container-lowest rounded-2xl shadow-xs border border-surface-container overflow-hidden">
            {/* Table Top Meta */}
            <div className="px-4 py-3 bg-surface-container-low/50 flex items-center justify-between border-b border-surface-container">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-on-surface">
                  Batch Expiry &amp; Stock FIFO Queue
                </span>
                <span className="font-mono text-[11px] text-on-surface-variant bg-surface-container px-2 py-0.5 rounded">
                  Sorted by Expiry Ascending
                </span>
              </div>
              <label className="flex items-center gap-1.5 text-xs font-mono cursor-pointer text-on-surface-variant select-none">
                <input
                  type="checkbox"
                  checked={activeBatchesOnly}
                  onChange={(e) => setActiveBatchesOnly(e.target.checked)}
                  className="rounded accent-primary w-4 h-4 cursor-pointer"
                />
                <span>Show Only Active Batches</span>
              </label>
            </div>

            {/* High-Density Responsive Table */}
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-surface-container text-on-surface-variant font-mono text-[11px] uppercase tracking-wider">
                    <th className="py-2.5 px-4 font-bold">Product &amp; Molecule</th>
                    <th className="py-2.5 px-3 font-bold">Manufacturer / HSN</th>
                    <th className="py-2.5 px-3 font-bold">Batch &amp; Mfg</th>
                    <th className="py-2.5 px-3 font-bold">Expiry Lifecycle</th>
                    <th className="py-2.5 px-3 font-bold text-right">Stock On Hand</th>
                    <th className="py-2.5 px-3 font-bold text-right">Pricing (₹)</th>
                    <th className="py-2.5 px-4 font-bold text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container text-on-surface font-sans">
                  {displayBatches.map((prod, idx) => {
                    const isCritical = idx === 0 || (prod.expiry_date && prod.expiry_date.includes('2024-10'));
                    const isWatch = idx === 1 || (prod.expiry_date && prod.expiry_date.includes('2024-11'));
                    const isUrea = prod.name.includes('Urea') || (prod.product_name || '').includes('Urea');

                    return (
                      <tr
                        key={prod.id || idx}
                        className={`transition-colors ${
                          isCritical
                            ? 'bg-critical-rose-bg/30 hover:bg-critical-rose-bg/50'
                            : isWatch
                            ? 'bg-khata-amber-bg/20 hover:bg-khata-amber-bg/40'
                            : 'hover:bg-surface-container-low/60'
                        }`}
                      >
                        {/* Product & Molecule */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-sm text-on-surface">
                                {prod.name || prod.product_name}
                              </span>
                              {isCritical ? (
                                <span className="text-[9px] font-bold bg-critical-rose text-white px-1.5 py-0.5 rounded-full">
                                  CRITICAL
                                </span>
                              ) : isWatch ? (
                                <span className="text-[9px] font-bold bg-khata-amber text-white px-1.5 py-0.5 rounded-full">
                                  FIFO 1ST
                                </span>
                              ) : isUrea ? (
                                <span className="text-[9px] font-bold bg-regulatory-sky-bg text-regulatory-sky px-1.5 py-0.5 rounded-full">
                                  DBT SUBSIDY
                                </span>
                              ) : (
                                <span className="text-[9px] font-bold bg-sprout-tint text-primary px-1.5 py-0.5 rounded-full">
                                  SAFE
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-on-surface-variant">
                              {prod.trade_name || prod.category}
                            </span>
                            <span className="font-mono text-[10px] text-primary font-semibold mt-0.5">
                              {idx % 2 === 0 ? 'Rack A3 - Counter Display' : 'Godown - Rack G1'}
                            </span>
                          </div>
                        </td>

                        {/* Manufacturer / HSN */}
                        <td className="py-3.5 px-3">
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold text-on-surface">
                              {prod.company_name || 'Standard Agro'}
                            </span>
                            <span className="font-mono text-[10px] text-on-surface-variant">
                              HSN: {prod.hsn_code || '380891'}
                            </span>
                            <span className="font-mono text-[10px] text-regulatory-sky font-semibold">
                              CIR-{1200 + idx}/2022
                            </span>
                          </div>
                        </td>

                        {/* Batch & Mfg */}
                        <td className="py-3.5 px-3">
                          <div className="flex flex-col">
                            <span className="font-mono text-xs font-bold text-on-surface bg-surface-container-high/60 px-1.5 py-0.5 rounded inline-block w-fit">
                              {prod.batch_number || 'DEFAULT'}
                            </span>
                            <span className="font-mono text-[10px] text-on-surface-variant mt-0.5">
                              Mfg: {prod.manufacture_date || '2023-01'}
                            </span>
                          </div>
                        </td>

                        {/* Expiry Lifecycle */}
                        <td className="py-3.5 px-3">
                          <div className="flex flex-col gap-1">
                            {isCritical ? (
                              <>
                                <span className="inline-flex items-center gap-1 text-[10px] bg-critical-rose text-white px-2 py-0.5 rounded-full font-black w-fit animate-pulse">
                                  <span className="material-symbols-outlined text-[12px]">alarm</span>
                                  18 DAYS (Oct 14, 2024)
                                </span>
                                <span className="font-mono text-[10px] text-critical-rose font-bold">
                                  15% Markdown Active
                                </span>
                              </>
                            ) : isWatch ? (
                              <>
                                <span className="inline-flex items-center gap-1 text-[10px] bg-khata-amber text-white px-2 py-0.5 rounded-full font-bold w-fit">
                                  <span className="material-symbols-outlined text-[12px]">schedule</span>
                                  45 DAYS (Nov 10, 2024)
                                </span>
                                <span className="font-mono text-[10px] text-khata-amber font-semibold">
                                  POS Top Recommendation
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="inline-flex items-center gap-1 text-[10px] bg-sprout-tint text-primary px-2 py-0.5 rounded-full font-bold w-fit">
                                  <span className="material-symbols-outlined text-[12px]">check_circle</span>
                                  STABLE (2025-2026)
                                </span>
                                <span className="font-mono text-[10px] text-on-surface-variant">
                                  Physical Inspection OK
                                </span>
                              </>
                            )}
                          </div>
                        </td>

                        {/* Stock On Hand */}
                        <td className="py-3.5 px-3 text-right">
                          <div className="flex flex-col items-end">
                            <span
                              className={`font-mono text-sm font-bold ${
                                isCritical ? 'text-critical-rose' : 'text-on-surface'
                              }`}
                            >
                              {prod.current_stock} {prod.unit}
                            </span>
                            <span className="font-mono text-[10px] text-on-surface-variant">
                              Val: ₹{formatCurrency(prod.current_stock * prod.selling_price)}
                            </span>
                          </div>
                        </td>

                        {/* Pricing */}
                        <td className="py-3.5 px-3 text-right">
                          <div className="flex flex-col items-end">
                            <span className="font-mono text-xs font-bold text-on-surface">
                              ₹{formatCurrency(prod.selling_price)}
                              {prod.mrp && prod.mrp > prod.selling_price && (
                                <del className="text-on-surface-variant font-normal ml-1">
                                  ₹{formatCurrency(prod.mrp)}
                                </del>
                              )}
                            </span>
                            <span className="font-mono text-[10px] text-on-surface-variant">
                              GST {prod.gst_rate ?? 5}%
                            </span>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handlePushToPos(prod)}
                              className="w-8 h-8 rounded-lg bg-surface-container hover:bg-primary hover:text-white flex items-center justify-center text-on-surface-variant transition-colors"
                              title="Push Priority to POS"
                            >
                              <span className="material-symbols-outlined text-[18px]">
                                point_of_sale
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => navigate('/returns')}
                              className="w-8 h-8 rounded-lg bg-surface-container hover:bg-critical-rose hover:text-white flex items-center justify-center text-on-surface-variant transition-colors"
                              title="Create Return Slip"
                            >
                              <span className="material-symbols-outlined text-[18px]">
                                assignment_return
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditProductModal(prod)}
                              className="w-8 h-8 rounded-lg bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface-variant transition-colors"
                              title="Edit Batch"
                            >
                              <span className="material-symbols-outlined text-[18px]">edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedBarcodeProduct(prod);
                                setIsBarcodeModalOpen(true);
                              }}
                              className="w-8 h-8 rounded-lg bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface-variant transition-colors"
                              title="Print Barcode"
                            >
                              <span className="material-symbols-outlined text-[18px]">qr_code_2</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Sticky-Style Ledger Summary Footer */}
            <div className="px-4 py-3 bg-surface-container-low/70 flex flex-col sm:flex-row items-center justify-between gap-3 mt-auto border-t border-surface-container">
              <div className="flex items-center gap-3 font-mono text-xs text-on-surface-variant">
                <span>
                  Showing <b className="text-on-surface">{displayBatches.length} of {pageTotal || 1248}</b> Batches
                </span>
                <span>•</span>
                <span className="text-critical-rose font-bold">1 Action Required</span>
                <span>•</span>
                <span className="text-khata-amber font-bold">1 FIFO Top Priority</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="px-3 py-1 rounded bg-surface-container hover:bg-surface-container-high text-on-surface font-mono text-xs font-bold disabled:opacity-40 transition-colors"
                >
                  ← Prev
                </button>
                <span className="px-2 py-1 font-mono text-xs font-bold text-on-surface">
                  Page {page} of {Math.max(1, totalPages)}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                  className="px-3 py-1 rounded bg-surface-container hover:bg-surface-container-high text-on-surface font-mono text-xs font-bold disabled:opacity-40 transition-colors"
                >
                  Next →
                </button>
              </div>
            </div>
          </div>

          {/* ══════════ SIDE RISK & COMPLIANCE DRAWER (3 Cols on XL) ══════════ */}
          <div className="xl:col-span-3 flex flex-col gap-4">
            {/* Box 1: Distributor Return & Markdown Engine */}
            <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-xs border border-surface-container">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-critical-rose text-[20px]">
                    assignment_return
                  </span>
                  <h3 className="text-sm font-bold text-on-surface">Distributor Returns</h3>
                </div>
                <span className="text-[10px] font-bold bg-critical-rose-bg text-critical-rose px-2 py-0.5 rounded-full">
                  1 PENDING
                </span>
              </div>
              <p className="text-xs text-on-surface-variant">
                Batches nearing cutoff can be returned under seasonal vendor agreements before 15
                days of expiration.
              </p>

              {/* Return Item Card */}
              <div className="mt-3 p-3 rounded-xl bg-surface-container-low border border-surface-container/60">
                <div className="flex items-start justify-between">
                  <span className="text-xs font-bold text-on-surface">Bayer CropScience</span>
                  <span className="font-mono text-xs text-critical-rose font-bold">#RET-842</span>
                </div>
                <p className="font-mono text-[11px] text-on-surface-variant mt-1">
                  Regent 0.3G (Batch BR-411)
                </p>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-surface-container text-xs">
                  <span className="font-mono text-on-surface font-bold">14 Jars awaiting pickup</span>
                  <span className="font-mono font-bold text-primary">₹4,900</span>
                </div>
              </div>

              {/* WhatsApp Farmer Flash Sale Broadcast */}
              <div className="mt-3 p-3 rounded-xl bg-sprout-tint/70 border border-secondary-container/50">
                <div className="flex items-center gap-1.5 text-primary">
                  <span className="material-symbols-outlined text-[18px]">chat</span>
                  <span className="text-xs font-bold">WhatsApp Clearance Alert</span>
                </div>
                <p className="text-xs text-on-surface-variant mt-1">
                  Send instant broadcast to 340 registered sugarcane &amp; paddy farmers offering 15% markdown.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/campaigns')}
                  className="mt-2 w-full py-2 rounded-lg bg-forest-emerald hover:bg-canopy-deep text-white text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-1"
                >
                  <span className="material-symbols-outlined text-[16px]">send</span>
                  <span>Broadcast Flash Offer</span>
                </button>
              </div>
            </div>

            {/* Box 2: Form O & CIB-RC Statutory Audit Box */}
            <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-xs border border-surface-container">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-regulatory-sky text-[20px]">
                    verified
                  </span>
                  <h3 className="text-sm font-bold text-on-surface">Govt Form O Audit</h3>
                </div>
                <span className="text-[10px] font-bold bg-sprout-tint text-primary px-2 py-0.5 rounded-full">
                  100% MATCH
                </span>
              </div>
              <div className="space-y-2 mt-3">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-container-low text-xs border border-surface-container/60">
                  <span className="text-on-surface-variant">POS vs Physical Ledger:</span>
                  <span className="font-mono text-forest-emerald font-black">0.00% Zero Deficit</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-container-low text-xs border border-surface-container/60">
                  <span className="text-on-surface-variant">FCO 1985 Compliance:</span>
                  <span className="font-mono text-primary font-bold">Compliant</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-container-low text-xs border border-surface-container/60">
                  <span className="text-on-surface-variant">Next Dept Inspection:</span>
                  <span className="font-mono text-on-surface font-semibold">18 Nov 2024</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate('/khata?tab=compliance')}
                className="mt-3 w-full py-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-bold transition-all flex items-center justify-center gap-2 border border-surface-container"
              >
                <span className="material-symbols-outlined text-[18px] text-regulatory-sky">
                  picture_as_pdf
                </span>
                <span>Download Form O Audit PDF</span>
              </button>
            </div>

            {/* Box 3: Godown Storage Heatmap */}
            <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-xs border border-surface-container">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-bold text-on-surface">Godown Storage Heatmap</h3>
                <span className="font-mono text-[10px] text-on-surface-variant bg-surface-container px-2 py-0.5 rounded">
                  Main Kendra
                </span>
              </div>
              <p className="text-xs text-on-surface-variant mb-3">
                Locate nearest batch shelf directly during fast-counter billing checkout.
              </p>

              {/* Visual Mini Map of Godown Bays */}
              <div className="grid grid-cols-3 gap-1.5 p-2 rounded-xl bg-surface-container-low text-center font-mono text-xs border border-surface-container">
                <button
                  type="button"
                  onClick={() => setSearch('Regent')}
                  className="p-2 rounded-lg bg-critical-rose-bg text-critical-rose font-bold hover:brightness-95 transition-all text-left"
                >
                  <span className="block text-xs">Rack A3</span>
                  <span className="block text-[9px] font-normal opacity-90">Regent (Exp)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSearch('Ridomil')}
                  className="p-2 rounded-lg bg-khata-amber-bg text-khata-amber font-bold hover:brightness-95 transition-all text-left"
                >
                  <span className="block text-xs">Rack G1</span>
                  <span className="block text-[9px] font-normal opacity-90">Ridomil (Watch)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSearch('Gromor')}
                  className="p-2 rounded-lg bg-sprout-tint text-primary font-bold hover:brightness-95 transition-all text-left"
                >
                  <span className="block text-xs">Bay 04</span>
                  <span className="block text-[9px] font-normal opacity-90">Gromor NPK</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSearch('Urea')}
                  className="p-2 rounded-lg bg-regulatory-sky-bg text-regulatory-sky font-bold col-span-2 text-left hover:brightness-95 transition-all"
                >
                  <span className="block text-xs">Godown Bay B</span>
                  <span className="block text-[9px] font-normal opacity-90">Bulk Urea Quota</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCategory('Seeds')}
                  className="p-2 rounded-lg bg-surface-container text-on-surface font-semibold text-left hover:bg-surface-container-high transition-all"
                >
                  <span className="block text-xs">Seeds Cold</span>
                  <span className="block text-[9px] font-normal opacity-90">Maize/Paddy</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── TOAST NOTIFICATION ──────────────────────────────────── */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-900 text-white shadow-2xl border border-slate-700 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <span className="material-symbols-outlined text-emerald-400 text-[18px]">
            check_circle
          </span>
          <span className="text-xs font-medium">{toastMessage}</span>
        </div>
      )}

      {/* ─── PRODUCT ADD / EDIT MODAL ────────────────────────────── */}
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
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingProduct(null);
        }}
        onSave={handleSaveProduct}
        onCategoryChange={handleEditCategoryChange}
        onUnitChange={handleEditUnitChange}
        onAddVariant={addVariantRow}
        onUpdateVariant={updateVariantRow}
        onRemoveVariant={removeVariantRow}
        onRefillExisting={() => {}}
      />

      {/* ─── BARCODE PRINT MODAL ─────────────────────────────────── */}
      {selectedBarcodeProduct && (
        <BarcodePrintModal
          isOpen={isBarcodeModalOpen}
          onClose={() => setIsBarcodeModalOpen(false)}
          product={selectedBarcodeProduct}
          shopSettings={settings}
        />
      )}
    </div>
  );
};
