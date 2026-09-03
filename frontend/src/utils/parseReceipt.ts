export type ParsedReceipt = {
  merchant: string;
  date: string;
  total: number;
  tax: number;
  subtotal: number;
  category: string;
  currency: string;
  items: { item: string; qty: number; price: number; category: string }[];
};

const CURRENCY = /(?:₹|rs\.?|inr|usd|\$)/i;
const NUM = /((?:\d{1,3}(?:,\d{2,3})+|\d+)(?:\.\d{1,2})?)/;
const DATE_RE = /(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/g;
const DECIMAL_AMOUNT = /\b(?:\d{1,3}(?:,\d{3})*|\d+)\.\d{2}\b/g;

const HEADER_METADATA_RE = /\b(?:phone|tel|mob|mobile|fax|gstin|tax\s+invoice|invoice\s+no|bill\s+no|bill\s+date|invoice\s+date|store\s+code|store\s*:|cashier|pos\s*:|pos\s*#|sr\s+no|s\.no|item\s+description|item\s+name|hsn|hsn\s+code|mrp|amount\s*\(|survey\s+no|plot\s+no|floor|skyline|icon|viman|pune|maharashtra|avenue\s+supermarts|dmart\s+ready|payment\s+mode|upi|transaction\s+id|upi\s+txn\s+id|paid\s+amount|thank\s+you|visit\s+us|save\s+money|total\s+items|taxable\s+amount|rounded\s+off|amount\s+payable|grand\s+total|subtotal|sub\s+total|discount|cgst|sgst|igst|vat|tax|shipping|rupees)\b/i;

const TOTAL_RE = /\b(?:amount\s+payable|paid\s+amount|grand\s+total|net\s+payable|amount\s+due|total\s+amount|bill\s+amount|net\s+amount|net\s+total|total\s+expense|to\s+pay)\b|^\s*(?:grand\s+)?total\b[\s:]*(?:₹|rs\.?|inr|usd|\$|\d)/i;

const TAX_RE = /\b(?:cgst|sgst|igst|vat|tax|sales\s+tax|service\s+charge|service\s+tax|cess)\b/i;

function parseValidDate(raw: string): string | null {
  const parts = raw.split(/[-/]/);
  if (parts.length !== 3) return null;
  const p1 = parseInt(parts[0], 10);
  const p2 = parseInt(parts[1], 10);
  const p3 = parseInt(parts[2], 10);
  let y = 0, m = 0, d = 0;
  if (p1 > 1000) { y = p1; m = p2; d = p3; }
  else if (p3 > 1000) { d = p1; m = p2; y = p3; }
  else return null;
  if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 2000 && y <= 2099) {
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  return null;
}

function toFloat(raw: string): number | null {
  const n = parseFloat(raw.replace(/,/g, ''));
  if (Number.isNaN(n) || n < 0 || n > 10_000_000) return null;
  return n;
}

function amountsInLine(line: string): number[] {
  if (HEADER_METADATA_RE.test(line) && !TOTAL_RE.test(line) && !TAX_RE.test(line) && !line.toLowerCase().includes('subtotal') && !line.toLowerCase().includes('sub total')) {
    return [];
  }

  const found: number[] = [];
  const withSymbol = new RegExp(`${CURRENCY.source}\\s*${NUM.source}`, 'gi');
  let m: RegExpExecArray | null;
  while ((m = withSymbol.exec(line))) {
    const v = toFloat(m[1]);
    if (v != null) found.push(v);
  }
  if (found.length) return found;

  const decRegex = new RegExp(DECIMAL_AMOUNT.source, 'g');
  while ((m = decRegex.exec(line))) {
    const v = toFloat(m[0]);
    if (v != null) found.push(v);
  }
  if (found.length) return found;

  const trail = new RegExp(`(?:${CURRENCY.source}\\s*)?${NUM.source}\\s*$`, 'i').exec(line.trim());
  if (trail) {
    const v = toFloat(trail[1]);
    if (v != null) found.push(v);
  }
  return found;
}

function isTotalLine(line: string) {
  const l = line.toLowerCase().trim();
  if (l.includes('subtotal') || l.includes('sub total') || l.includes('taxable amount')) return false;
  return TOTAL_RE.test(l);
}

function isTaxLine(line: string) {
  const l = line.toLowerCase().trim();
  if (l.includes('total') || l.includes('payable') || l.includes('paid amount')) return false;
  return TAX_RE.test(l);
}

function parseItem(line: string, category: string) {
  const l = line.toLowerCase().trim();
  if (HEADER_METADATA_RE.test(l)) return null;

  const cleanedLine = line.replace(/\b\d{4,8}\b/g, '');
  const amounts = amountsInLine(cleanedLine);
  if (!amounts.length) return null;

  const price = amounts[amounts.length - 1];
  const unitPrice = amounts.length > 1 ? amounts[0] : price;

  let qty = 1;
  const qtyMatch = cleanedLine.match(/(?:x\s*|×\s*)(\d+(?:\.\d+)?)\b/i) ||
    cleanedLine.match(/\b(\d+(?:\.\d+)?)\s*[x×]\s*/i);
  if (qtyMatch) {
    qty = parseFloat(qtyMatch[1]) || 1;
  } else if (amounts.length > 1 && unitPrice > 0) {
    const calc = Math.round(price / unitPrice);
    if (calc > 0 && Math.abs((unitPrice * calc) - price) < 0.05) {
      qty = calc;
    }
  }

  let name = cleanedLine.replace(/^[^\w]+/, '').trim();
  name = name.replace(/^\s*\d{1,2}\b\s*/, '');
  name = name.replace(CURRENCY, '');
  name = name.replace(DECIMAL_AMOUNT, '');
  name = name.replace(new RegExp(`${NUM.source}\\s*$`), '');
  name = name.replace(/\b\d{1,2}\s*$/, '');
  name = name.replace(/\s{2,}/g, ' ').trim().replace(/^[-:|]+|[-:|]+$/g, '');

  if (name.length < 2 || /^\d+(?:\.\d+)?$/.test(name.replace(/,/g, ''))) return null;
  return { item: name, qty, price, category };
}

function guessCategory(text: string) {
  const blob = text.toLowerCase();
  if (['swiggy', 'zomato', 'restaurant', 'cafe', 'starbucks', 'diner', 'pizza', 'burger', 'biryani', 'food', 'bakery', 'kitchen'].some(k => blob.includes(k))) return 'Food';
  if (['uber', 'ola', 'metro', 'fuel', 'shell', 'petrol', 'bpcl', 'hpcl', 'flight', 'cab', 'auto', 'railway'].some(k => blob.includes(k))) return 'Transport';
  if (['netflix', 'spotify', 'cinema', 'pvr', 'theatre', 'bookmyshow', 'movie', 'game', 'playstation'].some(k => blob.includes(k))) return 'Entertainment';
  if (['pharmacy', 'hospital', 'clinic', 'apollo', 'medplus', 'tablet', 'syrup', 'doctor', 'medicine', 'lab'].some(k => blob.includes(k))) return 'Healthcare';
  if (['dmart', 'freshmart', 'amazon', 'flipkart', 'myntra', 'zara', 'big bazaar', 'reliance', 'dmart ready', 'mart', 'store', 'supermarket', 'mall'].some(k => blob.includes(k))) return blob.includes('freshmart') ? 'Food' : 'Shopping';
  return 'Other';
}

export function parseReceiptLocal(rawText: string): ParsedReceipt {
  const lines = (rawText || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const today = new Date().toISOString().slice(0, 10);
  let merchant = 'Unknown Merchant';
  for (const line of lines.slice(0, 5)) {
    const cleanL = line.replace(/^[^\w]+/, '').trim();
    if (cleanL && !HEADER_METADATA_RE.test(cleanL) && !isTotalLine(cleanL)) {
      merchant = cleanL.replace(/[-|].*$/, '').trim() || cleanL;
      break;
    }
  }
  let date = today;
  let taxSum = 0;
  let explicitTotal = 0;
  const category = guessCategory(rawText + ' ' + merchant);
  const items: ParsedReceipt['items'] = [];

  for (const line of lines) {
    if (line.toLowerCase().includes('date') || date === today) {
      const regex = new RegExp(DATE_RE.source, 'g');
      let m: RegExpExecArray | null;
      while ((m = regex.exec(line))) {
        const pd = parseValidDate(m[0]);
        if (pd) { date = pd; break; }
      }
    }

    const amounts = amountsInLine(line);
    if (isTaxLine(line) && amounts.length) { taxSum += amounts[amounts.length - 1]; continue; }
    if (isTotalLine(line) && amounts.length) {
      const val = amounts[amounts.length - 1];
      if (line.toLowerCase().includes('amount payable') || line.toLowerCase().includes('paid amount') || explicitTotal === 0) {
        explicitTotal = val;
      }
      continue;
    }
    const item = parseItem(line, category);
    if (item) items.push(item);
  }

  const itemSum = items.reduce((a, i) => a + i.price, 0);

  if (explicitTotal > 0 && itemSum > 0 && explicitTotal > 2.5 * itemSum) {
    const strVal = String(Math.floor(explicitTotal));
    if (strVal.startsWith('21') && strVal.length >= 4) {
      const fixed = parseFloat(strVal.slice(1)) + (explicitTotal - Math.floor(explicitTotal));
      if (Math.abs(fixed - itemSum) < itemSum * 0.3) {
        explicitTotal = fixed;
      }
    }
  }

  let total = explicitTotal > 0 && explicitTotal <= 3 * itemSum ? explicitTotal : (itemSum > 0 ? itemSum : explicitTotal);
  let tax = Math.round(taxSum * 100) / 100;
  if (tax && total && tax >= total) tax = 0;

  return {
    merchant,
    date,
    total: Math.round(total * 100) / 100,
    tax,
    subtotal: Math.round((total - tax) * 100) / 100,
    category,
    currency: 'INR',
    items,
  };
}
