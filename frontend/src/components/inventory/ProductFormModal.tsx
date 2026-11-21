import React from 'react';
import {
  AlertTriangle,
  Calendar,
  Plus,
  RotateCcw,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { Product, ProductVariant } from '../../types';
import { resolveTradeName } from '../../utils/formatters';
import { CustomSelect } from '../common/CustomSelect';
import { CategoryExtraFieldsSection } from './CategoryExtraFieldsSection';
import {
  INVENTORY_CATEGORIES,
  INVENTORY_CATEGORY_CONFIGS,
  CategoryRuleConfig,
  addMonthsToDateString,
  normalizeUnit,
} from '../../config/inventoryCategories';

interface TradeResolution {
  suggested: string;
  relatedMappings: { company: string; trade_name: string }[];
}

interface DuplicateAlert {
  exists: boolean;
  message: string;
  product?: Product;
}

interface ProductFormModalProps {
  isOpen: boolean;
  editingProduct: Partial<Product> | null;
  setEditingProduct: React.Dispatch<React.SetStateAction<Partial<Product> | null>>;
  products: Product[];
  categoryConfig: CategoryRuleConfig;
  allowedVariantUnits: string[];
  productVariants: ProductVariant[];
  enableVariantsForOthers: boolean;
  setEnableVariantsForOthers: React.Dispatch<React.SetStateAction<boolean>>;
  tradeNameManuallyEdited: boolean;
  setTradeNameManuallyEdited: React.Dispatch<React.SetStateAction<boolean>>;
  editTradeResolution: TradeResolution;
  duplicateAlert: DuplicateAlert | null;
  checkingDuplicate: boolean;
  onClose: () => void;
  onSave: (e: React.FormEvent) => Promise<void>;
  onCategoryChange: (newCategory: string) => void;
  onUnitChange: (newUnit: string) => void;
  onAddVariant: () => void;
  onUpdateVariant: (index: number, field: keyof ProductVariant, value: string | number) => void;
  onRemoveVariant: (index: number) => void;
  onRefillExisting: (existing: Product) => void;
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  isOpen,
  editingProduct,
  setEditingProduct,
  products,
  categoryConfig,
  allowedVariantUnits,
  productVariants,
  enableVariantsForOthers,
  setEnableVariantsForOthers,
  tradeNameManuallyEdited,
  setTradeNameManuallyEdited,
  editTradeResolution,
  duplicateAlert,
  checkingDuplicate,
  onClose,
  onSave,
  onCategoryChange,
  onUnitChange,
  onAddVariant,
  onUpdateVariant,
  onRemoveVariant,
  onRefillExisting,
}) => {
  if (!isOpen || !editingProduct) {
    return null;
  }

  const currentUnitNormalized = normalizeUnit(editingProduct.unit || categoryConfig.defaultUnit);
  const unitOptionsList = categoryConfig.allowedUnits.includes(currentUnitNormalized)
    ? categoryConfig.allowedUnits
    : [currentUnitNormalized, ...categoryConfig.allowedUnits];

  const isOthersCollapsed = categoryConfig.packagingVariantsMode === 'optional_collapsed';
  const showVariantsEditor = !isOthersCollapsed || enableVariantsForOthers;

  const variantUnitHint =
    currentUnitNormalized === 'Grams' || currentUnitNormalized === 'Kg'
      ? 'Weight units only (Grams, Kg)'
      : currentUnitNormalized === 'ml' || currentUnitNormalized === 'Litre'
      ? 'Volume units only (ml, Litre)'
      : `Allowed pack units: ${allowedVariantUnits.join(', ')}`;

  const warrantyMonthsValue = String(editingProduct.category_attributes?.warranty_months ?? '');

  const handleWarrantyMonthsChange = (val: string) => {
    setEditingProduct({
      ...editingProduct,
      category_attributes: {
        ...(editingProduct.category_attributes || {}),
        warranty_months: val,
      },
    });
  };

  const handleAutoFillExpiry = () => {
    const months = categoryConfig.dateFields.autoSuggestExpiryMonths;
    if (!months || !editingProduct.manufacture_date) return;
    const computed = addMonthsToDateString(editingProduct.manufacture_date, months);
    if (computed) {
      setEditingProduct({ ...editingProduct, expiry_date: computed });
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden my-4 max-h-[92vh] flex flex-col">
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <h3 className="font-bold text-sm truncate">
              {editingProduct.id ? 'Edit Product Details' : 'Add New Product'}
            </h3>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${categoryConfig.badgeClass}`}>
              {categoryConfig.label}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close product form"
            className="text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={(e) => { void onSave(e); }} className="p-4 sm:p-5 space-y-4 text-xs overflow-y-auto">
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
                    Creating another product will generate a duplicate barcode. Please refill existing stock instead.
                  </p>
                </div>
              </div>

              {duplicateAlert.product && (
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => onRefillExisting(duplicateAlert.product!)}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-sm"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Refill This Product Instead
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Step 1: Category Selection (Drives dynamic units, GST, labels & compliance fields) */}
          <div className={`rounded-xl border p-3.5 space-y-2 ${categoryConfig.accentBgClass}`}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div>
                <label className="block font-bold text-slate-800">
                  <span className="block mb-1">Product Category *</span>
                  <CustomSelect
                    value={categoryConfig.id}
                    onChange={onCategoryChange}
                    options={INVENTORY_CATEGORIES.map((catId) => ({
                      value: catId,
                      label: `${INVENTORY_CATEGORY_CONFIGS[catId].label} (${INVENTORY_CATEGORY_CONFIGS[catId].defaultGstRate}% GST)`,
                    }))}
                  />
                </label>
              </div>

              <div>
                <label className="block font-semibold text-slate-700">
                  <span className="block mb-1">Primary Unit *</span>
                  <CustomSelect
                    value={currentUnitNormalized}
                    onChange={onUnitChange}
                    options={unitOptionsList.map((u) => ({
                      value: u,
                      label: u,
                    }))}
                  />
                </label>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="edit-prod-hsn" className="font-semibold text-slate-700">
                    HSN Code
                  </label>
                  <span className="text-[10px] font-mono text-slate-500">
                    {categoryConfig.hsnPrefixHint}
                  </span>
                </div>
                <input
                  id="edit-prod-hsn"
                  type="text"
                  value={editingProduct.hsn_code ?? ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, hsn_code: e.target.value })}
                  placeholder={categoryConfig.placeholders.hsnCode}
                  className="w-full px-2.5 py-2 bg-white font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[10px] text-slate-600">
              <span className="flex items-center gap-1 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                {categoryConfig.regulationTag} — {categoryConfig.shortDescription}
              </span>
              <span className="font-mono font-semibold text-slate-700">
                Units: {categoryConfig.allowedUnits.join(', ')}
              </span>
            </div>
          </div>

          {/* Product Basic Info with Dynamic Placeholders */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="edit-prod-name" className="block font-semibold text-slate-700 mb-1">
                Product / Technical Name *
              </label>
              <input
                id="edit-prod-name"
                type="text"
                required
                maxLength={150}
                value={editingProduct.name || ''}
                onChange={(e) => {
                  const nextName = e.target.value;
                  const nextTrade = !tradeNameManuallyEdited
                    ? resolveTradeName(nextName, editingProduct.company_name || '', products).suggested
                    : editingProduct.trade_name;
                  setEditingProduct({
                    ...editingProduct,
                    name: nextName,
                    trade_name: nextTrade,
                  });
                }}
                placeholder={categoryConfig.placeholders.productName}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
              {checkingDuplicate && (
                <span className="text-[10px] text-slate-400">Checking duplicate...</span>
              )}
            </div>

            <div>
              <label htmlFor="edit-prod-company" className="block font-semibold text-slate-700 mb-1">
                Company / Brand
              </label>
              <input
                id="edit-prod-company"
                type="text"
                maxLength={120}
                value={editingProduct.company_name || ''}
                onChange={(e) => {
                  const nextComp = e.target.value;
                  const nextTrade = !tradeNameManuallyEdited
                    ? resolveTradeName(editingProduct.name || '', nextComp, products).suggested
                    : editingProduct.trade_name;
                  setEditingProduct({
                    ...editingProduct,
                    company_name: nextComp,
                    trade_name: nextTrade,
                  });
                }}
                placeholder={categoryConfig.placeholders.companyName}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Trade Name (Combination of Product & Company/Brand) */}
          <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <label htmlFor="edit-prod-trade" className="block font-bold text-emerald-900 text-xs">
                Trade Name (Product + Company/Brand Combination)
              </label>
              <span className="text-[10px] text-emerald-700 font-medium">
                Auto-mapped from Product &amp; Company (editable)
              </span>
            </div>
            <input
              id="edit-prod-trade"
              type="text"
              maxLength={150}
              value={editingProduct.trade_name || ''}
              onChange={(e) => {
                setTradeNameManuallyEdited(true);
                setEditingProduct({ ...editingProduct, trade_name: e.target.value });
              }}
              placeholder={categoryConfig.placeholders.tradeName}
              className="w-full px-3 py-2 bg-white font-bold text-emerald-950 border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
            {editTradeResolution.relatedMappings.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                <span className="text-[10px] font-bold text-emerald-800">Brand Mappings for this Product:</span>
                {editTradeResolution.relatedMappings.map((m, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setTradeNameManuallyEdited(true);
                      setEditingProduct({
                        ...editingProduct,
                        company_name: m.company,
                        trade_name: m.trade_name,
                      });
                    }}
                    className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 transition"
                  >
                    {m.company} → <strong>{m.trade_name}</strong>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Dynamic Batch / Lot / Serial & Date / Warranty Tracking */}
          <div
            className={`grid grid-cols-1 ${
              categoryConfig.dateFields.showWarrantyField ? 'sm:grid-cols-2' : 'sm:grid-cols-3'
            } gap-3`}
          >
            <div>
              <label htmlFor="edit-prod-batch" className="block font-semibold text-slate-700 mb-1">
                {categoryConfig.batchField.label}
                {categoryConfig.batchField.required && <span className="text-red-600 ml-0.5">*</span>}
              </label>
              <input
                id="edit-prod-batch"
                type="text"
                required={categoryConfig.batchField.required}
                value={editingProduct.batch_number ?? ''}
                onChange={(e) => setEditingProduct({ ...editingProduct, batch_number: e.target.value })}
                placeholder={categoryConfig.batchField.placeholder}
                className="w-full px-2.5 py-2 font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            {categoryConfig.dateFields.showWarrantyField ? (
              <div>
                <label htmlFor="edit-prod-warranty-months" className="block font-semibold text-slate-700 mb-1">
                  Warranty Period (Months)
                </label>
                <div className="relative">
                  <input
                    id="edit-prod-warranty-months"
                    type="number"
                    min="0"
                    max="120"
                    value={warrantyMonthsValue}
                    onChange={(e) => handleWarrantyMonthsChange(e.target.value)}
                    placeholder="e.g. 12"
                    className="w-full px-2.5 py-2 pr-16 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <span className="absolute right-2.5 top-2 text-[11px] font-semibold text-slate-400">
                    Months
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Replaces Expiry Date for sprayers, tarpaulins &amp; agri tools
                </p>
              </div>
            ) : (
              <>
                {categoryConfig.dateFields.showMfgDate && (
                  <div>
                    <label htmlFor="edit-prod-mfg-date" className="block font-semibold text-slate-700 mb-1">
                      {categoryConfig.dateFields.mfgLabel}
                      {categoryConfig.dateFields.mfgRequired && <span className="text-red-600 ml-0.5">*</span>}
                    </label>
                    <input
                      id="edit-prod-mfg-date"
                      type="date"
                      required={categoryConfig.dateFields.mfgRequired}
                      value={editingProduct.manufacture_date || ''}
                      onChange={(e) => {
                        const nextMfg = e.target.value;
                        const autoMonths = categoryConfig.dateFields.autoSuggestExpiryMonths;
                        const shouldAutoFill =
                          Boolean(autoMonths) && Boolean(nextMfg) && !editingProduct.expiry_date;
                        setEditingProduct({
                          ...editingProduct,
                          manufacture_date: nextMfg,
                          expiry_date: shouldAutoFill
                            ? addMonthsToDateString(nextMfg, autoMonths!)
                            : editingProduct.expiry_date,
                        });
                      }}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                )}

                {categoryConfig.dateFields.showExpiryDate && (
                  <div>
                    <div className="flex items-center justify-between mb-1 gap-1">
                      <label htmlFor="edit-prod-expiry" className="font-semibold text-slate-700 truncate">
                        {categoryConfig.dateFields.expiryLabel}
                        {categoryConfig.dateFields.expiryRequired && <span className="text-red-600 ml-0.5">*</span>}
                      </label>
                      {categoryConfig.dateFields.autoSuggestExpiryMonths && editingProduct.manufacture_date && (
                        <button
                          type="button"
                          onClick={handleAutoFillExpiry}
                          className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded inline-flex items-center gap-0.5 shrink-0"
                          title={`Set ${categoryConfig.dateFields.autoSuggestExpiryMonths} months from ${categoryConfig.dateFields.mfgLabel}`}
                        >
                          <Calendar className="w-2.5 h-2.5" />
                          +{categoryConfig.dateFields.autoSuggestExpiryMonths}m
                        </button>
                      )}
                    </div>
                    <input
                      id="edit-prod-expiry"
                      type="date"
                      required={categoryConfig.dateFields.expiryRequired}
                      value={editingProduct.expiry_date || ''}
                      onChange={(e) => setEditingProduct({ ...editingProduct, expiry_date: e.target.value })}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                )}
              </>
            )}
          </div>

          {categoryConfig.dateFields.expiryHelper && (
            <p className="text-[10px] text-slate-500 -mt-2">
              Note: {categoryConfig.dateFields.expiryHelper}
            </p>
          )}

          {/* Category-Specific Extra Compliance Fields */}
          <CategoryExtraFieldsSection
            config={categoryConfig}
            attributes={editingProduct.category_attributes || {}}
            onChange={(nextAttrs) =>
              setEditingProduct({
                ...editingProduct,
                category_attributes: nextAttrs,
              })
            }
          />

          {/* Default Pricing, Auto-Default Editable GST & Stock */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label htmlFor="edit-prod-purchase-price" className="block font-semibold text-slate-700 mb-1">
                  Purchase (₹)
                </label>
                <input
                  id="edit-prod-purchase-price"
                  type="number"
                  step="0.5"
                  value={editingProduct.cost_price ?? 0}
                  onChange={(e) =>
                    setEditingProduct({ ...editingProduct, cost_price: Number.parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="edit-prod-selling-price" className="block font-semibold text-slate-700 mb-1">
                  Selling (₹)
                </label>
                <input
                  id="edit-prod-selling-price"
                  type="number"
                  step="0.5"
                  value={editingProduct.selling_price ?? 0}
                  onChange={(e) =>
                    setEditingProduct({ ...editingProduct, selling_price: Number.parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-2.5 py-1.5 bg-white font-bold text-slate-900 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700">
                  <span className="block mb-1">GST Rate %</span>
                  <CustomSelect
                    value={String(editingProduct.gst_rate ?? categoryConfig.defaultGstRate)}
                    onChange={(val) =>
                      setEditingProduct({ ...editingProduct, gst_rate: Number.parseInt(val, 10) })
                    }
                    options={[
                      { value: '0', label: '0% (Exempt / Seeds)' },
                      { value: '5', label: '5% (Fertilizer / Bio)' },
                      { value: '12', label: '12% (Micronutrients)' },
                      { value: '18', label: '18% (Pesticides)' },
                      { value: '28', label: '28%' },
                    ]}
                  />
                </label>
              </div>

              <div>
                <label htmlFor="edit-prod-stock" className="block font-semibold text-slate-700 mb-1">
                  Opening Stock ({currentUnitNormalized})
                </label>
                <input
                  id="edit-prod-stock"
                  type="number"
                  value={editingProduct.current_stock ?? 0}
                  onChange={(e) =>
                    setEditingProduct({ ...editingProduct, current_stock: Number.parseInt(e.target.value, 10) || 0 })
                  }
                  className="w-full px-2.5 py-1.5 bg-white font-black border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>
            <p className="text-[10px] text-slate-500">
              Tax Guidance: <span className="font-semibold text-slate-700">{categoryConfig.gstHint}</span> (editable for exceptions like branded vs. unbranded organic or FCO-notified micronutrients)
            </p>
          </div>

          {/* Multi-Unit Packaging Variants Section with Smart Unit Filtering */}
          {isOthersCollapsed && !showVariantsEditor ? (
            <div className="border border-dashed border-slate-300 rounded-xl p-3 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="font-bold text-slate-700 text-xs">
                  Packaging &amp; Size Variants (Optional for {categoryConfig.label})
                </h4>
                <p className="text-[10px] text-slate-500">
                  Hidden by default for equipment/tools ({currentUnitNormalized}). Enable only if sold in multiple pack sizes.
                </p>
              </div>
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableVariantsForOthers}
                  onChange={(e) => setEnableVariantsForOthers(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-500"
                />
                <span>Has pack sizes</span>
              </label>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl p-3.5 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-bold text-slate-900 text-xs">
                      Packaging &amp; Size Variants
                    </h4>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-semibold">
                      {variantUnitHint}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Configure different pack sizes with individual selling rates
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {isOthersCollapsed && (
                    <button
                      type="button"
                      onClick={() => setEnableVariantsForOthers(false)}
                      className="text-[10px] font-semibold text-slate-500 hover:text-slate-700"
                    >
                      Hide
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onAddVariant}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-bold text-xs flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    Add Packaging
                  </button>
                </div>
              </div>

              {productVariants.length > 0 && (
                <div className="space-y-2 pt-2">
                  {productVariants.map((v, idx) => {
                    const rowUnit = allowedVariantUnits.includes(normalizeUnit(v.unit))
                      ? normalizeUnit(v.unit)
                      : allowedVariantUnits[0];
                    return (
                      <div key={idx} className="flex flex-wrap sm:flex-nowrap items-center gap-2 bg-slate-50 p-2 rounded-lg text-xs">
                        <input
                          type="text"
                          aria-label={`Packaging variant ${idx + 1} name`}
                          placeholder={`Pack Name (e.g. 500 ${rowUnit})`}
                          value={v.variant_name}
                          onChange={(e) => onUpdateVariant(idx, 'variant_name', e.target.value)}
                          className="flex-1 min-w-[130px] px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                          required
                        />
                        <input
                          type="number"
                          step="0.01"
                          aria-label={`Packaging variant ${idx + 1} size`}
                          placeholder="Size"
                          value={v.unit_size}
                          onChange={(e) => onUpdateVariant(idx, 'unit_size', Number.parseFloat(e.target.value) || 0)}
                          className="w-20 px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                          required
                        />
                        <div className="w-24 shrink-0">
                          <CustomSelect
                            size="sm"
                            value={rowUnit}
                            onChange={(val) => onUpdateVariant(idx, 'unit', val)}
                            options={allowedVariantUnits.map((u) => ({ value: u, label: u }))}
                          />
                        </div>
                        <input
                          type="number"
                          step="0.5"
                          aria-label={`Packaging variant ${idx + 1} selling price`}
                          placeholder="Selling ₹"
                          value={v.selling_price}
                          onChange={(e) =>
                            onUpdateVariant(idx, 'selling_price', Number.parseFloat(e.target.value) || 0)
                          }
                          className="w-24 px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900"
                          required
                        />
                        <button
                          type="button"
                          aria-label={`Remove packaging variant ${idx + 1}`}
                          onClick={() => onRemoveVariant(idx)}
                          className="p-1 text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
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
  );
};
