import {
  INVENTORY_PAGE_SIZE,
  MAX_PRODUCTS_LIMIT,
  parseTotalCount,
  getTotalPages,
  clampPage,
  getPageRange,
} from '../utils/pagination';
import {
  CAPTCHA_LENGTH,
  sanitizeCaptchaCode,
  buildRegisterPayload,
  mergeGeneratedCredentials,
  type RegisterFormData,
} from '../utils/registerPayload';
import { filterByAlert, mergeProductsById } from '../utils/inventoryFilters';
import { generateBillIdempotencyKey, mergeProductSearchResults } from '../utils/formatters';
import type { Product } from '../types';

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

export function runSecurityAndPaginationTests(): number {
  let passed = 0;

  // 1. Pagination header parsing (B10)
  assertEqual(INVENTORY_PAGE_SIZE, 50, 'Default inventory page size is 50');
  assertEqual(MAX_PRODUCTS_LIMIT, 500, 'Max products limit is 500');
  assertEqual(parseTotalCount({ 'x-total-count': '312' }, 50), 312, 'Parse lowercase x-total-count');
  assertEqual(parseTotalCount({ 'X-Total-Count': '48' }, 10), 48, 'Parse mixed-case X-Total-Count');
  assertEqual(
    parseTotalCount({ get: (k: string) => (k === 'x-total-count' ? '125' : null) }, 10),
    125,
    'Parse AxiosHeaders-like .get() bag'
  );
  assertEqual(parseTotalCount({}, 17), 17, 'Fallback when X-Total-Count missing');
  assertEqual(parseTotalCount({ 'x-total-count': '-5' }, 12), 12, 'Fallback on negative count');
  assertEqual(parseTotalCount({ 'x-total-count': 'abc' }, 9), 9, 'Fallback on non-numeric count');
  passed += 8;

  // 2. Total pages, clamping & display ranges
  assertEqual(getTotalPages(0, 50), 1, 'Zero total has 1 page');
  assertEqual(getTotalPages(50, 50), 1, 'Exact page size has 1 page');
  assertEqual(getTotalPages(51, 50), 2, '51 items -> 2 pages');
  assertEqual(clampPage(0, 120, 50), 1, 'Clamp below 1 to 1');
  assertEqual(clampPage(99, 120, 50), 3, 'Clamp above max to totalPages');
  assertEqual(clampPage(Number.NaN, 120, 50), 1, 'Clamp NaN to 1');
  const r1 = getPageRange(1, 120, 50);
  assertEqual(r1.start, 1, 'Page 1 start');
  assertEqual(r1.end, 50, 'Page 1 end');
  const r3 = getPageRange(3, 120, 50);
  assertEqual(r3.start, 101, 'Page 3 start');
  assertEqual(r3.end, 120, 'Page 3 end');
  const rEmpty = getPageRange(1, 0, 50);
  assertEqual(rEmpty.start, 0, 'Empty range start');
  assertEqual(rEmpty.end, 0, 'Empty range end');
  passed += 12;

  // 3. Register payload CAPTCHA + client-side password merge (H3 & H5)
  assertEqual(CAPTCHA_LENGTH, 6, 'Captcha length is 6');
  assertEqual(sanitizeCaptchaCode(' ab-12!cd99 '), 'AB12CD', 'Sanitize and clamp CAPTCHA code');

  const form: RegisterFormData = {
    owner_name: 'Kiran Patel',
    username: ' Kiran_Agro ',
    email: ' kiran@example.com ',
    phone: ' 9876543210 ',
    password: 'StrongPassword#123',
    shop_name: ' Patel Krishi Kendra ',
    proprietor_name: '',
    address_line1: ' Main Road ',
    address_line2: '',
    city: ' Pune ',
    state: ' Maharashtra ',
    pincode: ' 411001 ',
    gstin: ' 27abcde1234f1z5 ',
    invoice_prefix: 'pkk',
    fertilizer_license_no: 'FL-101',
    pesticide_license_no: '',
    seed_license_no: '',
    bank_name: '',
    bank_account_no: '',
    bank_ifsc: 'sbin0001234',
    bank_branch: '',
    upi_id: '',
  };

  const payload = buildRegisterPayload(form, 'nonce.12345.sig', 'ab12cd');
  assertEqual(payload.username, 'kiran_agro', 'Username lowercased and trimmed');
  assertEqual(payload.gstin, '27ABCDE1234F1Z5', 'GSTIN uppercased');
  assertEqual(payload.captcha_token, 'nonce.12345.sig', 'CAPTCHA token forwarded');
  assertEqual(payload.captcha_code, 'AB12CD', 'CAPTCHA code uppercased');

  const merged = mergeGeneratedCredentials(
    {
      account_id: 'SHOP-00042',
      shop_name: 'Patel Krishi Kendra',
      owner_name: 'Kiran Patel',
      username: 'kiran_agro',
      email: 'kiran@example.com',
      phone: '9876543210',
      console_login_url: 'https://nockbill.com/login',
      gstin: '27ABCDE1234F1Z5',
      fertilizer_license: 'FL-101',
      created_at: '2026-11-21 12:00:00 UTC',
    },
    form,
    42,
    'https://nockbill.com'
  );
  assertEqual(merged.account_id, 'SHOP-00042', 'Server account_id preserved');
  assertEqual(merged.initial_password, 'StrongPassword#123', 'Typed password merged client-side only');
  passed += 8;

  // 4. Inventory alert filters & deduplication
  const sampleProducts = [
    { id: 1, current_stock: 3, min_stock_level: 10, expiry_date: '2028-01-01' },
    { id: 2, current_stock: 50, min_stock_level: 10, expiry_date: '2026-12-01' },
  ] as unknown as Product[];

  assertEqual(filterByAlert(sampleProducts, 'ALL').length, 2, 'ALL filter keeps all items');
  assertEqual(filterByAlert(sampleProducts, 'LOW_STOCK').length, 1, 'LOW_STOCK selects stock <= min');
  assertEqual(
    filterByAlert(sampleProducts, 'NEAR_EXPIRY', new Date('2026-11-21')).length,
    1,
    'NEAR_EXPIRY selects items expiring within 90 days'
  );
  assertEqual(mergeProductsById([sampleProducts[0]], sampleProducts).length, 2, 'Deduplicates products by id');
  passed += 4;

  // 5. POS Idempotency Key & Server-side Search Merging (SD4 & SD5)
  const k1 = generateBillIdempotencyKey();
  const k2 = generateBillIdempotencyKey();
  assertEqual(k1.startsWith('sale-'), true, 'Idempotency key has sale- prefix');
  assertEqual(k1 !== k2, true, 'Successive idempotency keys are unique');
  const mergedSearch = mergeProductSearchResults(
    [{ id: 1, name: 'A' }, { id: 2, name: 'B' }],
    [{ id: 2, name: 'B-remote' }, { id: 3, name: 'C' }, { id: 4, name: 'D' }],
    3
  );
  assertEqual(mergedSearch.length, 3, 'Merged search respects limit');
  assertEqual(mergedSearch[0].id, 1, 'Local result order preserved');
  assertEqual(mergedSearch[2].id, 3, 'Remote unique results appended after dedup');
  passed += 5;

  return passed;
}
