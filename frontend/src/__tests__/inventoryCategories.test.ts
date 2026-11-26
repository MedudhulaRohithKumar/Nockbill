import {
  INVENTORY_CATEGORIES,
  getCategoryConfig,
  getAllowedVariantUnits,
  normalizeCategory,
  normalizeUnit,
  addMonthsToDateString,
  getCategoryAttributeBadges,
  sortBatchesByCategoryRule,
} from '../config/inventoryCategories';

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertArrayEqual(actual: string[], expected: string[], message: string): void {
  if (actual.length !== expected.length || actual.some((v, i) => v !== expected[i])) {
    throw new Error(`${message}: expected [${expected.join(', ')}], got [${actual.join(', ')}]`);
  }
}

export function runInventoryCategoryTests(): number {
  let passed = 0;

  // 1. All 8 regulatory categories defined (including Microgreens)
  assertArrayEqual(
    INVENTORY_CATEGORIES,
    ['Fertilizer', 'Pesticide', 'Seeds', 'Micronutrients', 'Bio-Fertilizer', 'Microgreens', 'Organic', 'Others'],
    'All 8 agri categories present'
  );
  passed += 1;

  // 2. Category normalization (case-insensitive legacy Bio-fertilizer & Microgreens)
  assertEqual(normalizeCategory('Bio-fertilizer'), 'Bio-Fertilizer', 'Normalize Bio-fertilizer');
  assertEqual(normalizeCategory('microgreens'), 'Microgreens', 'Normalize lowercase microgreens');
  assertEqual(normalizeCategory('microgreen'), 'Microgreens', 'Normalize singular microgreen');
  assertEqual(normalizeCategory('seeds'), 'Seeds', 'Normalize lowercase seeds');
  assertEqual(normalizeCategory(undefined), 'Fertilizer', 'Fallback undefined to Fertilizer');
  passed += 5;

  // 3. Allowed Primary Units, Default GST % & Batch Rotation Rules per category
  const fert = getCategoryConfig('Fertilizer');
  assertArrayEqual(fert.allowedUnits, ['Kg', 'Grams', 'Litre', 'ml', 'Bags'], 'Fertilizer units');
  assertEqual(fert.defaultGstRate, 5, 'Fertilizer GST 5%');
  assertEqual(fert.dateFields.expiryRequired, false, 'Fertilizer expiry optional');

  const pest = getCategoryConfig('Pesticide');
  assertArrayEqual(pest.allowedUnits, ['ml', 'Litre', 'Grams', 'Kg'], 'Pesticide units');
  assertEqual(pest.defaultGstRate, 18, 'Pesticide GST 18%');
  assertEqual(pest.batchRotation, 'FEFO', 'Pesticide uses FEFO');
  assertEqual(pest.batchField.required, true, 'Pesticide batch mandatory');
  assertEqual(pest.dateFields.mfgRequired, true, 'Pesticide mfg mandatory');
  assertEqual(pest.dateFields.expiryRequired, true, 'Pesticide expiry mandatory');

  const seeds = getCategoryConfig('Seeds');
  assertArrayEqual(seeds.allowedUnits, ['Grams', 'Kg', 'Packets', 'Pouches'], 'Seeds units');
  assertEqual(seeds.defaultGstRate, 0, 'Seeds GST 0% exempt');
  assertEqual(seeds.batchRotation, 'FEFO', 'Seeds uses FEFO');
  assertEqual(seeds.batchField.label, 'Lot Number', 'Seeds lot label');
  assertEqual(seeds.dateFields.mfgLabel, 'Date of Test', 'Seeds Date of Test label');
  assertEqual(seeds.dateFields.expiryRequired, true, 'Seeds Valid Upto mandatory');

  const micro = getCategoryConfig('Micronutrients');
  assertArrayEqual(micro.allowedUnits, ['Grams', 'Kg', 'ml', 'Litre'], 'Micronutrients units');
  assertEqual(micro.defaultGstRate, 12, 'Micronutrients GST 12%');
  assertEqual(micro.batchRotation, 'FEFO', 'Micronutrients uses FEFO');
  assertEqual(micro.batchField.required, true, 'Micronutrients batch mandatory');

  const bio = getCategoryConfig('Bio-Fertilizer');
  assertArrayEqual(bio.allowedUnits, ['Grams', 'Kg', 'ml', 'Litre'], 'Bio-Fertilizer units');
  assertEqual(bio.defaultGstRate, 5, 'Bio-Fertilizer GST 5%');
  assertEqual(bio.batchRotation, 'FEFO', 'Bio-Fertilizer uses FEFO');
  assertEqual(bio.dateFields.mfgRequired, true, 'Bio-Fertilizer mfg mandatory');
  assertEqual(bio.dateFields.expiryRequired, true, 'Bio-Fertilizer expiry mandatory');

  const microgreens = getCategoryConfig('Microgreens');
  assertArrayEqual(microgreens.allowedUnits, ['Grams', 'Kg', 'Packets', 'Punnets', 'Trays'], 'Microgreens units');
  assertEqual(microgreens.defaultGstRate, 5, 'Microgreens GST 5%');
  assertEqual(microgreens.batchRotation, 'FEFO', 'Microgreens uses FEFO');
  assertEqual(microgreens.dateFields.expiryRequired, true, 'Microgreens expiry mandatory');

  const org = getCategoryConfig('Organic');
  assertArrayEqual(org.allowedUnits, ['Kg', 'Bags', 'Tons', 'Litre'], 'Organic units');
  assertEqual(org.defaultGstRate, 0, 'Organic default GST 0%');
  assertEqual(org.dateFields.expiryRequired, false, 'Organic expiry optional');

  const others = getCategoryConfig('Others');
  assertArrayEqual(others.allowedUnits, ['Pieces', 'Nos', 'Sets', 'Meters', 'Rolls'], 'Others units');
  assertEqual(others.defaultGstRate, 0, 'Others GST 0%');
  assertEqual(others.batchRotation, 'FIFO', 'Others uses strict FIFO');
  assertEqual(others.batchField.label, 'Model / Serial Number', 'Others serial/model label');
  assertEqual(others.dateFields.showExpiryDate, false, 'Others hides expiry date');
  assertEqual(others.dateFields.showWarrantyField, true, 'Others shows warranty field');
  assertEqual(others.packagingVariantsMode, 'optional_collapsed', 'Others collapses packaging variants');
  passed += 36;

  // 4. Smart unit filtering for Packaging & Size Variants
  assertArrayEqual(getAllowedVariantUnits('Kg', 'Fertilizer'), ['Grams', 'Kg'], 'Kg -> weight variants only');
  assertArrayEqual(getAllowedVariantUnits('Grams', 'Pesticide'), ['Grams', 'Kg'], 'Grams -> weight variants only');
  assertArrayEqual(getAllowedVariantUnits('ml', 'Pesticide'), ['ml', 'Litre'], 'ml -> volume variants only');
  assertArrayEqual(getAllowedVariantUnits('Litre', 'Bio-Fertilizer'), ['ml', 'Litre'], 'Litre -> volume variants only');
  assertArrayEqual(getAllowedVariantUnits('Litres', 'Bio-Fertilizer'), ['ml', 'Litre'], 'Legacy Litres -> volume variants only');
  assertArrayEqual(getAllowedVariantUnits('Punnets', 'Microgreens'), ['Grams', 'Kg', 'Packets', 'Punnets', 'Trays'], 'Microgreens punnet variants');
  assertEqual(normalizeUnit('pcs'), 'Pieces', 'Legacy pcs -> Pieces');
  assertEqual(normalizeUnit('punnet'), 'Punnets', 'Singular punnet -> Punnets');
  assertEqual(normalizeUnit('tray'), 'Trays', 'Singular tray -> Trays');
  passed += 9;

  // 5. Seeds +9 months validity calculation
  assertEqual(addMonthsToDateString('2026-01-15', 9), '2026-10-15', 'Seeds +9 months validity');
  passed += 1;

  // 6. Category compliance badges
  const pestBadges = getCategoryAttributeBadges('Pesticide', {
    formulation_type: 'SL',
    toxicity_color: 'Red',
    cib_registration_no: 'CIR-991',
  });
  assertEqual(pestBadges.length, 3, 'Pesticide compliance badges count');
  const othersBadges = getCategoryAttributeBadges('Others', {
    sku_model_code: 'KK-16L',
    warranty_months: '12',
  });
  assertEqual(othersBadges.length, 2, 'Others warranty/SKU badges count');
  passed += 2;

  // 7. Category-based FEFO vs FIFO batch selling priority after refill
  const pesticideBatches = [
    { id: 10, product_id: 1, batch_number: 'PEST-LATER', expiry_date: '2028-06', purchase_price: 200, selling_price: 300, mrp: 300, current_stock: 15, is_active: true },
    { id: 25, product_id: 1, batch_number: 'PEST-SOONER', expiry_date: '2027-03', purchase_price: 210, selling_price: 310, mrp: 310, current_stock: 10, is_active: true },
    { id: 5, product_id: 1, batch_number: 'PEST-EXPIRED', expiry_date: '2020-01', purchase_price: 180, selling_price: 280, mrp: 280, current_stock: 4, is_active: true },
  ];
  const sortedPest = sortBatchesByCategoryRule(pesticideBatches, 'Pesticide');
  assertEqual(sortedPest[0].batch_number, 'PEST-SOONER', 'FEFO picks earliest non-expired Pesticide batch first');
  assertEqual(sortedPest[1].batch_number, 'PEST-LATER', 'FEFO places later-expiring Pesticide batch second');
  assertEqual(sortedPest[2].batch_number, 'PEST-EXPIRED', 'FEFO deprioritizes expired Pesticide batch last');

  const othersBatches = [
    { id: 42, product_id: 2, batch_number: 'SPRAYER-NEW', purchase_price: 1200, selling_price: 1500, mrp: 1500, current_stock: 8, is_active: true },
    { id: 11, product_id: 2, batch_number: 'SPRAYER-OLD', purchase_price: 1100, selling_price: 1500, mrp: 1500, current_stock: 3, is_active: true },
  ];
  const sortedOthers = sortBatchesByCategoryRule(othersBatches, 'Others');
  assertEqual(sortedOthers[0].batch_number, 'SPRAYER-OLD', 'FIFO picks oldest inward Others batch first');
  assertEqual(sortedOthers[1].batch_number, 'SPRAYER-NEW', 'FIFO places newly refilled Others batch second');

  const fertNoExpBatches = [
    { id: 99, product_id: 3, batch_number: 'UREA-REFILL', purchase_price: 240, selling_price: 266, mrp: 266, current_stock: 50, is_active: true },
    { id: 12, product_id: 3, batch_number: 'UREA-OPENING', purchase_price: 240, selling_price: 266, mrp: 266, current_stock: 10, is_active: true },
  ];
  const sortedFert = sortBatchesByCategoryRule(fertNoExpBatches, 'Fertilizer');
  assertEqual(sortedFert[0].batch_number, 'UREA-OPENING', 'Non-expiring Fertilizer uses FIFO so opening stock sells before refill');
  passed += 6;

  return passed;
}
