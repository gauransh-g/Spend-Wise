from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.core.database import get_db
from app.api.auth import get_current_user
from app.models.models import User, Transaction, Account, Category
from app.schemas.schemas import (
    TransactionCreate, TransactionOut, CategoryOut, CategoryCreate,
    AccountOut, AccountCreate
)

router = APIRouter(prefix="/transactions", tags=["Transactions"])

@router.get("/accounts", response_model=List[AccountOut])
def get_accounts(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Account).filter(Account.user_id == current_user.id).all()

@router.post("/accounts", response_model=AccountOut)
def create_account(acc_in: AccountCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    acc = Account(
        user_id=current_user.id,
        name=acc_in.name,
        account_type=acc_in.account_type,
        balance=acc_in.balance,
        currency=acc_in.currency
    )
    db.add(acc)
    db.commit()
    db.refresh(acc)
    return acc

@router.get("/categories", response_model=List[CategoryOut])
def get_categories(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Category).filter((Category.user_id == current_user.id) | (Category.is_system == True)).all()

@router.post("/categories", response_model=CategoryOut)
def create_category(cat_in: CategoryCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cat = Category(user_id=current_user.id, name=cat_in.name, icon=cat_in.icon, color=cat_in.color, is_system=False)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat

@router.post("/", response_model=TransactionOut)
def create_transaction(tx_in: TransactionCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Verify account
    acc = None
    if tx_in.account_id:
        acc = db.query(Account).filter(Account.id == tx_in.account_id, Account.user_id == current_user.id).first()
    else:
        acc = db.query(Account).filter(Account.user_id == current_user.id).first()

    tx = Transaction(
        user_id=current_user.id,
        account_id=acc.id if acc else None,
        category_id=tx_in.category_id,
        amount=tx_in.amount,
        currency=tx_in.currency or current_user.currency,
        merchant=tx_in.merchant,
        description=tx_in.description,
        transaction_type=tx_in.transaction_type,
        transaction_date=tx_in.transaction_date or datetime.utcnow(),
        status="completed"
    )
    db.add(tx)

    # Adjust account balance
    if acc:
        if tx.transaction_type == "expense":
            acc.balance -= tx.amount
        elif tx.transaction_type == "income":
            acc.balance += tx.amount

    db.commit()
    db.refresh(tx)

    cat_name = tx.category.name if tx.category else None
    res = TransactionOut.model_validate(tx)
    res.category_name = cat_name
    return res

@router.get("/", response_model=List[TransactionOut])
def get_transactions(
    category_id: Optional[str] = None,
    merchant: Optional[str] = None,
    min_amount: Optional[float] = None,
    max_amount: Optional[float] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Transaction).filter(Transaction.user_id == current_user.id)

    if category_id:
        query = query.filter(Transaction.category_id == category_id)
    if merchant:
        query = query.filter(Transaction.merchant.ilike(f"%{merchant}%"))
    if min_amount is not None:
        query = query.filter(Transaction.amount >= min_amount)
    if max_amount is not None:
        query = query.filter(Transaction.amount <= max_amount)
    if start_date:
        query = query.filter(Transaction.transaction_date >= datetime.fromisoformat(start_date))
    if end_date:
        query = query.filter(Transaction.transaction_date <= datetime.fromisoformat(end_date))

    txs = query.order_by(Transaction.transaction_date.desc()).all()
    
    out = []
    for t in txs:
        t_out = TransactionOut.model_validate(t)
        t_out.category_name = t.category.name if t.category else "Uncategorized"
        out.append(t_out)
    return out

@router.put("/{tx_id}", response_model=TransactionOut)
def update_transaction(tx_id: str, tx_in: TransactionCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    tx = db.query(Transaction).filter(Transaction.id == tx_id, Transaction.user_id == current_user.id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    tx.amount = tx_in.amount
    tx.merchant = tx_in.merchant
    tx.description = tx_in.description
    tx.category_id = tx_in.category_id
    tx.transaction_type = tx_in.transaction_type
    if tx_in.transaction_date:
        tx.transaction_date = tx_in.transaction_date

    db.commit()
    db.refresh(tx)
    res = TransactionOut.model_validate(tx)
    res.category_name = tx.category.name if tx.category else "Uncategorized"
    return res

@router.delete("/{tx_id}")
def delete_transaction(tx_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    tx = db.query(Transaction).filter(Transaction.id == tx_id, Transaction.user_id == current_user.id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    db.delete(tx)
    db.commit()
    return {"message": "Transaction deleted successfully"}

@router.get("/summary/monthly")
def get_monthly_summary(month: Optional[int] = None, year: Optional[int] = None, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    now = datetime.utcnow()
    m = month or now.month
    y = year or now.year

    txs = db.query(Transaction).filter(Transaction.user_id == current_user.id).all()
    accounts = db.query(Account).filter(Account.user_id == current_user.id).all()

    total_income = sum(t.amount for t in txs if t.transaction_type == "income")
    total_expenses = sum(t.amount for t in txs if t.transaction_type == "expense")
    total_balance = sum(a.balance for a in accounts) if accounts else (total_income - total_expenses)

    month_txs = [t for t in txs if t.transaction_date.month == m and t.transaction_date.year == y]

    monthly_income = sum(t.amount for t in month_txs if t.transaction_type == "income")
    monthly_expenses = sum(t.amount for t in month_txs if t.transaction_type == "expense")
    savings = monthly_income - monthly_expenses

    category_breakdown = {}
    for t in month_txs:
        if t.transaction_type == "expense":
            cat_name = t.category.name if t.category else "Uncategorized"
            category_breakdown[cat_name] = category_breakdown.get(cat_name, 0.0) + t.amount

    return {
        "month": m,
        "year": y,
        "income": round(monthly_income, 2),
        "monthly_income": round(monthly_income, 2),
        "expenses": round(monthly_expenses, 2),
        "monthly_expenses": round(monthly_expenses, 2),
        "total_income": round(total_income, 2),
        "total_expenses": round(total_expenses, 2),
        "total_balance": round(total_balance, 2),
        "savings": round(savings, 2),
        "savings_rate": round((savings / monthly_income * 100), 1) if monthly_income > 0 else 0.0,
        "category_breakdown": [{"category": k, "amount": round(v, 2)} for k, v in category_breakdown.items()]
    }
