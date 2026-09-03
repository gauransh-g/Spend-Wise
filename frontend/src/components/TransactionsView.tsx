import { useState, useEffect } from 'react';
import { Search, Plus, ArrowUpRight, ArrowDownLeft, Trash2, RefreshCw } from 'lucide-react';
import { fetchTransactions, createTransaction, deleteTransaction, fetchCategories } from '../services/api';

const CAT_COLORS: Record<string, { bg: string; color: string }> = {
  'Food': { bg: '#d1fae5', color: '#059669' },
  'Shopping': { bg: '#eff6ff', color: '#2563eb' },
  'Transport': { bg: '#f5f3ff', color: '#7c3aed' },
  'Entertainment': { bg: '#fff7ed', color: '#d97706' },
  'Bills': { bg: '#fef2f2', color: '#dc2626' },
  'Income': { bg: '#d1fae5', color: '#059669' },
  'Healthcare': { bg: '#ecfdf5', color: '#059669' },
  'Other': { bg: '#f3f4f6', color: '#6b7280' },
  'Uncategorized': { bg: '#f3f4f6', color: '#6b7280' },
};

const CAT_ICONS: Record<string, string> = {
  Food: '🍽️', Shopping: '🛍️', Transport: '🚗', Entertainment: '🎬',
  Bills: '⚡', Income: '💼', Healthcare: '💊', Other: '📦', Uncategorized: '❓'
};

export default function TransactionsView() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({
    merchant: '',
    amount: '',
    category_id: '',
    transaction_type: 'expense' as 'expense' | 'income',
    description: '',
    transaction_date: new Date().toISOString().slice(0, 10)
  });
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [txs, cats] = await Promise.all([fetchTransactions(), fetchCategories()]);
      setTransactions(Array.isArray(txs) ? txs : []);
      setCategories(Array.isArray(cats) ? cats : []);
      if (Array.isArray(cats) && cats.length > 0 && !form.category_id) {
        setForm(f => ({ ...f, category_id: cats[0].id }));
      }
    } catch {
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleSave = async () => {
    if (!form.merchant || !form.amount) return showToast('Please fill merchant and amount.');
    setSaving(true);
    try {
      const tx = await createTransaction({
        merchant: form.merchant,
        description: form.description || form.merchant,
        amount: parseFloat(form.amount),
        transaction_type: form.transaction_type,
        category_id: form.category_id || undefined,
        transaction_date: form.transaction_date,
      });
      if (tx.id) {
        setTransactions(prev => [tx, ...prev]);
        setShowModal(false);
        setForm({ merchant: '', amount: '', category_id: categories[0]?.id ?? '', transaction_type: 'expense', description: '', transaction_date: new Date().toISOString().slice(0, 10) });
        showToast('✅ Transaction saved!');
      } else {
        showToast('❌ Error: ' + (tx.detail || 'Could not save.'));
      }
    } catch {
      showToast('❌ Failed to connect to backend.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTransaction(id);
      setTransactions(prev => prev.filter(t => t.id !== id));
      showToast('🗑️ Transaction deleted.');
    } catch {
      showToast('❌ Could not delete.');
    }
    setDeleteId(null);
  };

  const filtered = transactions.filter(t => {
    const matchSearch = t.merchant?.toLowerCase().includes(search.toLowerCase())
      || t.category_name?.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'All' || t.transaction_type === typeFilter;
    return matchSearch && matchType;
  });

  const totalIncome = transactions.filter(t => t.transaction_type === 'income').reduce((a, t) => a + (t.amount ?? 0), 0);
  const totalExpense = transactions.filter(t => t.transaction_type === 'expense').reduce((a, t) => a + (t.amount ?? 0), 0);

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 18px', boxShadow: 'var(--shadow-md)', fontSize: 13.5, fontWeight: 600 }}>
          {toast}
        </div>
      )}

      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h1 className="page-greeting">Transactions 💳</h1>
            <p className="page-subtitle">Track and manage all your income and expenses.</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={loadData} disabled={loading}>
              <RefreshCw size={14} /> Refresh
            </button>
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>
              <Plus size={15} /> Add Transaction
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
        <div className="card" style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Total Income</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>+₹{totalIncome.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{transactions.filter(t => t.transaction_type === 'income').length} transactions</div>
        </div>
        <div className="card" style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Total Expenses</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--red)' }}>-₹{totalExpense.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{transactions.filter(t => t.transaction_type === 'expense').length} transactions</div>
        </div>
        <div className="card" style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Net Balance</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: totalIncome - totalExpense >= 0 ? 'var(--accent)' : 'var(--red)' }}>
            ₹{(totalIncome - totalExpense).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{transactions.length} total</div>
        </div>
      </div>

      {/* Filters */}
      <div className="page-actions-bar">
        <div className="search-input-wrap">
          <Search size={14} />
          <input type="text" placeholder="Search transactions..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="filter-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="All">All Types</option>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </select>
        <span style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--text-muted)' }}>
          {filtered.length} of {transactions.length} shown
        </span>
      </div>

      {/* Table */}
      <div className="table-card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <span className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
            <div style={{ marginTop: 10, color: 'var(--text-muted)', fontSize: 13 }}>Loading transactions...</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Transaction</th>
                  <th>Category</th>
                  <th>Date</th>
                  <th>Type</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => {
                  const cat = t.category_name ?? 'Uncategorized';
                  const cc = CAT_COLORS[cat] ?? { bg: '#f3f4f6', color: '#6b7280' };
                  return (
                    <tr key={t.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 34, height: 34, borderRadius: 9, background: cc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>
                            {CAT_ICONS[cat] ?? '📦'}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{t.merchant}</div>
                            {t.description && t.description !== t.merchant && (
                              <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{t.description}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="badge" style={{ background: cc.bg, color: cc.color }}>{cat}</span>
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>
                        {t.transaction_date ? new Date(t.transaction_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      <td>
                        {t.transaction_type === 'income'
                          ? <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><ArrowDownLeft size={13} color="var(--accent)" /><span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>Income</span></div>
                          : <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><ArrowUpRight size={13} color="var(--red)" /><span style={{ fontSize: 12, color: 'var(--red)', fontWeight: 600 }}>Expense</span></div>
                        }
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: t.transaction_type === 'income' ? 'var(--accent)' : 'var(--red)' }}>
                        {t.transaction_type === 'income' ? '+' : '-'}₹{Number(t.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          onClick={() => setDeleteId(t.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px 6px', borderRadius: 6, transition: 'all 0.15s' }}
                          onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && !loading && (
              <div className="empty-state">
                <div className="empty-state-icon">{transactions.length === 0 ? '💳' : '🔍'}</div>
                <div className="empty-state-title">{transactions.length === 0 ? 'No transactions yet' : 'No results found'}</div>
                <div className="empty-state-sub">{transactions.length === 0 ? 'Click "Add Transaction" to log your first one.' : 'Try different search or filter.'}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Transaction Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Log Transaction</div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Merchant / Description *</label>
                <input className="form-input" placeholder="e.g. Zomato" value={form.merchant}
                  onChange={e => setForm(f => ({ ...f, merchant: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Amount (₹) *</label>
                <input className="form-input" type="number" min="0" step="0.01" placeholder="0.00" value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-select" value={form.category_id}
                  onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Type</label>
                <select className="form-select" value={form.transaction_type}
                  onChange={e => setForm(f => ({ ...f, transaction_type: e.target.value as 'expense' | 'income' }))}>
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Date</label>
              <input className="form-input" type="date" value={form.transaction_date}
                onChange={e => setForm(f => ({ ...f, transaction_date: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Notes (optional)</label>
              <input className="form-input" placeholder="Add a note..." value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Saving...</> : 'Save Transaction'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Dialog */}
      {deleteId && (
        <div className="modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🗑️</div>
              <div className="modal-title" style={{ marginBottom: 6 }}>Delete Transaction?</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>This action cannot be undone.</div>
            </div>
            <div className="modal-actions" style={{ justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => handleDelete(deleteId!)}>Yes, Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
