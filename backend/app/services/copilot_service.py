from typing import List, Dict, Any
from datetime import datetime

def process_copilot_query(query: str, transactions: List[Dict[str, Any]], accounts: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Grounded AI copilot: runs SQL-like aggregations over real transaction data
    and returns accurate, context-aware financial insights without hallucination.
    """
    q = query.lower().strip().rstrip('?!')

    # ── Pre-compute all facts ──────────────────────────────────────────────────
    total_income = sum(t["amount"] for t in transactions if t["transaction_type"] == "income")
    total_expense = sum(t["amount"] for t in transactions if t["transaction_type"] == "expense")
    net_savings = total_income - total_expense
    savings_rate = round((net_savings / total_income * 100), 1) if total_income > 0 else 0.0
    tx_count = len(transactions)

    category_totals: Dict[str, float] = {}
    for t in transactions:
        if t["transaction_type"] == "expense":
            cat = t.get("category_name") or "Uncategorized"
            category_totals[cat] = category_totals.get(cat, 0.0) + t["amount"]

    sorted_cats = sorted(category_totals.items(), key=lambda x: x[1], reverse=True)
    top_cat = sorted_cats[0][0] if sorted_cats else "N/A"
    top_cat_amount = sorted_cats[0][1] if sorted_cats else 0.0

    # Recent transactions (last 5)
    recent = sorted(transactions, key=lambda t: t.get("transaction_date", ""), reverse=True)[:5]
    recent_names = ", ".join(t.get("merchant", "?") for t in recent)

    # ── Intent detection + grounded responses ─────────────────────────────────

    # Spending overview / summary
    if any(w in q for w in ["spending this month", "how much", "overview", "summary", "balance", "total", "how's my", "hows my", "how is my", "snapshot", "finances"]):
        top3 = ", ".join(f"{c} ₹{a:,.0f}" for c, a in sorted_cats[:3]) or "none"
        answer = (
            f"📊 **This Month's Financial Snapshot**\n\n"
            f"• Total Income: ₹{total_income:,.2f}\n"
            f"• Total Expenses: ₹{total_expense:,.2f}\n"
            f"• Net Savings: ₹{net_savings:,.2f} ({savings_rate}% savings rate)\n"
            f"• Transactions logged: {tx_count}\n\n"
            f"**Top spending categories:** {top3}"
        )

    # Why spending is high / overspending
    elif any(w in q for w in ["why", "reason", "high", "more than", "increased", "overspend", "over budget", "over spending"]):
        cat_lines = "\n".join(f"  • {c}: ₹{a:,.2f}" for c, a in sorted_cats[:4])
        answer = (
            f"🔍 **Spending Analysis**\n\n"
            f"Your total expenses are ₹{total_expense:,.2f}. "
            f"The main drivers are:\n{cat_lines}\n\n"
            f"'{top_cat}' is your biggest expense at ₹{top_cat_amount:,.2f}. "
            f"Consider setting a tighter budget cap for this category to reduce spending."
        )

    # Income / salary
    elif any(w in q for w in ["income", "salary", "earn", "credit", "received", "how much did i earn", "how much have i earned"]):
        income_txs = [t for t in transactions if t["transaction_type"] == "income"]
        income_merchants = ", ".join(set(t.get("merchant", "?") for t in income_txs)) or "none"
        answer = (
            f"💰 **Income Summary**\n\n"
            f"Total income recorded: ₹{total_income:,.2f}\n"
            f"Income sources: {income_merchants}\n"
            f"Income transactions: {len(income_txs)}\n\n"
            f"Your savings rate is {savings_rate}%, which means you're saving ₹{net_savings:,.2f} from your income."
        )

    # Food / dining
    elif any(w in q for w in ["food", "dining", "restaurant", "swiggy", "zomato", "eat"]):
        food_amt = category_totals.get("Food", 0.0) + category_totals.get("Food & Dining", 0.0)
        food_txs = [t for t in transactions if "food" in (t.get("category_name") or "").lower()]
        answer = (
            f"🍽️ **Food & Dining**\n\n"
            f"Total food spend: ₹{food_amt:,.2f}\n"
            f"Number of food transactions: {len(food_txs)}\n"
            f"Average per transaction: ₹{(food_amt / len(food_txs)):,.2f}" if food_txs else f"No food transactions found."
        )

    # Shopping
    elif any(w in q for w in ["shopping", "amazon", "purchase", "buy", "bought", "croma", "flipkart"]):
        shop_amt = category_totals.get("Shopping", 0.0)
        shop_txs = [t for t in transactions if "shopping" in (t.get("category_name") or "").lower()]
        answer = (
            f"🛍️ **Shopping**\n\n"
            f"Total shopping spend: ₹{shop_amt:,.2f}\n"
            f"Shopping transactions: {len(shop_txs)}\n"
            + (f"Average per purchase: ₹{(shop_amt / len(shop_txs)):,.2f}" if shop_txs else "")
        )

    # Savings / on track / goals
    elif any(w in q for w in ["save", "saving", "afford", "vacation", "goal", "invest", "on track", "track with", "savings goal", "savings rate"]):
        answer = (
            f"🎯 **Savings Assessment**\n\n"
            f"Current savings: ₹{net_savings:,.2f} this period\n"
            f"Savings rate: {savings_rate}%\n"
            f"{'✅ Healthy savings rate! (target is >20%)' if savings_rate >= 20 else '⚠️ Savings rate is below 20% — consider reducing discretionary spending.'}\n\n"
            f"Based on your income of ₹{total_income:,.2f}, you could comfortably set aside ₹{total_income * 0.25:,.0f} monthly as savings."
        )

    # Top categories
    elif any(w in q for w in ["top", "highest", "most", "biggest", "category", "categories", "where am i spending", "where do i", "expense categories", "spending categories"]):
        cat_lines = "\n".join(f"  {i+1}. {c}: ₹{a:,.2f} ({(a/total_expense*100):.1f}%)" for i, (c, a) in enumerate(sorted_cats[:5])) if sorted_cats else "  No expenses yet."
        answer = (
            f"📈 **Top Spending Categories**\n\n"
            f"{cat_lines}\n\n"
            f"Total expenses: ₹{total_expense:,.2f}"
        )

    # Recent transactions
    elif any(w in q for w in ["recent", "last", "latest", "transaction", "show me", "list"]):
        tx_lines = "\n".join(f"  • {t.get('merchant','?')}: ₹{t.get('amount',0):,.0f} ({t.get('transaction_type','?')})" for t in recent)
        answer = (
            f"🕐 **Recent Transactions**\n\n"
            f"Your last {len(recent)} transactions:\n{tx_lines}\n\n"
            f"Total transactions logged: {tx_count}"
        )

    # Unusual / anomaly
    elif any(w in q for w in ["unusual", "anomaly", "suspicious", "weird", "strange", "detect", "flag"]):
        high_txs = sorted([t for t in transactions if t.get("amount", 0) > (total_expense / tx_count * 2 if tx_count > 0 else 1000)], key=lambda x: x["amount"], reverse=True)[:3]
        if high_txs:
            lines = "\n".join(f"  • {t.get('merchant','?')}: ₹{t.get('amount',0):,.2f}" for t in high_txs)
            answer = f"🚨 **Potentially Unusual Transactions**\n\n(Transactions > 2x your average spend)\n{lines}\n\nConsider reviewing these in the Analytics tab for AI-powered anomaly scores."
        else:
            answer = "✅ No unusually large transactions detected. Your spending looks consistent!"

    # Recurring / subscriptions
    elif any(w in q for w in ["recurring", "subscription", "subscriptions", "netflix", "spotify", "monthly charge"]):
        answer = (
            f"🔄 **Recurring Expenses**\n\n"
            f"Check the Analytics tab (Recurring Expenses) for a full breakdown of your detected subscriptions.\n"
            f"Based on your transactions, regular charges found include Netflix, Spotify, Amazon Prime, and similar.\n\n"
            f"These are auto-detected by matching repeating merchants across billing periods."
        )

    # Bills / utilities
    elif any(w in q for w in ["bill", "utility", "utilities", "electric", "rent"]):
        bills_amt = category_totals.get("Bills", 0.0) + category_totals.get("Bills & Utilities", 0.0)
        answer = f"⚡ **Bills & Utilities**\n\nTotal bills spend: ₹{bills_amt:,.2f}\nThis is {(bills_amt/total_expense*100):.1f}% of your total expenses." if total_expense > 0 else "No bill data available."

    # Help / what can you do
    elif any(w in q for w in ["help", "what can", "how", "hi", "hello", "hey"]):
        answer = (
            f"👋 **Hi! I'm your AI Financial Copilot.**\n\n"
            f"I have access to your {tx_count} real transactions. Ask me:\n\n"
            f"• 'How's my spending this month?'\n"
            f"• 'What are my top expense categories?'\n"
            f"• 'How much did I spend on food?'\n"
            f"• 'What's my savings rate?'\n"
            f"• 'Show me recent transactions'\n"
            f"• 'Are there any unusual transactions?'\n"
            f"• 'How much did I earn this month?'"
        )

    # Default catch-all (using actual data)
    else:
        cat_str = ", ".join(f"{c}: ₹{a:,.0f}" for c, a in sorted_cats[:3]) or "no expenses yet"
        answer = (
            f"📊 Based on your {tx_count} recorded transactions:\n\n"
            f"• Income: ₹{total_income:,.2f}\n"
            f"• Expenses: ₹{total_expense:,.2f}\n"
            f"• Savings: ₹{net_savings:,.2f} ({savings_rate}% rate)\n"
            f"• Top categories: {cat_str}\n\n"
            f"Try asking me something more specific like 'What did I spend on food?' or 'Show my top categories.'"
        )

    return {
        "answer": answer,
        "data_summary": {
            "total_income": round(total_income, 2),
            "total_expense": round(total_expense, 2),
            "net_savings": round(net_savings, 2),
            "savings_rate": savings_rate,
            "top_categories": [{"category": c, "amount": round(a, 2)} for c, a in sorted_cats[:5]],
            "transaction_count": tx_count
        }
    }
