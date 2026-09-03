import os
from datetime import datetime, timedelta
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import engine, Base, SessionLocal
from app.api import auth, transactions, groups, receipts, intelligence, copilot
from app.models.models import User, Account, Category, Transaction, Group, GroupMember, GroupExpense, Split, Budget, RecurringTransaction
from app.core.security import get_password_hash

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="SpendWise 2.0 - AI-Powered Personal Finance & Expense Splitting Platform API",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(transactions.router, prefix=settings.API_V1_STR)
app.include_router(groups.router, prefix=settings.API_V1_STR)
app.include_router(receipts.router, prefix=settings.API_V1_STR)
app.include_router(intelligence.router, prefix=settings.API_V1_STR)
app.include_router(copilot.router, prefix=settings.API_V1_STR)

@app.get("/")
def root():
    return {
        "app": "SpendWise 2.0 API",
        "status": "online",
        "docs": "/docs"
    }

@app.get("/health")
def health_check():
    from app.core.database import SessionLocal
    db = SessionLocal()
    try:
        user_count = db.query(User).count()
        tx_count = db.query(Transaction).count()
        return {
            "status": "ok",
            "database": "connected",
            "users": user_count,
            "transactions": tx_count,
            "version": "2.0.0"
        }
    except Exception as e:
        return {"status": "error", "detail": str(e)}
    finally:
        db.close()

@app.post("/api/v1/auth/demo-token")
def get_demo_token():
    """Returns a JWT for the seeded demo user — for development/testing only."""
    from app.core.security import create_access_token
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "demo@spendwise.com").first()
        if not user:
            raise Exception("Demo user not seeded yet")
        token = create_access_token(subject=user.id)
        return {
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "email": user.email,
                "full_name": user.full_name,
                "currency": user.currency
            }
        }
    finally:
        db.close()

# Seed Demo Data on Startup if database is empty
@app.on_event("startup")
def seed_demo_data():
    db = SessionLocal()
    try:
        if db.query(User).count() == 0:
            demo_user = User(
                id="demo_user_id_123",
                email="demo@spendwise.com",
                hashed_password=get_password_hash("password123"),
                full_name="Alex Mercer",
                currency="INR"
            )
            db.add(demo_user)
            db.commit()

            acc = Account(
                id="demo_account_id_123",
                user_id=demo_user.id,
                name="HDFC Primary Checking",
                account_type="checking",
                balance=82000.0,
                currency="INR"
            )
            db.add(acc)

            # System Categories
            cat_food = Category(id="cat_food", user_id=demo_user.id, name="Food", icon="Utensils", color="#f59e0b", is_system=True)
            cat_shop = Category(id="cat_shop", user_id=demo_user.id, name="Shopping", icon="ShoppingBag", color="#ec4899", is_system=True)
            cat_trans = Category(id="cat_trans", user_id=demo_user.id, name="Transport", icon="Car", color="#3b82f6", is_system=True)
            cat_ent = Category(id="cat_ent", user_id=demo_user.id, name="Entertainment", icon="Film", color="#8b5cf6", is_system=True)
            cat_bills = Category(id="cat_bills", user_id=demo_user.id, name="Bills", icon="Receipt", color="#ef4444", is_system=True)
            cat_inc = Category(id="cat_inc", user_id=demo_user.id, name="Income", icon="DollarSign", color="#22c55e", is_system=True)

            for c in [cat_food, cat_shop, cat_trans, cat_ent, cat_bills, cat_inc]:
                db.add(c)
            db.commit()

            # Seed Transactions — all in current month so dashboard shows real data
            now = datetime.utcnow()
            tx_data = [
                (demo_user.id, acc.id, cat_inc.id, 80000.0, "Tech Corp Salary", "Monthly Salary Deposit", "income", now - timedelta(days=1)),
                (demo_user.id, acc.id, cat_bills.id, 25000.0, "Prestige Rent", "House Rent", "expense", now - timedelta(days=3)),
                (demo_user.id, acc.id, cat_food.id, 850.0, "Swiggy", "Restaurant Dining", "expense", now - timedelta(days=2)),
                (demo_user.id, acc.id, cat_trans.id, 450.0, "Uber", "Cab to Office", "expense", now - timedelta(days=3)),
                (demo_user.id, acc.id, cat_ent.id, 649.0, "Netflix", "Monthly Premium Subscription", "expense", now - timedelta(days=4)),
                (demo_user.id, acc.id, cat_shop.id, 4129.0, "Amazon India", "Mechanical Keyboard", "expense", now - timedelta(days=4)),
                (demo_user.id, acc.id, cat_shop.id, 18500.0, "Croma Electronics", "4K Monitor Purchase", "expense", now - timedelta(days=1)),
                (demo_user.id, acc.id, cat_food.id, 2400.0, "Starbucks & Dining", "Team Lunch", "expense", now - timedelta(days=5)),
            ]
            for u_id, a_id, c_id, amt, merch, desc, t_type, t_date in tx_data:
                db.add(Transaction(
                    user_id=u_id, account_id=a_id, category_id=c_id, amount=amt, currency="INR",
                    merchant=merch, description=desc, transaction_type=t_type, transaction_date=t_date
                ))

            # Seed Group "Goa Trip"
            goa_group = Group(id="group_goa_123", name="Goa Trip", description="Vacation with friends", created_by=demo_user.id)
            db.add(goa_group)
            db.commit()

            m1 = GroupMember(group_id=goa_group.id, user_id=demo_user.id, member_name="Alex (You)")
            m2 = GroupMember(group_id=goa_group.id, user_id="u_rahul", member_name="Rahul")
            m3 = GroupMember(group_id=goa_group.id, user_id="u_aman", member_name="Aman")
            m4 = GroupMember(group_id=goa_group.id, user_id="u_priya", member_name="Priya")
            for m in [m1, m2, m3, m4]:
                db.add(m)
            db.commit()

            # Hotel expense ₹8,000 paid by Rahul (split 4 ways = ₹2,000 each)
            exp1 = GroupExpense(id="exp_hotel", group_id=goa_group.id, paid_by="u_rahul", paid_by_name="Rahul", amount=8000.0, description="Beach Resort Hotel")
            db.add(exp1)
            db.commit()
            for m_id, m_name in [(demo_user.id, "Alex (You)"), ("u_rahul", "Rahul"), ("u_aman", "Aman"), ("u_priya", "Priya")]:
                db.add(Split(expense_id=exp1.id, user_id=m_id, user_name=m_name, amount_owed=2000.0, amount_paid=8000.0 if m_id == "u_rahul" else 0.0))

            # Dinner expense ₹4,000 paid by Alex (split 4 ways = ₹1,000 each)
            exp2 = GroupExpense(id="exp_dinner", group_id=goa_group.id, paid_by=demo_user.id, paid_by_name="Alex (You)", amount=4000.0, description="Seafood Dinner")
            db.add(exp2)
            db.commit()
            for m_id, m_name in [(demo_user.id, "Alex (You)"), ("u_rahul", "Rahul"), ("u_aman", "Aman"), ("u_priya", "Priya")]:
                db.add(Split(expense_id=exp2.id, user_id=m_id, user_name=m_name, amount_owed=1000.0, amount_paid=4000.0 if m_id == demo_user.id else 0.0))

            # Seed Budgets
            db.add(Budget(user_id=demo_user.id, category_id=cat_food.id, category_name="Food", amount_limit=8000.0))
            db.add(Budget(user_id=demo_user.id, category_id=cat_shop.id, category_name="Shopping", amount_limit=15000.0))
            db.add(Budget(user_id=demo_user.id, category_id=cat_trans.id, category_name="Transport", amount_limit=3000.0))

            db.commit()
    finally:
        db.close()
