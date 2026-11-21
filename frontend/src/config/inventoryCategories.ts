export type InventoryCategoryId =
  | 'Fertilizer'
  | 'Pesticide'
  | 'Seeds'
  | 'Micronutrients'
  | 'Bio-Fertilizer'
  | 'Organic'
  | 'Others';

export interface CategorySelectOption {
  value: string;
  label: string;
  dotColor?: string;
}

export interface CategoryExtraFieldDef {
  key: string;
  label: string;
  type: 'text' | 'select' | 'number';
  placeholder?: string;
  options?: CategorySelectOption[];
  quickChips?: string[];
  helperText?: string;
  suffix?: string;
  showWhen?: {
    field: string;
    values: string[];
  };
}

export interface CategoryRuleConfig {
  id: InventoryCategoryId;
  label: string;
  shortDescription: string;
  regulationTag: string;
  dotClass: string;
  badgeClass: string;
  accentBgClass: string;
  allowedUnits: string[];
  defaultUnit: string;
  defaultGstRate: number;
  gstHint: string;
  hsnPrefixHint: string;
  batchField: {
    label: string;
    shortLabel: string;
    placeholder: string;
    required: boolean;
  };
  dateFields: {
    showMfgDate: boolean;
    mfgLabel: string;
    mfgRequired: boolean;
    showExpiryDate: boolean;
    expiryLabel: string;
    expiryShortLabel: string;
    expiryRequired: boolean;
    expiryHelper?: string;
    autoSuggestExpiryMonths?: number;
    showWarrantyField: boolean;
  };
  placeholders: {
    productName: string;
    companyName: string;
    tradeName: string;
    hsnCode: string;
  };
  packagingVariantsMode: 'standard' | 'optional_collapsed';
  extraFields: CategoryExtraFieldDef[];
}

export const INVENTORY_CATEGORY_CONFIGS: Record<InventoryCategoryId, CategoryRuleConfig> = {
  Fertilizer: {
    id: 'Fertilizer',
    label: 'Fertilizer',
    shortDescription: 'Urea, DAP, NPK, Potash & Straight Fertilizers',
    regulationTag: 'FCO 1985 • 5% GST',
    dotClass: 'bg-emerald-500',
    badgeClass: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
    accentBgClass: 'bg-emerald-50/70 border-emerald-200',
    allowedUnits: ['Kg', 'Grams', 'Litre', 'ml', 'Bags'],
    defaultUnit: 'Bags',
    defaultGstRate: 5,
    gstHint: 'HSN 3101–3105 • Standard 5% GST',
    hsnPrefixHint: 'HSN: 3101–3105',
    batchField: {
      label: 'Batch Number',
      shortLabel: 'Batch',
      placeholder: 'e.g., BATCH-2026-01',
      required: false,
    },
    dateFields: {
      showMfgDate: true,
      mfgLabel: 'Mfg Date (Optional)',
      mfgRequired: false,
      showExpiryDate: true,
      expiryLabel: 'Expiry Date (Optional)',
      expiryShortLabel: 'Exp',
      expiryRequired: false,
      expiryHelper: 'Optional for straight chemical fertilizers (Urea / DAP / MOP)',
      showWarrantyField: false,
    },
    placeholders: {
      productName: 'e.g. Urea 46% N or NPK 19:19:19',
      companyName: 'e.g. IFFCO, Coromandel, Yara',
      tradeName: 'e.g. IFFCO Nano Urea / Gromor 20:20:0:13',
      hsnCode: 'e.g. 31021000',
    },
    packagingVariantsMode: 'standard',
    extraFields: [
      {
        key: 'npk_grade',
        label: 'NPK Ratio / Grade',
        type: 'text',
        placeholder: 'e.g., 19:19:19, 46% N, 18:46:0',
        quickChips: ['46% N (Urea)', '18:46:0 (DAP)', '19:19:19', '10:26:26', '0:0:50 (MOP)'],
      },
      {
        key: 'subsidy_type',
        label: 'Subsidy Type',
        type: 'select',
        placeholder: 'Select subsidy category',
        options: [
          { value: 'Subsidized', label: 'Subsidized (DBT / PoS)' },
          { value: 'Non-Subsidized', label: 'Non-Subsidized' },
          { value: 'POS ID', label: 'POS ID Tracked' },
        ],
      },
      {
        key: 'pos_id',
        label: 'DBT / POS ID',
        type: 'text',
        placeholder: 'e.g., POS-FCO-2026-001',
        helperText: 'Enter PoS machine / DBT fertilizer SKU ID if applicable',
        showWhen: {
          field: 'subsidy_type',
          values: ['Subsidized', 'POS ID'],
        },
      },
    ],
  },

  Pesticide: {
    id: 'Pesticide',
    label: 'Pesticide',
    shortDescription: 'Insecticide, Fungicide & Herbicide',
    regulationTag: 'Insecticides Act • 18% GST',
    dotClass: 'bg-rose-500',
    badgeClass: 'bg-rose-50 text-rose-800 border border-rose-200',
    accentBgClass: 'bg-rose-50/60 border-rose-200',
    allowedUnits: ['ml', 'Litre', 'Grams', 'Kg'],
    defaultUnit: 'ml',
    defaultGstRate: 18,
    gstHint: 'HSN 3808 • Standard 18% GST',
    hsnPrefixHint: 'HSN: 3808',
    batchField: {
      label: 'Batch Number',
      shortLabel: 'Batch',
      placeholder: 'e.g., BATCH-2026-01',
      required: true,
    },
    dateFields: {
      showMfgDate: true,
      mfgLabel: 'Mfg Date',
      mfgRequired: true,
      showExpiryDate: true,
      expiryLabel: 'Expiry Date',
      expiryShortLabel: 'Exp',
      expiryRequired: true,
      expiryHelper: 'Mandatory under Insecticides Act for invoice & compliance',
      showWarrantyField: false,
    },
    placeholders: {
      productName: 'e.g. Imidacloprid 17.8% SL',
      companyName: 'e.g. Bayer, Syngenta, Dhanuka',
      tradeName: 'e.g. Confidor (Bayer) or Actara (Syngenta)',
      hsnCode: 'e.g. 38089199',
    },
    packagingVariantsMode: 'standard',
    extraFields: [
      {
        key: 'cib_registration_no',
        label: 'CIB Registration No.',
        type: 'text',
        placeholder: 'e.g., CIR-12345/2024-Imidacloprid',
        helperText: 'Central Insecticides Board & Registration Committee No.',
      },
      {
        key: 'formulation_type',
        label: 'Formulation Type',
        type: 'select',
        placeholder: 'Select formulation',
        options: [
          { value: 'EC', label: 'EC (Emulsifiable Concentrate)' },
          { value: 'SL', label: 'SL (Soluble Liquid)' },
          { value: 'WP', label: 'WP (Wettable Powder)' },
          { value: 'SC', label: 'SC (Suspension Concentrate)' },
          { value: 'WG', label: 'WG (Water Dispersible Granules)' },
          { value: 'GR', label: 'GR (Granules)' },
          { value: 'SP', label: 'SP (Soluble Powder)' },
          { value: 'CS', label: 'CS (Capsule Suspension)' },
        ],
      },
      {
        key: 'toxicity_color',
        label: 'Toxicity Color',
        type: 'select',
        placeholder: 'Select toxicity triangle',
        options: [
          { value: 'Red', label: 'Red — Extremely Toxic', dotColor: 'bg-red-600' },
          { value: 'Yellow', label: 'Yellow — Highly Toxic', dotColor: 'bg-amber-400' },
          { value: 'Blue', label: 'Blue — Moderately Toxic', dotColor: 'bg-blue-600' },
          { value: 'Green', label: 'Green — Slightly Toxic', dotColor: 'bg-emerald-600' },
        ],
      },
    ],
  },

  Seeds: {
    id: 'Seeds',
    label: 'Seeds',
    shortDescription: 'Hybrid, Certified & Truthfully Labelled Seeds',
    regulationTag: 'Seeds Act • 0% Exempt',
    dotClass: 'bg-amber-500',
    badgeClass: 'bg-amber-50 text-amber-900 border border-amber-200',
    accentBgClass: 'bg-amber-50/70 border-amber-200',
    allowedUnits: ['Grams', 'Kg', 'Packets', 'Pouches'],
    defaultUnit: 'Packets',
    defaultGstRate: 0,
    gstHint: 'HSN 1209 / 1001–1008 • 0% GST (Exempt)',
    hsnPrefixHint: 'HSN: 1209 / 1001–1008',
    batchField: {
      label: 'Lot Number',
      shortLabel: 'Lot',
      placeholder: 'e.g., LOT-2026-A12',
      required: true,
    },
    dateFields: {
      showMfgDate: true,
      mfgLabel: 'Date of Test',
      mfgRequired: true,
      showExpiryDate: true,
      expiryLabel: 'Valid Upto / Expiry Date',
      expiryShortLabel: 'Valid Upto',
      expiryRequired: true,
      expiryHelper: 'Mandatory — usually 9 months from Date of Test',
      autoSuggestExpiryMonths: 9,
      showWarrantyField: false,
    },
    placeholders: {
      productName: 'e.g. Hybrid Maize / Cotton BG-II',
      companyName: 'e.g. Mahyco, Nuziveedu, Pioneer',
      tradeName: 'e.g. Pioneer P3396 / Mahyco Bollgard II',
      hsnCode: 'e.g. 12099190',
    },
    packagingVariantsMode: 'standard',
    extraFields: [
      {
        key: 'seed_class',
        label: 'Seed Class',
        type: 'select',
        placeholder: 'Select seed class',
        options: [
          { value: 'Truthfully Labelled (TL)', label: 'Truthfully Labelled (TL)' },
          { value: 'Certified', label: 'Certified' },
          { value: 'Foundation', label: 'Foundation' },
          { value: 'Hybrid', label: 'Hybrid' },
        ],
      },
      {
        key: 'germination_pct',
        label: 'Germination %',
        type: 'text',
        placeholder: 'e.g., Min 85%',
      },
      {
        key: 'genetic_purity_pct',
        label: 'Genetic Purity %',
        type: 'text',
        placeholder: 'e.g., 98%',
      },
    ],
  },

  Micronutrients: {
    id: 'Micronutrients',
    label: 'Micronutrients',
    shortDescription: 'EDTA Chelated, Zinc, Boron & State Grades',
    regulationTag: 'FCO Micronutrients • 12% GST',
    dotClass: 'bg-violet-500',
    badgeClass: 'bg-violet-50 text-violet-800 border border-violet-200',
    accentBgClass: 'bg-violet-50/60 border-violet-200',
    allowedUnits: ['Grams', 'Kg', 'ml', 'Litre'],
    defaultUnit: 'Kg',
    defaultGstRate: 12,
    gstHint: 'HSN 3824 / 3105 • 12% GST (or 5% if FCO notified)',
    hsnPrefixHint: 'HSN: 3824 / 3105',
    batchField: {
      label: 'Batch Number',
      shortLabel: 'Batch',
      placeholder: 'e.g., BATCH-2026-01',
      required: true,
    },
    dateFields: {
      showMfgDate: true,
      mfgLabel: 'Mfg Date',
      mfgRequired: false,
      showExpiryDate: true,
      expiryLabel: 'Expiry Date',
      expiryShortLabel: 'Exp',
      expiryRequired: false,
      showWarrantyField: false,
    },
    placeholders: {
      productName: 'e.g. Chelated Zinc EDTA 12% or Boron 20%',
      companyName: 'e.g. Aries Agro, Multiplex, Mahadhan',
      tradeName: 'e.g. Chelamin Gold / Multiplex Kranti',
      hsnCode: 'e.g. 38249900',
    },
    packagingVariantsMode: 'standard',
    extraFields: [
      {
        key: 'chelation_grade',
        label: 'Chelation / Grade',
        type: 'text',
        placeholder: 'e.g., EDTA Chelated, Sulphate, Boron 20%, State Grade-I',
        quickChips: ['EDTA Chelated', 'Sulphate', 'Boron 20%', 'State Grade-I', 'State Grade-II'],
      },
    ],
  },

  'Bio-Fertilizer': {
    id: 'Bio-Fertilizer',
    label: 'Bio-Fertilizer',
    shortDescription: 'Liquid & Powder Microbial Consortia',
    regulationTag: 'FCO Bio-Fertilizers • 5% GST',
    dotClass: 'bg-teal-500',
    badgeClass: 'bg-teal-50 text-teal-800 border border-teal-200',
    accentBgClass: 'bg-teal-50/60 border-teal-200',
    allowedUnits: ['Grams', 'Kg', 'ml', 'Litre'],
    defaultUnit: 'Litre',
    defaultGstRate: 5,
    gstHint: 'HSN 3101 / 3002 • 5% GST (or 0% if unbranded organic)',
    hsnPrefixHint: 'HSN: 3101 / 3002',
    batchField: {
      label: 'Batch Number',
      shortLabel: 'Batch',
      placeholder: 'e.g., BATCH-2026-01',
      required: true,
    },
    dateFields: {
      showMfgDate: true,
      mfgLabel: 'Mfg Date',
      mfgRequired: true,
      showExpiryDate: true,
      expiryLabel: 'Expiry Date',
      expiryShortLabel: 'Exp',
      expiryRequired: true,
      expiryHelper: 'Mandatory — short shelf life (typically 6–12 months)',
      autoSuggestExpiryMonths: 12,
      showWarrantyField: false,
    },
    placeholders: {
      productName: 'e.g. Azotobacter / PSB / Rhizobium Liquid',
      companyName: 'e.g. IFFCO, IPL Biologicals, T. Stanes',
      tradeName: 'e.g. IFFCO Bio NPK / Symbion-P',
      hsnCode: 'e.g. 31010099',
    },
    packagingVariantsMode: 'standard',
    extraFields: [
      {
        key: 'cfu_count',
        label: 'CFU Count / Viable Cell Count',
        type: 'text',
        placeholder: 'e.g., 1x10^8 CFU/ml',
        quickChips: ['1x10^8 CFU/ml', '5x10^7 CFU/g', '1x10^9 CFU/ml'],
      },
      {
        key: 'carrier_base',
        label: 'Carrier Base',
        type: 'select',
        placeholder: 'Select carrier base',
        options: [
          { value: 'Liquid', label: 'Liquid' },
          { value: 'Powder/Peat', label: 'Powder / Peat' },
        ],
      },
    ],
  },

  Organic: {
    id: 'Organic',
    label: 'Organic',
    shortDescription: 'Manure, Vermicompost & Neem Cake',
    regulationTag: 'Organic / NPOP • 0% / 5% GST',
    dotClass: 'bg-lime-600',
    badgeClass: 'bg-lime-50 text-lime-900 border border-lime-200',
    accentBgClass: 'bg-lime-50/70 border-lime-200',
    allowedUnits: ['Kg', 'Bags', 'Tons', 'Litre'],
    defaultUnit: 'Bags',
    defaultGstRate: 0,
    gstHint: 'HSN 3101 • 0% (Unbranded) / 5% (Branded)',
    hsnPrefixHint: 'HSN: 3101',
    batchField: {
      label: 'Batch / Lot Number',
      shortLabel: 'Batch/Lot',
      placeholder: 'e.g., BATCH-2026-01',
      required: false,
    },
    dateFields: {
      showMfgDate: true,
      mfgLabel: 'Mfg / Packing Date',
      mfgRequired: false,
      showExpiryDate: true,
      expiryLabel: 'Expiry Date (Optional)',
      expiryShortLabel: 'Exp',
      expiryRequired: false,
      expiryHelper: 'Optional for dry compost, vermicompost & neem cake',
      showWarrantyField: false,
    },
    placeholders: {
      productName: 'e.g. Vermicompost / Neem Cake / City Compost',
      companyName: 'e.g. Coromandel, Godrej Agrovet, Local FPO',
      tradeName: 'e.g. Godavari Gold Organic Manure',
      hsnCode: 'e.g. 31010099',
    },
    packagingVariantsMode: 'standard',
    extraFields: [
      {
        key: 'organic_certification',
        label: 'Organic Certification',
        type: 'select',
        placeholder: 'Select certification',
        options: [
          { value: 'NPOP', label: 'NPOP Certified' },
          { value: 'PGS-India', label: 'PGS-India' },
          { value: 'None', label: 'None / Uncertified' },
        ],
      },
      {
        key: 'moisture_pct',
        label: 'Moisture %',
        type: 'text',
        placeholder: 'e.g., Max 25%',
      },
    ],
  },

  Others: {
    id: 'Others',
    label: 'Others',
    shortDescription: 'Sprayers, Tarpaulins, Mulch Film & Tools',
    regulationTag: 'Agri Implements • 12% / 18% GST',
    dotClass: 'bg-slate-500',
    badgeClass: 'bg-slate-100 text-slate-800 border border-slate-300',
    accentBgClass: 'bg-slate-50 border-slate-200',
    allowedUnits: ['Pieces', 'Nos', 'Sets', 'Meters', 'Rolls'],
    defaultUnit: 'Pieces',
    defaultGstRate: 18,
    gstHint: 'HSN 8424 (Sprayers) / 3920 (Mulch) • 12% or 18% GST',
    hsnPrefixHint: 'HSN: 8424 / 3920',
    batchField: {
      label: 'Model / Serial Number',
      shortLabel: 'Model/SN',
      placeholder: 'e.g., MOD-500X',
      required: false,
    },
    dateFields: {
      showMfgDate: false,
      mfgLabel: 'Mfg Date',
      mfgRequired: false,
      showExpiryDate: false,
      expiryLabel: 'Warranty Period',
      expiryShortLabel: 'Warranty',
      expiryRequired: false,
      showWarrantyField: true,
    },
    placeholders: {
      productName: 'e.g. Battery Knapsack Sprayer 16L / Mulch Film',
      companyName: 'e.g. Aspee, Neptune, KisanKraft',
      tradeName: 'e.g. KisanKraft KK-BBS-199',
      hsnCode: 'e.g. 84248200',
    },
    packagingVariantsMode: 'optional_collapsed',
    extraFields: [
      {
        key: 'sku_model_code',
        label: 'SKU / Model Code',
        type: 'text',
        placeholder: 'e.g., KK-BBS-199 / MULCH-30MIC',
      },
      {
        key: 'warranty_terms',
        label: 'Warranty / Guarantee',
        type: 'text',
        placeholder: 'e.g., 12 Months Motor & Battery Replacement',
      },
    ],
  },
};

export const INVENTORY_CATEGORIES: InventoryCategoryId[] = [
  'Fertilizer',
  'Pesticide',
  'Seeds',
  'Micronutrients',
  'Bio-Fertilizer',
  'Organic',
  'Others',
];

const UNIT_ALIAS_MAP: Record<string, string> = {
  ml: 'ml',
  l: 'Litre',
  ltr: 'Litre',
  liter: 'Litre',
  liters: 'Litre',
  litre: 'Litre',
  litres: 'Litre',
  g: 'Grams',
  gm: 'Grams',
  gms: 'Grams',
  gram: 'Grams',
  grams: 'Grams',
  kg: 'Kg',
  kgs: 'Kg',
  bag: 'Bags',
  bags: 'Bags',
  packet: 'Packets',
  packets: 'Packets',
  pouch: 'Pouches',
  pouches: 'Pouches',
  ton: 'Tons',
  tons: 'Tons',
  bottle: 'Bottles',
  bottles: 'Bottles',
  pc: 'Pieces',
  pcs: 'Pieces',
  piece: 'Pieces',
  pieces: 'Pieces',
  no: 'Nos',
  nos: 'Nos',
  set: 'Sets',
  sets: 'Sets',
  meter: 'Meters',
  meters: 'Meters',
  roll: 'Rolls',
  rolls: 'Rolls',
};

export function normalizeCategory(raw?: string | null): InventoryCategoryId {
  if (!raw) return 'Fertilizer';
  const target = raw.trim().toLowerCase();
  const matched = INVENTORY_CATEGORIES.find((c) => c.toLowerCase() === target);
  return matched || 'Fertilizer';
}

export function normalizeUnit(raw?: string | null): string {
  if (!raw) return 'Bags';
  const cleaned = raw.trim();
  return UNIT_ALIAS_MAP[cleaned.toLowerCase()] || cleaned;
}

export function getCategoryConfig(category?: string | null): CategoryRuleConfig {
  return INVENTORY_CATEGORY_CONFIGS[normalizeCategory(category)];
}

/**
 * Smart Unit Filtering for Packaging & Size Variants:
 * - Grams / Kg -> weight units only (Grams, Kg)
 * - ml / Litre -> volume units only (ml, Litre)
 * - Bags / Tons -> weight/pack units (Kg, Grams, Bags)
 * - Packets / Pouches -> seed pack units (Grams, Kg, Packets, Pouches)
 * - Others (Pieces / Nos / Sets / Meters / Rolls) -> primary unit + category units
 */
export function getAllowedVariantUnits(primaryUnit?: string | null, category?: string | null): string[] {
  const normalized = normalizeUnit(primaryUnit);
  if (normalized === 'Grams' || normalized === 'Kg') {
    return ['Grams', 'Kg'];
  }
  if (normalized === 'ml' || normalized === 'Litre') {
    return ['ml', 'Litre'];
  }
  if (normalized === 'Bags' || normalized === 'Tons') {
    return ['Kg', 'Grams', 'Bags'];
  }
  if (normalized === 'Packets' || normalized === 'Pouches') {
    return ['Grams', 'Kg', 'Packets', 'Pouches'];
  }
  const catConfig = getCategoryConfig(category);
  if (catConfig.allowedUnits.includes(normalized)) {
    return catConfig.allowedUnits;
  }
  return [normalized];
}

export function addMonthsToDateString(isoDate: string, months: number): string {
  if (!isoDate) return '';
  const parts = isoDate.split('-').map((p) => Number.parseInt(p, 10));
  if (parts.length < 2 || parts.some((n) => Number.isNaN(n))) return '';
  const year = parts[0];
  const monthIndex = parts[1] - 1;
  const day = parts[2] || 1;
  const d = new Date(year, monthIndex + months, day);
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export interface AttributeSummaryBadge {
  label: string;
  toneClass: string;
}

export function getCategoryAttributeBadges(
  category?: string | null,
  attrs?: Record<string, string | number | boolean | undefined> | null
): AttributeSummaryBadge[] {
  if (!attrs) return [];
  const cat = normalizeCategory(category);
  const badges: AttributeSummaryBadge[] = [];

  if (cat === 'Fertilizer') {
    if (attrs.npk_grade) {
      badges.push({ label: `NPK: ${attrs.npk_grade}`, toneClass: 'bg-emerald-50 text-emerald-800 border-emerald-200' });
    }
    if (attrs.subsidy_type) {
      badges.push({ label: String(attrs.subsidy_type), toneClass: 'bg-blue-50 text-blue-800 border-blue-200' });
    }
  } else if (cat === 'Pesticide') {
    if (attrs.formulation_type) {
      badges.push({ label: String(attrs.formulation_type), toneClass: 'bg-slate-100 text-slate-700 border-slate-200' });
    }
    if (attrs.toxicity_color) {
      const tox = String(attrs.toxicity_color);
      let toneClass = 'bg-emerald-50 text-emerald-800 border-emerald-300';
      if (tox === 'Red') toneClass = 'bg-red-100 text-red-800 border-red-300';
      else if (tox === 'Yellow') toneClass = 'bg-amber-100 text-amber-900 border-amber-300';
      else if (tox === 'Blue') toneClass = 'bg-blue-100 text-blue-800 border-blue-300';
      badges.push({ label: `${tox} Toxic`, toneClass });
    }
    if (attrs.cib_registration_no) {
      badges.push({ label: `CIB: ${attrs.cib_registration_no}`, toneClass: 'bg-rose-50 text-rose-800 border-rose-200' });
    }
  } else if (cat === 'Seeds') {
    if (attrs.seed_class) {
      badges.push({ label: String(attrs.seed_class), toneClass: 'bg-amber-50 text-amber-900 border-amber-200' });
    }
    if (attrs.germination_pct) {
      badges.push({ label: `Germ: ${attrs.germination_pct}`, toneClass: 'bg-emerald-50 text-emerald-800 border-emerald-200' });
    }
    if (attrs.genetic_purity_pct) {
      badges.push({ label: `Purity: ${attrs.genetic_purity_pct}`, toneClass: 'bg-slate-100 text-slate-700 border-slate-200' });
    }
  } else if (cat === 'Micronutrients') {
    if (attrs.chelation_grade) {
      badges.push({ label: String(attrs.chelation_grade), toneClass: 'bg-violet-50 text-violet-800 border-violet-200' });
    }
  } else if (cat === 'Bio-Fertilizer') {
    if (attrs.carrier_base) {
      badges.push({ label: String(attrs.carrier_base), toneClass: 'bg-teal-50 text-teal-800 border-teal-200' });
    }
    if (attrs.cfu_count) {
      badges.push({ label: String(attrs.cfu_count), toneClass: 'bg-slate-100 text-slate-700 border-slate-200' });
    }
  } else if (cat === 'Organic') {
    if (attrs.organic_certification && attrs.organic_certification !== 'None') {
      badges.push({ label: String(attrs.organic_certification), toneClass: 'bg-lime-50 text-lime-900 border-lime-200' });
    }
    if (attrs.moisture_pct) {
      badges.push({ label: `Moisture: ${attrs.moisture_pct}`, toneClass: 'bg-slate-100 text-slate-700 border-slate-200' });
    }
  } else if (cat === 'Others') {
    if (attrs.sku_model_code) {
      badges.push({ label: `SKU: ${attrs.sku_model_code}`, toneClass: 'bg-slate-100 text-slate-800 border-slate-300' });
    }
    if (attrs.warranty_months) {
      badges.push({ label: `${attrs.warranty_months}M Warranty`, toneClass: 'bg-indigo-50 text-indigo-800 border-indigo-200' });
    }
  }

  return badges;
}
