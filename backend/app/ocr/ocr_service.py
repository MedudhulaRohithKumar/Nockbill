"""
OCR service — extracts structured product information from raw OCR text.
Specially tuned for Indian fertilizer bags, pesticide bottles, and agri invoices.
"""
import re
from dataclasses import dataclass, field
from typing import Optional, Tuple
from app.utils.helpers import normalize_date

try:
    from app.schemas.schemas import OcrResult, OcrConfidence
except ImportError:
    @dataclass
    class OcrConfidence:  # type: ignore[no-redef]
        product_name: float = 0.0
        net_content: float = 0.0
        unit: float = 0.0
        price: float = 0.0
        company_name: float = 0.0
        manufacture_date: float = 0.0
        expiry_date: float = 0.0
        gst_rate: float = 0.0

    @dataclass
    class OcrResult:  # type: ignore[no-redef]
        product_name: Optional[str] = None
        batch_number: Optional[str] = None
        quantity: int = 1
        net_content: Optional[str] = None
        unit: str = "Bags"
        price: float = 0.0
        company_name: Optional[str] = None
        manufacture_date: Optional[str] = None
        expiry_date: Optional[str] = None
        hsn_code: Optional[str] = "31021000"
        gst_rate: float = 5.0
        raw_text: str = ""
        confidence: OcrConfidence = field(default_factory=OcrConfidence)


# ─── Field extraction helpers ────────────────────────────────────────────────

KNOWN_BRANDS = [
    "IFFCO", "KRIBHCO", "COROMANDEL", "GROMOR", "CHAMBAL", "NAGARJUNA", 
    "TATA", "RALLIS", "BAYER", "SYNGENTA", "UPL", "DHANUKA", "SUMITOMO",
    "IPL", "NFL", "FACT", "GSFC", "RCFL", "ZUARI", "SHRIRAM", "CRYSTAL", "INDOFIL"
]

KNOWN_PRODUCTS = [
    ("NEEM COATED UREA", "Urea"),
    ("UREA", "Urea"),
    ("DI-AMMONIUM PHOSPHATE", "DAP"),
    ("DAP 18-46-0", "DAP"),
    ("DAP", "DAP"),
    ("MURIATE OF POTASH", "MOP"),
    ("MOP", "MOP"),
    ("SINGLE SUPER PHOSPHATE", "SSP"),
    ("SSP", "SSP"),
    ("ZINC SULPHATE", "Zinc Sulphate"),
    ("14-35-14", "Gromor 14-35-14"),
    ("10-26-26", "NPK 10-26-26"),
    ("12-32-16", "NPK 12-32-16"),
    ("20-20-0-13", "NPK 20-20-0-13"),
    ("19-19-19", "NPK 19-19-19"),
    ("SAAF", "Saaf Fungicide"),
    ("CONFIDOR", "Confidor Insecticide"),
    ("MONOCROTOPHOS", "Monocrotophos"),
    ("CHLORPYRIFOS", "Chlorpyrifos"),
    ("GLYPHOSATE", "Glyphosate"),
    ("ATRAZINE", "Atrazine"),
    ("PENDIMETHALIN", "Pendimethalin"),
    ("IMIDACLOPRID", "Imidacloprid"),
    ("MANCOZEB", "Mancozeb"),
    ("CARBENDAZIM", "Carbendazim"),
    ("PROFEX SUPER", "Profex Super"),
    ("CORAGEN", "Coragen"),
    ("TAKUMI", "Takumi"),
    ("ROUNDUP", "Roundup")
]


def _find_product_name(text: str) -> Tuple[Optional[str], float]:
    """Identify product name via brand/product keywords or top lines."""
    upper = text.upper()

    # 1. Match known brand + product combination
    found_brand = None
    for brand in KNOWN_BRANDS:
        if brand in upper:
            found_brand = brand
            break

    found_prod = None
    for kw, title in KNOWN_PRODUCTS:
        if kw in upper:
            found_prod = title
            break

    if found_brand and found_prod:
        return f"{found_brand} {found_prod}", 0.95
    elif found_brand:
        # Extract line containing brand
        for line in text.splitlines():
            if found_brand in line.upper() and len(line.strip()) < 80:
                return line.strip(), 0.85
        return found_brand, 0.75
    elif found_prod:
        return found_prod, 0.85

    # 2. Fallback: First prominent non-numeric string line
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    for line in lines:
        if len(line) >= 4 and not all(c.isdigit() or c in " .:-/" for c in line):
            # Exclude lines that are pure headers like "NET WT" or "BATCH NO"
            if not any(hdr in line.upper() for hdr in ["BATCH", "EXPIRY", "MFG", "PRICE", "NET WT", "HSN"]):
                return line[:80], 0.60

    return None, 0.0


def _find_batch_number(text: str) -> Tuple[Optional[str], float]:
    """Find batch or lot number from text."""
    patterns = [
        (r"\b(?:BATCH|LOT|B\/N|B\.?\s{0,3}N(?:O\.?|\.)?)\s{0,5}(?:[:\-]\s{0,5})?([A-Z0-9][A-Z0-9\-\/]{2,24})", 0.95),
        (r"\b([A-Z]{2,4}\-\d{4,8}\-[A-Z0-9]{1,4})\b", 0.85),
        (r"\b([A-Z]{3,5}\-\d{3,8})\b", 0.75),
    ]
    for pattern, conf in patterns:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            val = m.group(1).strip()
            if len(val) >= 3 and not val.isalpha():
                return val, conf
    return None, 0.0


def _find_price(text: str) -> Tuple[Optional[float], float]:
    """Return (mrp, confidence)."""
    patterns = [
        (
            r"M\.?R\.?P\.?\s{0,5}(?:[:\-]\s{0,5})?"
            r"(?:INCL\.?\s{1,5}ALL\s{1,5}TAXES\s{0,5}(?:[:\-]\s{0,5})?)?"
            r"(?:(?:RS\.?|₹|INR)\s{0,5})?(\d{1,7}(?:\.\d{1,2})?)",
            0.95,
        ),
        (r"(?:RS\.?|₹|INR)\s{0,5}(?:[:\-]\s{0,5})?(\d{1,7}(?:\.\d{1,2})?)", 0.85),
        (r"\bPRICE\s{0,5}(?:[:\-]\s{0,5})?(\d{1,7}(?:\.\d{1,2})?)", 0.75),
        (r"\bRATE\s{0,5}(?:[:\-]\s{0,5})?(\d{1,7}(?:\.\d{1,2})?)", 0.65),
        (r"(?<!\d)(\d{1,7}(?:\.\d{1,2})?)\s{0,5}\/\-", 0.70),
    ]
    for pattern, conf in patterns:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            try:
                val = float(m.group(1))
                if 1.0 <= val <= 100000.0:
                    return val, conf
            except Exception:
                pass
    return None, 0.0


def _find_net_content(text: str) -> Tuple[Optional[str], Optional[str], float]:
    """Return (value_str, unit, confidence)."""
    patterns = [
        (
            r"\bNET\s{0,5}(?:(?:CONTENT|WEIGHT|WT\.?|QTY)\s{0,5})?(?:[:\-]\s{0,5})?"
            r"(\d{1,6}(?:\.\d{1,3})?)\s{0,5}(ML|LITRE|LITER|LTR|L|KGS|KG|GRAM|GM|G|BAG|BOTTLE|PACKET|PACK)\b",
            0.95,
        ),
        (r"(?<!\d)(\d{1,6}(?:\.\d{1,3})?)\s{0,5}(KGS|KG|ML|LITRE|LITER|LTR|GRAM|GM|BAG|BOTTLE)\b", 0.85),
        (r"(?<!\d)(\d{1,6}(?:\.\d{1,3})?)\s{0,5}(G|L)\b", 0.65),
    ]
    for pattern, conf in patterns:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            val, raw_unit = m.group(1), m.group(2).upper()
            unit_map = {
                "KG": "Kg", "KGS": "Kg", "G": "Kg", "GM": "Kg", "GRAM": "Kg",
                "ML": "Litres", "L": "Litres", "LITRE": "Litres", "LITER": "Litres", "LTR": "Litres",
                "BAG": "Bags", "BOTTLE": "Bottles", "PACKET": "Packets", "PACK": "Packets"
            }
            unit = unit_map.get(raw_unit, "Bags")
            return val, unit, conf
    return None, "Bags", 0.0


def _find_date(text: str, keywords: list[str]) -> Tuple[Optional[str], float]:
    """Return (YYYY-MM-DD or YYYY-MM, confidence)."""
    kw_pattern = "|".join(re.escape(k) for k in keywords)
    prefix = rf"\b(?:{kw_pattern})\b\.?(?:\s{{1,5}}DATE)?\s{{0,5}}(?:[:\-]\s{{0,5}})?"
    patterns = [
        rf"{prefix}(\d{{1,2}}[/\-.]\d{{1,2}}[/\-.]\d{{2,4}})",
        rf"{prefix}(\d{{1,2}}[/\-.]\d{{4}})",
        rf"{prefix}(\d{{4}}[/\-.]\d{{1,2}})",
        rf"{prefix}([A-Za-z]{{3,9}}\s{{1,5}}\d{{4}})",
    ]
    for pattern in patterns:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            normalized = normalize_date(m.group(1))
            if normalized:
                return normalized, 0.90
    return None, 0.0


def _find_company(text: str) -> Tuple[Optional[str], float]:
    """Heuristically find company name."""
    for brand in KNOWN_BRANDS:
        if brand in text.upper():
            return f"{brand} India Limited", 0.85

    indicators = ["ltd", "pvt", "private", "limited", "agro", "agri", "chem",
                  "bio", "corp", "industries", "enterprises", "fertilizers", "chemicals"]
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    for line in lines:
        lower = line.lower()
        if any(ind in lower for ind in indicators) and len(line) < 80:
            return line, 0.75
    return None, 0.0


def _find_hsn(text: str) -> Tuple[Optional[str], float]:
    """Find HSN code from text."""
    m = re.search(r"\b(?:HSN|SAC)\s{0,5}(?:CODE\s{0,5})?(?:[:\-]\s{0,5})?(\d{4,8})\b", text, re.IGNORECASE)
    if m:
        return m.group(1), 0.90
    
    # Infer standard HSN based on product terms
    upper = text.upper()
    if "UREA" in upper:
        return "31021000", 0.80
    elif "DAP" in upper or "PHOSPHATE" in upper:
        return "31053000", 0.80
    elif "POTASH" in upper or "MOP" in upper:
        return "31042000", 0.80
    elif "NPK" in upper or "GROMOR" in upper:
        return "31052000", 0.80
    elif any(k in upper for k in ["FUNGICIDE", "INSECTICIDE", "PESTICIDE", "SAAF", "CONFIDOR"]):
        return "38089290", 0.80

    return "31021000", 0.50


def _find_gst(text: str) -> Tuple[Optional[float], float]:
    patterns = [
        r"\bGST\s{0,5}(?:[:\-]\s{0,5})?(\d{1,2}(?:\.\d{1,2})?)\s{0,3}%",
        r"\bIGST\s{0,5}(?:[:\-]\s{0,5})?(\d{1,2}(?:\.\d{1,2})?)\s{0,3}%",
        r"\bTAX\s{0,5}(?:[:\-]\s{0,5})?(\d{1,2}(?:\.\d{1,2})?)\s{0,3}%",
    ]
    for p in patterns:
        m = re.search(p, text, re.IGNORECASE)
        if m:
            try:
                return float(m.group(1)), 0.85
            except Exception:
                pass
    return 5.0, 0.60


# ─── Main extraction function ────────────────────────────────────────────────

def extract_product_details(raw_text: str) -> OcrResult:
    """
    Parse raw OCR text and return structured OcrResult.
    """
    text = raw_text.strip()
    if not text:
        return OcrResult(
            product_name="Scanned Product",
            quantity=1,
            unit="Bags",
            price=0.0,
            gst_rate=5.0,
            hsn_code="31021000",
            raw_text=raw_text,
            confidence=OcrConfidence()
        )

    product_name, name_conf = _find_product_name(text)
    batch_no, batch_conf = _find_batch_number(text)
    price, price_conf = _find_price(text)
    net_val, net_unit, content_conf = _find_net_content(text)
    mfg_date, mfg_conf = _find_date(
        text, ["MANUFACTURED", "DATE OF MFG", "MFG", "MFD", "DOM"]
    )
    exp_date, exp_conf = _find_date(
        text, ["BEST BEFORE", "VALID UPTO", "EXPIRY", "USE BY", "EXP", "BB"]
    )
    company, company_conf = _find_company(text)
    hsn, hsn_conf = _find_hsn(text)
    gst, gst_conf = _find_gst(text)

    # Compose net_content display
    net_content_str = f"{net_val} {net_unit}" if net_val else None

    # Fallback product name if none identified
    if not product_name:
        product_name = "Agri Product"
        name_conf = 0.40

    return OcrResult(
        product_name=product_name,
        batch_number=batch_no,
        quantity=1,
        net_content=net_val,
        unit=net_unit or "Bags",
        price=price or 0.0,
        company_name=company,
        manufacture_date=mfg_date,
        expiry_date=exp_date,
        hsn_code=hsn,
        gst_rate=gst or 5.0,
        raw_text=raw_text,
        confidence=OcrConfidence(
            product_name=name_conf,
            net_content=content_conf,
            unit=content_conf,
            price=price_conf,
            company_name=company_conf,
            manufacture_date=mfg_conf,
            expiry_date=exp_conf,
            gst_rate=gst_conf,
        ),
    )
