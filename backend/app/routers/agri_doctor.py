"""
Agri Doctor Router:
1. Public Landing Page Informational Q&A (`POST /api/agri-doctor/ask-public`):
   - Answers ONLY agriculture-related questions; strictly blocks off-topic queries.
   - Protected by multi-worker IP rate limiting.
2. Authenticated Dashboard & POS Recommendation Engine (`POST /api/agri-doctor/diagnose`):
   - Diagnoses farmer-described crop problems, explains likely root cause, prescribes
     ICAR / CIB&RC-approved technical molecules, and matches ONLY verified, unexpired,
     crop-safe products from the authenticated shop's inventory (`current_user.shop_id`).
3. Browseable Reference Endpoints (`GET /crops`, `GET /advisories`, `GET /recommend`).
"""
from decimal import Decimal
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.data.agri_doctor_kb import AGRI_DOCTOR_KNOWLEDGE_BASE
from app.database.base import get_db
from app.models.models import User
from app.services.agri_doctor_ai import (
    answer_public_agriculture_question,
    diagnose_crop_problem_and_match_inventory,
    match_crop_safe_inventory,
)
from app.utils.auth import get_current_user, get_current_user_optional
from app.utils.rate_limit import enforce_rate_limit, get_client_ip

router = APIRouter(prefix="/api/agri-doctor", tags=["Agri Doctor & Crop Advisory"])

_PUBLIC_QA_RATE_LIMIT = 20
_PUBLIC_QA_WINDOW_SECONDS = 300


class MatchingProductItem(BaseModel):
    id: int
    product_name: str
    trade_name: Optional[str] = None
    company_name: Optional[str] = None
    category: Optional[str] = None
    unit: Optional[str] = None
    hsn_code: Optional[str] = None
    gst_rate: Decimal = Decimal("0.00")
    selling_price: Decimal = Decimal("0.00")
    mrp: Optional[Decimal] = None
    current_stock: Decimal = Decimal("0.00")
    batch_number: Optional[str] = None
    expiry_date: Optional[str] = None
    in_stock: bool = True
    matched_molecule: Optional[str] = None


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
    root_cause: Optional[str] = None
    crop_safety_warning: Optional[str] = None
    advisory_notes: str
    matching_products: List[MatchingProductItem] = Field(default_factory=list)


class CropSummary(BaseModel):
    crop_name: str
    hindi_name: str
    pest_count: int
    pests: List[str] = Field(default_factory=list)


class PublicAgriQuestionRequest(BaseModel):
    question: str = Field(..., min_length=3, max_length=600)


class PublicAgriQuestionResponse(BaseModel):
    is_agriculture_related: bool
    topic: str
    answer: str
    key_recommendations: List[str] = Field(default_factory=list)
    safety_note: str
    provider: str


class ApprovedMoleculeRecommendation(BaseModel):
    technical_molecule: str
    active_keywords: List[str] = Field(default_factory=list)
    verified_brands: List[str] = Field(default_factory=list)
    dosage_per_pump: str
    dosage_per_acre: str
    phi_and_application: str


class DashboardDiagnoseRequest(BaseModel):
    problem_description: str = Field(..., min_length=3, max_length=800)
    crop_name: Optional[str] = Field(default=None, max_length=80)


class DashboardDiagnoseResponse(BaseModel):
    is_agriculture_related: bool
    detected_crop: str
    likely_condition: str
    confidence: str
    treatment_category: str
    root_cause_explanation: str
    approved_molecules: List[ApprovedMoleculeRecommendation] = Field(default_factory=list)
    verification_checklist: List[str] = Field(default_factory=list)
    crop_safety_warnings: List[str] = Field(default_factory=list)
    matching_products: List[MatchingProductItem] = Field(default_factory=list)
    out_of_stock_notice: Optional[str] = None
    provider: str


def _resolve_in_stock_products(
    db: Session,
    shop_id: int,
    advisory_entry: Dict[str, Any],
) -> List[MatchingProductItem]:
    """Resolve strictly crop-safe, unexpired in-stock products matching an advisory's active molecule."""
    approved_spec = [
        {
            "technical_molecule": advisory_entry.get("technical_molecule", ""),
            "active_keywords": list(advisory_entry.get("active_molecules") or []),
            "verified_brands": list(advisory_entry.get("verified_brands") or []),
        }
    ]
    raw_matches = match_crop_safe_inventory(
        db=db,
        shop_id=shop_id,
        target_crop=str(advisory_entry.get("crop_name") or ""),
        treatment_category=str(advisory_entry.get("category") or ""),
        approved_molecules=approved_spec,
    )
    return [MatchingProductItem(**m) for m in raw_matches]


def _serialize_advisory_entry(
    entry: Dict[str, Any],
    matching_products: List[MatchingProductItem],
) -> AgriDoctorAdvisoryDetail:
    return AgriDoctorAdvisoryDetail(
        crop_name=entry["crop_name"],
        hindi_name=entry["hindi_name"],
        pest_disease=entry["pest_disease"],
        disease_hindi=entry["disease_hindi"],
        category=entry["category"],
        technical_molecule=entry["technical_molecule"],
        dosage_per_pump=entry["dosage_per_pump"],
        dosage_per_acre=entry["dosage_per_acre"],
        symptoms=entry["symptoms"],
        root_cause=entry.get("root_cause"),
        crop_safety_warning=entry.get("crop_safety_warning"),
        advisory_notes=entry["advisory_notes"],
        matching_products=matching_products,
    )


@router.post("/ask-public", response_model=PublicAgriQuestionResponse)
def ask_public_agri_doctor(
    payload: PublicAgriQuestionRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Public Landing Page informational endpoint.
    Answers agriculture-related questions ONLY and blocks off-topic queries.
    Never exposes tenant inventory or internal shop data.
    """
    client_ip = get_client_ip(request)
    enforce_rate_limit(
        db=db,
        action="agri_doctor_public",
        key=client_ip,
        limit=_PUBLIC_QA_RATE_LIMIT,
        window_seconds=_PUBLIC_QA_WINDOW_SECONDS,
    )
    result = answer_public_agriculture_question(payload.question)
    return PublicAgriQuestionResponse(**result)


@router.post("/diagnose", response_model=DashboardDiagnoseResponse)
def diagnose_and_recommend_inventory(
    payload: DashboardDiagnoseRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Authenticated Dashboard & POS Counter Diagnostic Recommender.
    Explains the likely root cause, prescribes CIB&RC-approved technical molecules,
    and matches ONLY verified, crop-safe, unexpired products from `current_user.shop_id`.
    """
    shop_id = getattr(current_user, "shop_id", 1) or 1
    result = diagnose_crop_problem_and_match_inventory(
        db=db,
        shop_id=shop_id,
        problem_description=payload.problem_description,
        crop_name=payload.crop_name,
    )
    return DashboardDiagnoseResponse(**result)


@router.get("/crops", response_model=List[CropSummary])
def get_crops_list(
    current_user: Optional[User] = Depends(get_current_user_optional),
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
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """Search crop advisories and resolve crop-safe matching products in the shop's active inventory."""
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
                f"{entry['disease_hindi']} {entry['technical_molecule']} {entry['symptoms']} "
                f"{entry.get('root_cause', '')} {entry.get('keywords', '')}"
            ).lower()
            if query_search not in text_corpus:
                continue
        filtered_entries.append(entry)

    results: List[AgriDoctorAdvisoryDetail] = []
    for entry in filtered_entries:
        matching_products = (
            _resolve_in_stock_products(db, current_user.shop_id, entry)
            if (current_user and getattr(current_user, "shop_id", None))
            else []
        )
        results.append(_serialize_advisory_entry(entry, matching_products))
    return results


@router.get("/recommend", response_model=AgriDoctorAdvisoryDetail)
def get_recommendation_for_problem(
    crop: str = Query(..., description="Crop name e.g. Cotton, Paddy, Chilli"),
    pest_disease: str = Query(..., description="Pest or disease name e.g. Pink Bollworm"),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """Given a Crop and a Pest/Disease, return official advisory, dosage, and crop-safe in-stock matches."""
    c_clean = crop.strip().lower()
    p_clean = pest_disease.strip().lower()

    target_entry = None
    for entry in AGRI_DOCTOR_KNOWLEDGE_BASE:
        if c_clean in entry["crop_name"].lower() and p_clean in entry["pest_disease"].lower():
            target_entry = entry
            break

    if not target_entry:
        for entry in AGRI_DOCTOR_KNOWLEDGE_BASE:
            if p_clean in entry["pest_disease"].lower():
                target_entry = entry
                break

    if not target_entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No agronomic advisory found for crop '{crop}' and pest '{pest_disease}'.",
        )

    matching_products = (
        _resolve_in_stock_products(db, current_user.shop_id, target_entry)
        if (current_user and getattr(current_user, "shop_id", None))
        else []
    )
    return _serialize_advisory_entry(target_entry, matching_products)
