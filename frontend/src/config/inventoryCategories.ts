export type InventoryCategoryId =
  | 'Fertilizer'
  | 'Pesticide'
  | 'Seeds'
  | 'Micronutrients'
  | 'Bio-Fertilizer'
  | 'Microgreens'
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

export interface CategoryPackPreset {
  label: string;
  size: number;
  unit: string;
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
  batchRotation: 'FEFO' | 'FIFO';
  rotationRuleLabel: string;
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
  packPresets: CategoryPackPreset[];
  extraFields: CategoryExtraFieldDef[];
}

export const INVENTORY_CATEGORY_CONFIGS: Record<InventoryCategoryId, CategoryRuleConfig> = {
  Fertilizer: {
    id: 'Fertilizer',
    label: 'Fertilizer',
    shortDescription: 'Urea, DAP, NPK, Potash & Straight Fertilizers',
    regulationTag: 'FCO 1985 • 5% GST',
    dotClass: 'bg-emerald-500',
    badgeClass:
      'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800/70',
    accentBgClass:
      'bg-emerald-50/70 border-emerald-200 dark:bg-slate-800/80 dark:border-emerald-800/50',
    allowedUnits: ['Kg', 'Grams', 'Litre', 'ml', 'Bags'],
    defaultUnit: 'Bags',
    defaultGstRate: 5,
    gstHint: 'HSN 3101–3105 • Category 5% GST',
    hsnPrefixHint: 'HSN: 3101–3105',
    batchRotation: 'FIFO',
    rotationRuleLabel:
      'FIFO / FEFO — Expiring batches sell first; non-expiring bags sell oldest stock first before refilled stock',
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
    packPresets: [
      { label: '1 Kg Pouch', size: 1, unit: 'Kg' },
      { label: '5 Kg Pack', size: 5, unit: 'Kg' },
      { label: '25 Kg Bag', size: 25, unit: 'Kg' },
      { label: '45 Kg Bag', size: 45, unit: 'Kg' },
      { label: '50 Kg Bag', size: 50, unit: 'Kg' },
    ],
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
    badgeClass:
      'bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800/70',
    accentBgClass:
      'bg-rose-50/60 border-rose-200 dark:bg-slate-800/80 dark:border-rose-800/50',
    allowedUnits: ['ml', 'Litre', 'Grams', 'Kg'],
    defaultUnit: 'ml',
    defaultGstRate: 18,
    gstHint: 'HSN 3808 • Category 18% GST',
    hsnPrefixHint: 'HSN: 3808',
    batchRotation: 'FEFO',
    rotationRuleLabel: 'Strict FEFO — Batch with earliest valid Expiry Date sells first',
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
    packPresets: [
      { label: '100 ml Bottle', size: 100, unit: 'ml' },
      { label: '250 ml Bottle', size: 250, unit: 'ml' },
      { label: '500 ml Bottle', size: 500, unit: 'ml' },
      { label: '1 Litre Can', size: 1, unit: 'Litre' },
    ],
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
    badgeClass:
      'bg-amber-50 text-amber-900 border border-amber-200 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800/70',
    accentBgClass:
      'bg-amber-50/70 border-amber-200 dark:bg-slate-800/80 dark:border-amber-800/50',
    allowedUnits: ['Grams', 'Kg', 'Packets', 'Pouches'],
    defaultUnit: 'Packets',
    defaultGstRate: 0,
    gstHint: 'HSN 1209 / 1001–1008 • Category 0% GST (Exempt)',
    hsnPrefixHint: 'HSN: 1209 / 1001–1008',
    batchRotation: 'FEFO',
    rotationRuleLabel: 'Strict FEFO — Seed Lot with earliest Valid Upto date sells first',
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
    packPresets: [
      { label: '50 g Packet', size: 50, unit: 'Grams' },
      { label: '100 g Packet', size: 100, unit: 'Grams' },
      { label: '450 g Packet', size: 450, unit: 'Grams' },
      { label: '1 Kg Pouch', size: 1, unit: 'Kg' },
    ],
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
    badgeClass:
      'bg-violet-50 text-violet-800 border border-violet-200 dark:bg-violet-950/70 dark:text-violet-300 dark:border-violet-800/70',
    accentBgClass:
      'bg-violet-50/60 border-violet-200 dark:bg-slate-800/80 dark:border-violet-800/50',
    allowedUnits: ['Grams', 'Kg', 'ml', 'Litre'],
    defaultUnit: 'Kg',
    defaultGstRate: 12,
    gstHint: 'HSN 3824 / 3105 • Category 12% GST',
    hsnPrefixHint: 'HSN: 3824 / 3105',
    batchRotation: 'FEFO',
    rotationRuleLabel: 'FEFO — Earliest expiring nutrient batch sells first',
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
    packPresets: [
      { label: '100 g Pouch', size: 100, unit: 'Grams' },
      { label: '250 g Pouch', size: 250, unit: 'Grams' },
      { label: '500 g Pack', size: 500, unit: 'Grams' },
      { label: '1 Kg Pack', size: 1, unit: 'Kg' },
    ],
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
    badgeClass:
      'bg-teal-50 text-teal-800 border border-teal-200 dark:bg-teal-950/70 dark:text-teal-300 dark:border-teal-800/70',
    accentBgClass:
      'bg-teal-50/60 border-teal-200 dark:bg-slate-800/80 dark:border-teal-800/50',
    allowedUnits: ['Grams', 'Kg', 'ml', 'Litre'],
    defaultUnit: 'Litre',
    defaultGstRate: 5,
    gstHint: 'HSN 3101 / 3002 • Category 5% GST',
    hsnPrefixHint: 'HSN: 3101 / 3002',
    batchRotation: 'FEFO',
    rotationRuleLabel: 'Strict FEFO — Live microbial batch with earliest Expiry Date sells first',
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
    packPresets: [
      { label: '250 ml Bottle', size: 250, unit: 'ml' },
      { label: '500 ml Bottle', size: 500, unit: 'ml' },
      { label: '1 Litre Bottle', size: 1, unit: 'Litre' },
    ],
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

  Microgreens: {
    id: 'Microgreens',
    label: 'Microgreens',
    shortDescription: 'Fresh Microgreen Trays, Punnets & Grow Kits',
    regulationTag: 'Specialty Greens • 5% GST',
    dotClass: 'bg-green-500',
    badgeClass:
      'bg-green-50 text-green-800 border border-green-200 dark:bg-green-950/70 dark:text-green-300 dark:border-green-800/70',
    accentBgClass:
      'bg-green-50/60 border-green-200 dark:bg-slate-800/80 dark:border-green-800/50',
    allowedUnits: ['Grams', 'Kg', 'Packets', 'Punnets', 'Trays'],
    defaultUnit: 'Punnets',
    defaultGstRate: 5,
    gstHint: 'HSN 0709 / 1209 • Category 5% GST',
    hsnPrefixHint: 'HSN: 0709 / 1209',
    batchRotation: 'FEFO',
    rotationRuleLabel: 'Strict FEFO — Harvest / pack lot with earliest Best-Before date sells first',
    batchField: {
      label: 'Harvest / Batch Lot',
      shortLabel: 'Lot',
      placeholder: 'e.g., MG-LOT-2611',
      required: true,
    },
    dateFields: {
      showMfgDate: true,
      mfgLabel: 'Harvest / Pack Date',
      mfgRequired: false,
      showExpiryDate: true,
      expiryLabel: 'Best Before / Expiry Date',
      expiryShortLabel: 'Best Before',
      expiryRequired: true,
      expiryHelper: 'Perishable greens — earliest Best-Before harvest lot auto-sells first (FEFO)',
      showWarrantyField: false,
    },
    placeholders: {
      productName: 'e.g. Sunflower / Radish / Broccoli Microgreens',
      companyName: 'e.g. NockBill Hydroponics, Urban Kisan',
      tradeName: 'e.g. Fresh Broccoli Microgreens Punnet',
      hsnCode: 'e.g. 07099990',
    },
    packagingVariantsMode: 'standard',
    packPresets: [
      { label: '50 g Punnet', size: 50, unit: 'Grams' },
      { label: '100 g Punnet', size: 100, unit: 'Grams' },
      { label: '250 g Pack', size: 250, unit: 'Grams' },
      { label: '1 Live Tray', size: 1, unit: 'Trays' },
    ],
    extraFields: [
      {
        key: 'crop_variety',
        label: 'Microgreen Variety',
        type: 'text',
        placeholder: 'e.g., Sunflower, Radish Pink, Pea Shoots, Broccoli',
        quickChips: ['Sunflower', 'Radish', 'Pea Shoots', 'Broccoli', 'Mustard', 'Wheatgrass'],
      },
      {
        key: 'growing_medium',
        label: 'Pack / Grow Format',
        type: 'select',
        placeholder: 'Select format',
        options: [
          { value: 'Cut Punnet', label: 'Fresh Cut Clamshell Punnet' },
          { value: 'Live Coco Tray', label: 'Live Coco-Peat Grow Tray' },
          { value: 'Hydroponic Mat', label: 'Hydroponic Hemp / Jute Mat' },
          { value: 'Grow Kit', label: 'DIY Seed & Coco Grow Kit' },
        ],
      },
    ],
  },

  Organic: {
    id: 'Organic',
    label: 'Organic',
    shortDescription: 'Manure, Vermicompost & Neem Cake',
    regulationTag: 'Organic / NPOP • 0% GST',
    dotClass: 'bg-lime-600',
    badgeClass:
      'bg-lime-50 text-lime-900 border border-lime-200 dark:bg-lime-950/70 dark:text-lime-300 dark:border-lime-800/70',
    accentBgClass:
      'bg-lime-50/70 border-lime-200 dark:bg-slate-800/80 dark:border-lime-800/50',
    allowedUnits: ['Kg', 'Bags', 'Tons', 'Litre'],
    defaultUnit: 'Bags',
    defaultGstRate: 0,
    gstHint: 'HSN 3101 • Category 0% GST',
    hsnPrefixHint: 'HSN: 3101',
    batchRotation: 'FIFO',
    rotationRuleLabel: 'FIFO / FEFO — Expiring lots sell first; dry compost bags sell oldest stock first',
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
    packPresets: [
      { label: '5 Kg Pouch', size: 5, unit: 'Kg' },
      { label: '25 Kg Bag', size: 25, unit: 'Kg' },
      { label: '50 Kg Bag', size: 50, unit: 'Kg' },
    ],
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
    shortDescription: 'Sprayers, Tarpaulins, Mulch Film & Farm Tools',
    regulationTag: 'Agri Hardware • 0% GST',
    dotClass: 'bg-slate-500',
    badgeClass:
      'bg-slate-100 text-slate-800 border border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
    accentBgClass:
      'bg-slate-50 border-slate-200 dark:bg-slate-800/80 dark:border-slate-700',
    allowedUnits: ['Pieces', 'Nos', 'Sets', 'Meters', 'Rolls'],
    defaultUnit: 'Pieces',
    defaultGstRate: 0,
    gstHint: 'HSN 8201 / 8424 • Category 0% GST',
    hsnPrefixHint: 'HSN: 8201 / 8424',
    batchRotation: 'FIFO',
    rotationRuleLabel: 'Strict FIFO — Existing older inward stock sells first before newly refilled stock',
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
    packPresets: [
      { label: '1 Piece', size: 1, unit: 'Pieces' },
      { label: '1 Set', size: 1, unit: 'Sets' },
      { label: '100 m Roll', size: 100, unit: 'Meters' },
    ],
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
  'Microgreens',
  'Organic',
  'Others',
];

const CATEGORY_ALIAS_MAP: Record<string, InventoryCategoryId> = {
  fertilizer: 'Fertilizer',
  fertilizers: 'Fertilizer',
  pesticide: 'Pesticide',
  pesticides: 'Pesticide',
  seed: 'Seeds',
  seeds: 'Seeds',
  micronutrient: 'Micronutrients',
  micronutrients: 'Micronutrients',
  'bio-fertilizer': 'Bio-Fertilizer',
  biofertilizer: 'Bio-Fertilizer',
  'bio fertilizer': 'Bio-Fertilizer',
  microgreen: 'Microgreens',
  microgreens: 'Microgreens',
  'micro green': 'Microgreens',
  'micro greens': 'Microgreens',
  organic: 'Organic',
  other: 'Others',
  others: 'Others',
};

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
  punnet: 'Punnets',
  punnets: 'Punnets',
  tray: 'Trays',
  trays: 'Trays',
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
  if (CATEGORY_ALIAS_MAP[target]) {
    return CATEGORY_ALIAS_MAP[target];
  }
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
 * - Microgreens -> Grams, Kg, Packets, Punnets, Trays
 * - Grams / Kg -> weight units only (Grams, Kg)
 * - ml / Litre -> volume units only (ml, Litre)
 * - Bags / Tons -> weight/pack units (Kg, Grams, Bags)
 * - Packets / Pouches -> seed pack units (Grams, Kg, Packets, Pouches)
 * - Others (Pieces / Nos / Sets / Meters / Rolls) -> primary unit + category units
 */
export function getAllowedVariantUnits(primaryUnit?: string | null, category?: string | null): string[] {
  const cat = normalizeCategory(category);
  const normalized = normalizeUnit(primaryUnit);
  if (cat === 'Microgreens' && (normalized === 'Punnets' || normalized === 'Trays' || normalized === 'Packets')) {
    return ['Grams', 'Kg', 'Packets', 'Punnets', 'Trays'];
  }
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
  const catConfig = getCategoryConfig(cat);
  if (catConfig.allowedUnits.includes(normalized)) {
    return catConfig.allowedUnits;
  }
  return [normalized];
}

function normalizeExpiryForSort(rawExpiry?: string | null): string {
  const s = (rawExpiry || '').trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}$/.test(s)) return `${s}-28`;
  return s.slice(0, 10);
}

export interface SortableBatchLike {
  id?: number;
  batch_number?: string;
  expiry_date?: string | null;
  current_stock?: number;
  selling_price?: number;
  mrp?: number;
  trade_name?: string | null;
}

/**
 * Category-aware batch selling priority (FEFO vs FIFO):
 * - 'Others' (non-expiring implements/hardware): Strict FIFO (oldest batch id ASC sells first).
 * - Expiry-bearing categories ('Pesticide', 'Seeds', 'Bio-Fertilizer', 'Microgreens', 'Micronutrients',
 *   plus 'Fertilizer' / 'Organic' batches that carry an expiry date):
 *   1) Non-expired batches ahead of already-expired batches;
 *   2) Earliest valid expiry_date sells first (FEFO);
 *   3) Batches without expiry_date fall back to oldest batch id ASC (FIFO).
 */
export function sortBatchesByCategoryRule<T extends SortableBatchLike>(
  batches: T[] | undefined | null,
  category?: string | null,
  todayIso?: string
): T[] {
  if (!batches || batches.length === 0) return [];
  const inStock = batches.filter((b) => (b.current_stock ?? 0) > 0);
  const pool = inStock.length > 0 ? inStock : [...batches];
  const cat = normalizeCategory(category);
  const today = todayIso || new Date().toISOString().slice(0, 10);

  return [...pool].sort((a, b) => {
    const idA = a.id ?? 0;
    const idB = b.id ?? 0;
    if (cat === 'Others') {
      return idA - idB;
    }

    const expA = normalizeExpiryForSort(a.expiry_date);
    const expB = normalizeExpiryForSort(b.expiry_date);
    const hasExpA = expA.length > 0;
    const hasExpB = expB.length > 0;

    if (hasExpA && hasExpB) {
      const expiredA = expA < today ? 1 : 0;
      const expiredB = expB < today ? 1 : 0;
      if (expiredA !== expiredB) return expiredA - expiredB;
      const cmp = expA.localeCompare(expB);
      if (cmp !== 0) return cmp;
      return idA - idB;
    }
    if (hasExpA !== hasExpB) {
      if (hasExpA) return expA < today ? 1 : -1;
      return expB < today ? -1 : 1;
    }
    return idA - idB;
  });
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
      badges.push({
        label: `NPK: ${attrs.npk_grade}`,
        toneClass: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
      });
    }
    if (attrs.subsidy_type) {
      badges.push({
        label: String(attrs.subsidy_type),
        toneClass: 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800',
      });
    }
  } else if (cat === 'Pesticide') {
    if (attrs.formulation_type) {
      badges.push({
        label: String(attrs.formulation_type),
        toneClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
      });
    }
    if (attrs.toxicity_color) {
      const tox = String(attrs.toxicity_color);
      let toneClass = 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800';
      if (tox === 'Red') toneClass = 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800';
      else if (tox === 'Yellow') toneClass = 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800';
      else if (tox === 'Blue') toneClass = 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800';
      badges.push({ label: `${tox} Toxic`, toneClass });
    }
    if (attrs.cib_registration_no) {
      badges.push({
        label: `CIB: ${attrs.cib_registration_no}`,
        toneClass: 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800',
      });
    }
  } else if (cat === 'Seeds') {
    if (attrs.seed_class) {
      badges.push({
        label: String(attrs.seed_class),
        toneClass: 'bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
      });
    }
    if (attrs.germination_pct) {
      badges.push({
        label: `Germ: ${attrs.germination_pct}`,
        toneClass: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
      });
    }
    if (attrs.genetic_purity_pct) {
      badges.push({
        label: `Purity: ${attrs.genetic_purity_pct}`,
        toneClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
      });
    }
  } else if (cat === 'Micronutrients') {
    if (attrs.chelation_grade) {
      badges.push({
        label: String(attrs.chelation_grade),
        toneClass: 'bg-violet-50 text-violet-800 border-violet-200 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-800',
      });
    }
  } else if (cat === 'Bio-Fertilizer') {
    if (attrs.carrier_base) {
      badges.push({
        label: String(attrs.carrier_base),
        toneClass: 'bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800',
      });
    }
    if (attrs.cfu_count) {
      badges.push({
        label: String(attrs.cfu_count),
        toneClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
      });
    }
  } else if (cat === 'Microgreens') {
    if (attrs.crop_variety) {
      badges.push({
        label: String(attrs.crop_variety),
        toneClass: 'bg-green-50 text-green-800 border-green-200 dark:bg-green-950/60 dark:text-green-300 dark:border-green-800',
      });
    }
    if (attrs.growing_medium) {
      badges.push({
        label: String(attrs.growing_medium),
        toneClass: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
      });
    }
  } else if (cat === 'Organic') {
    if (attrs.organic_certification && attrs.organic_certification !== 'None') {
      badges.push({
        label: String(attrs.organic_certification),
        toneClass: 'bg-lime-50 text-lime-900 border-lime-200 dark:bg-lime-950/60 dark:text-lime-300 dark:border-lime-800',
      });
    }
    if (attrs.moisture_pct) {
      badges.push({
        label: `Moisture: ${attrs.moisture_pct}`,
        toneClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
      });
    }
  } else if (cat === 'Others') {
    if (attrs.sku_model_code) {
      badges.push({
        label: `SKU: ${attrs.sku_model_code}`,
        toneClass: 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
      });
    }
    if (attrs.warranty_months) {
      badges.push({
        label: `${attrs.warranty_months}M Warranty`,
        toneClass: 'bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800',
      });
    }
  }

  return badges;
}
