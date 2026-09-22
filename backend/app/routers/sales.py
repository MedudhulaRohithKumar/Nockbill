from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from decimal import Decimal
from datetime import datetime
from app.database.base import get_db
from app.models.models import (
    Sale, SaleItem, Product, InventoryTransaction, InventoryTxType,
    GstTransaction, ShopSettings, AuditLog, AuditAction, User
)
from app.schemas.schemas import SaleCreate, SaleResponse, SaleListResponse
from app.utils.auth import get_current_user
from app.utils.helpers import generate_invoice_number

router = APIRouter(prefix="/api/sales", tags=["Sales"])


def _calculate_item(item_data, product: Optional[Product] = None):
    """Compute gst_amount and total for a sale item."""
    qty = Decimal(str(item_data.quantity))
    price = Decimal(str(item_data.price))
    gst_rate = Decimal(str(item_data.gst_rate))
    taxable = qty * price
    gst_amount = (taxable * gst_rate / 100).quantize(Decimal("0.01"))
    total = taxable + gst_amount
    return taxable, gst_amount, total


@router.post("", response_model=SaleResponse, status_code=201)
def create_sale(
    payload: SaleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # ── Idempotency check ──────────────────────────────────────
    if payload.idempotency_key:
        existing = db.query(Sale).filter(
            Sale.idempotency_key == payload.idempotency_key
        ).first()
        if existing:
            return existing  # replay-safe response

    # ── Validate stock before transaction ──────────────────────
    for item in payload.items:
        if item.product_id:
            product = db.query(Product).filter(Product.id == item.product_id).first()
            if product and product.current_stock < Decimal(str(item.quantity)):
                raise HTTPException(
                    400,
                    f"Insufficient stock for '{product.product_name}'. "
                    f"Available: {product.current_stock}",
                )

    # ── Get / create shop settings ─────────────────────────────
    shop = db.query(ShopSettings).first()
    if not shop:
        shop = ShopSettings(shop_name="My Fertilizer Shop")
        db.add(shop)
        db.flush()

    # ── Generate invoice number ────────────────────────────────
    sale_date = datetime.utcnow()
    invoice_number = generate_invoice_number(
        shop.invoice_prefix, shop.invoice_counter, sale_date
    )
    shop.invoice_counter += 1

    # ── Create Sale (all-or-nothing transaction) ───────────────
    try:
        subtotal = Decimal("0")
        total_gst = Decimal("0")
        grand_total = Decimal("0")

        sale = Sale(
            invoice_number=invoice_number,
            idempotency_key=payload.idempotency_key,
            customer_name=payload.customer_name,
            customer_phone=payload.customer_phone,
            payment_method=payload.payment_method,
            notes=payload.notes,
            sale_date=sale_date,
            created_by=current_user.id,
        )
        db.add(sale)
        db.flush()  # get sale.id

        gst_buckets: dict[Decimal, dict] = {}  # gst_rate -> {taxable, gst}

        for item_data in payload.items:
            taxable, gst_amount, total = _calculate_item(item_data)
            subtotal += taxable
            total_gst += gst_amount
            grand_total += total

            sale_item = SaleItem(
                sale_id=sale.id,
                product_id=item_data.product_id,
                product_name=item_data.product_name,
                company_name=item_data.company_name,
                net_content=item_data.net_content,
                quantity=item_data.quantity,
                price=item_data.price,
                gst_rate=item_data.gst_rate,
                gst_amount=gst_amount,
                total=total,
                manufacture_date=item_data.manufacture_date,
                expiry_date=item_data.expiry_date,
            )
            db.add(sale_item)

            # Accumulate GST by rate
            rate = Decimal(str(item_data.gst_rate))
            if rate not in gst_buckets:
                gst_buckets[rate] = {"taxable": Decimal("0"), "gst": Decimal("0")}
            gst_buckets[rate]["taxable"] += taxable
            gst_buckets[rate]["gst"] += gst_amount

            # ── Update inventory ────────────────────────────────
            if item_data.product_id:
                product = db.query(Product).filter(
                    Product.id == item_data.product_id
                ).with_for_update().first()
                if product:
                    prev_stock = product.current_stock
                    product.current_stock -= Decimal(str(item_data.quantity))
                    inv_tx = InventoryTransaction(
                        product_id=product.id,
                        transaction_type=InventoryTxType.SALE,
                        quantity=item_data.quantity,
                        previous_stock=prev_stock,
                        new_stock=product.current_stock,
                        reference_id=sale.id,
                        reference_type="SALE",
                    )
                    db.add(inv_tx)

        # ── Update sale totals ─────────────────────────────────
        sale.subtotal = subtotal.quantize(Decimal("0.01"))
        sale.gst_amount = total_gst.quantize(Decimal("0.01"))
        sale.grand_total = grand_total.quantize(Decimal("0.01"))

        # ── Create GST transactions ────────────────────────────
        for rate, bucket in gst_buckets.items():
            gst_tx = GstTransaction(
                sale_id=sale.id,
                invoice_number=invoice_number,
                taxable_amount=bucket["taxable"].quantize(Decimal("0.01")),
                gst_rate=rate,
                gst_amount=bucket["gst"].quantize(Decimal("0.01")),
                transaction_date=sale_date,
            )
            db.add(gst_tx)

        # ── Audit log ──────────────────────────────────────────
        db.add(AuditLog(
            user_id=current_user.id,
            action=AuditAction.SALE_CREATE,
            reference_id=sale.id,
            reference_type="Sale",
            description=f"Invoice {invoice_number}, Total ₹{sale.grand_total}",
        ))

        db.commit()
        db.refresh(sale)
        return serialize_sale(sale)

    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Failed to save bill: {str(e)}")


def serialize_sale(s: Sale) -> dict:
    sub = float(s.subtotal or 0)
    gst = float(s.gst_amount or 0)
    half_gst = round(gst / 2.0, 2)
    s_date = s.sale_date.isoformat() if s.sale_date else datetime.utcnow().isoformat()
    p_mode = s.payment_method.value if hasattr(s.payment_method, "value") else str(s.payment_method or "Cash")
    return {
        "id": s.id,
        "invoice_number": s.invoice_number,
        "customer_name": s.customer_name or "Cash Customer / Farmer",
        "customer_phone": s.customer_phone or "",
        "payment_method": p_mode,
        "payment_mode": p_mode,
        "sale_date": s_date,
        "invoice_date": s_date,
        "subtotal": sub,
        "gst_amount": gst,
        "total_taxable": sub,
        "total_cgst": half_gst,
        "total_sgst": half_gst,
        "total_igst": 0.0,
        "round_off": 0.0,
        "grand_total": float(s.grand_total or 0),
        "notes": s.notes or "",
        "status": "Completed",
        "items": [
            {
                "id": it.id,
                "product_id": it.product_id,
                "product_name": it.product_name,
                "company_name": it.company_name,
                "quantity": float(it.quantity or 0),
                "price": float(it.price or 0),
                "unit_price": float(it.price or 0),
                "gst_rate": float(it.gst_rate or 0),
                "gst_amount": float(it.gst_amount or 0),
                "taxable_amount": float(it.total or 0) - float(it.gst_amount or 0),
                "total_amount": float(it.total or 0),
                "total": float(it.total or 0),
            }
            for it in (s.items or [])
        ]
    }


@router.get("")
def list_sales(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sales = db.query(Sale).order_by(Sale.sale_date.desc()).offset(skip).limit(limit).all()
    return [serialize_sale(s) for s in sales]


@router.get("/{sale_id}")
def get_sale(
    sale_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not sale:
        raise HTTPException(404, "Sale not found")
    return serialize_sale(sale)
