import pytest
from app.services.split_service import simplify_group_debts
from app.services.ocr_service import parse_receipt_text
from app.services.ml_service import rule_categorize, ml_categorize, detect_anomalies, generate_cash_flow_forecast

def test_splitwise_greedy_settlement():
    # Setup test group: Rahul paid 8000, Alex paid 4000
    # Members: Alex, Rahul, Aman, Priya
    members = [
        {"user_id": "alex", "member_name": "Alex"},
        {"user_id": "rahul", "member_name": "Rahul"},
        {"user_id": "aman", "member_name": "Aman"},
        {"user_id": "priya", "member_name": "Priya"}
    ]
    expenses = [
        {
            "paid_by": "rahul",
            "amount": 8000.0,
            "splits": [
                {"user_id": "alex", "amount_owed": 2000.0},
                {"user_id": "rahul", "amount_owed": 2000.0},
                {"user_id": "aman", "amount_owed": 2000.0},
                {"user_id": "priya", "amount_owed": 2000.0}
            ]
        },
        {
            "paid_by": "alex",
            "amount": 4000.0,
            "splits": [
                {"user_id": "alex", "amount_owed": 1000.0},
                {"user_id": "rahul", "amount_owed": 1000.0},
                {"user_id": "aman", "amount_owed": 1000.0},
                {"user_id": "priya", "amount_owed": 1000.0}
            ]
        }
    ]
    settlements = []

    results = simplify_group_debts(expenses, settlements, members)
    
    # Net Balances:
    # Rahul: +8000 - 3000 = +5000
    # Alex: +4000 - 3000 = +1000
    # Aman: 0 - 3000 = -3000
    # Priya: 0 - 3000 = -3000
    # Min transfers needed: 3 transactions (Aman->Rahul 3000, Priya->Rahul 2000, Priya->Alex 1000)
    
    assert len(results) <= 3
    total_transferred = sum(r.amount for r in results)
    assert round(total_transferred, 2) == 6000.0

def test_ocr_receipt_parsing():
    raw_ocr = """
    SWIGGY DINING
    Date: 2026-08-31
    Paneer Butter Masala 450.00
    Garlic Naan 200.00
    Subtotal 650.00
    GST Tax 32.50
    Total 682.50
    """
    parsed = parse_receipt_text(raw_ocr)
    assert parsed["merchant"].upper() == "SWIGGY DINING"
    assert parsed["total"] == 682.50
    assert parsed["category"] == "Food"
    assert len(parsed["items"]) >= 2

def test_categorization_engines():
    rule_cat = rule_categorize("UBER TRIP", "Cab ride home")
    assert rule_cat == "Transport"

    ml_res = ml_categorize("Spotify Premium", "Music monthly")
    assert ml_res["category"] == "Entertainment"

def test_cash_flow_forecast():
    forecast = generate_cash_flow_forecast(50000.0, [], days_ahead=7)
    assert len(forecast) == 7
    assert forecast[0]["expected_balance"] == 50000.0

def test_scan_receipt_api():
    from fastapi.testclient import TestClient
    from app.main import app
    from PIL import Image, ImageDraw
    import io
    img = Image.new('RGB', (400, 150), color=(255, 255, 255))
    d = ImageDraw.Draw(img)
    d.text((10, 10), 'STARBUCKS COFFEE\nCoffee 250.00\nTotal 250.00', fill=(0, 0, 0))
    b = io.BytesIO()
    img.save(b, format='JPEG')
    client = TestClient(app)
    tok = client.post('/api/v1/auth/demo-token').json()['access_token']
    res = client.post(
        '/api/v1/receipts/scan',
        headers={'Authorization': 'Bearer ' + tok},
        files={'file': ('receipt.jpg', b.getvalue(), 'image/jpeg')}
    )
    assert res.status_code == 200
    data = res.json()
    assert data['ocr_status'] == 'completed'
    assert 'items' in data

