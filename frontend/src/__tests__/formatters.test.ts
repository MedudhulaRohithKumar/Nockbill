import {
  safeNumber,
  safeString,
  formatCurrency,
  formatINR,
  formatCompactINR,
  sanitizeTextInput,
  sanitizeCodeInput,
  sanitizePhoneInput,
  sanitizePincodeInput,
  clampNonNegative,
  isValidPhone,
  isValidPincode,
  isValidIfsc,
  isValidGstin,
  resolveTradeName,
} from '../utils/formatters';

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

export function runFormatterTests(): number {
  let passed = 0;

  // 1. safeNumber & safeString
  assertEqual(safeNumber(null, 5), 5, 'safeNumber null fallback');
  assertEqual(safeNumber(undefined, 7), 7, 'safeNumber undefined fallback');
  assertEqual(safeNumber('not-a-number', 0), 0, 'safeNumber NaN fallback');
  assertEqual(safeNumber('42.5', 0), 42.5, 'safeNumber numeric string');
  assertEqual(safeString(null, 'N/A'), 'N/A', 'safeString null fallback');
  assertEqual(safeString(123), '123', 'safeString number conversion');
  passed += 6;

  // 2. Currency formatting
  assertEqual(formatCurrency(266.5, 2), '266.50', 'formatCurrency 2 decimals');
  assertEqual(formatINR(1000).includes('1,000.00'), true, 'formatINR Indian grouping');
  assertEqual(formatCompactINR(50000), '50,000', 'formatCompactINR below 1 lakh');
  assertEqual(formatCompactINR(245000), '2.45 L', 'formatCompactINR lakh');
  assertEqual(formatCompactINR(12000000), '1.20 Cr', 'formatCompactINR crore');
  passed += 5;

  // 3. Input sanitization & clamping
  assertEqual(
    sanitizeTextInput('  <script>alert(1)</script>IFFCO   Urea  '),
    ' alert(1)IFFCO Urea ',
    'sanitizeTextInput strips HTML tags'
  );
  assertEqual(sanitizeCodeInput('b#2026/01!', 20, true), 'B#2026/01', 'sanitizeCodeInput uppercase');
  assertEqual(sanitizePhoneInput('+91-98765 43210').length, 10, 'sanitizePhoneInput 10 digits');
  assertEqual(sanitizePincodeInput('422-001'), '422001', 'sanitizePincodeInput 6 digits');
  assertEqual(clampNonNegative(-10), 0, 'clampNonNegative negative');
  assertEqual(clampNonNegative(500, 100), 100, 'clampNonNegative max');
  passed += 6;

  // 4. Validators
  assertEqual(isValidPhone('9876543210'), true, 'isValidPhone valid');
  assertEqual(isValidPhone('12345'), false, 'isValidPhone invalid');
  assertEqual(isValidPincode('422001'), true, 'isValidPincode valid');
  assertEqual(isValidPincode('012345'), false, 'isValidPincode invalid');
  assertEqual(isValidIfsc('SBIN0001234'), true, 'isValidIfsc valid');
  assertEqual(isValidIfsc('BADIFSC'), false, 'isValidIfsc invalid');
  assertEqual(isValidGstin('24AABCI1234E1Z0'), true, 'isValidGstin valid');
  passed += 7;

  // 5. Agro-chemical Trade Name resolution
  const bayerImida = resolveTradeName('Imidacloprid 17.8% SL', 'Bayer');
  assertEqual(bayerImida.suggested, 'Confidor', 'resolveTradeName Bayer Imidacloprid');

  const tataImida = resolveTradeName('Imidacloprid 17.8% SL', 'Tata Rallis');
  assertEqual(tataImida.suggested, 'Tatamida', 'resolveTradeName Tata Rallis Imidacloprid');
  passed += 2;

  return passed;
}
