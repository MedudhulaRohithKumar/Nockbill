from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, selectinload
from typing import List, Optional, Any
from pydantic import BaseModel, Field, model_validator
from decimal import Decimal
from datetime import datetime
from app.database.base import get_db
from app.models.models import (
    Purchase, PurchaseItem, Product, ProductBatch,
    InventoryTransaction, InventoryTxType,
    AuditLog, AuditAction, User, ShopSettings
)
from app.utils.auth import get_current_user
from app.utils.helpers import sanitize_text, sanitize_code, validate_gstin, resolve_trade_name

router = APIRouter(prefix="/api/purchases", tags=["Purchases"])


# ── Flexible Item Schema ────────────────────────────────────────────────────
class FlexPurchaseItem(BaseModel):
    product_id: Optional[int] = None
    product_name: Optional[str] = None
    company_name: Optional[str] = None
    trade_name: Optional[str] = None
    batch_number: Optional[str] = None
    expiry_date: Optional[str] = None
    quantity: Decimal = Field(default=Decimal("1"), gt=0)
    purchase_price: Decimal = Field(default=Decimal("0"), ge=0)
    selling_price: Optional[Decimal] = None
    mrp: Optional[Decimal] = None
    gst_rate: Decimal = Field(default=Decimal("0"), ge=0, le=100)
    total_amount: Optional[Decimal] = None
    taxable_amount: Optional[Decimal] = None
    cgst_amount: Optional[Decimal] = None
    sgst_amount: Optional[Decimal] = None
    igst_amount: Optional[Decimal] = None


class FlexPurchaseCreate(BaseModel):
    supplier_name: Optional[str] = None
    supplier_gstin: Optional[str] = None
    invoice_number: Optional[str] = None
    bill_number: Optional[str] = None   # alias from frontend
    purchase_date: Optional[Any] = None
    bill_date: Optional[str] = None     # alias from frontend
    notes: Optional[str] = None
    total_amount: Optional[Decimal] = None   # pre-computed from frontend
    total_tax: Optional[Decimal] = None
    items: List[FlexPurchaseItem] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def normalize(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # Unify invoice_number / bill_number
            if not data.get("invoice_number") and data.get("bill_number"):
                data["invoice_number"] = data["bill_number"]
            # Unify purchase_date / bill_date
            if not data.get("purchase_date") and data.get("bill_date"):
                data["purchase_date"] = data["bill_date"]
        return data

    @model_validator(mode="after")
    def sanitize_purchase(self) -> "FlexPurchaseCreate":
        self.supplier_name = sanitize_text(self.supplier_name, 200) if self.supplier_name else None
        self.supplier_gstin = validate_gstin(self.supplier_gstin) if self.supplier_gstin else None
        self.invoice_number = sanitize_code(self.invoice_number, 100) if self.invoice_number else None
        self.notes = sanitize_text(self.notes, 500) if self.notes else None
        return self


def _resolve_product(db: Session, item: FlexPurchaseItem, shop_id: int = 1, prelocked_map: Optional[dict] = None) -> Optional[Product]:
    """Find product by id or name within current shop."""
    if item.product_id:
        if prelocked_map and item.product_id in prelocked_map:
            return prelocked_map[item.product_id]
        return db.query(Product).filter(
            Product.id == item.product_id,
            Product.shop_id == shop_id
        ).with_for_update().first()
    if item.product_name:
        return db.query(Product).filter(
            Product.shop_id == shop_id,
            Product.is_active == True,
            Product.product_name.ilike(f"%{item.product_name.strip()}%")
        ).with_for_update().first()
    return None


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
                "product_name": it.product_name or (
                    it.product.product_name if getattr(it, "product", None) else f"Product #{it.product_id}"
                ),
                "company_name": getattr(it, "company_name", None) or "",
                "trade_name": getattr(it, "trade_name", None) or "",
                "unit": it.unit or "",
                "batch_number": it.batch_number or "",
                "expiry_date": it.expiry_date or "",
                "quantity": float(it.quantity or 0),
                "purchase_price": float(it.purchase_price or 0),
                "gst_rate": float(it.gst_rate or 0),
                "total_amount": float(it.total or 0),
                "total": float(it.total or 0),
            }
            for it in (p.items or [])
        ]
    }


@router.post("", status_code=201)
def create_purchase(
    payload: FlexPurchaseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        subtotal = Decimal("0")
        total_gst = Decimal("0")

        # Parse purchase date
        p_date = datetime.utcnow()
        if payload.purchase_date:
            raw = str(payload.purchase_date)
            for fmt in ["%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%S.%f"]:
                try:
                    p_date = datetime.strptime(raw[:19], fmt[:len(raw[:19])])
                    break
                except Exception:
                    continue

        shop_id = getattr(current_user, "shop_id", 1) or 1

        # Pre-lock all involved Product rows in ascending ID order to prevent AB-BA deadlocks
        product_ids = sorted({item.product_id for item in payload.items if item.product_id})
        locked_products = (
            db.query(Product)
            .filter(Product.shop_id == shop_id, Product.id.in_(product_ids))
            .order_by(Product.id.asc())
            .with_for_update()
            .all()
        ) if product_ids else []
        prelocked_map = {p.id: p for p in locked_products}

        purchase = Purchase(
            shop_id=shop_id,
            supplier_name=payload.supplier_name,
            invoice_number=payload.invoice_number or payload.bill_number,
            purchase_date=p_date,
            notes=payload.notes,
            created_by=current_user.id,
        )
        # Store supplier GSTIN in notes if no column exists
        if payload.supplier_gstin and not hasattr(Purchase, "supplier_gstin"):
            purchase.notes = f"GSTIN: {payload.supplier_gstin}" + (f"\n{payload.notes}" if payload.notes else "")

        db.add(purchase)
        db.flush()  # get purchase.id

        for item_data in payload.items:
            qty = Decimal(str(item_data.quantity or 1))
            price = Decimal(str(item_data.purchase_price or 0))
            gst_rate = Decimal(str(item_data.gst_rate or 0))
            taxable = qty * price
            gst_amount = (taxable * gst_rate / 100).quantize(Decimal("0.01"))
            total = taxable + gst_amount
            subtotal += taxable
            total_gst += gst_amount

            # Try to find matching product in this shop
            product = _resolve_product(db, item_data, shop_id, prelocked_map)
            p_name = item_data.product_name or (product.product_name if product else "Unknown Product")
            c_name = item_data.company_name or (product.company_name if product else payload.supplier_name)
            t_name = resolve_trade_name(
                p_name,
                c_name,
                item_data.trade_name or (product.trade_name if product else None),
            )

            p_item = PurchaseItem(
                purchase_id=purchase.id,
                product_id=product.id if product else (item_data.product_id or 1),
                product_name=p_name,
                company_name=c_name,
                trade_name=t_name,
                unit=str(product.unit.value if hasattr(product.unit, "value") else product.unit) if product else "Bags",
                batch_number=item_data.batch_number,
                expiry_date=item_data.expiry_date,
                quantity=qty,
                purchase_price=price,
                gst_rate=gst_rate,
                total=total,
            )
            db.add(p_item)

            # Update product stock if product found
            if product:
                prev_stock = product.current_stock or Decimal("0")
                product.current_stock = prev_stock + qty
                product.purchase_price = price
                if t_name:
                    product.trade_name = t_name
                if item_data.company_name and item_data.company_name.strip():
                    product.company_name = item_data.company_name.strip()

                # Create/update ProductBatch for this inward
                if item_data.batch_number:
                    existing_batch = db.query(ProductBatch).filter(
                        ProductBatch.product_id == product.id,
                        ProductBatch.batch_number == item_data.batch_number
                    ).with_for_update().first()
                    if existing_batch:
                        existing_batch.current_stock = (existing_batch.current_stock or Decimal("0")) + qty
                        existing_batch.purchase_price = price
                        existing_batch.company_name = c_name
                        existing_batch.trade_name = t_name
                        if item_data.selling_price:
                            existing_batch.selling_price = item_data.selling_price
                        if item_data.mrp:
                            existing_batch.mrp = item_data.mrp
                    else:
                        sell_price = item_data.selling_price or item_data.mrp or product.selling_price or price
                        if sell_price <= 0:
                            sell_price = price if price > 0 else Decimal("1")
                        new_batch = ProductBatch(
                            product_id=product.id,
                            batch_number=item_data.batch_number,
                            trade_name=t_name,
                            company_name=c_name,
                            expiry_date=item_data.expiry_date or product.expiry_date or "2028-06",
                            purchase_price=price,
                            selling_price=sell_price,
                            mrp=item_data.mrp or sell_price,
                            current_stock=qty,
                            is_active=True,
                        )
                        db.add(new_batch)

                inv_tx = InventoryTransaction(
                    shop_id=shop_id,
                    product_id=product.id,
                    transaction_type=InventoryTxType.PURCHASE,
                    quantity=qty,
                    previous_stock=prev_stock,
                    new_stock=product.current_stock,
                    reference_id=purchase.id,
                    reference_type="PURCHASE",
                    notes=f"Inward purchase batch={item_data.batch_number or 'N/A'}",
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
        return serialize_purchase(purchase)

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Failed to save purchase: {str(e)}")


@router.get("")
def list_purchases(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    shop_id = getattr(current_user, "shop_id", 1) or 1
    purchases = db.query(Purchase).options(
        selectinload(Purchase.items)
    ).filter(
        Purchase.shop_id == shop_id
    ).order_by(Purchase.purchase_date.desc()).offset(skip).limit(limit).all()
    return [serialize_purchase(p) for p in purchases]


@router.get("/{purchase_id}")
def get_purchase(
    purchase_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    shop_id = getattr(current_user, "shop_id", 1) or 1
    purchase = db.query(Purchase).options(
        selectinload(Purchase.items)
    ).filter(
        Purchase.id == purchase_id,
        Purchase.shop_id == shop_id
    ).first()
    if not purchase:
        raise HTTPException(404, "Purchase not found")
    return serialize_purchase(purchase)


import io
from fastapi.responses import StreamingResponse
from app.reports.invoice_pdf import generate_purchase_pdf


@router.get("/{purchase_id}/pdf")
def download_purchase_pdf(
    purchase_id: int,
    inline: bool = Query(True, description="Display inline in browser if true, or download if false"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    purchase = db.query(Purchase).filter(
        Purchase.id == purchase_id,
        Purchase.shop_id == current_user.shop_id
    ).first()
    if not purchase:
        raise HTTPException(404, "Purchase not found")
    shop = db.query(ShopSettings).filter(ShopSettings.id == current_user.shop_id).first()
    if not shop:
        shop = ShopSettings(shop_name="NockBill Solutions")

    pdf_bytes = generate_purchase_pdf(purchase, shop)
    inv_name = purchase.invoice_number or f"PO-{purchase.id}"
    filename = f"Purchase_{inv_name}.pdf"
    disposition = "inline" if inline else "attachment"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'{disposition}; filename="{filename}"'},
    )
