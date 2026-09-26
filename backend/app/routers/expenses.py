from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional, Any
from pydantic import BaseModel, Field, model_validator
from decimal import Decimal
from datetime import date, datetime
from app.database.base import get_db
from app.models.models import Expense, AuditLog, AuditAction, User, ExpenseCategory
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/expenses", tags=["Expenses"])

# ── Category normalizer ──────────────────────────────────────────────────────
# Maps frontend strings (any case) to DB enum values
_CAT_MAP = {
    "rent": ExpenseCategory.RENT,
    "electricity": ExpenseCategory.ELECTRICITY,
    "power": ExpenseCategory.ELECTRICITY,
    "salary": ExpenseCategory.SALARY,
    "labor": ExpenseCategory.SALARY,
    "labour": ExpenseCategory.SALARY,
    "transport": ExpenseCategory.TRANSPORTATION,
    "transportation": ExpenseCategory.TRANSPORTATION,
    "freight": ExpenseCategory.TRANSPORTATION,
    "internet": ExpenseCategory.INTERNET,
    "maintenance": ExpenseCategory.MAINTENANCE,
    "packaging": ExpenseCategory.OTHER,
    "office": ExpenseCategory.OTHER,
    "misc": ExpenseCategory.OTHER,
    "miscellaneous": ExpenseCategory.OTHER,
    "other": ExpenseCategory.OTHER,
}

def _normalize_category(raw: Any) -> ExpenseCategory:
    if isinstance(raw, ExpenseCategory):
        return raw
    s = str(raw).strip().lower()
    return _CAT_MAP.get(s, ExpenseCategory.OTHER)


# ── Flexible create schema ───────────────────────────────────────────────────
class FlexibleExpenseCreate(BaseModel):
    expense_name: Optional[str] = None
    description: Optional[str] = None
    category: Any = "OTHER"
    amount: Decimal = Field(..., gt=0)
    expense_date: Any = None      # accept str or date
    payment_mode: Optional[str] = None
    notes: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def normalize(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # expense_name fallback chain: expense_name → description → category
            if not data.get("expense_name"):
                data["expense_name"] = (
                    data.get("description")
                    or data.get("notes")
                    or str(data.get("category", "Expense"))
                )
            # expense_date: accept "YYYY-MM-DD" string
            raw_date = data.get("expense_date")
            if raw_date and isinstance(raw_date, str):
                try:
                    data["expense_date"] = date.fromisoformat(raw_date)
                except ValueError:
                    data["expense_date"] = date.today()
            elif not raw_date:
                data["expense_date"] = date.today()
        return data

    def resolved_category(self) -> ExpenseCategory:
        return _normalize_category(self.category)

    def resolved_date(self) -> date:
        if isinstance(self.expense_date, date):
            return self.expense_date
        try:
            return date.fromisoformat(str(self.expense_date))
        except Exception:
            return date.today()


class ExpenseResponse(BaseModel):
    id: int
    expense_name: str
    category: str
    amount: float
    expense_date: Any
    description: Optional[str] = None
    payment_mode: Optional[str] = None
    created_at: Optional[Any] = None

    class Config:
        from_attributes = True


def _serialize_expense(e: Expense) -> dict:
    cat_val = e.category.value if hasattr(e.category, "value") else str(e.category)
    # Map internal enum back to a friendly display name for the frontend
    _DISPLAY = {
        "RENT": "Rent",
        "ELECTRICITY": "Electricity",
        "SALARY": "Labor",
        "TRANSPORTATION": "Transport",
        "INTERNET": "Office",
        "MAINTENANCE": "Maintenance",
        "OTHER": "Misc",
    }
    return {
        "id": e.id,
        "expense_name": e.expense_name,
        "description": e.description or e.expense_name,
        "category": _DISPLAY.get(cat_val, cat_val),
        "amount": float(e.amount or 0),
        "expense_date": str(e.expense_date),
        "payment_mode": getattr(e, "payment_mode", None) or "Cash",
        "created_at": e.created_at.isoformat() if e.created_at else None,
    }


@router.get("")
def list_expenses(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    expenses = db.query(Expense).order_by(Expense.expense_date.desc()).offset(skip).limit(limit).all()
    return [_serialize_expense(e) for e in expenses]


@router.post("", status_code=201)
def create_expense(
    payload: FlexibleExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        expense = Expense(
            expense_name=payload.expense_name or payload.description or "Expense",
            category=payload.resolved_category(),
            amount=payload.amount,
            expense_date=payload.resolved_date(),
            description=payload.description or payload.notes,
            created_by=current_user.id,
        )
        db.add(expense)
        db.add(AuditLog(
            user_id=current_user.id, action=AuditAction.EXPENSE_CREATE,
            description=f"Expense: {expense.expense_name} ₹{expense.amount}",
        ))
        db.commit()
        db.refresh(expense)
        return _serialize_expense(expense)
    except Exception as ex:
        db.rollback()
        raise HTTPException(500, f"Failed to save expense: {str(ex)}")


@router.put("/{expense_id}")
def update_expense(
    expense_id: int,
    payload: FlexibleExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(404, "Expense not found")
    expense.expense_name = payload.expense_name or payload.description or expense.expense_name
    expense.category = payload.resolved_category()
    expense.amount = payload.amount
    expense.expense_date = payload.resolved_date()
    expense.description = payload.description or payload.notes
    db.add(AuditLog(user_id=current_user.id, action=AuditAction.EXPENSE_UPDATE, reference_id=expense_id))
    db.commit()
    db.refresh(expense)
    return _serialize_expense(expense)


@router.delete("/{expense_id}", status_code=204)
def delete_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(404, "Expense not found")
    db.delete(expense)
    db.add(AuditLog(user_id=current_user.id, action=AuditAction.EXPENSE_DELETE, reference_id=expense_id))
    db.commit()
