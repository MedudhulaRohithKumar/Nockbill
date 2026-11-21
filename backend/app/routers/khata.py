"""
Farmer Khata (Customer Credit Ledger), Supplier Khata (Accounts Payable),
1-Click Master Agri Product Catalog Onboarding, Expiry Clearance Discounting,
Cashier Shift Handover Summary, and Agriculture Inspector Compliance Register (Form O).
Strictly tenant-isolated by current_user.shop_id.
"""
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
import re
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.database.base import get_db
from app.models.models import (
    AuditAction,
    AuditLog,
    KhataPayment,
    PaymentMethod,
    Product,
    ProductBatch,
    Purchase,
    Sale,
    ShopSettings,
    User,
)
from app.utils.auth import get_current_user, require_owner
from app.utils.helpers import sanitize_code, sanitize_text, validate_phone

router = APIRouter(prefix="/api/khata", tags=["Khata, Onboarding & Compliance"])

_DEC_ZERO = Decimal("0.00")

# Curated Indian Krishi Seva Kendra Master Product Catalog
MASTER_AGRI_CATALOG: List[dict] = [
    {
        "code": "IFFCO-NANO-UREA",
        "product_name": "IFFCO Nano Urea Liquid",
        "trade_name": "Nano Urea",
        "company_name": "IFFCO",
        "category": "Fertilizer",
        "unit": "Bottles",
        "net_content": "0.500",
        "hsn_code": "31021000",
        "gst_rate": "5.00",
        "purchase_price": "190.00",
        "selling_price": "225.00",
        "mrp": "225.00",
        "initial_stock": 40,
    },
    {
        "code": "IFFCO-DAP-50KG",
        "product_name": "IFFCO DAP 18-46-0 Fertilizer (50 Kg)",
        "trade_name": "DAP 18:46",
        "company_name": "IFFCO",
        "category": "Fertilizer",
        "unit": "Bags",
        "net_content": "50.000",
        "hsn_code": "31053000",
        "gst_rate": "5.00",
        "purchase_price": "1260.00",
        "selling_price": "1350.00",
        "mrp": "1350.00",
        "initial_stock": 50,
    },
    {
        "code": "GROMOR-UREA-45KG",
        "product_name": "Coromandel Gromor Neem Coated Urea (45 Kg)",
        "trade_name": "Gromor Urea",
        "company_name": "Coromandel International",
        "category": "Fertilizer",
        "unit": "Bags",
        "net_content": "45.000",
        "hsn_code": "31021000",
        "gst_rate": "5.00",
        "purchase_price": "242.00",
        "selling_price": "266.50",
        "mrp": "266.50",
        "initial_stock": 80,
    },
    {
        "code": "MAHADHAN-19-19-19",
        "product_name": "Mahadhan 100% Water Soluble NPK 19:19:19 (1 Kg)",
        "trade_name": "NPK 19:19:19",
        "company_name": "Deepak Fertilisers",
        "category": "Fertilizer",
        "unit": "Packets",
        "net_content": "1.000",
        "hsn_code": "31052000",
        "gst_rate": "5.00",
        "purchase_price": "125.00",
        "selling_price": "165.00",
        "mrp": "180.00",
        "initial_stock": 35,
    },
    {
        "code": "FMC-CORAGEN-150ML",
        "product_name": "FMC Coragen Chlorantraniliprole 18.5% SC (150 ml)",
        "trade_name": "Coragen",
        "company_name": "FMC India",
        "category": "Pesticide",
        "unit": "Bottles",
        "net_content": "0.150",
        "hsn_code": "38089199",
        "gst_rate": "18.00",
        "purchase_price": "1320.00",
        "selling_price": "1550.00",
        "mrp": "1680.00",
        "initial_stock": 20,
    },
    {
        "code": "BAYER-CONFIDOR-100ML",
        "product_name": "Bayer Confidor Imidacloprid 17.8% SL (100 ml)",
        "trade_name": "Confidor",
        "company_name": "Bayer CropScience",
        "category": "Pesticide",
        "unit": "Bottles",
        "net_content": "0.100",
        "hsn_code": "38089199",
        "gst_rate": "18.00",
        "purchase_price": "240.00",
        "selling_price": "295.00",
        "mrp": "320.00",
        "initial_stock": 30,
    },
    {
        "code": "SYNGENTA-AMISTAR-100ML",
        "product_name": "Syngenta Amistar Azoxystrobin 23% SC Fungicide (100 ml)",
        "trade_name": "Amistar",
        "company_name": "Syngenta India",
        "category": "Pesticide",
        "unit": "Bottles",
        "net_content": "0.100",
        "hsn_code": "38089290",
        "gst_rate": "18.00",
        "purchase_price": "410.00",
        "selling_price": "490.00",
        "mrp": "530.00",
        "initial_stock": 25,
    },
    {
        "code": "UPL-SAAF-500G",
        "product_name": "UPL Saaf Carbendazim 12% + Mancozeb 63% WP (500 g)",
        "trade_name": "Saaf Fungicide",
        "company_name": "UPL Limited",
        "category": "Pesticide",
        "unit": "Packets",
        "net_content": "0.500",
        "hsn_code": "38089290",
        "gst_rate": "18.00",
        "purchase_price": "310.00",
        "selling_price": "380.00",
        "mrp": "410.00",
        "initial_stock": 30,
    },
    {
        "code": "MAHYCO-COTTON-BGII",
        "product_name": "Mahyco MRC 7351 BG-II Hybrid Cotton Seed (450 g)",
        "trade_name": "MRC 7351 BG-II",
        "company_name": "Mahyco Seeds",
        "category": "Seeds",
        "unit": "Packets",
        "net_content": "0.450",
        "hsn_code": "12099190",
        "gst_rate": "0.00",
        "purchase_price": "740.00",
        "selling_price": "864.00",
        "mrp": "864.00",
        "initial_stock": 40,
    },
    {
        "code": "PIONEER-MAIZE-3396",
        "product_name": "Corteva Pioneer P3396 Hybrid Corn / Maize Seed (4 Kg)",
        "trade_name": "Pioneer P3396",
        "company_name": "Corteva Agriscience",
        "category": "Seeds",
        "unit": "Bags",
        "net_content": "4.000",
        "hsn_code": "10051000",
        "gst_rate": "0.00",
        "purchase_price": "1150.00",
        "selling_price": "1380.00",
        "mrp": "1450.00",
        "initial_stock": 25,
    },
    {
        "code": "ARIES-CHELAMIN-500G",
        "product_name": "Aries Chelamin Chelated Zinc EDTA 12% (500 g)",
        "trade_name": "Chelamin Zn",
        "company_name": "Aries Agro",
        "category": "Micronutrients",
        "unit": "Packets",
        "net_content": "0.500",
        "hsn_code": "31059090",
        "gst_rate": "12.00",
        "purchase_price": "260.00",
        "selling_price": "330.00",
        "mrp": "360.00",
        "initial_stock": 25,
    },
    {
        "code": "IFFCO-SAGARIKA-10KG",
        "product_name": "IFFCO Sagarika Seaweed Bio-Stimulant Granules (10 Kg)",
        "trade_name": "Sagarika Z++",
        "company_name": "IFFCO",
        "category": "Bio-Fertilizer",
        "unit": "Bags",
        "net_content": "10.000",
        "hsn_code": "31010099",
        "gst_rate": "5.00",
        "purchase_price": "360.00",
        "selling_price": "415.00",
        "mrp": "415.00",
        "initial_stock": 30,
    },
]


class KhataPaymentCreateRequest(BaseModel):
    ledger_type: str = Field(default="CUSTOMER", description="'CUSTOMER' or 'SUPPLIER'")
    party_name: str = Field(..., min_length=1, max_length=200)
    party_phone: Optional[str] = Field(default=None, max_length=20)
    party_gstin: Optional[str] = Field(default=None, max_length=20)
    reference_id: Optional[int] = Field(default=None)
    reference_number: Optional[str] = Field(default=None, max_length=100)
    amount: Decimal = Field(..., gt=Decimal("0"))
    payment_mode: str = Field(default="CASH", max_length=30)
    notes: Optional[str] = Field(default=None, max_length=300)

    @model_validator(mode="after")
    def clean_khata_payment(self) -> "KhataPaymentCreateRequest":
        lt = (self.ledger_type or "CUSTOMER").strip().upper()
        if lt not in ("CUSTOMER", "SUPPLIER"):
            raise ValueError("ledger_type must be 'CUSTOMER' or 'SUPPLIER'")
        self.ledger_type = lt
        self.party_name = sanitize_text(self.party_name, 200) or "Walk-in Party"
        self.party_phone = validate_phone(self.party_phone) if (self.party_phone and self.party_phone.strip()) else None
        self.party_gstin = sanitize_code(self.party_gstin, 20, uppercase=True) if self.party_gstin else None
        self.reference_number = sanitize_code(self.reference_number, 100) if self.reference_number else None
        self.payment_mode = (sanitize_code(self.payment_mode, 30, uppercase=True) or "CASH")
        self.notes = sanitize_text(self.notes, 300) if self.notes else None
        self.amount = Decimal(str(self.amount)).quantize(Decimal("0.01"))
        return self


class CatalogImportRequest(BaseModel):
    codes: Optional[List[str]] = Field(default=None, description="Template codes to import; omit to import all")


class ExpiryClearanceRequest(BaseModel):
    product_id: int = Field(..., gt=0)
    discount_percent: Decimal = Field(..., gt=Decimal("0"), le=Decimal("80"))


def _extract_credit_component(sale: Sale) -> Decimal:
    """Return the credit (Udhar) amount for a sale, supporting full CREDIT and Split Payment notes."""
    grand = Decimal(str(sale.grand_total or 0)).quantize(Decimal("0.01"))
    pm = sale.payment_method.value if hasattr(sale.payment_method, "value") else str(sale.payment_method or "")
    if pm.upper() == "CREDIT":
        return grand
    notes = str(sale.notes or "")
    if "CREDIT" in notes.upper():
        match = re.search(r"CREDIT\s*[:=]?\s*(?:INR|RS\.?|₹)?\s*([0-9]+(?:\.[0-9]{1,2})?)", notes, re.IGNORECASE)
        if match:
            try:
                parsed = Decimal(match.group(1)).quantize(Decimal("0.01"))
                return min(parsed, grand)
            except Exception:
                pass
    return _DEC_ZERO


def _customer_key(name: Optional[str], phone: Optional[str]) -> str:
    clean_phone = (phone or "").strip()
    if clean_phone:
        return f"PHONE:{clean_phone}"
    clean_name = (name or "Walk-in Farmer").strip().lower()
    return f"NAME:{clean_name}"


@router.get("/customers")
def list_customer_khata(
    search: Optional[str] = Query(default=None, max_length=100),
    only_due: bool = Query(default=False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Aggregate Farmer Khata (Udhar / Credit Ledger) across all sales and repayments for the current shop."""
    shop_id = current_user.shop_id
    sales = (
        db.query(Sale)
        .filter(Sale.shop_id == shop_id)
        .order_by(Sale.sale_date.desc())
        .all()
    )
    repayments = (
        db.query(KhataPayment)
        .filter(
            KhataPayment.shop_id == shop_id,
            KhataPayment.ledger_type == "CUSTOMER",
        )
        .order_by(KhataPayment.created_at.desc())
        .all()
    )

    buckets: dict[str, dict] = {}
    for s in sales:
        cname = (s.customer_name or "").strip()
        cphone = (s.customer_phone or "").strip()
        if not cname and not cphone:
            continue
        key = _customer_key(cname, cphone)
        entry = buckets.get(key)
        if not entry:
            entry = {
                "customer_key": key,
                "customer_name": cname or "Farmer",
                "customer_phone": cphone or None,
                "customer_address": getattr(s, "customer_address", None),
                "customer_aadhar": getattr(s, "customer_aadhar", None),
                "customer_gstin": getattr(s, "customer_gstin", None),
                "bill_count": 0,
                "total_billed": _DEC_ZERO,
                "total_credit_billed": _DEC_ZERO,
                "total_repaid": _DEC_ZERO,
                "last_purchase_date": s.sale_date.isoformat() if s.sale_date else None,
            }
            buckets[key] = entry
        entry["bill_count"] += 1
        grand = Decimal(str(s.grand_total or 0)).quantize(Decimal("0.01"))
        entry["total_billed"] += grand
        entry["total_credit_billed"] += _extract_credit_component(s)
        if not entry["customer_address"] and getattr(s, "customer_address", None):
            entry["customer_address"] = s.customer_address
        if not entry["customer_aadhar"] and getattr(s, "customer_aadhar", None):
            entry["customer_aadhar"] = s.customer_aadhar
        if not entry["customer_gstin"] and getattr(s, "customer_gstin", None):
            entry["customer_gstin"] = s.customer_gstin

    for rp in repayments:
        key = _customer_key(rp.party_name, rp.party_phone)
        entry = buckets.get(key)
        if not entry:
            entry = {
                "customer_key": key,
                "customer_name": rp.party_name,
                "customer_phone": rp.party_phone,
                "customer_address": None,
                "customer_aadhar": None,
                "customer_gstin": rp.party_gstin,
                "bill_count": 0,
                "total_billed": _DEC_ZERO,
                "total_credit_billed": _DEC_ZERO,
                "total_repaid": _DEC_ZERO,
                "last_purchase_date": rp.created_at.isoformat() if rp.created_at else None,
            }
            buckets[key] = entry
        entry["total_repaid"] += Decimal(str(rp.amount or 0)).quantize(Decimal("0.01"))

    q = (search or "").strip().lower()
    results = []
    total_outstanding = _DEC_ZERO
    for item in buckets.values():
        outstanding = max(_DEC_ZERO, item["total_credit_billed"] - item["total_repaid"])
        if only_due and outstanding <= _DEC_ZERO:
            continue
        if q:
            haystack = f"{item['customer_name']} {item['customer_phone'] or ''} {item['customer_address'] or ''}".lower()
            if q not in haystack:
                continue
        total_outstanding += outstanding
        results.append({
            **item,
            "total_billed": float(item["total_billed"]),
            "total_credit_billed": float(item["total_credit_billed"]),
            "total_repaid": float(item["total_repaid"]),
            "outstanding_balance": float(outstanding),
        })

    results.sort(key=lambda r: (-r["outstanding_balance"], -r["total_billed"]))
    return {
        "total_customers": len(results),
        "total_outstanding_udhar": float(total_outstanding),
        "customers": results,
    }


@router.get("/customers/lookup")
def lookup_customer_for_pos(
    phone: str = Query(..., min_length=3, max_length=40),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Fast POS returning-customer lookup by mobile number.
    Returns profile fields, current pending Udhar balance, and recent bills for 1-Click Repeat Order.
    """
    shop_id = current_user.shop_id
    clean_phone = "".join(ch for ch in phone if ch.isdigit())[-10:]
    if not clean_phone:
        raise HTTPException(status_code=400, detail="Valid phone digits required.")

    sales = (
        db.query(Sale)
        .options(selectinload(Sale.items))
        .filter(Sale.shop_id == shop_id, Sale.customer_phone == clean_phone)
        .order_by(Sale.sale_date.desc())
        .all()
    )
    repaid_sum = (
        db.query(func.coalesce(func.sum(KhataPayment.amount), 0))
        .filter(
            KhataPayment.shop_id == shop_id,
            KhataPayment.ledger_type == "CUSTOMER",
            KhataPayment.party_phone == clean_phone,
        )
        .scalar()
    )
    total_repaid = Decimal(str(repaid_sum or 0)).quantize(Decimal("0.01"))

    if not sales:
        return {
            "found": False,
            "customer_phone": clean_phone,
            "outstanding_balance": 0.0,
            "bill_count": 0,
            "recent_sales": [],
        }

    latest = sales[0]
    total_billed = _DEC_ZERO
    total_credit = _DEC_ZERO
    for s in sales:
        total_billed += Decimal(str(s.grand_total or 0)).quantize(Decimal("0.01"))
        total_credit += _extract_credit_component(s)

    outstanding = max(_DEC_ZERO, total_credit - total_repaid)
    recent_sales = []
    for s in sales[:5]:
        recent_sales.append({
            "id": s.id,
            "invoice_number": s.invoice_number,
            "sale_date": s.sale_date.isoformat() if s.sale_date else None,
            "grand_total": float(s.grand_total or 0),
            "payment_method": s.payment_method.value if hasattr(s.payment_method, "value") else str(s.payment_method),
            "items": [
                {
                    "product_id": it.product_id,
                    "product_name": it.product_name,
                    "batch_number": getattr(it, "batch_number", None),
                    "quantity": float(it.quantity or 1),
                    "unit": getattr(it, "unit", None) or "Bags",
                    "unit_price": float(it.price or 0),
                    "gst_rate": float(it.gst_rate or 0),
                    "hsn_code": getattr(it, "hsn_code", None),
                }
                for it in s.items
            ],
        })

    return {
        "found": True,
        "customer_name": latest.customer_name,
        "customer_phone": clean_phone,
        "customer_address": getattr(latest, "customer_address", None),
        "customer_aadhar": getattr(latest, "customer_aadhar", None),
        "customer_gstin": getattr(latest, "customer_gstin", None),
        "bill_count": len(sales),
        "total_billed": float(total_billed),
        "total_credit_billed": float(total_credit),
        "total_repaid": float(total_repaid),
        "outstanding_balance": float(outstanding),
        "recent_sales": recent_sales,
    }


@router.get("/suppliers")
def list_supplier_khata(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Aggregate Supplier Khata (Accounts Payable) across all inward purchase bills and payouts."""
    shop_id = current_user.shop_id
    purchases = (
        db.query(Purchase)
        .filter(Purchase.shop_id == shop_id)
        .order_by(Purchase.purchase_date.desc())
        .all()
    )
    payouts = (
        db.query(KhataPayment)
        .filter(
            KhataPayment.shop_id == shop_id,
            KhataPayment.ledger_type == "SUPPLIER",
        )
        .order_by(KhataPayment.created_at.desc())
        .all()
    )

    buckets: dict[str, dict] = {}
    for p in purchases:
        sname = (p.supplier_name or "Distributor").strip()
        key = sname.lower()
        entry = buckets.get(key)
        if not entry:
            entry = {
                "supplier_name": sname,
                "supplier_phone": p.supplier_phone,
                "supplier_gstin": getattr(p, "supplier_gstin", None),
                "bill_count": 0,
                "total_purchased": _DEC_ZERO,
                "total_paid": _DEC_ZERO,
                "last_purchase_date": p.purchase_date.isoformat() if p.purchase_date else None,
            }
            buckets[key] = entry
        entry["bill_count"] += 1
        entry["total_purchased"] += Decimal(str(p.grand_total or 0)).quantize(Decimal("0.01"))

    for po in payouts:
        key = (po.party_name or "Distributor").strip().lower()
        entry = buckets.get(key)
        if not entry:
            entry = {
                "supplier_name": po.party_name,
                "supplier_phone": po.party_phone,
                "supplier_gstin": po.party_gstin,
                "bill_count": 0,
                "total_purchased": _DEC_ZERO,
                "total_paid": _DEC_ZERO,
                "last_purchase_date": po.created_at.isoformat() if po.created_at else None,
            }
            buckets[key] = entry
        entry["total_paid"] += Decimal(str(po.amount or 0)).quantize(Decimal("0.01"))

    suppliers = []
    total_payable = _DEC_ZERO
    for item in buckets.values():
        payable = max(_DEC_ZERO, item["total_purchased"] - item["total_paid"])
        total_payable += payable
        suppliers.append({
            **item,
            "total_purchased": float(item["total_purchased"]),
            "total_paid": float(item["total_paid"]),
            "outstanding_payable": float(payable),
        })

    suppliers.sort(key=lambda r: (-r["outstanding_payable"], -r["total_purchased"]))
    return {
        "total_suppliers": len(suppliers),
        "total_outstanding_payable": float(total_payable),
        "suppliers": suppliers,
    }


@router.get("/payments")
def list_khata_payments(
    ledger_type: Optional[str] = Query(default=None, max_length=20),
    party_phone: Optional[str] = Query(default=None, max_length=20),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(KhataPayment).filter(KhataPayment.shop_id == current_user.shop_id)
    if ledger_type:
        q = q.filter(KhataPayment.ledger_type == ledger_type.strip().upper())
    if party_phone:
        q = q.filter(KhataPayment.party_phone == party_phone.strip())
    rows = q.order_by(KhataPayment.created_at.desc()).limit(limit).all()
    return [
        {
            "id": r.id,
            "ledger_type": r.ledger_type,
            "party_name": r.party_name,
            "party_phone": r.party_phone,
            "party_gstin": r.party_gstin,
            "reference_id": r.reference_id,
            "reference_number": r.reference_number,
            "amount": float(r.amount or 0),
            "payment_mode": r.payment_mode,
            "notes": r.notes,
            "recorded_by": r.recorded_by,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


@router.post("/payments", status_code=201)
def record_khata_payment(
    payload: KhataPaymentCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Record a Customer Udhar repayment or Supplier Payable settlement."""
    record = KhataPayment(
        shop_id=current_user.shop_id,
        ledger_type=payload.ledger_type,
        party_name=payload.party_name,
        party_phone=payload.party_phone,
        party_gstin=payload.party_gstin,
        reference_id=payload.reference_id,
        reference_number=payload.reference_number,
        amount=payload.amount,
        payment_mode=payload.payment_mode,
        notes=payload.notes,
        recorded_by=current_user.id,
    )
    db.add(record)
    db.flush()
    db.add(AuditLog(
        user_id=current_user.id,
        shop_id=current_user.shop_id,
        action=AuditAction.SALE_CREATE if payload.ledger_type == "CUSTOMER" else AuditAction.PURCHASE_CREATE,
        reference_type="KhataPayment",
        reference_id=record.id,
        description=f"Recorded {payload.ledger_type} Khata payment of ₹{payload.amount} for {payload.party_name} ({payload.payment_mode})",
    ))
    db.commit()
    db.refresh(record)
    return {
        "id": record.id,
        "ledger_type": record.ledger_type,
        "party_name": record.party_name,
        "party_phone": record.party_phone,
        "amount": float(record.amount),
        "payment_mode": record.payment_mode,
        "notes": record.notes,
        "created_at": record.created_at.isoformat() if record.created_at else None,
    }


@router.get("/catalog-templates")
def get_master_agri_catalog_templates(
    current_user: User = Depends(get_current_user),
):
    """Return curated Indian Krishi Seva Kendra product templates for 1-click onboarding."""
    return {"templates": MASTER_AGRI_CATALOG}


@router.post("/import-catalog", status_code=201)
def import_master_agri_catalog(
    payload: CatalogImportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    """One-click bulk import of curated Indian Fertilizer, Pesticide, and Seed products into the shop."""
    shop_id = current_user.shop_id
    selected_codes = {c.strip().upper() for c in (payload.codes or []) if c and c.strip()}
    candidates = [
        item for item in MASTER_AGRI_CATALOG
        if not selected_codes or item["code"].upper() in selected_codes
    ]

    existing_products = (
        db.query(Product)
        .filter(Product.shop_id == shop_id)
        .all()
    )
    existing_codes = {(p.product_code or "").upper() for p in existing_products if p.product_code}
    existing_names = {(p.product_name or "").lower() for p in existing_products if p.product_name}

    imported = []
    skipped = 0
    default_expiry = date.today() + timedelta(days=540)

    for tpl in candidates:
        code_upper = tpl["code"].upper()
        name_lower = tpl["product_name"].lower()
        if code_upper in existing_codes or name_lower in existing_names:
            skipped += 1
            continue

        batch_no = f"{code_upper[:10]}-B1"
        init_qty = Decimal(str(tpl["initial_stock"]))
        p_price = Decimal(tpl["purchase_price"])
        s_price = Decimal(tpl["selling_price"])
        m_price = Decimal(tpl["mrp"])

        prod = Product(
            shop_id=shop_id,
            product_code=code_upper,
            product_name=tpl["product_name"],
            trade_name=tpl["trade_name"],
            company_name=tpl["company_name"],
            category=tpl["category"],
            batch_number=batch_no,
            net_content=Decimal(tpl["net_content"]),
            unit=tpl["unit"],
            purchase_price=p_price,
            base_selling_price=s_price,
            selling_price=s_price,
            mrp=m_price,
            gst_rate=Decimal(tpl["gst_rate"]),
            hsn_code=tpl["hsn_code"],
            quantity=init_qty,
            min_stock_threshold=Decimal("10"),
            expiry_date=default_expiry,
            barcode=f"SH{shop_id}-{code_upper}",
            is_active=True,
        )
        db.add(prod)
        db.flush()

        batch = ProductBatch(
            product_id=prod.id,
            batch_number=batch_no,
            trade_name=tpl["trade_name"],
            company_name=tpl["company_name"],
            expiry_date=default_expiry,
            purchase_price=p_price,
            selling_price=s_price,
            mrp=m_price,
            current_stock=init_qty,
            is_active=True,
        )
        db.add(batch)
        existing_codes.add(code_upper)
        existing_names.add(name_lower)
        imported.append({"id": prod.id, "product_code": prod.product_code, "product_name": prod.product_name})

    if imported:
        db.add(AuditLog(
            user_id=current_user.id,
            shop_id=shop_id,
            action=AuditAction.PRODUCT_CREATE,
            description=f"Imported {len(imported)} products from Master Agri Catalog",
        ))
        db.commit()

    return {
        "imported_count": len(imported),
        "skipped_count": skipped,
        "imported_products": imported,
    }


@router.post("/expiry-clearance")
def apply_expiry_clearance_discount(
    payload: ExpiryClearanceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    """Apply a 1-Click Clearance Discount (%) to a near-expiry product and its active batches."""
    prod = (
        db.query(Product)
        .filter(Product.id == payload.product_id, Product.shop_id == current_user.shop_id)
        .first()
    )
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found in your shop.")

    base_price = Decimal(str(prod.base_selling_price or prod.selling_price or 0)).quantize(Decimal("0.01"))
    if base_price <= _DEC_ZERO:
        raise HTTPException(status_code=400, detail="Product has no base selling price to discount.")

    if not prod.base_selling_price:
        prod.base_selling_price = base_price

    multiplier = (Decimal("100") - Decimal(str(payload.discount_percent))) / Decimal("100")
    new_price = max(Decimal("1.00"), (base_price * multiplier).quantize(Decimal("0.01")))
    prod.selling_price = new_price

    batches = db.query(ProductBatch).filter(ProductBatch.product_id == prod.id, ProductBatch.is_active == True).all()
    for b in batches:
        b.selling_price = new_price

    db.add(AuditLog(
        user_id=current_user.id,
        shop_id=current_user.shop_id,
        action=AuditAction.PRODUCT_UPDATE,
        reference_type="Product",
        reference_id=prod.id,
        description=f"Applied {payload.discount_percent}% expiry clearance discount to {prod.product_name} (new price ₹{new_price})",
    ))
    db.commit()
    return {
        "product_id": prod.id,
        "product_name": prod.product_name,
        "base_selling_price": float(base_price),
        "discount_percent": float(payload.discount_percent),
        "new_selling_price": float(new_price),
    }


@router.get("/shift-handover")
def get_cashier_shift_handover(
    target_date: Optional[date] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """End-of-day Cashier Shift Handover Summary per IAM user for drawer reconciliation."""
    shop_id = current_user.shop_id
    users = db.query(User).filter(User.shop_id == shop_id).order_by(User.id.asc()).all()
    user_map: dict[int, dict] = {
        u.id: {
            "user_id": u.id,
            "username": u.username,
            "name": u.name,
            "role": u.role.value if hasattr(u.role, "value") else str(u.role),
            "bills_count": 0,
            "cash_sales": _DEC_ZERO,
            "upi_sales": _DEC_ZERO,
            "card_sales": _DEC_ZERO,
            "credit_sales_issued": _DEC_ZERO,
            "khata_cash_collected": _DEC_ZERO,
            "khata_upi_collected": _DEC_ZERO,
        }
        for u in users
    }

    sales_q = db.query(Sale).filter(Sale.shop_id == shop_id)
    khata_q = db.query(KhataPayment).filter(
        KhataPayment.shop_id == shop_id,
        KhataPayment.ledger_type == "CUSTOMER",
    )
    if target_date:
        start_dt = datetime.combine(target_date, datetime.min.time())
        end_dt = start_dt + timedelta(days=1)
        sales_q = sales_q.filter(Sale.sale_date >= start_dt, Sale.sale_date < end_dt)
        khata_q = khata_q.filter(KhataPayment.created_at >= start_dt, KhataPayment.created_at < end_dt)

    for s in sales_q.all():
        uid = s.sold_by or current_user.id
        bucket = user_map.get(uid) or next(iter(user_map.values()), None)
        if not bucket:
            continue
        bucket["bills_count"] += 1
        grand = Decimal(str(s.grand_total or 0)).quantize(Decimal("0.01"))
        pm = (s.payment_method.value if hasattr(s.payment_method, "value") else str(s.payment_method or "CASH")).upper()
        if pm == "CASH":
            bucket["cash_sales"] += grand
        elif pm == "UPI":
            bucket["upi_sales"] += grand
        elif pm == "CARD":
            bucket["card_sales"] += grand
        elif pm == "CREDIT":
            bucket["credit_sales_issued"] += grand

    for kp in khata_q.all():
        uid = kp.recorded_by or current_user.id
        bucket = user_map.get(uid) or next(iter(user_map.values()), None)
        if not bucket:
            continue
        amt = Decimal(str(kp.amount or 0)).quantize(Decimal("0.01"))
        if (kp.payment_mode or "CASH").upper() == "UPI":
            bucket["khata_upi_collected"] += amt
        else:
            bucket["khata_cash_collected"] += amt

    cashiers = []
    total_drawer_cash = _DEC_ZERO
    for b in user_map.values():
        net_cash = b["cash_sales"] + b["khata_cash_collected"]
        total_drawer_cash += net_cash
        cashiers.append({
            **b,
            "cash_sales": float(b["cash_sales"]),
            "upi_sales": float(b["upi_sales"]),
            "card_sales": float(b["card_sales"]),
            "credit_sales_issued": float(b["credit_sales_issued"]),
            "khata_cash_collected": float(b["khata_cash_collected"]),
            "khata_upi_collected": float(b["khata_upi_collected"]),
            "net_cash_in_drawer": float(net_cash),
        })

    return {
        "date": target_date.isoformat() if target_date else "ALL_TIME",
        "total_net_cash_in_drawer": float(total_drawer_cash),
        "cashiers": cashiers,
    }


@router.get("/compliance-register")
def get_agri_inspector_compliance_register(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Agriculture Department Inspector Audit Pack:
    1. Form O / Daily Stock-Cum-Price Display Board
    2. Batch-wise Farmer Sale Register (with Farmer Aadhar, Village, Batch & Expiry)
    """
    shop_id = current_user.shop_id
    shop = db.query(ShopSettings).filter(ShopSettings.id == shop_id).first()
    products = (
        db.query(Product)
        .filter(Product.shop_id == shop_id, Product.is_active == True)
        .order_by(Product.category.asc(), Product.product_name.asc())
        .all()
    )
    stock_board = [
        {
            "product_id": p.id,
            "product_code": p.product_code,
            "product_name": p.product_name,
            "company_name": p.company_name,
            "category": p.category or "Fertilizer",
            "batch_number": p.batch_number or "-",
            "expiry_date": p.expiry_date.isoformat() if p.expiry_date else None,
            "current_stock": float(p.quantity or 0),
            "unit": p.unit or "Bags",
            "selling_price": float(p.selling_price or 0),
            "mrp": float(p.mrp or p.selling_price or 0),
        }
        for p in products
    ]

    recent_sales = (
        db.query(Sale)
        .options(selectinload(Sale.items))
        .filter(Sale.shop_id == shop_id)
        .order_by(Sale.sale_date.desc())
        .limit(100)
        .all()
    )
    batch_sale_register = []
    for s in recent_sales:
        for it in s.items:
            batch_sale_register.append({
                "invoice_number": s.invoice_number,
                "sale_date": s.sale_date.isoformat() if s.sale_date else None,
                "farmer_name": s.customer_name or "Walk-in Farmer",
                "farmer_phone": s.customer_phone or "-",
                "farmer_village": getattr(s, "customer_address", None) or "-",
                "farmer_aadhar": getattr(s, "customer_aadhar", None) or "-",
                "product_name": it.product_name,
                "company_name": getattr(it, "company_name", None) or "-",
                "batch_number": getattr(it, "batch_number", None) or "-",
                "quantity": float(it.quantity or 0),
                "unit": getattr(it, "unit", None) or "Bags",
                "total_amount": float(it.total or 0),
            })

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "shop_name": shop.shop_name if shop else "My Shop",
        "gstin": shop.gstin if shop else None,
        "fertilizer_license_no": shop.fertilizer_license_no if shop else None,
        "pesticide_license_no": shop.pesticide_license_no if shop else None,
        "seed_license_no": shop.seed_license_no if shop else None,
        "stock_cum_price_board": stock_board,
        "batch_sale_register": batch_sale_register,
    }
