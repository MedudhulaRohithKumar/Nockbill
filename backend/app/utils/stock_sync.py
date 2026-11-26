"""Helpers to keep Product.current_stock, ProductBatch.current_stock, and ProductVariant.stock synchronized (SD3),
and to enforce category-aware FEFO / FIFO batch rotation across inward refills and POS billing."""
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy.orm import Session

from app.models.models import Product, ProductBatch, ProductVariant

CATEGORY_DEFAULT_GST_RATES: Dict[str, Decimal] = {
    "Fertilizer": Decimal("5"),
    "Pesticide": Decimal("18"),
    "Seeds": Decimal("0"),
    "Micronutrients": Decimal("12"),
    "Bio-Fertilizer": Decimal("5"),
    "Microgreens": Decimal("5"),
    "Organic": Decimal("0"),
    "Others": Decimal("0"),
}

_CATEGORY_CANONICAL_MAP: Dict[str, str] = {
    "fertilizer": "Fertilizer",
    "fertilizers": "Fertilizer",
    "pesticide": "Pesticide",
    "pesticides": "Pesticide",
    "insecticide": "Pesticide",
    "fungicide": "Pesticide",
    "herbicide": "Pesticide",
    "seed": "Seeds",
    "seeds": "Seeds",
    "micronutrient": "Micronutrients",
    "micronutrients": "Micronutrients",
    "bio-fertilizer": "Bio-Fertilizer",
    "biofertilizer": "Bio-Fertilizer",
    "bio fertilizer": "Bio-Fertilizer",
    "microgreen": "Microgreens",
    "microgreens": "Microgreens",
    "micro green": "Microgreens",
    "micro greens": "Microgreens",
    "organic": "Organic",
    "other": "Others",
    "others": "Others",
    "equipment": "Others",
    "hardware": "Others",
}


def normalize_category_name(raw_category: Optional[str]) -> str:
    """Normalize category labels (case-insensitive) to canonical ERP category IDs."""
    cleaned = (raw_category or "").strip()
    if not cleaned:
        return "Fertilizer"
    mapped = _CATEGORY_CANONICAL_MAP.get(cleaned.lower())
    return mapped if mapped else cleaned


def resolve_category_gst_rate(raw_category: Optional[str]) -> Decimal:
    """Return statutory GST rate (%) strictly associated with the product's category."""
    canonical = normalize_category_name(raw_category)
    return CATEGORY_DEFAULT_GST_RATES.get(canonical, Decimal("5"))


def _normalize_expiry_for_sort(raw_expiry: Optional[str]) -> str:
    """Normalize YYYY-MM or YYYY-MM-DD expiry strings for deterministic lexical FEFO comparison."""
    s = (raw_expiry or "").strip()
    if not s:
        return ""
    if len(s) == 7 and s[4] == "-":
        return f"{s}-28"
    return s[:10]


def batch_rotation_sort_key(
    batch_or_dict: Any,
    category: Optional[str] = None,
    today_iso: Optional[str] = None,
) -> Tuple[int, int, str, int]:
    """
    Category-aware stock rotation sort key:
    - 'Others' (hardware, sprayers, tarpaulins — no expiry): Strict FIFO (oldest batch id ASC sells first).
    - Expiry-bearing categories ('Pesticide', 'Seeds', 'Bio-Fertilizer', 'Microgreens', 'Micronutrients',
      plus 'Fertilizer' / 'Organic' batches that carry an expiry date):
      1) Non-expired batches ahead of already-expired batches;
      2) Valid expiry_date present (FEFO: earliest expiry_date ASC sells first);
      3) Batches without expiry_date fall back to FIFO (oldest batch id ASC sells first).
    """
    canonical_cat = normalize_category_name(category)
    today_str = today_iso or datetime.now(timezone.utc).strftime("%Y-%m-%d")

    if isinstance(batch_or_dict, dict):
        raw_exp = batch_or_dict.get("expiry_date")
        raw_id = batch_or_dict.get("id") or 0
    else:
        raw_exp = getattr(batch_or_dict, "expiry_date", None)
        raw_id = getattr(batch_or_dict, "id", 0) or 0

    batch_id = int(raw_id) if raw_id else 0

    if canonical_cat == "Others":
        return (0, 1, "9999-12-31", batch_id)

    exp_norm = _normalize_expiry_for_sort(raw_exp)
    if exp_norm:
        is_expired = 1 if exp_norm < today_str else 0
        return (is_expired, 0, exp_norm, batch_id)

    return (0, 1, "9999-12-31", batch_id)


def get_ordered_active_batches(
    db: Session,
    product: Product,
    *,
    only_in_stock: bool = False,
    lock: bool = False,
) -> List[ProductBatch]:
    """Return active ProductBatch rows sorted by category-aware FEFO/FIFO priority."""
    q = db.query(ProductBatch).filter(
        ProductBatch.product_id == product.id,
        ProductBatch.is_active == True,
    )
    if only_in_stock:
        q = q.filter(ProductBatch.current_stock > 0)
    q = q.order_by(ProductBatch.id.asc())
    if lock:
        q = q.with_for_update()
    rows = q.all()
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    rows.sort(key=lambda b: batch_rotation_sort_key(b, product.category, today_str))
    return rows


def sync_product_priority_batch(db: Session, product: Product) -> Optional[ProductBatch]:
    """
    Keep Product.batch_number, Product.expiry_date, and Product.manufacture_date synchronized
    with the #1 priority sellable batch (FEFO/FIFO) so counter search, Fast-Till, and barcode
    labels always reflect the batch that must sell next.
    """
    in_stock_batches = get_ordered_active_batches(db, product, only_in_stock=True, lock=False)
    priority = in_stock_batches[0] if in_stock_batches else None
    if priority is None:
        all_active = get_ordered_active_batches(db, product, only_in_stock=False, lock=False)
        priority = all_active[-1] if all_active else None

    if priority is not None:
        if priority.batch_number:
            product.batch_number = priority.batch_number
        if normalize_category_name(product.category) == "Others":
            product.expiry_date = None
        else:
            product.expiry_date = priority.expiry_date or None
        if priority.manufacture_date:
            product.manufacture_date = priority.manufacture_date
    return priority


def deduct_stock_across_batches(
    db: Session,
    product: Product,
    qty_to_deduct: Decimal,
    *,
    preferred_batch_id: Optional[int] = None,
    preferred_batch_number: Optional[str] = None,
) -> Optional[ProductBatch]:
    """
    Deduct `qty_to_deduct` across a product's active batches without losing batch-to-product parity:
    1. If `preferred_batch_id` or `preferred_batch_number` matches an in-stock batch, consume from it first.
    2. Cascade any remaining quantity across remaining in-stock batches in category-aware FEFO/FIFO order.
    Returns the primary ProductBatch consumed for the SaleItem snapshot.
    """
    batches = get_ordered_active_batches(db, product, only_in_stock=False, lock=True)
    if not batches:
        return None

    ordered_candidates: List[ProductBatch] = []
    preferred: Optional[ProductBatch] = None

    if preferred_batch_id:
        preferred = next((b for b in batches if b.id == preferred_batch_id), None)
    if preferred is None and preferred_batch_number:
        clean_bn = preferred_batch_number.strip()
        preferred = next((b for b in batches if b.batch_number == clean_bn), None)

    if preferred is not None and Decimal(str(preferred.current_stock or 0)) > Decimal("0"):
        ordered_candidates.append(preferred)

    for b in batches:
        if b not in ordered_candidates and Decimal(str(b.current_stock or 0)) > Decimal("0"):
            ordered_candidates.append(b)

    primary_batch: Optional[ProductBatch] = ordered_candidates[0] if ordered_candidates else (preferred or batches[0])
    remaining = Decimal(str(qty_to_deduct or 0))

    for candidate in ordered_candidates:
        if remaining <= Decimal("0"):
            break
        avail = Decimal(str(candidate.current_stock or 0))
        if avail <= Decimal("0"):
            continue
        ded = min(avail, remaining)
        candidate.current_stock = avail - ded
        remaining -= ded

    db.flush()
    sync_product_priority_batch(db, product)
    return primary_batch


def sync_variant_stock(
    db: Session,
    product: Product,
    delta: Decimal,
    matched_price: Optional[Decimal] = None,
) -> None:
    """
    Apply a stock delta (positive for inward/return, negative for sale/damage) to active
    ProductVariant rows so variant stock does not drift from Product.current_stock (SD3).
    """
    variants = (
        db.query(ProductVariant)
        .filter(ProductVariant.product_id == product.id, ProductVariant.is_active == True)
        .order_by(ProductVariant.id.asc())
        .with_for_update()
        .all()
    )
    if not variants:
        return

    if len(variants) == 1:
        variants[0].stock = max(Decimal("0"), Decimal(str(product.current_stock or 0)))
        return

    target = None
    if matched_price is not None:
        target = next(
            (v for v in variants if v.selling_price is not None and abs(Decimal(str(v.selling_price)) - matched_price) <= Decimal("0.01")),
            None,
        )
    if target is None:
        target = variants[0]

    target.stock = max(Decimal("0"), Decimal(str(target.stock or 0)) + delta)


def sync_batch_stock_delta(db: Session, product: Product, delta: Decimal) -> None:
    """Apply a manual stock adjustment delta to active ProductBatch rows (FEFO/FIFO for deductions, latest for additions)."""
    if delta == Decimal("0"):
        return
    batches = get_ordered_active_batches(db, product, only_in_stock=False, lock=True)
    if not batches:
        return

    if delta > Decimal("0"):
        newest = max(batches, key=lambda b: b.id or 0)
        newest.current_stock = Decimal(str(newest.current_stock or 0)) + delta
        db.flush()
        sync_product_priority_batch(db, product)
        return

    remaining = abs(delta)
    for b in batches:
        if remaining <= Decimal("0"):
            break
        avail = Decimal(str(b.current_stock or 0))
        if avail > Decimal("0"):
            ded = min(avail, remaining)
            b.current_stock = avail - ded
            remaining -= ded
    db.flush()
    sync_product_priority_batch(db, product)
