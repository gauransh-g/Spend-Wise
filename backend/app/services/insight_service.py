from typing import List, Dict, Any
from datetime import datetime
from app.schemas.schemas import InsightOut

def generate_financial_insights(transactions: List[Dict[str, Any]], budgets: List[Dict[str, Any]]) -> List[InsightOut]:
    """
    Computes deterministic, data-backed financial insights.
    """
    insights: List[InsightOut] = []

    if not transactions:
        insights.append(InsightOut(
            title="Welcome to SpendWise 2.0",
            description="Start logging your transactions or upload a receipt to generate smart insights.",
            severity="info"
        ))
        return insights

    now = datetime.utcnow()
    curr_month_txs = [t for t in transactions if datetime.fromisoformat(str(t["transaction_date"])).month == now.month]
    prev_month_txs = [t for t in transactions if datetime.fromisoformat(str(t["transaction_date"])).month == (now.month - 1 or 12)]

    # 1. Total Income & Expense
    income_curr = sum(t["amount"] for t in curr_month_txs if t["transaction_type"] == "income")
    expense_curr = sum(t["amount"] for t in curr_month_txs if t["transaction_type"] == "expense")
    expense_prev = sum(t["amount"] for t in prev_month_txs if t["transaction_type"] == "expense")

    if income_curr > 0:
        savings = income_curr - expense_curr
        savings_rate = round((savings / income_curr) * 100, 1)
        insights.append(InsightOut(
            title=f"Savings Rate: {savings_rate}%",
            description=f"You earned ₹{income_curr:,.2f} and spent ₹{expense_curr:,.2f}, saving ₹{savings:,.2f} this month.",
            severity="success" if savings_rate >= 20 else "warning"
        ))

    # 2. Month-over-Month Spending Velocity
    if expense_prev > 0:
        pct_change = round(((expense_curr - expense_prev) / expense_prev) * 100, 1)
        if pct_change > 15:
            insights.append(InsightOut(
                title=f"Monthly Spend Increased by {pct_change}%",
                description=f"Your expenses increased from ₹{expense_prev:,.2f} last month to ₹{expense_curr:,.2f} this month.",
                severity="warning"
            ))
        elif pct_change < -10:
            insights.append(InsightOut(
                title=f"Great job! Spending decreased by {abs(pct_change)}%",
                description=f"You spent ₹{abs(expense_curr - expense_prev):,.2f} less than last month.",
                severity="success"
            ))

    # 3. Category Deep-Dive (Food / Shopping)
    food_curr = sum(t["amount"] for t in curr_month_txs if t.get("category_name") == "Food" and t["transaction_type"] == "expense")
    food_prev = sum(t["amount"] for t in prev_month_txs if t.get("category_name") == "Food" and t["transaction_type"] == "expense")

    if food_prev > 0 and food_curr > food_prev:
        diff = food_curr - food_prev
        pct = round((diff / food_prev) * 100, 1)
        insights.append(InsightOut(
            title=f"Food spending up {pct}%",
            description=f"You spent ₹{diff:,.2f} more on restaurants and dining out compared to last month.",
            severity="warning"
        ))

    # 4. Top 3 Largest Expenses
    expenses = sorted([t for t in curr_month_txs if t["transaction_type"] == "expense"], key=lambda x: x["amount"], reverse=True)
    if expenses:
        top_tx = expenses[0]
        insights.append(InsightOut(
            title="Largest Single Expense",
            description=f"₹{top_tx['amount']:,.2f} at '{top_tx.get('merchant') or 'Unknown'}' on {datetime.fromisoformat(str(top_tx['transaction_date'])).strftime('%d %b')}.",
            severity="info"
        ))

    return insights
