from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from decimal import Decimal
from app.database.base import get_db
from app.models.models import (
    Product, InventoryTransaction, InventoryTxType,
    AuditLog, AuditAction, User
)
from app.schemas.schemas import InventoryAdjustRequest
from app.routers.products import serialize_product
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/inventory", tags=["Inventory"])



@router.post("/adjust")
def adjust_inventory(
    payload: InventoryAdjustRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    shop_id = getattr(current_user, "shop_id", 1) or 1
    product = db.query(Product).filter(
        Product.id == payload.product_id,
        Product.shop_id == shop_id
    ).with_for_update().first()
    if not product:
        raise HTTPException(404, "Product not found")

    # Handle alias parameters from frontend
    tx_type_str = payload.adjustment_type or (payload.transaction_type.value if hasattr(payload.transaction_type, "value") else str(payload.transaction_type or "ADJUSTMENT"))
    tx_type_str = tx_type_str.upper()

    try:
        tx_enum = InventoryTxType(tx_type_str)
    except ValueError:
        if tx_type_str == "AUDIT_CORRECTION":
            tx_enum = InventoryTxType.ADJUSTMENT
        else:
            tx_enum = InventoryTxType.ADJUSTMENT

    qty = Decimal(str(payload.quantity))
    prev_stock = product.current_stock
    notes_str = payload.notes or payload.reason or ""

    increase_types = {InventoryTxType.PURCHASE, InventoryTxType.RETURN}
    decrease_types = {InventoryTxType.SALE, InventoryTxType.DAMAGE, InventoryTxType.EXPIRY}

    if tx_enum in increase_types:
        product.current_stock += abs(qty)
    elif tx_enum in decrease_types:
        if product.current_stock < abs(qty):
            raise HTTPException(400, f"Insufficient stock. Available: {product.current_stock}")
        product.current_stock -= abs(qty)
    else: # ADJUSTMENT / AUDIT_CORRECTION
        # If user provides +/- relative adjustment
        product.current_stock = max(Decimal("0"), product.current_stock + qty)

    inv_tx = InventoryTransaction(
        shop_id=shop_id,
        product_id=product.id,
        transaction_type=tx_enum,
        quantity=qty,
        previous_stock=prev_stock,
        new_stock=product.current_stock,
        reference_type="MANUAL",
        notes=notes_str,
    )
    db.add(inv_tx)

    db.add(AuditLog(
        user_id=current_user.id,
        action=AuditAction.INVENTORY_ADJUST,
        reference_id=product.id,
        reference_type="Product",
        description=f"{tx_enum.value} {qty} units of {product.product_name}",
    ))

    db.commit()
    db.refresh(inv_tx)
    return {
        "id": inv_tx.id,
        "product_id": inv_tx.product_id,
        "transaction_type": inv_tx.transaction_type.value,
        "quantity": float(inv_tx.quantity),
        "previous_stock": float(inv_tx.previous_stock),
        "new_stock": float(inv_tx.new_stock),
        "transaction_date": inv_tx.transaction_date.isoformat() if inv_tx.transaction_date else None,
        "notes": inv_tx.notes,
    }


@router.get("/transactions")
def list_transactions(
    product_id: int = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    shop_id = getattr(current_user, "shop_id", 1) or 1
    query = db.query(InventoryTransaction).filter(InventoryTransaction.shop_id == shop_id)
    if product_id:
        query = query.filter(InventoryTransaction.product_id == product_id)
    txs = query.order_by(InventoryTransaction.transaction_date.desc()).offset(skip).limit(limit).all()
    return [
        {
            "id": t.id,
            "product_id": t.product_id,
            "transaction_type": t.transaction_type.value if hasattr(t.transaction_type, "value") else str(t.transaction_type),
            "quantity": float(t.quantity or 0),
            "previous_stock": float(t.previous_stock or 0),
            "new_stock": float(t.new_stock or 0),
            "transaction_date": t.transaction_date.isoformat() if t.transaction_date else None,
            "notes": t.notes,
        }
        for t in txs
    ]


@router.get("/low-stock")
def low_stock(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    shop_id = getattr(current_user, "shop_id", 1) or 1
    products = (
        db.query(Product)
        .filter(
            Product.shop_id == shop_id,
            Product.is_active == True,
            Product.current_stock <= Product.minimum_stock,
        )
        .all()
    )
    return [serialize_product(p) for p in products]

