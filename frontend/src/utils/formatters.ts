/**
 * Safe formatting utilities to prevent JavaScript runtime exceptions (TypeError)
 * during render when dealing with optional, null, or string numerical data.
 */

export function safeNumber(val: any, fallback = 0): number {
  if (val === null || val === undefined) return fallback;
  const num = Number(val);
  return isNaN(num) ? fallback : num;
}

export function safeString(val: any, fallback = ''): string {
  if (val === null || val === undefined) return fallback;
  return String(val);
}

export function formatCurrency(val: any, decimals = 2): string {
  const num = safeNumber(val, 0);
  return num.toFixed(decimals);
}

export function formatINR(val: any): string {
  const num = safeNumber(val, 0);
  return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Compact Indian-format currency (without the ₹ symbol) for KPI cards.
 * Amounts below ₹1 lakh are shown in full with Indian digit grouping
 * (e.g. 45,230) so small values are never rounded away. Larger amounts are
 * abbreviated using the Indian system: 2.45 L (lakh), 1.20 Cr (crore).
 */
export function formatCompactINR(val: any): string {
  const num = safeNumber(val, 0);
  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  if (abs >= 1e7) return `${sign}${(abs / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `${sign}${(abs / 1e5).toFixed(2)} L`;
  return num.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}
