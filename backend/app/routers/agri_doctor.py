"""
Agri Doctor Router: Crop Advisory, Pest-Disease Identification,
Approved Technical Molecules, Standard Field Dosages, and Real-Time In-Stock Product Matcher.
Strictly scoped by authenticated tenant (current_user.shop_id).
"""
from decimal import Decimal
import re
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, selectinload

from app.data.agri_doctor_kb import AGRI_DOCTOR_KNOWLEDGE_BASE
from app.database.base import get_db
from app.models.models import Product, ProductBatch, User
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/agri-doctor", tags=["Agri Doctor & Crop Advisory"])


class MatchingProductItem(BaseModel):
    id: int
    product_name: str
    trade_name: Optional[str] = None
    company_name: Optional[str] = None
    category: Optional[str] = None
    unit: Optional[str] = None
    selling_price: Decimal = Decimal("0.00")
    mrp: Optional[Decimal] = None
    current_stock: Decimal = Decimal("0.00")
    batch_number: Optional[str] = None
    expiry_date: Optional[str] = None
    in_stock: bool = True


class AgriDoctorAdvisoryDetail(BaseModel):
    crop_name: str
    hindi_name: str
    pest_disease: str
    disease_hindi: str
    category: str
    technical_molecule: str
    dosage_per_pump: str
    dosage_per_acre: str
    symptoms: str
    advisory_notes: str
    matching_products: List[MatchingProductItem] = Field(default_factory=list)


class CropSummary(BaseModel):
    crop_name: str
    hindi_name: str
    pest_count: int
    pests: List[str] = Field(default_factory=list)


@router.get("/crops", response_model=List[CropSummary])
def get_crops_list(
    current_user: User = Depends(get_current_user),
):
    """List all supported crops, localized names, and associated pests/diseases."""
    crop_map: Dict[str, Dict[str, Any]] = {}
    for entry in AGRI_DOCTOR_KNOWLEDGE_BASE:
        c_name = entry["crop_name"]
        if c_name not in crop_map:
            crop_map[c_name] = {
                "crop_name": c_name,
                "hindi_name": entry["hindi_name"],
                "pests": [],
            }
        crop_map[c_name]["pests"].append(entry["pest_disease"])

    results = []
    for c_name in sorted(crop_map.keys()):
        pests = crop_map[c_name]["pests"]
        results.append(
            CropSummary(
                crop_name=c_name,
                hindi_name=crop_map[c_name]["hindi_name"],
                pest_count=len(pests),
                pests=pests,
            )
        )
    return results


@router.get("/advisories", response_model=List[AgriDoctorAdvisoryDetail])
def list_advisories(
    crop: Optional[str] = Query(default=None),
    pest: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Search crop advisories and resolve matching products in the shop's active inventory.
    """
    query_crop = (crop or "").strip().lower()
    query_pest = (pest or "").strip().lower()
    query_search = (search or "").strip().lower()

    filtered_entries = []
    for entry in AGRI_DOCTOR_KNOWLEDGE_BASE:
        if query_crop and query_crop not in entry["crop_name"].lower():
            continue
        if query_pest and query_pest not in entry["pest_disease"].lower():
            continue
        if query_search:
            text_corpus = (
                f"{entry['crop_name']} {entry['hindi_name']} {entry['pest_disease']} "
                f"{entry['disease_hindi']} {entry['technical_molecule']} {entry['symptoms']} {entry['keywords']}"
            ).lower()
            if query_search not in text_corpus:
                continue
        filtered_entries.append(entry)

    results: List[AgriDoctorAdvisoryDetail] = []
    for entry in filtered_entries:
        matching_products = _resolve_in_stock_products(db, current_user.shop_id, entry)
        results.append(
            AgriDoctorAdvisoryDetail(
                crop_name=entry["crop_name"],
                hindi_name=entry["hindi_name"],
                pest_disease=entry["pest_disease"],
                disease_hindi=entry["disease_hindi"],
                category=entry["category"],
                technical_molecule=entry["technical_molecule"],
                dosage_per_pump=entry["dosage_per_pump"],
                dosage_per_acre=entry["dosage_per_acre"],
                symptoms=entry["symptoms"],
                advisory_notes=entry["advisory_notes"],
                matching_products=matching_products,
            )
        )
    return results


@router.get("/recommend", response_model=AgriDoctorAdvisoryDetail)
def get_recommendation_for_problem(
    crop: str = Query(..., description="Crop name e.g. Cotton, Paddy, Chilli"),
    pest_disease: str = Query(..., description="Pest or disease name e.g. Pink Bollworm"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Given a Crop and a Pest/Disease, returns official advisory, dosage,
    and matches products currently in-stock on the shop's shelves.
    """
    c_clean = crop.strip().lower()
    p_clean = pest_disease.strip().lower()

    target_entry = None
    for entry in AGRI_DOCTOR_KNOWLEDGE_BASE:
        if c_clean in entry["crop_name"].lower() and p_clean in entry["pest_disease"].lower():
            target_entry = entry
            break

    if not target_entry:
        # Fallback partial match on pest
        for entry in AGRI_DOCTOR_KNOWLEDGE_BASE:
            if p_clean in entry["pest_disease"].lower():
                target_entry = entry
                break

    if not target_entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No agronomic advisory found for crop '{crop}' and pest '{pest_disease}'.",
        )

    matching_products = _resolve_in_stock_products(db, current_user.shop_id, target_entry)
    return AgriDoctorAdvisoryDetail(
        crop_name=target_entry["crop_name"],
        hindi_name=target_entry["hindi_name"],
        pest_disease=target_entry["pest_disease"],
        disease_hindi=target_entry["disease_hindi"],
        category=target_entry["category"],
        technical_molecule=target_entry["technical_molecule"],
        dosage_per_pump=target_entry["dosage_per_pump"],
        dosage_per_acre=target_entry["dosage_per_acre"],
        symptoms=target_entry["symptoms"],
        advisory_notes=target_entry["advisory_notes"],
        matching_products=matching_products,
    )


def _resolve_in_stock_products(
    db: Session,
    shop_id: int,
    advisory_entry: Dict[str, str],
) -> List[MatchingProductItem]:
    """
    Query shop inventory for active products matching the technical molecule or keywords.
    Eagerly loads batches to provide real batch numbers, expiry dates, and selling prices.
    """
    raw_keywords = advisory_entry.get("keywords", "").split(",")
    keywords = [k.strip().lower() for k in raw_keywords if len(k.strip()) >= 3]

    # Also extract meaningful words from the technical molecule (e.g. "Emamectin", "Benzoate")
    molecule_words = [
        re.sub(r"[^a-zA-Z]", "", w).lower()
        for w in advisory_entry.get("technical_molecule", "").split()
        if len(re.sub(r"[^a-zA-Z]", "", w)) >= 4
    ]
    search_tokens = list(set(keywords + molecule_words))

    if not search_tokens:
        return []

    # Build OR filter across product_name, trade_name, and category_attributes
    clauses = []
    for token in search_tokens[:8]:  # Limit tokens for query efficiency
        pattern = f"%{token}%"
        clauses.append(func.lower(Product.product_name).like(pattern))
        clauses.append(func.lower(Product.trade_name).like(pattern))
        clauses.append(func.lower(Product.category_attributes).like(pattern))

    products = (
        db.query(Product)
        .options(selectinload(Product.batches))
        .filter(
            Product.shop_id == shop_id,
            Product.is_active.is_(True),
            or_(*clauses),
        )
        .order_by(Product.current_stock.desc(), Product.product_name.asc())
        .limit(10)
        .all()
    )

    items: List[MatchingProductItem] = []
    for prod in products:
        # Find first active batch with available stock or newest batch
        active_batch = None
        for b in prod.batches:
            if b.is_active and (b.current_stock or 0) > 0:
                active_batch = b
                break
        if not active_batch and prod.batches:
            active_batch = prod.batches[0]

        batch_no = active_batch.batch_number if active_batch else prod.batch_number
        exp_date = active_batch.expiry_date if active_batch else prod.expiry_date
        mrp_val = active_batch.mrp if active_batch and active_batch.mrp else prod.selling_price
        sell_price = active_batch.selling_price if active_batch else prod.selling_price
        curr_stock = Decimal(str(prod.current_stock or 0))

        items.append(
            MatchingProductItem(
                id=prod.id,
                product_name=prod.product_name,
                trade_name=prod.trade_name,
                company_name=prod.company_name,
                category=prod.category,
                unit=prod.unit,
                selling_price=Decimal(str(sell_price or 0)),
                mrp=Decimal(str(mrp_val or sell_price or 0)),
                current_stock=curr_stock,
                batch_number=batch_no,
                expiry_date=exp_date,
                in_stock=(curr_stock > 0),
            )
        )
    return items
