export const INVENTORY_PAGE_SIZE = 50;
/** Backend hard cap for GET /api/products `limit`. */
export const MAX_PRODUCTS_LIMIT = 500;

type HeaderBag = Record<string, unknown> | { get?: (name: string) => unknown } | null | undefined;

function readHeader(headers: HeaderBag, name: string): unknown {
  if (!headers) return undefined;
  const maybeGetter = (headers as { get?: unknown }).get;
  if (typeof maybeGetter === 'function') {
    const viaGetter = (maybeGetter as (n: string) => unknown).call(headers, name);
    if (viaGetter !== undefined && viaGetter !== null) return viaGetter;
  }
  const bag = headers as Record<string, unknown>;
  const key = Object.keys(bag).find((k) => k.toLowerCase() === name.toLowerCase());
  return key === undefined ? undefined : bag[key];
}

/** Parse the `X-Total-Count` response header, falling back to `fallback` when absent/invalid. */
export function parseTotalCount(headers: HeaderBag, fallback: number): number {
  const raw = readHeader(headers, 'x-total-count');
  const parsed = Number.parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

export function getTotalPages(total: number, pageSize: number): number {
  if (!Number.isFinite(total) || total <= 0 || pageSize <= 0) return 1;
  return Math.max(1, Math.ceil(total / pageSize));
}

/** Clamp a 1-based page number into [1, totalPages]. */
export function clampPage(page: number, total: number, pageSize: number): number {
  if (!Number.isFinite(page)) return 1;
  return Math.min(Math.max(1, Math.trunc(page)), getTotalPages(total, pageSize));
}

/** 1-based inclusive row range for the "Showing X–Y of Z" label. */
export function getPageRange(page: number, total: number, pageSize: number): { start: number; end: number } {
  if (total <= 0) return { start: 0, end: 0 };
  const safePage = clampPage(page, total, pageSize);
  const start = (safePage - 1) * pageSize + 1;
  return { start, end: Math.min(total, start + pageSize - 1) };
}
