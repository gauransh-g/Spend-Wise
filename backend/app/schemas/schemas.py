from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime

# Auth
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    currency: Optional[str] = "INR"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"

class UserOut(BaseModel):
    id: str
    email: str
    full_name: str
    currency: str
    created_at: datetime
    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    currency: Optional[str] = None

# Accounts
class AccountCreate(BaseModel):
    name: str
    account_type: str = "checking"
    balance: float = 0.0
    currency: str = "INR"

class AccountOut(BaseModel):
    id: str
    user_id: str
    name: str
    account_type: str
    balance: float
    currency: str
    created_at: datetime
    class Config:
        from_attributes = True

# Category
class CategoryCreate(BaseModel):
    name: str
    icon: Optional[str] = "Tag"
    color: Optional[str] = "#6366f1"

class CategoryOut(BaseModel):
    id: str
    name: str
    icon: Optional[str]
    color: Optional[str]
    is_system: bool
    class Config:
        from_attributes = True

# Transaction
class TransactionCreate(BaseModel):
    account_id: Optional[str] = None
    category_id: Optional[str] = None
    amount: float
    currency: Optional[str] = "INR"
    merchant: Optional[str] = None
    description: Optional[str] = None
    transaction_type: str = "expense" # expense, income
    transaction_date: Optional[datetime] = None

class TransactionOut(BaseModel):
    id: str
    user_id: str
    account_id: Optional[str]
    category_id: Optional[str]
    category_name: Optional[str] = None
    amount: float
    currency: str
    merchant: Optional[str]
    description: Optional[str]
    transaction_type: str
    transaction_date: datetime
    status: str
    is_recurring: bool
    is_anomaly: bool
    created_at: datetime
    class Config:
        from_attributes = True

# Group & Expense Splitting
class GroupCreate(BaseModel):
    name: str
    description: Optional[str] = None
    member_names: List[str] = []

class GroupMemberOut(BaseModel):
    id: str
    group_id: str
    user_id: str
    member_name: str
    joined_at: datetime
    class Config:
        from_attributes = True

class SplitCreate(BaseModel):
    user_id: str
    user_name: str
    amount_owed: float

class GroupExpenseCreate(BaseModel):
    group_id: Optional[str] = None
    paid_by: str
    paid_by_name: str
    amount: float
    description: str
    splits: List[SplitCreate] = []

class SimplifiedSettlement(BaseModel):
    payer_id: str
    payer_name: str
    payee_id: str
    payee_name: str
    amount: float

class GroupOut(BaseModel):
    id: str
    name: str
    description: Optional[str]
    created_by: str
    created_at: datetime
    members: List[GroupMemberOut] = []
    class Config:
        from_attributes = True

# Receipts & OCR
class ReceiptItemOut(BaseModel):
    item_name: str
    quantity: float
    unit_price: float
    total_price: float
    class Config:
        from_attributes = True

class ReceiptOut(BaseModel):
    id: str
    transaction_id: Optional[str]
    image_url: str
    ocr_status: str
    ocr_raw_text: Optional[str]
    processed_data: Optional[str]
    items: List[ReceiptItemOut] = []
    created_at: datetime
    class Config:
        from_attributes = True

# Intelligence & Insights
class CategorizationComparison(BaseModel):
    merchant: str
    description: str
    rule_category: str
    ml_category: str
    ml_confidence: float

class AnomalyResult(BaseModel):
    transaction_id: str
    merchant: Optional[str]
    amount: float
    category_name: Optional[str]
    anomaly_score: float
    is_anomaly: bool
    reason: str

class RecurringResult(BaseModel):
    merchant: str
    avg_amount: float
    frequency: str
    last_date: str
    next_expected_date: str

class ForecastPoint(BaseModel):
    date: str
    expected_balance: float
    projected_expenses: float
    projected_income: float

class BudgetStatus(BaseModel):
    category_name: str
    limit: float
    spent: float
    percentage: float
    forecasted_excess: float

class InsightOut(BaseModel):
    title: str
    description: str
    severity: str # info, warning, success

class CopilotQuery(BaseModel):
    query: str

class CopilotResponse(BaseModel):
    answer: str
    data_summary: dict
