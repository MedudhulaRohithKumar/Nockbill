"""Helpers to keep Product.current_stock, ProductBatch.current_stock, and ProductVariant.stock synchronized (SD3)."""
from decimal import Decimal
from typing import Optional
from sqlalchemy.orm import Session

from app.models.models import Product, ProductBatch, ProductVariant


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
    """Apply a manual stock adjustment delta to active ProductBatch rows (FIFO for deductions, latest for additions)."""
    if delta == Decimal("0"):
        return
    batches = (
        db.query(ProductBatch)
        .filter(ProductBatch.product_id == product.id, ProductBatch.is_active == True)
        .order_by(ProductBatch.expiry_date.asc(), ProductBatch.id.asc())
        .with_for_update()
        .all()
    )
    if not batches:
        return

    if delta > Decimal("0"):
        batches[-1].current_stock = Decimal(str(batches[-1].current_stock or 0)) + delta
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
