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
