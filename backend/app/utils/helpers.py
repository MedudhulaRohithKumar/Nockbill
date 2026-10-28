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


# ─── Input Sanitization & Format Validators ──────────────────────────────────

_CONTROL_CHARS_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_HTML_TAG_RE = re.compile(r"<[^>]*>")
_MULTI_SPACE_RE = re.compile(r"\s{2,}")

# Standard Indian GSTIN pattern (15 chars) or Simple alphanumeric ID (5-20 chars)
GSTIN_STRICT_RE = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$")
GSTIN_LENIENT_RE = re.compile(r"^[A-Z0-9\-/]{3,25}$")
PHONE_RE = re.compile(r"^(?:\+91[\-\s]?)?[6-9]\d{9}$")
PINCODE_RE = re.compile(r"^[1-9][0-9]{5}$")
IFSC_RE = re.compile(r"^[A-Z]{4}0[A-Z0-9]{6}$")
CODE_SAFE_RE = re.compile(r"^[A-Za-z0-9\-_./#\s]{1,100}$")


def sanitize_text(value: Optional[str], max_length: int = 250, allow_newlines: bool = False) -> Optional[str]:
    """
    Strip control characters, HTML/script tags, and collapse redundant whitespace.
    """
    if value is None:
        return None
    cleaned = _CONTROL_CHARS_RE.sub("", str(value))
    cleaned = _HTML_TAG_RE.sub("", cleaned)
    if allow_newlines:
        lines = [_MULTI_SPACE_RE.sub(" ", line).strip() for line in cleaned.splitlines()]
        cleaned = "\n".join(line for line in lines if line)
    else:
        cleaned = _MULTI_SPACE_RE.sub(" ", cleaned).strip()
    if max_length and len(cleaned) > max_length:
        cleaned = cleaned[:max_length].strip()
    return cleaned


def sanitize_code(value: Optional[str], max_length: int = 100, uppercase: bool = False) -> Optional[str]:
    """
    Sanitize identifiers like batch numbers, barcodes, HSN codes, GSTIN, IFSC.
    """
    if value is None:
        return None
    cleaned = sanitize_text(value, max_length=max_length)
    if not cleaned:
        return ""
    cleaned = re.sub(r"[^A-Za-z0-9\-_./#\s]", "", cleaned).strip()
    return cleaned.upper() if uppercase else cleaned


def validate_phone(value: Optional[str]) -> Optional[str]:
    if not value:
        return value
    digits = re.sub(r"[\s\-()]", "", str(value).strip())
    if digits.startswith("+91") and len(digits) == 13:
        digits = digits[3:]
    elif digits.startswith("91") and len(digits) == 12:
        digits = digits[2:]
    elif digits.startswith("0") and len(digits) == 11:
        digits = digits[1:]
    if not re.match(r"^[6-9]\d{9}$", digits):
        raise ValueError("Phone number must be a valid 10-digit Indian mobile number starting with 6-9")
    return digits


def validate_pincode(value: Optional[str]) -> Optional[str]:
    if not value:
        return value
    cleaned = re.sub(r"\s+", "", str(value).strip())
    if not PINCODE_RE.match(cleaned):
        raise ValueError("Pincode must be a valid 6-digit Indian postal code")
    return cleaned


def validate_ifsc(value: Optional[str]) -> Optional[str]:
    if not value:
        return value
    cleaned = re.sub(r"\s+", "", str(value).strip().upper())
    if cleaned and not IFSC_RE.match(cleaned):
        raise ValueError("IFSC code must be 11 characters (e.g., SBIN0001234)")
    return cleaned


def validate_gstin(value: Optional[str]) -> Optional[str]:
    if not value:
        return value
    cleaned = re.sub(r"\s+", "", str(value).strip().upper())
    if cleaned and not GSTIN_LENIENT_RE.match(cleaned):
        raise ValueError("GSTIN / License number must be 3-25 alphanumeric characters")
    return cleaned


# ─── Agro-Chemical Trade Name Resolution ((Product, Company) -> Trade Name) ──
# Domain logic: In Company A, Product B is called Trade Name C;
#               In Company D, the same Product B is called Trade Name E.

AGRO_TRADE_NAME_CATALOG = [
    # Imidacloprid 17.8% SL
    {"product": "Imidacloprid", "company": "Bayer", "trade_name": "Confidor"},
    {"product": "Imidacloprid", "company": "Tata Rallis", "trade_name": "Tatamida"},
    {"product": "Imidacloprid", "company": "Dhanuka", "trade_name": "Media"},
    {"product": "Imidacloprid", "company": "UPL", "trade_name": "Imida"},
    {"product": "Imidacloprid", "company": "Indofil", "trade_name": "Atom"},
    # Chlorantraniliprole 18.5% SC
    {"product": "Chlorantraniliprole", "company": "FMC", "trade_name": "Coragen"},
    {"product": "Chlorantraniliprole", "company": "Syngenta", "trade_name": "Voliam Flexi"},
    {"product": "Chlorantraniliprole", "company": "Dhanuka", "trade_name": "Cover"},
    {"product": "Chlorantraniliprole", "company": "Crystal", "trade_name": "larvigo"},
    # Thiamethoxam 25% WG
    {"product": "Thiamethoxam", "company": "Syngenta", "trade_name": "Actara"},
    {"product": "Thiamethoxam", "company": "Dhanuka", "trade_name": "Areva"},
    {"product": "Thiamethoxam", "company": "UPL", "trade_name": "Renova"},
    {"product": "Thiamethoxam", "company": "Tata Rallis", "trade_name": "Anant"},
    # Emamectin Benzoate 5% SG
    {"product": "Emamectin Benzoate", "company": "Syngenta", "trade_name": "Proclaim"},
    {"product": "Emamectin Benzoate", "company": "Dhanuka", "trade_name": "EM-1"},
    {"product": "Emamectin Benzoate", "company": "Crystal", "trade_name": "Missile"},
    {"product": "Emamectin Benzoate", "company": "UPL", "trade_name": "Spolit"},
    # Glyphosate 41% SL
    {"product": "Glyphosate", "company": "Bayer", "trade_name": "Roundup"},
    {"product": "Glyphosate", "company": "Sumitomo", "trade_name": "Glycel"},
    {"product": "Glyphosate", "company": "Dhanuka", "trade_name": "Noweed"},
    {"product": "Glyphosate", "company": "UPL", "trade_name": "Sweep"},
    # Mancozeb 75% WP
    {"product": "Mancozeb", "company": "Indofil", "trade_name": "Indofil M-45"},
    {"product": "Mancozeb", "company": "UPL", "trade_name": "Uthane M-45"},
    {"product": "Mancozeb", "company": "Syngenta", "trade_name": "Abic M-45"},
    {"product": "Mancozeb", "company": "Coromandel", "trade_name": "Marlet M-45"},
    # Carbendazim + Mancozeb
    {"product": "Carbendazim", "company": "UPL", "trade_name": "Saaf"},
    {"product": "Carbendazim", "company": "Bayer", "trade_name": "Bavistin"},
    {"product": "Carbendazim", "company": "Dhanuka", "trade_name": "Sixer"},
    {"product": "Carbendazim", "company": "Indofil", "trade_name": "Companion"},
    # Fipronil 5% SC / 0.3% GR
    {"product": "Fipronil", "company": "Bayer", "trade_name": "Regent"},
    {"product": "Fipronil", "company": "Dhanuka", "trade_name": "Fax"},
    {"product": "Fipronil", "company": "Gharda", "trade_name": "Mahaveer"},
    # Profenofos + Cypermethrin / Profenofos 50% EC
    {"product": "Profenofos", "company": "Syngenta", "trade_name": "Curacron"},
    {"product": "Profenofos", "company": "PI Industries", "trade_name": "Roket"},
    {"product": "Profenofos", "company": "Nagarjuna", "trade_name": "Profex Super"},
    # Acephate 75% SP
    {"product": "Acephate", "company": "Tata Rallis", "trade_name": "Asataf"},
    {"product": "Acephate", "company": "UPL", "trade_name": "Lancer"},
    {"product": "Acephate", "company": "Indofil", "trade_name": "Avatar"},
    # Paraquat Dichloride 24% SL
    {"product": "Paraquat", "company": "Syngenta", "trade_name": "Gramoxone"},
    {"product": "Paraquat", "company": "Dhanuka", "trade_name": "Ozone"},
    {"product": "Paraquat", "company": "UPL", "trade_name": "Uniquat"},
    # Pendimethalin 30% EC
    {"product": "Pendimethalin", "company": "BASF", "trade_name": "Stomp"},
    {"product": "Pendimethalin", "company": "Dhanuka", "trade_name": "Dhanutop"},
    {"product": "Pendimethalin", "company": "Tata Rallis", "trade_name": "Panida"},
    # Urea 46% N
    {"product": "Urea", "company": "IFFCO", "trade_name": "IFFCO Neem Coated Urea"},
    {"product": "Urea", "company": "Coromandel", "trade_name": "Gromor Urea"},
    {"product": "Urea", "company": "Chambal", "trade_name": "Uttam Veer Urea"},
    {"product": "Urea", "company": "Zuari", "trade_name": "Jai Kisaan Urea"},
    {"product": "Urea", "company": "KRIBHCO", "trade_name": "KRIBHCO Shyam Urea"},
    {"product": "Urea", "company": "NFL", "trade_name": "Kisan Urea"},
    # DAP 18-46-0
    {"product": "DAP", "company": "IFFCO", "trade_name": "IFFCO DAP 18:46"},
    {"product": "DAP", "company": "Coromandel", "trade_name": "Gromor DAP"},
    {"product": "DAP", "company": "Chambal", "trade_name": "Uttam DAP"},
    {"product": "DAP", "company": "Zuari", "trade_name": "Jai Kisaan Navratna DAP"},
    {"product": "DAP", "company": "Paradeep", "trade_name": "Jai Kisaan Navratna DAP"},
    # NPK Complex
    {"product": "NPK", "company": "IFFCO", "trade_name": "IFFCO NPK Sagarika"},
    {"product": "NPK", "company": "Coromandel", "trade_name": "Gromor Paramfos NPK"},
    {"product": "NPK", "company": "Zuari", "trade_name": "Jai Kisaan Sampurna NPK"},
    {"product": "NPK", "company": "Mahadhan", "trade_name": "Mahadhan Smartek NPK"},
    # MOP / Potash
    {"product": "MOP", "company": "IPL", "trade_name": "IPL Red Potash"},
    {"product": "MOP", "company": "Zuari", "trade_name": "Jai Kisaan MOP"},
    {"product": "MOP", "company": "Coromandel", "trade_name": "Gromor MOP"},
]


def resolve_trade_name(
    product_name: Optional[str],
    company_name: Optional[str],
    explicit_trade_name: Optional[str] = None,
) -> Optional[str]:
    """
    Resolve or construct a product's Trade Name from (product_name, company_name).
    1. If explicit_trade_name is provided and non-empty, return sanitized explicit_trade_name.
    2. Otherwise check AGRO_TRADE_NAME_CATALOG for a matching (product, company) combination.
    3. Otherwise combine company_name + product_name into a clean default trade identifier.
    """
    clean_explicit = sanitize_text(explicit_trade_name, max_length=200)
    if clean_explicit:
        return clean_explicit

    p_clean = sanitize_text(product_name, max_length=200) or ""
    c_clean = sanitize_text(company_name, max_length=200) or ""

    if p_clean and c_clean:
        p_low = p_clean.lower()
        c_low = c_clean.lower()
        for entry in AGRO_TRADE_NAME_CATALOG:
            if entry["product"].lower() in p_low and entry["company"].lower() in c_low:
                return entry["trade_name"]
        # Default combination when not in standard catalog
        return f"{c_clean} {p_clean}"[:200]

    return p_clean or c_clean or None
