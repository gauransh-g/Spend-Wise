from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from app.core.database import get_db
from app.api.auth import get_current_user
from app.models.models import User, Transaction, Account, Budget
from app.schemas.schemas import (
    CategorizationComparison, AnomalyResult, RecurringResult,
    ForecastPoint, BudgetStatus, InsightOut
)
from app.services.ml_service import (
    compare_categorizer, detect_anomalies, detect_recurring_expenses,
    generate_cash_flow_forecast
)
from app.services.insight_service import generate_financial_insights

router = APIRouter(prefix="/intelligence", tags=["Financial Intelligence & ML"])

@router.get("/categorize-benchmark", response_model=CategorizationComparison)
def test_categorize_comparison(merchant: str, description: str = ""):
    return compare_categorizer(merchant, description)

@router.get("/anomalies", response_model=List[AnomalyResult])
def get_spending_anomalies(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    txs = db.query(Transaction).filter(Transaction.user_id == current_user.id).all()
    tx_dicts = []
    for t in txs:
        tx_dicts.append({
            "id": t.id,
            "merchant": t.merchant,
            "amount": t.amount,
            "category_id": t.category_id,
            "category_name": t.category.name if t.category else "Uncategorized",
            "transaction_type": t.transaction_type,
            "transaction_date": t.transaction_date.isoformat()
        })
    return detect_anomalies(tx_dicts)

@router.get("/recurring", response_model=List[RecurringResult])
def get_recurring_commitments(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    txs = db.query(Transaction).filter(Transaction.user_id == current_user.id).all()
    tx_dicts = []
    for t in txs:
        tx_dicts.append({
            "id": t.id,
            "merchant": t.merchant,
            "amount": t.amount,
            "transaction_type": t.transaction_type,
            "transaction_date": t.transaction_date.isoformat()
        })
    return detect_recurring_expenses(tx_dicts)

@router.get("/cashflow-forecast", response_model=List[ForecastPoint])
def get_cashflow_forecast(days: int = 30, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    acc = db.query(Account).filter(Account.user_id == current_user.id).first()
    curr_balance = acc.balance if acc else 50000.0

    txs = db.query(Transaction).filter(Transaction.user_id == current_user.id).all()
    tx_dicts = [{
        "amount": t.amount,
        "transaction_type": t.transaction_type,
        "transaction_date": t.transaction_date.isoformat()
    } for t in txs]

    return generate_cash_flow_forecast(curr_balance, tx_dicts, days_ahead=days)

@router.get("/budgets", response_model=List[BudgetStatus])
def get_budgets_with_forecast(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    budgets = db.query(Budget).filter(Budget.user_id == current_user.id).all()
    txs = db.query(Transaction).filter(Transaction.user_id == current_user.id).all()

    now = datetime.utcnow()
    m_txs = [t for t in txs if t.transaction_date.month == now.month and t.transaction_type == "expense"]

    cat_spending = {}
    for t in m_txs:
        cat_name = t.category.name if t.category else "Uncategorized"
        cat_spending[cat_name] = cat_spending.get(cat_name, 0.0) + t.amount

    days_passed = max(now.day, 1)
    days_in_month = 30

    res = []
    for b in budgets:
        spent = cat_spending.get(b.category_name, 0.0)
        pct = round((spent / b.amount_limit * 100), 1) if b.amount_limit > 0 else 0.0
        projected = (spent / days_passed) * days_in_month
        excess = max(0.0, round(projected - b.amount_limit, 2))

        res.append(BudgetStatus(
            category_name=b.category_name,
            limit=b.amount_limit,
            spent=round(spent, 2),
            percentage=pct,
            forecasted_excess=excess
        ))
    return res

@router.post("/budgets")
def set_budget(category_name: str, limit: float, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    b = Budget(user_id=current_user.id, category_id="cat_default", category_name=category_name, amount_limit=limit)
    db.add(b)
    db.commit()
    return {"message": "Budget set successfully"}

@router.get("/insights", response_model=List[InsightOut])
def get_financial_insights(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    txs = db.query(Transaction).filter(Transaction.user_id == current_user.id).all()
    budgets = db.query(Budget).filter(Budget.user_id == current_user.id).all()

    tx_dicts = [{
        "amount": t.amount,
        "merchant": t.merchant,
        "category_name": t.category.name if t.category else "Uncategorized",
        "transaction_type": t.transaction_type,
        "transaction_date": t.transaction_date.isoformat()
    } for t in txs]

    budget_dicts = [{"category_name": b.category_name, "limit": b.amount_limit} for b in budgets]

    return generate_financial_insights(tx_dicts, budget_dicts)
