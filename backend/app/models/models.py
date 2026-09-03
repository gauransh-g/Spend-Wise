import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, Boolean, DateTime, ForeignKey, Text, Numeric, Integer
from sqlalchemy.orm import relationship
from app.core.database import Base

def generate_uuid():
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    currency = Column(String, default="INR")
    created_at = Column(DateTime, default=datetime.utcnow)
    
    accounts = relationship("Account", back_populates="owner", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="user", cascade="all, delete-orphan")
    categories = relationship("Category", back_populates="user", cascade="all, delete-orphan")
    receipts = relationship("Receipt", back_populates="user", cascade="all, delete-orphan")
    budgets = relationship("Budget", back_populates="user", cascade="all, delete-orphan")
    recurring_txs = relationship("RecurringTransaction", back_populates="user", cascade="all, delete-orphan")

class Account(Base):
    __tablename__ = "accounts"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    account_type = Column(String, nullable=False, default="checking") # checking, savings, credit_card, cash
    balance = Column(Float, default=0.0) # Numeric float for compatibility
    currency = Column(String, default="INR")
    created_at = Column(DateTime, default=datetime.utcnow)
    
    owner = relationship("User", back_populates="accounts")
    transactions = relationship("Transaction", back_populates="account", cascade="all, delete-orphan")

class Category(Base):
    __tablename__ = "categories"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=True) # None = System default
    name = Column(String, nullable=False)
    icon = Column(String, default="Tag")
    color = Column(String, default="#6366f1")
    is_system = Column(Boolean, default=False)
    
    user = relationship("User", back_populates="categories")
    transactions = relationship("Transaction", back_populates="category")

class Transaction(Base):
    __tablename__ = "transactions"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    account_id = Column(String, ForeignKey("accounts.id"), nullable=True)
    category_id = Column(String, ForeignKey("categories.id"), nullable=True)
    amount = Column(Float, nullable=False)
    currency = Column(String, default="INR")
    merchant = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    transaction_type = Column(String, nullable=False, default="expense") # expense, income, transfer
    transaction_date = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="completed")
    is_recurring = Column(Boolean, default=False)
    is_anomaly = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="transactions")
    account = relationship("Account", back_populates="transactions")
    category = relationship("Category", back_populates="transactions")
    receipts = relationship("Receipt", back_populates="transaction")

class Receipt(Base):
    __tablename__ = "receipts"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    transaction_id = Column(String, ForeignKey("transactions.id"), nullable=True)
    image_url = Column(Text, nullable=False)
    ocr_status = Column(String, default="pending") # pending, processing, completed, failed
    ocr_raw_text = Column(Text, nullable=True)
    processed_data = Column(Text, nullable=True) # JSON string
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="receipts")
    transaction = relationship("Transaction", back_populates="receipts")
    items = relationship("ReceiptItem", back_populates="receipt", cascade="all, delete-orphan")

class ReceiptItem(Base):
    __tablename__ = "receipt_items"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    receipt_id = Column(String, ForeignKey("receipts.id"), nullable=False)
    item_name = Column(String, nullable=False)
    quantity = Column(Float, default=1.0)
    unit_price = Column(Float, nullable=False)
    total_price = Column(Float, nullable=False)
    
    receipt = relationship("Receipt", back_populates="items")

class Group(Base):
    __tablename__ = "groups"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    created_by = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    members = relationship("GroupMember", back_populates="group", cascade="all, delete-orphan")
    expenses = relationship("GroupExpense", back_populates="group", cascade="all, delete-orphan")
    settlements = relationship("Settlement", back_populates="group", cascade="all, delete-orphan")

class GroupMember(Base):
    __tablename__ = "group_members"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    group_id = Column(String, ForeignKey("groups.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    member_name = Column(String, nullable=False)
    joined_at = Column(DateTime, default=datetime.utcnow)
    
    group = relationship("Group", back_populates="members")

class GroupExpense(Base):
    __tablename__ = "group_expenses"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    group_id = Column(String, ForeignKey("groups.id"), nullable=False)
    paid_by = Column(String, ForeignKey("users.id"), nullable=False)
    paid_by_name = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    description = Column(String, nullable=False)
    expense_date = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    group = relationship("Group", back_populates="expenses")
    splits = relationship("Split", back_populates="expense", cascade="all, delete-orphan")

class Split(Base):
    __tablename__ = "splits"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    expense_id = Column(String, ForeignKey("group_expenses.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    user_name = Column(String, nullable=False)
    amount_owed = Column(Float, nullable=False)
    amount_paid = Column(Float, default=0.0)
    
    expense = relationship("GroupExpense", back_populates="splits")

class Settlement(Base):
    __tablename__ = "settlements"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    group_id = Column(String, ForeignKey("groups.id"), nullable=False)
    payer_id = Column(String, ForeignKey("users.id"), nullable=False)
    payer_name = Column(String, nullable=False)
    payee_id = Column(String, ForeignKey("users.id"), nullable=False)
    payee_name = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    settled_at = Column(DateTime, default=datetime.utcnow)
    
    group = relationship("Group", back_populates="settlements")

class Budget(Base):
    __tablename__ = "budgets"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    category_id = Column(String, ForeignKey("categories.id"), nullable=False)
    category_name = Column(String, nullable=False)
    amount_limit = Column(Float, nullable=False)
    period = Column(String, default="monthly")
    
    user = relationship("User", back_populates="budgets")

class RecurringTransaction(Base):
    __tablename__ = "recurring_transactions"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    merchant = Column(String, nullable=False)
    avg_amount = Column(Float, nullable=False)
    frequency = Column(String, default="monthly") # weekly, monthly, yearly
    last_date = Column(DateTime, nullable=False)
    next_expected_date = Column(DateTime, nullable=False)
    is_active = Column(Boolean, default=True)
    
    user = relationship("User", back_populates="recurring_txs")
