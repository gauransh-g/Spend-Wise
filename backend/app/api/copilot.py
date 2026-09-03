from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.auth import get_current_user
from app.models.models import User, Transaction, Account
from app.schemas.schemas import CopilotQuery, CopilotResponse
from app.services.copilot_service import process_copilot_query

router = APIRouter(prefix="/copilot", tags=["AI Copilot"])

@router.post("/query", response_model=CopilotResponse)
def query_ai_copilot(query_in: CopilotQuery, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    txs = db.query(Transaction).filter(Transaction.user_id == current_user.id).all()
    accounts = db.query(Account).filter(Account.user_id == current_user.id).all()

    tx_dicts = [{
        "amount": t.amount,
        "merchant": t.merchant,
        "category_name": t.category.name if t.category else "Uncategorized",
        "transaction_type": t.transaction_type,
        "transaction_date": t.transaction_date.isoformat()
    } for t in txs]

    acc_dicts = [{"name": a.name, "balance": a.balance} for a in accounts]

    result = process_copilot_query(query_in.query, tx_dicts, acc_dicts)
    return CopilotResponse(
        answer=result["answer"],
        data_summary=result["data_summary"]
    )
