import {
  INVENTORY_CATEGORIES,
  getCategoryConfig,
  getAllowedVariantUnits,
  normalizeCategory,
  normalizeUnit,
  addMonthsToDateString,
  getCategoryAttributeBadges,
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

  // 1. All 7 regulatory categories defined
  assertArrayEqual(
    INVENTORY_CATEGORIES,
    ['Fertilizer', 'Pesticide', 'Seeds', 'Micronutrients', 'Bio-Fertilizer', 'Organic', 'Others'],
    'All 7 agri categories present'
  );
  passed += 1;

  // 2. Category normalization (case-insensitive legacy Bio-fertilizer)
  assertEqual(normalizeCategory('Bio-fertilizer'), 'Bio-Fertilizer', 'Normalize Bio-fertilizer');
  assertEqual(normalizeCategory('seeds'), 'Seeds', 'Normalize lowercase seeds');
  assertEqual(normalizeCategory(undefined), 'Fertilizer', 'Fallback undefined to Fertilizer');
  passed += 3;

  // 3. Allowed Primary Units & Default GST % per category
  const fert = getCategoryConfig('Fertilizer');
  assertArrayEqual(fert.allowedUnits, ['Kg', 'Grams', 'Litre', 'ml', 'Bags'], 'Fertilizer units');
  assertEqual(fert.defaultGstRate, 5, 'Fertilizer GST 5%');
  assertEqual(fert.dateFields.expiryRequired, false, 'Fertilizer expiry optional');

  const pest = getCategoryConfig('Pesticide');
  assertArrayEqual(pest.allowedUnits, ['ml', 'Litre', 'Grams', 'Kg'], 'Pesticide units');
  assertEqual(pest.defaultGstRate, 18, 'Pesticide GST 18%');
  assertEqual(pest.batchField.required, true, 'Pesticide batch mandatory');
  assertEqual(pest.dateFields.mfgRequired, true, 'Pesticide mfg mandatory');
  assertEqual(pest.dateFields.expiryRequired, true, 'Pesticide expiry mandatory');

  const seeds = getCategoryConfig('Seeds');
  assertArrayEqual(seeds.allowedUnits, ['Grams', 'Kg', 'Packets', 'Pouches'], 'Seeds units');
  assertEqual(seeds.defaultGstRate, 0, 'Seeds GST 0% exempt');
  assertEqual(seeds.batchField.label, 'Lot Number', 'Seeds lot label');
  assertEqual(seeds.dateFields.mfgLabel, 'Date of Test', 'Seeds Date of Test label');
  assertEqual(seeds.dateFields.expiryRequired, true, 'Seeds Valid Upto mandatory');

  const micro = getCategoryConfig('Micronutrients');
  assertArrayEqual(micro.allowedUnits, ['Grams', 'Kg', 'ml', 'Litre'], 'Micronutrients units');
  assertEqual(micro.defaultGstRate, 12, 'Micronutrients GST 12%');
  assertEqual(micro.batchField.required, true, 'Micronutrients batch mandatory');

  const bio = getCategoryConfig('Bio-Fertilizer');
  assertArrayEqual(bio.allowedUnits, ['Grams', 'Kg', 'ml', 'Litre'], 'Bio-Fertilizer units');
  assertEqual(bio.defaultGstRate, 5, 'Bio-Fertilizer GST 5%');
  assertEqual(bio.dateFields.mfgRequired, true, 'Bio-Fertilizer mfg mandatory');
  assertEqual(bio.dateFields.expiryRequired, true, 'Bio-Fertilizer expiry mandatory');

  const org = getCategoryConfig('Organic');
  assertArrayEqual(org.allowedUnits, ['Kg', 'Bags', 'Tons', 'Litre'], 'Organic units');
  assertEqual(org.defaultGstRate, 0, 'Organic default GST 0%');
  assertEqual(org.dateFields.expiryRequired, false, 'Organic expiry optional');

  const others = getCategoryConfig('Others');
  assertArrayEqual(others.allowedUnits, ['Pieces', 'Nos', 'Sets', 'Meters', 'Rolls'], 'Others units');
  assertEqual(others.batchField.label, 'Model / Serial Number', 'Others serial/model label');
  assertEqual(others.dateFields.showExpiryDate, false, 'Others hides expiry date');
  assertEqual(others.dateFields.showWarrantyField, true, 'Others shows warranty field');
  assertEqual(others.packagingVariantsMode, 'optional_collapsed', 'Others collapses packaging variants');
  passed += 26;

  // 4. Smart unit filtering for Packaging & Size Variants
  assertArrayEqual(getAllowedVariantUnits('Kg', 'Fertilizer'), ['Grams', 'Kg'], 'Kg -> weight variants only');
  assertArrayEqual(getAllowedVariantUnits('Grams', 'Pesticide'), ['Grams', 'Kg'], 'Grams -> weight variants only');
  assertArrayEqual(getAllowedVariantUnits('ml', 'Pesticide'), ['ml', 'Litre'], 'ml -> volume variants only');
  assertArrayEqual(getAllowedVariantUnits('Litre', 'Bio-Fertilizer'), ['ml', 'Litre'], 'Litre -> volume variants only');
  assertArrayEqual(getAllowedVariantUnits('Litres', 'Bio-Fertilizer'), ['ml', 'Litre'], 'Legacy Litres -> volume variants only');
  assertEqual(normalizeUnit('pcs'), 'Pieces', 'Legacy pcs -> Pieces');
  passed += 6;

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

  return passed;
}
