"""
OCR service — extracts structured product information from raw OCR text.
Specially tuned for Indian fertilizer bags, pesticide bottles, and agri invoices.
"""
import re
from typing import Optional, Tuple
from app.schemas.schemas import OcrResult, OcrConfidence
from app.utils.helpers import normalize_date


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
        if len(line) >= 4 and not re.match(r"^[\d\s\.\:\-\/]+$", line):
            # Exclude lines that are pure headers like "NET WT" or "BATCH NO"
            if not any(hdr in line.upper() for hdr in ["BATCH", "EXPIRY", "MFG", "PRICE", "NET WT", "HSN"]):
                return line[:80], 0.60

    return None, 0.0


def _find_batch_number(text: str) -> Tuple[Optional[str], float]:
    """Find batch or lot number from text."""
    patterns = [
        (r"(?:BATCH|B\.?\s*NO|LOT|B\/N|B\.N\.?)\s*[:\-]?\s*([A-Z0-9\-\/]{3,25})", 0.95),
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
        (r"M\.?R\.?P\.?\s*[:\-]?\s*(?:INCL\.?\s*ALL\s*TAXES)?\s*[:\-]?\s*(?:RS\.?|₹|INR)?\s*(\d+(?:\.\d{1,2})?)", 0.95),
        (r"(?:RS\.?|₹|INR)\s*[:\-]?\s*(\d+(?:\.\d{1,2})?)", 0.85),
        (r"PRICE\s*[:\-]?\s*(\d+(?:\.\d{1,2})?)", 0.75),
        (r"RATE\s*[:\-]?\s*(\d+(?:\.\d{1,2})?)", 0.65),
        (r"(\d+(?:\.\d{1,2})?)\s*\/\-", 0.70),
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
        (r"NET\s*(?:CONTENT|WT\.?|WEIGHT|QTY)?\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*(ML|L|LITRE|LITER|LTR|KG|G|GM|GRAM|BAG|BOTTLE|PACKET|PACK|KGS)", 0.95),
        (r"(\d+(?:\.\d+)?)\s*(KG|KGS|ML|LITRE|LITER|LTR|GRAM|GM|BAG|BOTTLE)\b", 0.85),
        (r"(\d+(?:\.\d+)?)\s*(G|L)\b", 0.65),
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
    patterns = [
        rf"(?:{kw_pattern})(?:\s+DATE)?\s*[:\-]?\s*(\d{{1,2}}[/\-.]\d{{1,2}}[/\-.]\d{{2,4}})",
        rf"(?:{kw_pattern})(?:\s+DATE)?\s*[:\-]?\s*(\d{{1,2}}[/\-.]\d{{4}})",
        rf"(?:{kw_pattern})(?:\s+DATE)?\s*[:\-]?\s*(\d{{4}}[/\-.]\d{{1,2}})",
        rf"(?:{kw_pattern})(?:\s+DATE)?\s*[:\-]?\s*([A-Za-z]{{3,9}}\s+\d{{4}})",
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
    m = re.search(r"(?:HSN|SAC)\s*(?:CODE)?\s*[:\-]?\s*(\d{4,8})", text, re.IGNORECASE)
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
        r"GST\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*%",
        r"IGST\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*%",
        r"TAX\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*%",
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
        text, ["MFG", "MFD", "MANUFACTURED", "DATE OF MFG", "DOM", "MFG."]
    )
    exp_date, exp_conf = _find_date(
        text, ["EXP", "EXPIRY", "BEST BEFORE", "USE BY", "BB", "VALID UPTO", "EXP."]
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
