import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import List, Dict, Any
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.ensemble import IsolationForest

# Train a lightweight ML classifier on init
TRAINING_DATA = [
    ("Swiggy food order biryani", "Food"),
    ("Zomato dinner delivery", "Food"),
    ("Starbucks coffee mocha", "Food"),
    ("Dominos pizza party", "Food"),
    ("Uber cab ride airport", "Transport"),
    ("Ola auto ride city", "Transport"),
    ("Shell petrol station fuel", "Transport"),
    ("Metro train pass recharge", "Transport"),
    ("Netflix monthly subscription", "Entertainment"),
    ("Spotify Premium music", "Entertainment"),
    ("PVR cinema movie tickets", "Entertainment"),
    ("Amazon India electronics order", "Shopping"),
    ("Flipkart fashion clothing", "Shopping"),
    ("Myntra shoes and apparel", "Shopping"),
    ("Zara jacket online purchase", "Shopping"),
    ("Electricity bill payment BESCOM", "Bills"),
    ("Airtel wifi internet monthly bill", "Bills"),
    ("Gas cylinder booking Indane", "Bills"),
    ("Apollo pharmacy medicine purchase", "Healthcare"),
    ("Max healthcare doctor checkup", "Healthcare")
]

texts = [item[0] for item in TRAINING_DATA]
labels = [item[1] for item in TRAINING_DATA]

tfidf = TfidfVectorizer()
X_train = tfidf.fit_transform(texts)
clf = MultinomialNB()
clf.fit(X_train, labels)

RULES = {
    "SWIGGY": "Food", "ZOMATO": "Food", "STARBUCKS": "Food", "RESTAURANT": "Food",
    "UBER": "Transport", "OLA": "Transport", "FUEL": "Transport", "METRO": "Transport",
    "NETFLIX": "Entertainment", "SPOTIFY": "Entertainment", "PVR": "Entertainment",
    "AMAZON": "Shopping", "FLIPKART": "Shopping", "MYNTRA": "Shopping", "ZARA": "Shopping",
    "AIRTEL": "Bills", "BESCOM": "Bills", "ELECTRICITY": "Bills",
    "APOLLO": "Healthcare", "MEDPLUS": "Healthcare"
}

def rule_categorize(merchant: str, description: str) -> str:
    combined = f"{merchant} {description}".upper()
    for keyword, cat in RULES.items():
        if keyword in combined:
            return cat
    return "Other"

def ml_categorize(merchant: str, description: str) -> Dict[str, Any]:
    text = f"{merchant} {description}".strip()
    if not text:
        return {"category": "Other", "confidence": 0.5}
    vec = tfidf.transform([text])
    probs = clf.predict_proba(vec)[0]
    best_idx = np.argmax(probs)
    predicted_cat = clf.classes_[best_idx]
    confidence = float(probs[best_idx])
    return {"category": predicted_cat, "confidence": round(confidence, 2)}

def compare_categorizer(merchant: str, description: str) -> Dict[str, Any]:
    rule_cat = rule_categorize(merchant, description)
    ml_res = ml_categorize(merchant, description)
    return {
        "merchant": merchant,
        "description": description,
        "rule_category": rule_cat,
        "ml_category": ml_res["category"],
        "ml_confidence": ml_res["confidence"]
    }

def detect_anomalies(transactions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Detects unusual spending behavior using Isolation Forest & statistical Z-scores.
    """
    if not transactions:
        return []

    df = pd.DataFrame(transactions)
    if "amount" not in df.columns or len(df) == 0:
        return []

    # Filter out income transactions for expense anomaly detection
    df_exp = df[df["transaction_type"] == "expense"].copy()
    if len(df_exp) < 3:
        # Simple threshold fallback for small datasets
        results = []
        for tx in transactions:
            is_anom = tx["amount"] > 10000 and tx["transaction_type"] == "expense"
            results.append({
                "transaction_id": tx["id"],
                "merchant": tx.get("merchant"),
                "amount": tx["amount"],
                "category_name": tx.get("category_name"),
                "anomaly_score": 0.85 if is_anom else 0.1,
                "is_anomaly": is_anom,
                "reason": "Unusual high transaction amount" if is_anom else "Normal spending"
            })
        return results

    # Compute category-level mean and std
    category_stats = df_exp.groupby("category_id")["amount"].agg(["mean", "std"]).reset_index()
    category_stats["std"] = category_stats["std"].fillna(1.0)
    category_stats["std"] = category_stats["std"].replace(0.0, 1.0)

    df_exp = df_exp.merge(category_stats, on="category_id", how="left")
    df_exp["z_score"] = (df_exp["amount"] - df_exp["mean"]) / df_exp["std"]

    # ML Isolation Forest
    amounts_matrix = df_exp[["amount", "z_score"]].fillna(0).values
    iso = IsolationForest(contamination=0.15, random_state=42)
    predictions = iso.fit_predict(amounts_matrix)
    scores = iso.decision_function(amounts_matrix)

    anomaly_results = []
    for idx, (_, row) in enumerate(df_exp.iterrows()):
        is_anom = bool(predictions[idx] == -1 or row["z_score"] > 2.5)
        score = float(round(1.0 - scores[idx], 2))
        reason = f"Transaction amount ₹{row['amount']:,.2f} is significantly above average (z-score: {row['z_score']:.1f})" if is_anom else "Normal pattern"
        
        anomaly_results.append({
            "transaction_id": row["id"],
            "merchant": row.get("merchant"),
            "amount": row["amount"],
            "category_name": row.get("category_name"),
            "anomaly_score": score,
            "is_anomaly": is_anom,
            "reason": reason
        })

    return anomaly_results

def detect_recurring_expenses(transactions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Identifies recurring subscriptions by temporal interval & amount frequency.
    """
    if not transactions:
        return []

    df = pd.DataFrame(transactions)
    df_exp = df[df["transaction_type"] == "expense"].copy()
    if len(df_exp) < 2:
        return []

    df_exp["transaction_date"] = pd.to_datetime(df_exp["transaction_date"])
    grouped = df_exp.groupby(df_exp["merchant"].str.upper())

    recurring = []
    for merchant_name, group in grouped:
        if len(group) >= 2 and merchant_name:
            sorted_dates = group["transaction_date"].sort_values()
            diffs = sorted_dates.diff().dt.days.dropna()
            avg_diff = diffs.mean()
            avg_amount = group["amount"].mean()

            frequency = None
            if 5 <= avg_diff <= 9:
                frequency = "weekly"
            elif 25 <= avg_diff <= 35:
                frequency = "monthly"
            elif 350 <= avg_diff <= 380:
                frequency = "yearly"

            if frequency:
                last_date = sorted_dates.max()
                interval_days = 7 if frequency == "weekly" else (30 if frequency == "monthly" else 365)
                next_date = last_date + timedelta(days=interval_days)

                recurring.append({
                    "merchant": merchant_name.title(),
                    "avg_amount": round(avg_amount, 2),
                    "frequency": frequency,
                    "last_date": last_date.strftime("%Y-%m-%d"),
                    "next_expected_date": next_date.strftime("%Y-%m-%d")
                })

    return recurring

def generate_cash_flow_forecast(current_balance: float, transactions: List[Dict[str, Any]], days_ahead: int = 30) -> List[Dict[str, Any]]:
    """
    Generates time-series cash-flow forecasts using moving averages and recurring schedule logic.
    """
    if not transactions:
        # Fallback flat projection
        forecast = []
        today = datetime.utcnow()
        for i in range(days_ahead):
            d = today + timedelta(days=i)
            forecast.append({
                "date": d.strftime("%Y-%m-%d"),
                "expected_balance": round(current_balance, 2),
                "projected_expenses": 0.0,
                "projected_income": 0.0
            })
        return forecast

    df = pd.DataFrame(transactions)
    df["transaction_date"] = pd.to_datetime(df["transaction_date"])

    # Average daily income and expense
    df_exp = df[df["transaction_type"] == "expense"]
    df_inc = df[df["transaction_type"] == "income"]

    daily_exp_avg = df_exp["amount"].sum() / max(len(df["transaction_date"].dt.date.unique()), 30)
    daily_inc_avg = df_inc["amount"].sum() / max(len(df["transaction_date"].dt.date.unique()), 30)

    forecast = []
    running_balance = current_balance
    today = datetime.utcnow()

    for i in range(days_ahead):
        d = today + timedelta(days=i)
        exp_today = daily_exp_avg
        inc_today = daily_inc_avg if d.day in [1, 5, 30] else 0.0 # Salary on 1st/5th

        running_balance = running_balance + inc_today - exp_today

        forecast.append({
            "date": d.strftime("%Y-%m-%d"),
            "expected_balance": round(running_balance, 2),
            "projected_expenses": round(exp_today, 2),
            "projected_income": round(inc_today, 2)
        })

    return forecast
