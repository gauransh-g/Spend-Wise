from typing import List, Dict
from app.schemas.schemas import SimplifiedSettlement

def calculate_net_balances(expenses: List[dict], settlements: List[dict], members: List[dict]) -> Dict[str, dict]:
    """
    Computes net balances for each group member.
    Returns dict: { user_id: { "name": str, "net": float } }
    """
    balances = {m["user_id"]: {"name": m["member_name"], "net": 0.0} for m in members}

    # Process expenses
    for exp in expenses:
        paid_by = exp["paid_by"]
        if paid_by in balances:
            balances[paid_by]["net"] += exp["amount"]
        
        for split in exp.get("splits", []):
            u_id = split["user_id"]
            if u_id in balances:
                balances[u_id]["net"] -= split["amount_owed"]

    # Process settlements already made
    for s in settlements:
        payer = s["payer_id"]
        payee = s["payee_id"]
        amt = s["amount"]
        if payer in balances:
            balances[payer]["net"] += amt
        if payee in balances:
            balances[payee]["net"] -= amt

    return balances

def simplify_group_debts(expenses: List[dict], settlements: List[dict], members: List[dict]) -> List[SimplifiedSettlement]:
    """
    Greedy balance minimization algorithm to minimize total transactions.
    Reduces N balances down to at most N - 1 transactions.
    """
    net_map = calculate_net_balances(expenses, settlements, members)

    debtors = []   # (user_id, name, amount_owed_positive)
    creditors = [] # (user_id, name, amount_credit_positive)

    for u_id, info in net_map.items():
        net = round(info["net"], 2)
        if net < -0.01:
            debtors.append([u_id, info["name"], abs(net)])
        elif net > 0.01:
            creditors.append([u_id, info["name"], net])

    # Sort debtors descending by debt, creditors descending by credit
    debtors.sort(key=lambda x: x[2], reverse=True)
    creditors.sort(key=lambda x: x[2], reverse=True)

    results: List[SimplifiedSettlement] = []

    i = 0
    j = 0
    while i < len(debtors) and j < len(creditors):
        debtor_id, debtor_name, debt_amt = debtors[i]
        creditor_id, creditor_name, credit_amt = creditors[j]

        settle_amt = round(min(debt_amt, credit_amt), 2)
        if settle_amt > 0:
            results.append(SimplifiedSettlement(
                payer_id=debtor_id,
                payer_name=debtor_name,
                payee_id=creditor_id,
                payee_name=creditor_name,
                amount=settle_amt
            ))

        debtors[i][2] = round(debtors[i][2] - settle_amt, 2)
        creditors[j][2] = round(creditors[j][2] - settle_amt, 2)

        if debtors[i][2] <= 0.01:
            i += 1
        if creditors[j][2] <= 0.01:
            j += 1

    return results
