import re
from decimal import Decimal
from typing import Optional, Tuple


# ─── Date normalizers ────────────────────────────────────────────────────────

def normalize_date(raw: str) -> Optional[str]:
    """
    Accept many date formats and return YYYY-MM-DD or YYYY-MM.
    Examples:
        15/08/2026 -> 2026-08-15
        05/2026    -> 2026-05
        05-2026    -> 2026-05
        2026-05-15 -> 2026-05-15
        May 2026   -> 2026-05
    """
    if not raw:
        return None
    raw = raw.strip()

    month_map = {
        "jan": "01", "feb": "02", "mar": "03", "apr": "04",
        "may": "05", "jun": "06", "jul": "07", "aug": "08",
        "sep": "09", "oct": "10", "nov": "11", "dec": "12",
    }

    # DD/MM/YYYY or DD-MM-YYYY
    m = re.match(r"(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{4})$", raw)
    if m:
        d, m_val, y = m.group(1).zfill(2), m.group(2).zfill(2), m.group(3)
        if int(m_val) <= 12 and int(d) <= 31:
            return f"{y}-{m_val}-{d}"

    # YYYY-MM-DD
    m = re.match(r"(\d{4})[-/. ](\d{1,2})[-/. ](\d{1,2})$", raw)
    if m:
        return f"{m.group(1)}-{m.group(2).zfill(2)}-{m.group(3).zfill(2)}"

    # YYYY-MM or YYYY/MM
    m = re.match(r"(\d{4})[-/. ](\d{1,2})$", raw)
    if m:
        return f"{m.group(1)}-{m.group(2).zfill(2)}"

    # MM/YYYY or MM-YYYY
    m = re.match(r"(\d{1,2})[-/. ](\d{4})$", raw)
    if m:
        return f"{m.group(2)}-{m.group(1).zfill(2)}"

    # Month Year  e.g.  "May 2026"
    m = re.match(r"([a-zA-Z]+)\s+(\d{4})$", raw)
    if m:
        mon = month_map.get(m.group(1).lower()[:3])
        if mon:
            return f"{m.group(2)}-{mon}"

    return None


# ─── Price normalizers ───────────────────────────────────────────────────────

def normalize_price(raw: str) -> Optional[Decimal]:
    """
    Extract numeric price from strings like:
        MRP ₹500    ->  500
        Rs. 450.00  ->  450.00
        M.R.P. 500  ->  500
        ₹500        ->  500
    """
    if not raw:
        return None
    # Remove currency symbols, alphabets except decimal point
    cleaned = re.sub(r"[^\d.]", "", raw)
    if cleaned:
        try:
            return Decimal(cleaned)
        except Exception:
            pass
    return None


# ─── Net content normalizer ──────────────────────────────────────────────────

def normalize_net_content(raw: str) -> Tuple[Optional[Decimal], Optional[str]]:
    """
    Returns (value, unit) from strings like:
        500 ML      ->  (500, 'ml')
        1 LITRE     ->  (1, 'liter')
        1 KG        ->  (1, 'kg')
        250 G       ->  (250, 'gram')
        1L          ->  (1, 'liter')
    """
    if not raw:
        return None, None
    raw = raw.strip().upper()

    patterns = [
        (r"(\d+(?:\.\d+)?)\s*ML", "ml"),
        (r"(\d+(?:\.\d+)?)\s*LITRE[S]?", "liter"),
        (r"(\d+(?:\.\d+)?)\s*LITER[S]?", "liter"),
        (r"(\d+(?:\.\d+)?)\s*LTR[S]?", "liter"),
        (r"(\d+(?:\.\d+)?)L\b", "liter"),
        (r"(\d+(?:\.\d+)?)\s*KG", "kg"),
        (r"(\d+(?:\.\d+)?)\s*GRAM[S]?", "gram"),
        (r"(\d+(?:\.\d+)?)\s*GM[S]?", "gram"),
        (r"(\d+(?:\.\d+)?)\s*G\b", "gram"),
    ]

    for pattern, unit in patterns:
        m = re.search(pattern, raw)
        if m:
            try:
                return Decimal(m.group(1)), unit
            except Exception:
                pass

    return None, None


# ─── Invoice number generation ───────────────────────────────────────────────

def generate_invoice_number(prefix: str, counter: int, sale_date) -> str:
    year = sale_date.strftime("%Y")
    month = sale_date.strftime("%m")
    return f"{prefix}-{year}{month}-{str(counter).zfill(5)}"
