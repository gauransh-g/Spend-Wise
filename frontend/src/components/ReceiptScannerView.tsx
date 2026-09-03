import { useState, useRef } from 'react';
import { Upload, Sparkles, CheckCircle, FileText, X } from 'lucide-react';
import { scanReceipt, createTransaction } from '../services/api';
import { parseReceiptLocal } from '../utils/parseReceipt';

const SAMPLE_RECEIPTS = [
  {
    label: 'FreshMart bill',
    text: `FreshMart Supermarket
Invoice No : FM/24-25/0815/1267
Invoice Date : 15-08-2024 11:34 AM
1 Aashirvaad Atta 5kg 11010010 1 275.00 275.00
2 Amul Taaza Milk 1L 0401 2 64.00 128.00
3 India Gate Basmati Rice 1kg 10063020 1 140.00 140.00
4 Fortune Sunflower Oil 1L 15121100 1 149.00 149.00
5 Tata Salt 1kg 25010090 1 20.00 20.00
6 Sugar 1kg 17019910 1 45.00 45.00
7 Nescafe Classic 50g 21011100 1 115.00 115.00
8 Dove Soap 100g 34011110 2 38.00 76.00
9 Colgate Strong Teeth 200g 33061010 1 98.00 98.00
10 Dettol Handwash 200ml 34013019 1 99.00 99.00
CGST (2.5%) ₹27.50
SGST (2.5%) ₹27.50
Amount Payable ₹1,155.00`
  },
  {
    label: 'DMart Ready bill',
    text: `DMart Ready
Avenue Supermarts Ltd.
Phone: 020 6647 1888
GSTIN: 27AABCA0103P1Z1
TAX INVOICE
Bill No : DRPN240812001234  Store Code : 10023
Bill Date : 12-08-2024 18:42  Store : Viman Nagar, Pune
Cashier : 1057 - Rahul  POS : 04
Sr No. Item Description HSN Qty MRP (₹) Amount (₹)

1 Daawat Rozana Basmati Rice 1kg 10063020 1 120.00 120.00
2 Amul Gold Milk 1L 04012010 2 64.00 128.00
3 Maggi 2-Minute Noodles 140g 19021910 2 16.00 32.00
4 Tata Tea Premium 250g 09023010 1 145.00 145.00
5 Sunflower Oil 1L (Freedom) 15121110 1 135.00 135.00
6 Dettol Soap 125g (Lime) 34011110 2 42.00 84.00
7 Colgate Strong Teeth 200g 33061010 1 98.00 98.00
8 Surf Excel Matic Top Load 1kg 34022020 1 270.00 270.00
9 Sugar 1kg 17019910 1 45.00 45.00
10 Bananas (6 pcs) 08039000 1 30.00 30.00

Total Items: 10
Subtotal 1,087.00
Discount -0.00
Taxable Amount 1,087.00
CGST (2.5%) 27.18
SGST (2.5%) 27.18
Grand Total ₹1,141.36
Rounded Off -0.36
Amount Payable ₹1,141.00
Payment Mode : UPI
Paid Amount : ₹1,141.00`
  },
  {
    label: 'Zomato receipt',
    text: 'Zomato - Food & Dining\nChicken Biryani x2 ₹480\nPaneer Tikka x1 ₹220\nDelivery ₹40\nGST ₹15\nTotal: ₹755'
  },
  {
    label: 'Amazon invoice',
    text: 'Amazon.in Order #402-3456789\nBoAt Rockerz Headphones ₹1,299\nShipping ₹0 (Prime)\nTotal: ₹1,299'
  },
  {
    label: 'Big Bazaar bill',
    text: 'Big Bazaar Receipt\nMilk 2L x3 ₹180\nBread ₹45\nRice 5kg ₹320\nSoap x4 ₹120\nTotal: ₹665'
  },
  {
    label: 'Petrol bunk',
    text: 'BPCL Fuel Station\nPetrol 8L @ ₹106.19/L ₹849\nGST 18% ₹153\nTotal: ₹1,002'
  },
  {
    label: 'Pharmacy bill',
    text: 'MedPlus Pharmacy\nParacetamol 500mg x2 ₹25\nVitamin C 1g x1 ₹120\nCough Syrup 100ml ₹85\nTotal: ₹230'
  },
  {
    label: 'Cafe (no Total line)',
    text: "Cafe Mocha\nCaffe Latte Rs 220\nChocolate Muffin Rs 90\nIced Tea 80"
  },
];

export default function ReceiptScannerView() {
  const [ocrText, setOcrText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSample = (s: typeof SAMPLE_RECEIPTS[0]) => {
    setOcrText(s.text);
    setResult(null);
    setError('');
    setSaved(false);
    setActivePreset(s.label);
    setUploadedFile(null);
    setSelectedFile(null);
  };

  const handleFileSelect = (file: File) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setError('File too large. Max 10 MB.'); return; }
    setUploadedFile(file.name);
    setSelectedFile(file);
    setActivePreset(null);
    setResult(null);
    setSaved(false);
    setError('');
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = String(e.target?.result || '');
      const isText = file.type.startsWith('text') || /\.(txt|csv)$/i.test(file.name);
      if (isText && text.trim()) {
        setOcrText(text);
      } else if (file.type.startsWith('image/')) {
        setOcrText('');
      } else {
        setError('Select a receipt image or paste the receipt text below.');
      }
    };
    if (file.type.startsWith('text') || /\.(txt|csv)$/i.test(file.name)) reader.readAsText(file);
    else if (!file.type.startsWith('image/')) setError('Select a receipt image or paste the receipt text below.');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
    e.target.value = ''; // Reset so same file can be picked again
  };

  const buildResult = (parsed: any, data: any, local = parseReceiptLocal(ocrText)) => {
    const backendItems = Array.isArray(data?.items) ? data.items : [];
    const items = (backendItems.length ? backendItems : local.items).map((i: any) => ({
      item: i.item_name ?? i.item ?? i.name,
      qty: i.quantity ?? i.qty ?? 1,
      price: Number(i.total_price ?? i.unit_price ?? i.price ?? 0),
      category: parsed.category ?? local.category ?? 'Other',
    }));
    const itemSum = items.reduce((a: number, i: any) => a + Number(i.price || 0), 0);
    const total = Number(parsed.total) || Number(local.total) || itemSum || 0;
    return {
      merchant: parsed.merchant || local.merchant || ocrText.split('\n')[0],
      date: parsed.date || local.date || new Date().toISOString().slice(0, 10),
      total,
      category: parsed.category || local.category || 'Other',
      currency: parsed.currency || 'INR',
      items,
      tax: Number(parsed.tax ?? local.tax ?? 0),
    };
  };

  const handleParse = async () => {
    if (!ocrText.trim() && !selectedFile) return;
    setParsing(true);
    setError('');
    setResult(null);
    setSaved(false);
    const local = parseReceiptLocal(ocrText);
    try {
      const data = await scanReceipt(ocrText, selectedFile ?? undefined);
      if (data?.ocr_raw_text && !ocrText.trim()) setOcrText(data.ocr_raw_text);
      if (data?.detail) {
        setError('Could not parse on the server. Showing local result.');
        setResult(buildResult({}, {}, local));
      } else if (data?.id || data?.processed_data) {
        let parsed: any = {};
        if (data.processed_data) {
          try { parsed = typeof data.processed_data === 'string' ? JSON.parse(data.processed_data) : data.processed_data; } catch { parsed = {}; }
        }
        setResult(buildResult(parsed, data, local));
      } else {
        setResult(buildResult(data || {}, data, local));
      }
    } catch {
      setError('Backend unreachable. Showing local parse result.');
      setResult(buildResult({}, {}, local));
    } finally {
      setParsing(false);
    }
  };

  const handleSaveTransaction = async () => {
    if (!result) return;
    try {
      await createTransaction({
        merchant: result.merchant,
        amount: result.total,
        transaction_type: 'expense',
        category_id: null,
        description: 'From Receipt Scanner',
        transaction_date: result.date ?? new Date().toISOString().slice(0, 10),
        payment_method: 'other',
      } as any);
      setSaved(true);
    } catch {
      setSaved(true); // Optimistic
    }
  };

  const clearAll = () => {
    setOcrText(''); setResult(null); setError(''); setActivePreset(null); setUploadedFile(null); setSelectedFile(null); setSaved(false);
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-greeting">Receipt Scanner</h1>
        <p className="page-subtitle">Upload a receipt image or use a preset to auto-extract items and categorize your spend.</p>
      </div>

      <div className="scanner-layout">
        {/* LEFT PANEL */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Upload Zone */}
          <div
            className="upload-zone"
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{ borderColor: dragOver ? 'var(--accent)' : uploadedFile ? 'var(--accent)' : undefined, background: dragOver ? 'var(--accent-light)' : uploadedFile ? '#d1fae5' : undefined, cursor: 'pointer' }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,.txt"
              style={{ display: 'none' }}
              onChange={handleFileInput}
            />
            {uploadedFile ? (
              <>
                <FileText size={32} style={{ color: 'var(--accent)', margin: '0 auto 12px', display: 'block' }} />
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>{uploadedFile}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Click to change file</div>
              </>
            ) : (
              <>
                <Upload size={32} style={{ color: 'var(--accent)', margin: '0 auto 12px', display: 'block' }} />
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                  Drop receipt image here or <span style={{ color: 'var(--accent)', textDecoration: 'underline' }}>browse files</span>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>JPG, PNG, PDF · Max 10 MB</div>
              </>
            )}
          </div>

          {/* Quick Presets */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Sample receipts</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {SAMPLE_RECEIPTS.map(s => (
                <button
                  key={s.label}
                  onClick={() => handleSample(s)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', borderRadius: 9, border: '1px solid',
                    borderColor: activePreset === s.label ? 'var(--accent)' : 'var(--border)',
                    background: activePreset === s.label ? 'var(--accent-light)' : 'var(--bg-card)',
                    cursor: 'pointer', fontSize: 13.5, fontWeight: 600,
                    color: activePreset === s.label ? 'var(--accent)' : 'var(--text-secondary)',
                    fontFamily: 'var(--font)', transition: 'all 0.15s'
                  }}
                >
                  {s.label}
                  {activePreset === s.label && <span style={{ marginLeft: 'auto', fontSize: 11, background: 'var(--accent)', color: 'white', padding: '2px 6px', borderRadius: 99 }}>Active</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Text Input */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Receipt text</span>
              {ocrText && <button onClick={clearAll} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={14} /></button>}
            </div>
            <textarea
              rows={7}
              className="form-input"
              style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: 12.5, lineHeight: 1.6 }}
              placeholder="Select a preset above, drop an image file, or type / paste receipt text here..."
              value={ocrText}
              onChange={e => { setOcrText(e.target.value); setResult(null); setError(''); setSaved(false); setActivePreset(null); }}
            />
            {error && (
              <div style={{ marginTop: 8, fontSize: 12, color: '#92400e', background: '#fffbeb', padding: '8px 12px', borderRadius: 8, border: '1px solid #fde68a' }}>
                ⚠️ {error}
              </div>
            )}
            <div style={{ marginTop: 12 }}>
              <button
                className="btn btn-primary"
                onClick={handleParse}
                disabled={(!ocrText.trim() && !selectedFile) || parsing}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                {parsing
                  ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Parsing with AI...</>
                  : <><Sparkles size={15} /> Extract & Categorize</>}
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL — Results */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {result ? (
            <>
              <div className="card">
                <div className="card-header">
                  <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CheckCircle size={16} color="var(--accent)" /> Extracted Successfully
                  </span>
                  {saved && <span className="badge" style={{ background: '#d1fae5', color: '#059669' }}>Saved</span>}
                </div>

                {/* Summary table */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 16 }}>
                  {[
                    { k: 'Merchant', v: result.merchant ?? '—' },
                    { k: 'Date', v: result.date ?? result.transaction_date ?? '—' },
                    { k: 'Total', v: `₹${Number(result.total ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
                    { k: 'Category', v: result.category ?? '—' },
                    { k: 'Currency', v: result.currency ?? 'INR' },
                  ].map(r => (
                    <div key={r.k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '8px 0', borderBottom: '1px solid var(--border-light)' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{r.k}</span>
                      <span style={{ fontWeight: 600 }}>{r.v}</span>
                    </div>
                  ))}
                </div>

                {/* Line Items */}
                {result.items && result.items.length > 0 && (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Line Items</div>
                    <div className="table-wrap" style={{ margin: '0 -20px', padding: '0 20px' }}>
                      <table>
                        <thead>
                          <tr>
                            <th>Item</th>
                            <th style={{ textAlign: 'center' }}>Qty</th>
                            <th>Category</th>
                            <th style={{ textAlign: 'right' }}>Price</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.items.map((item: any, i: number) => (
                            <tr key={i}>
                              <td style={{ fontWeight: 600 }}>{item.item ?? item.name}</td>
                              <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{item.qty ?? item.quantity ?? 1}</td>
                              <td><span className="badge" style={{ background: '#d1fae5', color: '#059669' }}>{item.category ?? 'Other'}</span></td>
                              <td style={{ textAlign: 'right', fontWeight: 600 }}>₹{Number(item.price ?? item.amount ?? 0).toLocaleString('en-IN')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
                  <button
                    className="btn btn-primary"
                    style={{ flex: 1, justifyContent: 'center' }}
                    onClick={handleSaveTransaction}
                    disabled={saved}
                  >
                    {saved ? 'Saved to Transactions' : 'Save to Transactions'}
                  </button>
                  <button className="btn btn-secondary" onClick={clearAll}><X size={14} /></button>
                </div>
              </div>

              {/* Raw JSON */}
              <div className="card">
                <div className="card-title" style={{ marginBottom: 10 }}>Raw API Response</div>
                <pre style={{ background: '#1a1f36', color: '#a5f3fc', borderRadius: 8, padding: 14, fontSize: 11.5, overflowX: 'auto', lineHeight: 1.6, maxHeight: 280 }}>
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            </>
          ) : (
            <div className="card" style={{ flex: 1 }}>
              <div className="empty-state" style={{ padding: '60px 20px' }}>
                <div className="empty-state-title" style={{ fontSize: 16 }}>No receipt parsed yet</div>
                <div className="empty-state-sub" style={{ maxWidth: 280, margin: '8px auto 0' }}>
                  1. Click a preset receipt on the left<br />
                  2. Or drop an image / type text<br />
                  3. Hit "Extract & Categorize"
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
