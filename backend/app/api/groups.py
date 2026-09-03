from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.api.auth import get_current_user
from app.models.models import User, Group, GroupMember, GroupExpense, Split, Settlement
from app.schemas.schemas import (
    GroupCreate, GroupOut, GroupExpenseCreate, SimplifiedSettlement
)
from app.services.split_service import simplify_group_debts

router = APIRouter(prefix="/groups", tags=["Groups & Splits"])

@router.post("/", response_model=GroupOut)
def create_group(group_in: GroupCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    group = Group(
        name=group_in.name,
        description=group_in.description,
        created_by=current_user.id
    )
    db.add(group)
    db.commit()
    db.refresh(group)

    # Add creator as member
    creator_member = GroupMember(
        group_id=group.id,
        user_id=current_user.id,
        member_name=current_user.full_name or "You"
    )
    db.add(creator_member)

    # Add other group member names
    for name in group_in.member_names:
        if name.strip() and name.strip().lower() != current_user.full_name.lower():
            # Create member placeholder
            m = GroupMember(
                group_id=group.id,
                user_id=f"user_placeholder_{name.lower().replace(' ', '_')}",
                member_name=name.strip()
            )
            db.add(m)

    db.commit()
    db.refresh(group)
    return group

@router.get("/", response_model=List[GroupOut])
def get_user_groups(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    member_records = db.query(GroupMember).filter(GroupMember.user_id == current_user.id).all()
    group_ids = [m.group_id for m in member_records]
    return db.query(Group).filter(Group.id.in_(group_ids)).all()

@router.post("/{group_id}/expenses")
def add_group_expense(group_id: str, exp_in: GroupExpenseCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    exp = GroupExpense(
        group_id=group_id,
        paid_by=exp_in.paid_by,
        paid_by_name=exp_in.paid_by_name,
        amount=exp_in.amount,
        description=exp_in.description
    )
    db.add(exp)
    db.commit()
    db.refresh(exp)

    for s in exp_in.splits:
        split = Split(
            expense_id=exp.id,
            user_id=s.user_id,
            user_name=s.user_name,
            amount_owed=s.amount_owed,
            amount_paid=exp_in.amount if s.user_id == exp_in.paid_by else 0.0
        )
        db.add(split)

    db.commit()
    return {"message": "Expense added successfully", "expense_id": exp.id}

@router.get("/{group_id}/balances", response_model=List[SimplifiedSettlement])
def get_simplified_settlements(group_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    members = [{"user_id": m.user_id, "member_name": m.member_name} for m in group.members]

    expenses_raw = db.query(GroupExpense).filter(GroupExpense.group_id == group_id).all()
    expenses = []
    for e in expenses_raw:
        splits = [{"user_id": s.user_id, "amount_owed": s.amount_owed} for s in e.splits]
        expenses.append({
            "paid_by": e.paid_by,
            "amount": e.amount,
            "splits": splits
        })

    settlements_raw = db.query(Settlement).filter(Settlement.group_id == group_id).all()
    settlements = [{
        "payer_id": s.payer_id,
        "payee_id": s.payee_id,
        "amount": s.amount
    } for s in settlements_raw]

    return simplify_group_debts(expenses, settlements, members)

@router.post("/{group_id}/settle")
def settle_debt(group_id: str, payer_id: str, payer_name: str, payee_id: str, payee_name: str, amount: float, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    s = Settlement(
        group_id=group_id,
        payer_id=payer_id,
        payer_name=payer_name,
        payee_id=payee_id,
        payee_name=payee_name,
        amount=amount
    )
    db.add(s)
    db.commit()
    return {"message": "Settlement recorded successfully"}
