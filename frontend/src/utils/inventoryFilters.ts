import { Product } from '../types';
import { safeNumber } from './formatters';

export type InventoryAlertFilter = 'ALL' | 'LOW_STOCK' | 'NEAR_EXPIRY';

export const NEAR_EXPIRY_DAYS = 90;

/** Client-side alert filters (low stock / near expiry) applied to an already server-filtered list. */
export function filterByAlert(list: Product[], filterType: InventoryAlertFilter, now: Date = new Date()): Product[] {
  if (filterType === 'LOW_STOCK') {
    return list.filter((p) => safeNumber(p.current_stock) <= safeNumber(p.min_stock_level ?? p.minimum_stock ?? 20));
  }
  if (filterType === 'NEAR_EXPIRY') {
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() + NEAR_EXPIRY_DAYS);
    return list.filter((p) => {
      if (!p.expiry_date) return false;
      const expTime = new Date(p.expiry_date).getTime();
      return !Number.isNaN(expTime) && expTime <= cutoff.getTime();
    });
  }
  return list;
}

/** Merge product lists by id (first occurrence wins). */
export function mergeProductsById(...lists: Product[][]): Product[] {
  const seen = new Set<number>();
  const merged: Product[] = [];
  for (const list of lists) {
    for (const p of list) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        merged.push(p);
      }
    }
  }
  return merged;
}
