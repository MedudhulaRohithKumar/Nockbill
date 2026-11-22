"""
Marketing Campaigns & Seasonal WhatsApp Broadcast Router.
Provides farmer segmentation (by crop interest, village, khata balance),
multilingual seasonal message templates, anti-ban click-to-WhatsApp dispatch deck,
and campaign tracking strictly scoped by current_user.shop_id.
"""
from datetime import datetime, timezone
from decimal import Decimal
import re
from typing import Dict, List, Optional
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.database.base import get_db
from app.models.models import (
    KhataPayment,
    MarketingCampaign,
    PaymentMethod,
    Sale,
    SaleItem,
    ShopSettings,
    User,
)
from app.utils.auth import get_current_user, require_owner
from app.utils.helpers import sanitize_text, validate_phone

router = APIRouter(prefix="/api/campaigns", tags=["Marketing & WhatsApp Broadcast"])

_DEC_ZERO = Decimal("0.00")

DEFAULT_CAMPAIGN_TEMPLATES = [
    {
        "id": "KHARIF_SEED_ARRIVAL",
        "title": "Kharif Certified Seed Arrival",
        "season": "KHARIF",
        "category": "Seeds",
        "template": (
            "Dear {farmer_name}, fresh certified stock of high-yield {crop} seeds has arrived at {shop_name}. "
            "Ensure optimal germination and yield by securing your seeds early. "
            "Store address: {shop_address}. Phone: {shop_phone}."
        ),
        "description": "Alert farmers about fresh arrival of Cotton, Paddy, Soybean, or Maize certified seeds.",
    },
    {
        "id": "PEST_OUTBREAK_ALERT",
        "title": "Crop Advisory & Pest Outbreak Alert",
        "season": "KHARIF",
        "category": "Pesticide",
        "template": (
            "Agricultural Advisory: Dear {farmer_name}, weather changes are causing pest and fungal infestation risks in {crop} in our region. "
            "Consult our Agri Doctor counter for verified remedies, active molecules, and accurate pump dosages. "
            "Store: {shop_name}, {shop_address}. Contact: {shop_phone}."
        ),
        "description": "Send urgent preventive spray alerts for Pink Bollworm, Rice Blast, Thrips, or Blight.",
    },
    {
        "id": "FERTILIZER_AVAILABILITY",
        "title": "Fertilizer Stock Arrival at Govt MRP",
        "season": "ALL",
        "category": "Fertilizer",
        "template": (
            "Hello {farmer_name}, fresh supplies of genuine DAP, NPK, and Nano Urea fertilizers are now in stock at {shop_name} at official MRP. "
            "Please bring your Aadhaar card for record-keeping and collect your allocation on time. Contact: {shop_phone}."
        ),
        "description": "Inform farmers regarding DAP, Urea, and complex fertilizer availability.",
    },
    {
        "id": "RABI_WHEAT_BOOKING",
        "title": "Rabi Season Wheat & Chana Seed Booking",
        "season": "RABI",
        "category": "Seeds",
        "template": (
            "Dear {farmer_name}, advance booking for high-quality certified Rabi season seeds (Wheat, Gram, Mustard) is now open at {shop_name}. "
            "Reserve your seeds and basal fertilizers early. Contact: {shop_phone}."
        ),
        "description": "Early booking campaign for Rabi season seeds and basal fertilizers.",
    },
    {
        "id": "KHATA_SETTLEMENT_GENTLE",
        "title": "Gentle Seasonal Credit Reminder",
        "season": "ALL",
        "category": "General",
        "template": (
            "Dear {farmer_name}, this is a gentle reminder from {shop_name} regarding your outstanding credit balance of ₹{pending_balance}. "
            "To renew credit limits for the upcoming season, kindly clear your pending balance. Thank you, {shop_name} ({shop_phone})."
        ),
        "description": "Polite payment request sent before issuing new seasonal credit.",
    },
]


class FarmerSegmentItem(BaseModel):
    customer_name: str
    customer_phone: str
    customer_address: Optional[str] = None
    village: Optional[str] = None
    total_bills: int = 0
    total_spend: Decimal = Decimal("0.00")
    last_visit_date: Optional[str] = None
    preferred_categories: List[str] = Field(default_factory=list)
    pending_khata_balance: Decimal = Decimal("0.00")
    whatsapp_url: Optional[str] = None


class SegmentSummaryResponse(BaseModel):
    total_farmers: int
    total_matching: int
    villages: List[str] = Field(default_factory=list)
    farmers: List[FarmerSegmentItem] = Field(default_factory=list)


class CampaignCreateRequest(BaseModel):
    campaign_name: str = Field(..., min_length=3, max_length=200)
    season: str = Field(default="KHARIF", max_length=50)
    target_crop: Optional[str] = Field(default=None, max_length=100)
    target_village: Optional[str] = Field(default=None, max_length=100)
    template_text: str = Field(..., min_length=10, max_length=1000)
    recipients_count: int = Field(default=0, ge=0)


class CampaignResponse(BaseModel):
    id: int
    campaign_name: str
    season: str
    target_crop: Optional[str] = None
    target_village: Optional[str] = None
    template_text: str
    total_recipients: int
    sent_count: int
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("/templates")
def list_campaign_templates(
    current_user: User = Depends(get_current_user),
):
    """Returns curated seasonal message templates with merge variables."""
    return DEFAULT_CAMPAIGN_TEMPLATES


@router.get("/segments", response_model=SegmentSummaryResponse)
def get_farmer_segments(
    season: str = Query(default="ALL", description="Season filter: KHARIF, RABI, ALL"),
    category: Optional[str] = Query(default=None, description="Category filter: Seeds, Pesticide, Fertilizer, All"),
    village: Optional[str] = Query(default=None, description="Filter by village / address"),
    khata_filter: str = Query(default="ALL", description="ALL, ZERO_DUE, WITH_UDHAR"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Intelligently segments the shop's farmer customer base from past sales & items.
    Computes village clusters, favorite categories, spend, and pending khata dues.
    """
    shop_id = current_user.shop_id

    # 1. Fetch all sales for this shop with non-empty phone numbers
    sales = (
        db.query(Sale)
        .filter(
            Sale.shop_id == shop_id,
            Sale.customer_phone.isnot(None),
            Sale.customer_phone != "",
        )
        .order_by(Sale.sale_date.desc())
        .all()
    )

    if not sales:
        return SegmentSummaryResponse(total_farmers=0, total_matching=0, villages=[], farmers=[])

    # 2. Group by normalized 10-digit phone number
    farmers_dict: Dict[str, Dict[str, Any]] = {}
    for s in sales:
        raw_phone = re.sub(r"\D", "", s.customer_phone or "")
        clean_phone = raw_phone[-10:] if len(raw_phone) >= 10 else raw_phone
        if not clean_phone or len(clean_phone) < 10:
            continue

        if clean_phone not in farmers_dict:
            # Extract village from customer_address
            addr = (s.customer_address or "").strip()
            v_name = _extract_village(addr)
            farmers_dict[clean_phone] = {
                "customer_name": (s.customer_name or "Farmer").strip(),
                "customer_phone": clean_phone,
                "customer_address": addr or None,
                "village": v_name or None,
                "total_bills": 0,
                "total_spend": _DEC_ZERO,
                "last_visit_date": s.sale_date.strftime("%Y-%m-%d") if s.sale_date else None,
                "credit_sales_sum": _DEC_ZERO,
                "sale_ids": [],
            }

        farmers_dict[clean_phone]["total_bills"] += 1
        farmers_dict[clean_phone]["total_spend"] += Decimal(str(s.grand_total or 0))
        farmers_dict[clean_phone]["sale_ids"].append(s.id)

        # Track credit purchases for khata calculation
        p_mode = (getattr(s.payment_method, "value", None) or str(s.payment_method or "")).upper()
        if "CREDIT" in p_mode or "UDHAR" in p_mode:
            farmers_dict[clean_phone]["credit_sales_sum"] += Decimal(str(s.grand_total or 0))

    # 3. Compute repayments per phone
    repayments = (
        db.query(
            KhataPayment.party_phone,
            func.sum(KhataPayment.amount).label("total_paid"),
        )
        .filter(
            KhataPayment.shop_id == shop_id,
            KhataPayment.ledger_type == "CUSTOMER",
            KhataPayment.party_phone.isnot(None),
        )
        .group_by(KhataPayment.party_phone)
        .all()
    )
    repay_map = {}
    for row in repayments:
        r_phone = re.sub(r"\D", "", row[0] or "")[-10:]
        repay_map[r_phone] = Decimal(str(row[1] or 0))

    # 4. Resolve product categories bought per farmer
    all_sale_ids = [sid for f in farmers_dict.values() for sid in f["sale_ids"][:5]]  # recent 5 sales per farmer
    category_map: Dict[int, List[str]] = {}
    if all_sale_ids:
        items = (
            db.query(SaleItem.sale_id, SaleItem.product_name, SaleItem.trade_name)
            .filter(SaleItem.sale_id.in_(all_sale_ids))
            .all()
        )
        for sid, p_name, t_name in items:
            cat = _infer_category(p_name, t_name)
            if sid not in category_map:
                category_map[sid] = []
            if cat not in category_map[sid]:
                category_map[sid].append(cat)

    all_villages = set()
    matching_farmers: List[FarmerSegmentItem] = []

    cat_filter = (category or "").strip().lower()
    vill_filter = (village or "").strip().lower()

    for phone, f in farmers_dict.items():
        if f["village"]:
            all_villages.add(f["village"])

        # Compute categories
        cats = set()
        for sid in f["sale_ids"]:
            for c in category_map.get(sid, []):
                cats.add(c)
        cat_list = sorted(list(cats)) if cats else ["General"]

        # Category filter
        if cat_filter and cat_filter != "all":
            matched_cat = any(cat_filter in c.lower() for c in cat_list)
            if not matched_cat:
                continue

        # Village filter
        if vill_filter:
            v_val = (f["village"] or f["customer_address"] or "").lower()
            if vill_filter not in v_val:
                continue

        # Khata balance calculation
        credit_total = f["credit_sales_sum"]
        paid_total = repay_map.get(phone, _DEC_ZERO)
        net_balance = max(_DEC_ZERO, credit_total - paid_total)

        if khata_filter == "ZERO_DUE" and net_balance > 0:
            continue
        if khata_filter == "WITH_UDHAR" and net_balance <= 0:
            continue

        matching_farmers.append(
            FarmerSegmentItem(
                customer_name=f["customer_name"],
                customer_phone=f["customer_phone"],
                customer_address=f["customer_address"],
                village=f["village"],
                total_bills=f["total_bills"],
                total_spend=f["total_spend"].quantize(Decimal("0.01")),
                last_visit_date=f["last_visit_date"],
                preferred_categories=cat_list,
                pending_khata_balance=net_balance.quantize(Decimal("0.01")),
            )
        )

    # Sort matching farmers by total spend descending
    matching_farmers.sort(key=lambda x: x.total_spend, reverse=True)

    return SegmentSummaryResponse(
        total_farmers=len(farmers_dict),
        total_matching=len(matching_farmers),
        villages=sorted(list(all_villages)),
        farmers=matching_farmers,
    )


@router.post("", response_model=CampaignResponse, status_code=status.HTTP_201_CREATED)
def create_campaign(
    payload: CampaignCreateRequest,
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db),
):
    """Create a new broadcast campaign record for tracking."""
    campaign = MarketingCampaign(
        shop_id=current_user.shop_id,
        campaign_name=sanitize_text(payload.campaign_name, 200),
        season=sanitize_text(payload.season.upper(), 50) or "KHARIF",
        target_crop=sanitize_text(payload.target_crop, 100) if payload.target_crop else None,
        target_village=sanitize_text(payload.target_village, 100) if payload.target_village else None,
        template_text=payload.template_text.strip(),
        total_recipients=payload.recipients_count,
        sent_count=0,
    )
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return campaign


@router.get("", response_model=List[CampaignResponse])
def list_campaigns(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List historical marketing campaigns for the current shop."""
    return (
        db.query(MarketingCampaign)
        .filter(MarketingCampaign.shop_id == current_user.shop_id)
        .order_by(MarketingCampaign.created_at.desc())
        .limit(50)
        .all()
    )


@router.put("/{campaign_id}/increment", response_model=CampaignResponse)
def increment_sent_count(
    campaign_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Increment sent count as cashier dispatches via WhatsApp deck."""
    campaign = (
        db.query(MarketingCampaign)
        .filter(
            MarketingCampaign.id == campaign_id,
            MarketingCampaign.shop_id == current_user.shop_id,
        )
        .first()
    )
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found.")

    campaign.sent_count = (campaign.sent_count or 0) + 1
    db.commit()
    db.refresh(campaign)
    return campaign


def _extract_village(address: str) -> Optional[str]:
    """Helper to extract village name from customer address string."""
    if not address:
        return None
    # If separated by comma, take first element
    parts = [p.strip() for p in address.split(",") if p.strip()]
    if parts:
        v = parts[0]
        v = re.sub(r"^(village|vill|po|at|p\.o\.)\b[\s.:-]*", "", v, flags=re.IGNORECASE).strip()
        if len(v) >= 2:
            return v.title()
    return None


def _infer_category(product_name: Optional[str], trade_name: Optional[str]) -> str:
    """Infer agricultural category from name keywords."""
    combined = f"{product_name or ''} {trade_name or ''}".lower()
    if any(k in combined for k in ["seed", "beej", "hybrid", "kaveri", "rashi"]):
        return "Seeds"
    if any(k in combined for k in ["dap", "urea", "mop", "npk", "fertilizer", "khad", "potash"]):
        return "Fertilizer"
    if any(k in combined for k in ["insecticide", "fungicide", "herbicide", "pesticide", "coragen", "fipronil", "proclaim", "tilt", "super"]):
        return "Pesticide"
    if any(k in combined for k in ["zinc", "boron", "chelated", "micronutrient", "humic"]):
        return "Micronutrients"
    return "General"
