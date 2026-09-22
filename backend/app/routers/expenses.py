from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database.base import get_db
from app.models.models import Expense, AuditLog, AuditAction, User
from app.schemas.schemas import ExpenseCreate, ExpenseUpdate, ExpenseResponse
from app.utils.auth import get_current_user
from datetime import datetime

router = APIRouter(prefix="/api/expenses", tags=["Expenses"])


@router.get("", response_model=List[ExpenseResponse])
def list_expenses(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(Expense).order_by(Expense.expense_date.desc()).offset(skip).limit(limit).all()


@router.post("", response_model=ExpenseResponse, status_code=201)
def create_expense(
    payload: ExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    expense = Expense(**payload.model_dump(), created_by=current_user.id)
    db.add(expense)
    db.add(AuditLog(
        user_id=current_user.id, action=AuditAction.EXPENSE_CREATE,
        description=f"Expense: {payload.expense_name} ₹{payload.amount}",
    ))
    db.commit()
    db.refresh(expense)
    return expense


@router.put("/{expense_id}", response_model=ExpenseResponse)
def update_expense(
    expense_id: int,
    payload: ExpenseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(404, "Expense not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(expense, field, value)
    db.add(AuditLog(user_id=current_user.id, action=AuditAction.EXPENSE_UPDATE, reference_id=expense_id))
    db.commit()
    db.refresh(expense)
    return expense


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
