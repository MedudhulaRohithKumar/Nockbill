from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload

from app.database.base import get_db
from app.models.models import (
    PriceList, Product, ProductBatch, ProductVariant,
    User, UserRole, AuditLog, AuditAction
)
from app.schemas.schemas import (
    PriceListCreate, PriceListUpdate,
    PriceListAssignRequest, PriceListUnassignRequest
)
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/price-lists", tags=["Price Lists"])


def require_owner_user(current_user: User = Depends(get_current_user)) -> User:
    """Strictly enforce that only Admin / Shop Owner can create or modify Price Lists."""
    role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if role_str.upper() != "OWNER" and current_user.username != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the Shop Owner / Admin can create or manage Price Lists."
        )
    return current_user


def compute_adjusted_price(base_price: Decimal, price_list: Optional[PriceList]) -> Decimal:
    """Calculate the adjusted selling price from base_selling_price and an active PriceList."""
    base = Decimal(str(base_price or 0))
    if base <= Decimal("0") or not price_list or not price_list.is_active:
        return base.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    adj_val = Decimal(str(price_list.adjustment_value or 0))
    adj_type = (price_list.adjustment_type or "DISCOUNT").upper()
    calc_mode = (price_list.calculation_mode or "PERCENTAGE").upper()

    if calc_mode == "PERCENTAGE":
        delta = (base * adj_val) / Decimal("100")
    else:
        delta = adj_val

    if adj_type == "DISCOUNT":
        final_price = max(Decimal("0.01"), base - delta)
    else:  # INCREMENT
        final_price = base + delta

    return final_price.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def apply_price_list_to_product(product: Product, price_list: Optional[PriceList]) -> None:
    """
    Apply (or remove if price_list is None) a PriceList on a Product and update its
    selling_price, active batches, and variants without losing base_selling_price.
    """
    current_selling = Decimal(str(product.selling_price or 0))
    if product.base_selling_price is None or Decimal(str(product.base_selling_price or 0)) <= Decimal("0"):
        product.base_selling_price = current_selling

    base_price = Decimal(str(product.base_selling_price or 0))

    if price_list is None:
        new_selling = base_price
        product.price_list_id = None
    else:
        product.price_list_id = price_list.id
        if price_list.is_active:
            new_selling = compute_adjusted_price(base_price, price_list)
        else:
            new_selling = base_price

    product.selling_price = new_selling
    product.updated_at = datetime.utcnow()

    # Keep active batches & primary variants in sync with the product's effective selling price
    if hasattr(product, "batches") and product.batches:
        for b in product.batches:
            if getattr(b, "is_active", True):
                b.selling_price = new_selling if new_selling > Decimal("0") else Decimal("1.00")

    if hasattr(product, "variants") and product.variants:
        if len(product.variants) == 1:
            product.variants[0].selling_price = new_selling
        elif base_price > Decimal("0"):
            ratio = new_selling / base_price
            for v in product.variants:
                if getattr(v, "is_active", True):
                    v_base = Decimal(str(v.mrp or v.selling_price or 0))
                    if v_base > Decimal("0"):
                        v.selling_price = max(
                            Decimal("0.01"),
                            (v_base * ratio).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                        )


def serialize_price_list(pl: PriceList, products: List[Product]) -> dict:
    assigned = [p for p in products if p.price_list_id == pl.id and p.is_active]
    return {
        "id": pl.id,
        "shop_id": pl.shop_id,
        "name": pl.name,
        "description": pl.description or "",
        "adjustment_type": pl.adjustment_type,
        "calculation_mode": pl.calculation_mode,
        "adjustment_value": float(pl.adjustment_value or 0),
        "is_active": bool(pl.is_active),
        "product_count": len(assigned),
        "product_ids": [p.id for p in assigned],
        "products": [
            {
                "id": p.id,
                "product_name": p.product_name,
                "trade_name": p.trade_name,
                "company_name": p.company_name,
                "category": p.category or "Fertilizer",
                "unit": p.unit.value if hasattr(p.unit, "value") else str(p.unit or "Bags"),
                "base_selling_price": float(p.base_selling_price if p.base_selling_price is not None else p.selling_price or 0),
                "selling_price": float(p.selling_price or 0),
                "current_stock": float(p.current_stock or 0),
            }
            for p in assigned
        ],
        "created_at": pl.created_at.isoformat() if pl.created_at else None,
        "updated_at": pl.updated_at.isoformat() if pl.updated_at else None,
    }


@router.get("")
def list_price_lists(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    shop_id = getattr(current_user, "shop_id", 1) or 1
    price_lists = db.query(PriceList).filter(
        PriceList.shop_id == shop_id
    ).order_by(PriceList.created_at.desc()).all()

    products = db.query(Product).filter(
        Product.shop_id == shop_id,
        Product.is_active == True
    ).order_by(Product.product_name.asc()).all()

    return [serialize_price_list(pl, products) for pl in price_lists]


@router.post("", status_code=201)
def create_price_list(
    payload: PriceListCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_user),
):
    shop_id = getattr(current_user, "shop_id", 1) or 1

    # Prevent duplicate price list names in the same shop
    existing_name = db.query(PriceList).filter(
        PriceList.shop_id == shop_id,
        PriceList.name.ilike(payload.name.strip())
    ).first()
    if existing_name:
        raise HTTPException(
            status_code=400,
            detail=f"A Price List named '{payload.name.strip()}' already exists."
        )

    # Fetch shop products with other price lists mapped to validate BEFORE committing if products were requested
    all_shop_products = db.query(Product).options(
        selectinload(Product.batches),
        selectinload(Product.variants),
        selectinload(Product.price_list),
    ).filter(
        Product.shop_id == shop_id,
        Product.is_active == True
    ).all()

    target_products: List[Product] = []
    if payload.apply_to_all:
        # Check if any product already has another price list assigned
        conflicts = [p for p in all_shop_products if p.price_list_id is not None]
        if conflicts:
            first_c = conflicts[0]
            other_pl_name = first_c.price_list.name if first_c.price_list else f"ID #{first_c.price_list_id}"
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Cannot apply to all products because {len(conflicts)} product(s) "
                    f"(including '{first_c.product_name}') already have Price List '{other_pl_name}' assigned. "
                    f"No two price lists can be added to the same product. Please unassign them from '{other_pl_name}' first "
                    f"or select only unassigned products."
                )
            )
        target_products = all_shop_products
    elif payload.product_ids:
        prod_map = {p.id: p for p in all_shop_products}
        for pid in payload.product_ids:
            p = prod_map.get(pid)
            if not p:
                continue
            if p.price_list_id is not None:
                other_pl_name = p.price_list.name if p.price_list else f"ID #{p.price_list_id}"
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Product '{p.product_name}' is already assigned to Price List '{other_pl_name}'. "
                        f"No two price lists can be added to the same product."
                    )
                )
            target_products.append(p)

    new_pl = PriceList(
        shop_id=shop_id,
        name=payload.name.strip(),
        description=payload.description,
        adjustment_type=payload.adjustment_type,
        calculation_mode=payload.calculation_mode,
        adjustment_value=payload.adjustment_value,
        is_active=payload.is_active,
    )
    db.add(new_pl)
    db.flush()

    for p in target_products:
        apply_price_list_to_product(p, new_pl)

    db.add(AuditLog(
        user_id=current_user.id,
        action=AuditAction.SETTINGS_UPDATE,
        reference_id=new_pl.id,
        reference_type="PriceList",
        description=f"Created Price List '{new_pl.name}' ({new_pl.adjustment_type} {new_pl.adjustment_value} {new_pl.calculation_mode}) applied to {len(target_products)} product(s)."
    ))
    db.commit()
    db.refresh(new_pl)

    return serialize_price_list(new_pl, all_shop_products)


@router.put("/{price_list_id}")
def update_price_list(
    price_list_id: int,
    payload: PriceListUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_user),
):
    shop_id = getattr(current_user, "shop_id", 1) or 1
    pl = db.query(PriceList).filter(
        PriceList.id == price_list_id,
        PriceList.shop_id == shop_id
    ).first()
    if not pl:
        raise HTTPException(status_code=404, detail="Price List not found")

    if payload.name is not None:
        dup = db.query(PriceList).filter(
            PriceList.shop_id == shop_id,
            PriceList.name.ilike(payload.name.strip()),
            PriceList.id != pl.id
        ).first()
        if dup:
            raise HTTPException(status_code=400, detail=f"Another Price List named '{payload.name.strip()}' already exists.")
        pl.name = payload.name.strip()

    if payload.description is not None:
        pl.description = payload.description
    if payload.adjustment_type is not None:
        pl.adjustment_type = payload.adjustment_type
    if payload.calculation_mode is not None:
        pl.calculation_mode = payload.calculation_mode
    if payload.adjustment_value is not None:
        pl.adjustment_value = payload.adjustment_value
    if payload.is_active is not None:
        pl.is_active = payload.is_active

    if pl.adjustment_type == "DISCOUNT" and pl.calculation_mode == "PERCENTAGE" and pl.adjustment_value >= Decimal("100"):
        raise HTTPException(status_code=400, detail="Percentage discount must be less than 100%")

    pl.updated_at = datetime.utcnow()

    # Recalculate prices for all products currently assigned to this price list
    all_shop_products = db.query(Product).options(
        selectinload(Product.batches),
        selectinload(Product.variants),
    ).filter(
        Product.shop_id == shop_id,
        Product.is_active == True
    ).all()

    for p in all_shop_products:
        if p.price_list_id == pl.id:
            apply_price_list_to_product(p, pl)

    db.commit()
    db.refresh(pl)
    return serialize_price_list(pl, all_shop_products)


@router.post("/{price_list_id}/assign")
def assign_products_to_price_list(
    price_list_id: int,
    payload: PriceListAssignRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_user),
):
    """
    Assign all products or specified products to this Price List.
    Strictly enforces that NO TWO PRICE LISTS can be added to the same product.
    """
    shop_id = getattr(current_user, "shop_id", 1) or 1
    pl = db.query(PriceList).filter(
        PriceList.id == price_list_id,
        PriceList.shop_id == shop_id
    ).first()
    if not pl:
        raise HTTPException(status_code=404, detail="Price List not found")

    all_shop_products = db.query(Product).options(
        selectinload(Product.batches),
        selectinload(Product.variants),
        selectinload(Product.price_list),
    ).filter(
        Product.shop_id == shop_id,
        Product.is_active == True
    ).all()

    target_products: List[Product] = []

    if payload.apply_to_all:
        conflicts = [
            p for p in all_shop_products
            if p.price_list_id is not None and p.price_list_id != pl.id
        ]
        if conflicts:
            first_c = conflicts[0]
            other_name = first_c.price_list.name if first_c.price_list else f"ID #{first_c.price_list_id}"
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Cannot apply '{pl.name}' to all products because {len(conflicts)} product(s) "
                    f"(e.g. '{first_c.product_name}') are already assigned to Price List '{other_name}'. "
                    f"No two price lists can be added to the same product. Please remove them from '{other_name}' first."
                )
            )
        target_products = all_shop_products
    else:
        if not payload.product_ids:
            raise HTTPException(status_code=400, detail="Please select at least one product to assign.")
        prod_map = {p.id: p for p in all_shop_products}
        for pid in payload.product_ids:
            p = prod_map.get(pid)
            if not p:
                raise HTTPException(status_code=404, detail=f"Product ID {pid} not found.")
            if p.price_list_id is not None and p.price_list_id != pl.id:
                other_name = p.price_list.name if p.price_list else f"ID #{p.price_list_id}"
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Product '{p.product_name}' already has Price List '{other_name}' applied. "
                        f"No two price lists can be added to the same product."
                    )
                )
            target_products.append(p)

    for p in target_products:
        apply_price_list_to_product(p, pl)

    db.commit()
    return {
        "success": True,
        "message": f"Successfully applied Price List '{pl.name}' to {len(target_products)} product(s).",
        "price_list": serialize_price_list(pl, all_shop_products),
    }


@router.post("/{price_list_id}/unassign")
def unassign_products_from_price_list(
    price_list_id: int,
    payload: PriceListUnassignRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_user),
):
    """Remove specified products (or all products) from this Price List and restore their base selling prices."""
    shop_id = getattr(current_user, "shop_id", 1) or 1
    pl = db.query(PriceList).filter(
        PriceList.id == price_list_id,
        PriceList.shop_id == shop_id
    ).first()
    if not pl:
        raise HTTPException(status_code=404, detail="Price List not found")

    all_shop_products = db.query(Product).options(
        selectinload(Product.batches),
        selectinload(Product.variants),
    ).filter(
        Product.shop_id == shop_id,
        Product.is_active == True
    ).all()

    unassigned_count = 0
    target_ids = set(payload.product_ids or [])
    for p in all_shop_products:
        if p.price_list_id == pl.id:
            if payload.unassign_all or p.id in target_ids:
                apply_price_list_to_product(p, None)
                unassigned_count += 1

    db.commit()
    return {
        "success": True,
        "message": f"Removed {unassigned_count} product(s) from Price List '{pl.name}' and restored base prices.",
        "price_list": serialize_price_list(pl, all_shop_products),
    }


@router.delete("/{price_list_id}", status_code=200)
def delete_price_list(
    price_list_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_user),
):
    shop_id = getattr(current_user, "shop_id", 1) or 1
    pl = db.query(PriceList).filter(
        PriceList.id == price_list_id,
        PriceList.shop_id == shop_id
    ).first()
    if not pl:
        raise HTTPException(status_code=404, detail="Price List not found")

    # Restore base prices for all products assigned to this price list before deleting
    assigned_products = db.query(Product).options(
        selectinload(Product.batches),
        selectinload(Product.variants),
    ).filter(
        Product.shop_id == shop_id,
        Product.price_list_id == pl.id
    ).all()

    for p in assigned_products:
        apply_price_list_to_product(p, None)

    pl_name = pl.name
    db.delete(pl)
    db.commit()

    return {
        "success": True,
        "message": f"Price List '{pl_name}' deleted and base prices restored for {len(assigned_products)} product(s)."
    }
