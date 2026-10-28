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

// ─── Input Sanitization & Validation Utilities ────────────────────────────────

export function sanitizeTextInput(val: string, maxLength = 200): string {
  if (!val) return '';
  return val
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s{2,}/g, ' ')
    .slice(0, maxLength);
}

export function sanitizeCodeInput(val: string, maxLength = 50, uppercase = false): string {
  if (!val) return '';
  const cleaned = val.replace(/[^A-Za-z0-9\-_./#\s]/g, '').slice(0, maxLength);
  return uppercase ? cleaned.toUpperCase() : cleaned;
}

export function sanitizePhoneInput(val: string): string {
  if (!val) return '';
  return val.replace(/\D/g, '').slice(0, 10);
}

export function sanitizePincodeInput(val: string): string {
  if (!val) return '';
  return val.replace(/\D/g, '').slice(0, 6);
}

export function clampNonNegative(val: any, max = 10000000): number {
  const num = safeNumber(val, 0);
  if (num < 0) return 0;
  if (num > max) return max;
  return num;
}

export function isValidPhone(val?: string): boolean {
  if (!val || !val.trim()) return true; // optional unless required
  const digits = val.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
  return /^[6-9]\d{9}$/.test(digits);
}

export function isValidPincode(val?: string): boolean {
  if (!val || !val.trim()) return true;
  return /^[1-9]\d{5}$/.test(val.trim());
}

export function isValidIfsc(val?: string): boolean {
  if (!val || !val.trim()) return true;
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(val.trim().toUpperCase());
}

export function isValidGstin(val?: string): boolean {
  if (!val || !val.trim()) return true;
  return /^[A-Z0-9\-/]{3,25}$/.test(val.trim().toUpperCase());
}

// ─── Agro-Chemical Trade Name Resolution ((Product, Company) -> Trade Name) ──
// In Company A, Product B is called Trade Name C;
// In Company D, the same Product B is called Trade Name E.

export interface AgroTradeMapping {
  product: string;
  company: string;
  trade_name: string;
}

export const AGRO_TRADE_NAME_CATALOG: AgroTradeMapping[] = [
  // Imidacloprid
  { product: 'Imidacloprid', company: 'Bayer', trade_name: 'Confidor' },
  { product: 'Imidacloprid', company: 'Tata Rallis', trade_name: 'Tatamida' },
  { product: 'Imidacloprid', company: 'Dhanuka', trade_name: 'Media' },
  { product: 'Imidacloprid', company: 'UPL', trade_name: 'Imida' },
  { product: 'Imidacloprid', company: 'Indofil', trade_name: 'Atom' },
  // Chlorantraniliprole
  { product: 'Chlorantraniliprole', company: 'FMC', trade_name: 'Coragen' },
  { product: 'Chlorantraniliprole', company: 'Syngenta', trade_name: 'Voliam Flexi' },
  { product: 'Chlorantraniliprole', company: 'Dhanuka', trade_name: 'Cover' },
  { product: 'Chlorantraniliprole', company: 'Crystal', trade_name: 'Larvigo' },
  // Thiamethoxam
  { product: 'Thiamethoxam', company: 'Syngenta', trade_name: 'Actara' },
  { product: 'Thiamethoxam', company: 'Dhanuka', trade_name: 'Areva' },
  { product: 'Thiamethoxam', company: 'UPL', trade_name: 'Renova' },
  { product: 'Thiamethoxam', company: 'Tata Rallis', trade_name: 'Anant' },
  // Emamectin Benzoate
  { product: 'Emamectin Benzoate', company: 'Syngenta', trade_name: 'Proclaim' },
  { product: 'Emamectin Benzoate', company: 'Dhanuka', trade_name: 'EM-1' },
  { product: 'Emamectin Benzoate', company: 'Crystal', trade_name: 'Missile' },
  { product: 'Emamectin Benzoate', company: 'UPL', trade_name: 'Spolit' },
  // Glyphosate
  { product: 'Glyphosate', company: 'Bayer', trade_name: 'Roundup' },
  { product: 'Glyphosate', company: 'Sumitomo', trade_name: 'Glycel' },
  { product: 'Glyphosate', company: 'Dhanuka', trade_name: 'Noweed' },
  { product: 'Glyphosate', company: 'UPL', trade_name: 'Sweep' },
  // Mancozeb
  { product: 'Mancozeb', company: 'Indofil', trade_name: 'Indofil M-45' },
  { product: 'Mancozeb', company: 'UPL', trade_name: 'Uthane M-45' },
  { product: 'Mancozeb', company: 'Syngenta', trade_name: 'Abic M-45' },
  { product: 'Mancozeb', company: 'Coromandel', trade_name: 'Marlet M-45' },
  // Carbendazim
  { product: 'Carbendazim', company: 'UPL', trade_name: 'Saaf' },
  { product: 'Carbendazim', company: 'Bayer', trade_name: 'Bavistin' },
  { product: 'Carbendazim', company: 'Dhanuka', trade_name: 'Sixer' },
  { product: 'Carbendazim', company: 'Indofil', trade_name: 'Companion' },
  // Fipronil
  { product: 'Fipronil', company: 'Bayer', trade_name: 'Regent' },
  { product: 'Fipronil', company: 'Dhanuka', trade_name: 'Fax' },
  { product: 'Fipronil', company: 'Gharda', trade_name: 'Mahaveer' },
  // Profenofos
  { product: 'Profenofos', company: 'Syngenta', trade_name: 'Curacron' },
  { product: 'Profenofos', company: 'PI Industries', trade_name: 'Roket' },
  { product: 'Profenofos', company: 'Nagarjuna', trade_name: 'Profex Super' },
  // Acephate
  { product: 'Acephate', company: 'Tata Rallis', trade_name: 'Asataf' },
  { product: 'Acephate', company: 'UPL', trade_name: 'Lancer' },
  { product: 'Acephate', company: 'Indofil', trade_name: 'Avatar' },
  // Paraquat
  { product: 'Paraquat', company: 'Syngenta', trade_name: 'Gramoxone' },
  { product: 'Paraquat', company: 'Dhanuka', trade_name: 'Ozone' },
  { product: 'Paraquat', company: 'UPL', trade_name: 'Uniquat' },
  // Pendimethalin
  { product: 'Pendimethalin', company: 'BASF', trade_name: 'Stomp' },
  { product: 'Pendimethalin', company: 'Dhanuka', trade_name: 'Dhanutop' },
  { product: 'Pendimethalin', company: 'Tata Rallis', trade_name: 'Panida' },
  // Urea
  { product: 'Urea', company: 'IFFCO', trade_name: 'IFFCO Neem Coated Urea' },
  { product: 'Urea', company: 'Coromandel', trade_name: 'Gromor Urea' },
  { product: 'Urea', company: 'Chambal', trade_name: 'Uttam Veer Urea' },
  { product: 'Urea', company: 'Zuari', trade_name: 'Jai Kisaan Urea' },
  { product: 'Urea', company: 'KRIBHCO', trade_name: 'KRIBHCO Shyam Urea' },
  { product: 'Urea', company: 'NFL', trade_name: 'Kisan Urea' },
  // DAP
  { product: 'DAP', company: 'IFFCO', trade_name: 'IFFCO DAP 18:46' },
  { product: 'DAP', company: 'Coromandel', trade_name: 'Gromor DAP' },
  { product: 'DAP', company: 'Chambal', trade_name: 'Uttam DAP' },
  { product: 'DAP', company: 'Zuari', trade_name: 'Jai Kisaan Navratna DAP' },
  // NPK
  { product: 'NPK', company: 'IFFCO', trade_name: 'IFFCO NPK Sagarika' },
  { product: 'NPK', company: 'Coromandel', trade_name: 'Gromor Paramfos NPK' },
  { product: 'NPK', company: 'Zuari', trade_name: 'Jai Kisaan Sampurna NPK' },
  { product: 'NPK', company: 'Mahadhan', trade_name: 'Mahadhan Smartek NPK' },
  // MOP / Potash
  { product: 'MOP', company: 'IPL', trade_name: 'IPL Red Potash' },
  { product: 'MOP', company: 'Zuari', trade_name: 'Jai Kisaan MOP' },
  { product: 'MOP', company: 'Coromandel', trade_name: 'Gromor MOP' },
];

export function resolveTradeName(
  productName?: string,
  companyName?: string,
  existingProducts: { product_name?: string; name?: string; company_name?: string; trade_name?: string }[] = []
): {
  suggested: string;
  relatedMappings: { product: string; company: string; trade_name: string }[];
} {
  const pClean = (productName || '').trim();
  const cClean = (companyName || '').trim();
  const pLow = pClean.toLowerCase();
  const cLow = cClean.toLowerCase();

  const relatedMappings: { product: string; company: string; trade_name: string }[] = [];
  let exactMatch = '';

  if (pClean) {
    // 1. Check shop's existing products
    for (const ep of existingProducts) {
      const epName = (ep.product_name || ep.name || '').trim();
      const epComp = (ep.company_name || '').trim();
      const epTrade = (ep.trade_name || '').trim();
      if (epName && epName.toLowerCase().includes(pLow) && epComp && epTrade) {
        if (!relatedMappings.some(m => m.company.toLowerCase() === epComp.toLowerCase() && m.trade_name.toLowerCase() === epTrade.toLowerCase())) {
          relatedMappings.push({ product: epName, company: epComp, trade_name: epTrade });
        }
        if (cLow && epComp.toLowerCase() === cLow) {
          exactMatch = epTrade;
        }
      }
    }

    // 2. Check standard agro-chemical catalog
    for (const item of AGRO_TRADE_NAME_CATALOG) {
      const itemPLow = item.product.toLowerCase();
      const itemCLow = item.company.toLowerCase();
      if (pLow.includes(itemPLow) || itemPLow.includes(pLow)) {
        if (!relatedMappings.some(m => m.company.toLowerCase() === itemCLow && m.trade_name.toLowerCase() === item.trade_name.toLowerCase())) {
          relatedMappings.push(item);
        }
        if (cLow && (cLow.includes(itemCLow) || itemCLow.includes(cLow)) && !exactMatch) {
          exactMatch = item.trade_name;
        }
      }
    }
  }

  if (exactMatch) {
    return { suggested: exactMatch, relatedMappings };
  }
  if (pClean && cClean) {
    return { suggested: `${cClean} ${pClean}`, relatedMappings };
  }
  return { suggested: pClean || cClean, relatedMappings };
}

