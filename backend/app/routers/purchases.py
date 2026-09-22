from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from decimal import Decimal
from datetime import datetime
from app.database.base import get_db
from app.models.models import (
    Purchase, PurchaseItem, Product,
    InventoryTransaction, InventoryTxType,
    AuditLog, AuditAction, User
)
from app.schemas.schemas import PurchaseCreate, PurchaseResponse
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/purchases", tags=["Purchases"])


@router.post("", response_model=PurchaseResponse, status_code=201)
def create_purchase(
    payload: PurchaseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        subtotal = Decimal("0")
        total_gst = Decimal("0")

        purchase = Purchase(
            supplier_name=payload.supplier_name,
            invoice_number=payload.invoice_number,
            purchase_date=payload.purchase_date or datetime.utcnow(),
            notes=payload.notes,
            created_by=current_user.id,
        )
        db.add(purchase)
        db.flush()

        for item_data in payload.items:
            qty = Decimal(str(item_data.quantity))
            price = Decimal(str(item_data.purchase_price))
            gst_rate = Decimal(str(item_data.gst_rate))
            taxable = qty * price
            gst_amount = (taxable * gst_rate / 100).quantize(Decimal("0.01"))
            total = taxable + gst_amount
            subtotal += taxable
            total_gst += gst_amount

            p_item = PurchaseItem(
                purchase_id=purchase.id,
                product_id=item_data.product_id,
                quantity=qty,
                purchase_price=price,
                gst_rate=gst_rate,
                total=total,
            )
            db.add(p_item)

            # Update product stock + purchase price
            product = db.query(Product).filter(
                Product.id == item_data.product_id
            ).with_for_update().first()
            if not product:
                raise HTTPException(404, f"Product {item_data.product_id} not found")

            prev_stock = product.current_stock
            product.current_stock += qty
            product.purchase_price = price  # update latest purchase price

            inv_tx = InventoryTransaction(
                product_id=product.id,
                transaction_type=InventoryTxType.PURCHASE,
                quantity=qty,
                previous_stock=prev_stock,
                new_stock=product.current_stock,
                reference_id=purchase.id,
                reference_type="PURCHASE",
            )
            db.add(inv_tx)

        purchase.subtotal = subtotal.quantize(Decimal("0.01"))
        purchase.gst_amount = total_gst.quantize(Decimal("0.01"))
        purchase.grand_total = (subtotal + total_gst).quantize(Decimal("0.01"))

        db.add(AuditLog(
            user_id=current_user.id,
            action=AuditAction.PURCHASE_CREATE,
            reference_id=purchase.id,
            reference_type="Purchase",
        ))

        db.commit()
        db.refresh(purchase)
        return purchase

    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Failed to save purchase: {str(e)}")


def serialize_purchase(p: Purchase) -> dict:
    b_date = p.purchase_date.strftime("%Y-%m-%d") if p.purchase_date else ""
    return {
        "id": p.id,
        "supplier_name": p.supplier_name or "Supplier Depot",
        "supplier_gstin": getattr(p, "supplier_gstin", None) or "",
        "invoice_number": p.invoice_number or f"INV-PUR-{p.id}",
        "bill_number": p.invoice_number or f"INV-PUR-{p.id}",
        "purchase_date": p.purchase_date.isoformat() if p.purchase_date else None,
        "bill_date": b_date,
        "subtotal": float(p.subtotal or 0),
        "gst_amount": float(p.gst_amount or 0),
        "total_tax": float(p.gst_amount or 0),
        "grand_total": float(p.grand_total or 0),
        "total_amount": float(p.grand_total or 0),
        "status": "Received",
        "notes": p.notes or "",
        "items": [
            {
                "id": it.id,
                "product_id": it.product_id,
                "quantity": float(it.quantity or 0),
                "purchase_price": float(it.purchase_price or 0),
                "gst_rate": float(it.gst_rate or 0),
                "total_amount": float(it.total or 0),
                "total": float(it.total or 0),
            }
            for it in (p.items or [])
        ]
    }


@router.get("")
def list_purchases(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    purchases = db.query(Purchase).order_by(Purchase.purchase_date.desc()).offset(skip).limit(limit).all()
    return [serialize_purchase(p) for p in purchases]


@router.get("/{purchase_id}")
def get_purchase(
    purchase_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    purchase = db.query(Purchase).filter(Purchase.id == purchase_id).first()
    if not purchase:
        raise HTTPException(404, "Purchase not found")
    return serialize_purchase(purchase)

