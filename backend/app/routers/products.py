from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from typing import List, Optional
from app.database.base import get_db
from app.models.models import Product, User, AuditLog, AuditAction
from app.schemas.schemas import ProductCreate, ProductUpdate, ProductResponse, ProductSearchResult
from app.utils.auth import get_current_user
import re
from datetime import datetime

router = APIRouter(prefix="/api/products", tags=["Products"])


def _generate_code(db: Session) -> str:
    count = db.query(func.count(Product.id)).scalar() + 1
    return f"PRD{str(count).zfill(5)}"


def serialize_product(p: Product) -> dict:
    unit_str = p.unit.value if hasattr(p.unit, "value") else str(p.unit or "Bags")
    return {
        "id": p.id,
        "product_code": p.product_code,
        "product_name": p.product_name,
        "name": p.product_name,
        "company_name": p.company_name,
        "category": p.company_name or "Fertilizer",
        "net_content": float(p.net_content) if p.net_content is not None else None,
        "unit": unit_str,
        "purchase_price": float(p.purchase_price or 0),
        "cost_price": float(p.purchase_price or 0),
        "selling_price": float(p.selling_price or 0),
        "mrp": float(p.selling_price or 0),
        "gst_rate": float(p.gst_rate or 0),
        "manufacture_date": p.manufacture_date,
        "expiry_date": p.expiry_date,
        "batch_number": p.product_code or f"BAT-{p.id}",
        "hsn_code": "31021000",
        "current_stock": float(p.current_stock or 0),
        "minimum_stock": float(p.minimum_stock or 0),
        "min_stock_level": float(p.minimum_stock or 0),
        "is_active": p.is_active,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


@router.get("/search")
def search_products(
    q: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Product).filter(Product.is_active == True)
    search = f"%{q}%"
    query = query.filter(
        or_(
            Product.product_name.ilike(search),
            Product.product_code.ilike(search),
            Product.company_name.ilike(search),
        )
    )
    products = query.limit(20).all()
    return [serialize_product(p) for p in products]


@router.get("")
def list_products(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    active_only: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Product)
    if active_only:
        query = query.filter(Product.is_active == True)
    if search:
        like = f"%{search}%"
        query = query.filter(
            or_(Product.product_name.ilike(like), Product.company_name.ilike(like))
        )
    products = query.order_by(Product.product_name).offset(skip).limit(limit).all()
    return [serialize_product(p) for p in products]


@router.get("/{product_id}")
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(404, "Product not found")
    return serialize_product(product)


@router.post("", status_code=201)
def create_product(
    payload: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    code = payload.product_code or _generate_code(db)
    # Check for duplicate code
    if db.query(Product).filter(Product.product_code == code).first():
        code = _generate_code(db)

    product = Product(**payload.model_dump(), product_code=code)
    product.product_code = code
    db.add(product)
    db.commit()
    db.refresh(product)

    audit = AuditLog(
        user_id=current_user.id, action=AuditAction.PRODUCT_CREATE,
        reference_id=product.id, reference_type="Product",
        description=f"Created product: {product.product_name}",
    )
    db.add(audit)
    db.commit()
    return serialize_product(product)


@router.put("/{product_id}")
def update_product(
    product_id: int,
    payload: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(404, "Product not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(product, field, value)
    product.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(product)

    audit = AuditLog(
        user_id=current_user.id, action=AuditAction.PRODUCT_UPDATE,
        reference_id=product.id, reference_type="Product",
        description=f"Updated product: {product.product_name}",
    )
    db.add(audit)
    db.commit()
    return serialize_product(product)


@router.delete("/{product_id}", status_code=204)
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(404, "Product not found")
    product.is_active = False  # soft delete
    db.commit()

    audit = AuditLog(
        user_id=current_user.id, action=AuditAction.PRODUCT_DELETE,
        reference_id=product.id, reference_type="Product",
    )
    db.add(audit)
    db.commit()
