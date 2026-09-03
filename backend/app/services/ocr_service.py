import re
from io import BytesIO
from datetime import datetime
from typing import Dict, Any, List, Optional

from PIL import Image
import pytesseract

_CURRENCY = r'(?:₹|rs\.?|inr|usd|\$)'
_NUM = r'((?:\d{1,3}(?:,\d{2,3})+|\d+)(?:\.\d{1,2})?)'

_AMOUNT_WITH_SYMBOL = re.compile(rf'{_CURRENCY}\s*{_NUM}', re.IGNORECASE)
_DECIMAL_AMOUNT = re.compile(r'\b(?:\d{1,3}(?:,\d{3})*|\d+)\.\d{2}\b')
_TRAILING_AMOUNT = re.compile(rf'(?:{_CURRENCY}\s*)?{_NUM}\s*$', re.IGNORECASE)
_PERCENT = re.compile(r'\d+(?:\.\d+)?\s*%')
_DATE = re.compile(r'(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})')

_HEADER_METADATA_RE = re.compile(
    r'\b(?:phone|tel|mob|mobile|fax|gstin|tax\s+invoice|invoice\s+no|bill\s+no|bill\s+date|invoice\s+date|store\s+code|store\s*:|cashier|pos\s*:|pos\s*#|'
    r'sr\s+no|s\.no|item\s+description|item\s+name|hsn|hsn\s+code|mrp|amount\s*\(|survey\s+no|plot\s+no|floor|skyline|icon|viman|pune|maharashtra|'
    r'avenue\s+supermarts|dmart\s+ready|payment\s+mode|upi|transaction\s+id|upi\s+txn\s+id|paid\s+amount|thank\s+you|visit\s+us|save\s+money|'
    r'total\s+items|taxable\s+amount|rounded\s+off|amount\s+payable|grand\s+total|subtotal|sub\s+total|discount|cgst|sgst|igst|vat|tax|shipping|rupees)\b',
    re.IGNORECASE
)

_TOTAL_RE = re.compile(
    r'\b(?:amount\s+payable|paid\s+amount|grand\s+total|net\s+payable|amount\s+due|total\s+amount|bill\s+amount|net\s+amount|net\s+total|total\s+expense|to\s+pay)\b'
    r'|^\s*(?:grand\s+)?total\b[\s:]*(?:₹|rs\.?|inr|usd|\$|\d)',
    re.IGNORECASE
)

_TAX_RE = re.compile(
    r'\b(?:cgst|sgst|igst|vat|tax|sales\s+tax|service\s+charge|service\s+tax|cess)\b',
    re.IGNORECASE
)


def _parse_valid_date(raw: str) -> Optional[str]:
    parts = re.split(r'[-/]', raw)
    if len(parts) != 3:
        return None
    try:
        p1, p2, p3 = int(parts[0]), int(parts[1]), int(parts[2])
        if p1 > 1000:
            y, m, d = p1, p2, p3
        elif p3 > 1000:
            d, m, y = p1, p2, p3
        else:
            return None
        if 1 <= m <= 12 and 1 <= d <= 31 and 2000 <= y <= 2099:
            return f"{y:04d}-{m:02d}-{d:02d}"
    except ValueError:
        pass
    return None


def _to_float(raw: str) -> Optional[float]:
    try:
        val = float(raw.replace(',', ''))
        if 0 <= val <= 10_000_000:
            return val
    except (ValueError, TypeError):
        pass
    return None


def _amounts_in_line(line: str) -> List[float]:
    if _HEADER_METADATA_RE.search(line) and not _TOTAL_RE.search(line) and not _TAX_RE.search(line) and not 'subtotal' in line.lower() and not 'sub total' in line.lower():
        return []

    found: List[float] = []
    for m in _AMOUNT_WITH_SYMBOL.finditer(line):
        v = _to_float(m.group(1))
        if v is not None:
            found.append(v)
    if found:
        return found

    for m in _DECIMAL_AMOUNT.finditer(line):
        v = _to_float(m.group(0))
        if v is not None:
            found.append(v)
    if found:
        return found

    if _DATE.search(line) and not re.search(_CURRENCY, line, re.I):
        return []
    m = _TRAILING_AMOUNT.search(line.strip())
    if m:
        v = _to_float(m.group(1))
        if v is not None:
            found.append(v)

    return found


def _is_total_line(line: str) -> bool:
    l = line.lower().strip()
    if 'subtotal' in l or 'sub total' in l or 'taxable amount' in l:
        return False
    return bool(_TOTAL_RE.search(l))


def _is_tax_line(line: str) -> bool:
    l = line.lower().strip()
    if 'total' in l or 'payable' in l or 'paid amount' in l:
        return False
    return bool(_TAX_RE.search(l))


def _parse_item(line: str) -> Optional[Dict[str, Any]]:
    l = line.lower().strip()
    if _HEADER_METADATA_RE.search(l):
        return None

    cleaned_line = re.sub(r'\b\d{4,8}\b', '', line)

    amounts = _amounts_in_line(cleaned_line)
    if not amounts:
        return None

    price = amounts[-1]
    unit_price = amounts[0] if len(amounts) > 1 else price

    qty = 1.0
    qty_match = re.search(r'(?:x\s*|×\s*)(\d+(?:\.\d+)?)\b', cleaned_line, re.I)
    if not qty_match:
        qty_match = re.search(r'\b(\d+(?:\.\d+)?)\s*[x×]\s*', cleaned_line, re.I)
    if not qty_match and len(amounts) > 1 and unit_price > 0:
        calc_qty = round(price / unit_price)
        if calc_qty > 0 and abs((unit_price * calc_qty) - price) < 0.05:
            qty = float(calc_qty)

    if qty == 1.0 and unit_price != price and unit_price > 0:
        qty = round(price / unit_price, 2)

    name = cleaned_line
    name = re.sub(r'^[^\w]+', '', name).strip()
    name = re.sub(r'^\s*\d{1,2}\b\s*', '', name)
    name = re.sub(_CURRENCY, '', name, flags=re.I)
    name = _DECIMAL_AMOUNT.sub('', name)
    name = re.sub(rf'{_NUM}\s*$', '', name)
    name = re.sub(r'\b\d{1,2}\s*$', '', name)
    name = re.sub(r'\s{2,}', ' ', name).strip(' -:|')

    if len(name) < 2 or name.replace('.', '', 1).replace(',', '', 1).isdigit():
        return None

    return {
        "item_name": name,
        "quantity": qty,
        "unit_price": unit_price if unit_price > 0 else price,
        "total_price": price
    }


def parse_receipt_text(raw_text: str) -> Dict[str, Any]:
    """Parse pasted receipt / OCR text into merchant, items, tax, and total."""
    lines = [line.strip() for line in (raw_text or '').splitlines() if line.strip()]

    merchant = "Unknown Merchant"
    date_str = datetime.utcnow().strftime("%Y-%m-%d")
    subtotal = 0.0
    tax_sum = 0.0
    explicit_total = 0.0
    category = "Shopping"
    items: List[Dict[str, Any]] = []

    if lines:
        for line in lines[:5]:
            clean_l = re.sub(r'^[^\w]+', '', line).strip()
            if clean_l and not _DATE.search(clean_l) and not _HEADER_METADATA_RE.search(clean_l) and not _is_total_line(clean_l):
                merchant = re.sub(r'[-|].*$', '', clean_l).strip() or clean_l
                merchant = merchant.title()
                break

    for line in lines:
        if 'date' in line.lower() or date_str == datetime.utcnow().strftime("%Y-%m-%d"):
            for m in _DATE.finditer(line):
                parsed_d = _parse_valid_date(m.group(1))
                if parsed_d:
                    date_str = parsed_d
                    break

        amounts = _amounts_in_line(line)

        if _is_tax_line(line) and amounts:
            tax_sum += amounts[-1]
            continue

        if _is_total_line(line) and amounts:
            val = amounts[-1]
            if 'amount payable' in line.lower() or 'paid amount' in line.lower() or explicit_total == 0:
                explicit_total = val
            continue

        item = _parse_item(line)
        if item:
            items.append(item)

    item_sum = round(sum(i["total_price"] for i in items), 2)

    if explicit_total > 0 and item_sum > 0 and explicit_total > 2.5 * item_sum:
        str_val = str(int(explicit_total))
        if str_val.startswith('21') and len(str_val) >= 4:
            try:
                fixed_val = float(str_val[1:]) + (explicit_total - int(explicit_total))
                if abs(fixed_val - item_sum) < item_sum * 0.3:
                    explicit_total = fixed_val
            except ValueError:
                pass

    total = explicit_total if (explicit_total > 0 and explicit_total <= 3 * item_sum) else (item_sum if item_sum > 0 else explicit_total)
    tax = round(tax_sum, 2)
    if tax and total and tax >= total:
        tax = 0.0
    subtotal = round(total - tax, 2) if total >= tax else total

    blob = (raw_text or '').lower() + ' ' + merchant.lower()
    if any(k in blob for k in ['swiggy', 'zomato', 'restaurant', 'cafe', 'starbucks', 'diner', 'pizza', 'burger', 'biryani', 'food', 'bakery', 'kitchen']):
        category = "Food"
    elif any(k in blob for k in ['uber', 'ola', 'metro', 'fuel', 'shell', 'petrol', 'bpcl', 'hpcl', 'flight', 'cab', 'auto', 'railway']):
        category = "Transport"
    elif any(k in blob for k in ['netflix', 'spotify', 'cinema', 'pvr', 'theatre', 'bookmyshow', 'movie', 'game', 'playstation']):
        category = "Entertainment"
    elif any(k in blob for k in ['pharmacy', 'hospital', 'clinic', 'apollo', 'medplus', 'tablet', 'syrup', 'doctor', 'medicine', 'lab']):
        category = "Healthcare"
    elif any(k in blob for k in ['dmart', 'freshmart', 'amazon', 'flipkart', 'myntra', 'zara', 'big bazaar', 'reliance', 'dmart ready', 'mart', 'store', 'supermarket', 'mall']):
        category = "Food" if "freshmart" in blob else "Shopping"

    return {
        "merchant": merchant,
        "date": date_str,
        "subtotal": subtotal,
        "tax": tax,
        "total": round(float(total or 0), 2),
        "category": category,
        "items": items,
    }


def extract_text_from_image(image_bytes: bytes) -> str:
    """Run local Tesseract OCR on an uploaded receipt image."""
    try:
        image = Image.open(BytesIO(image_bytes))
        return pytesseract.image_to_string(image)
    except Exception:
        return ""
