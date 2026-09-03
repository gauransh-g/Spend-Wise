import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, RefreshCw, Save } from 'lucide-react';
import { fetchBudgets } from '../services/api';

const DEFAULT_CATS = [
  { name: 'Food & Dining', icon: '🍽️', bg: '#d1fae5', color: '#10b981' },
  { name: 'Shopping', icon: '🛍️', bg: '#eff6ff', color: '#3b82f6' },
  { name: 'Transportation', icon: '🚗', bg: '#f5f3ff', color: '#8b5cf6' },
  { name: 'Entertainment', icon: '🎬', bg: '#fff7ed', color: '#f59e0b' },
  { name: 'Bills & Utilities', icon: '⚡', bg: '#fef2f2', color: '#ef4444' },
  { name: 'Health & Fitness', icon: '💪', bg: '#ecfdf5', color: '#059669' },
  { name: 'Travel', icon: '✈️', bg: '#eff6ff', color: '#0ea5e9' },
  { name: 'Education', icon: '📚', bg: '#fdf4ff', color: '#a855f7' },
  { name: 'Other', icon: '📦', bg: '#f3f4f6', color: '#6b7280' },
];

interface Budget {
  id: string;
  category_name: string;
  icon: string;
  bg: string;
  color: string;
  spent: number;
  amount_limit: number;
  period: string;
}

export default function BudgetsView() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editBudget, setEditBudget] = useState<Budget | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [form, setForm] = useState({ category_name: 'Food & Dining', amount_limit: '', period: 'Monthly' });

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const loadBudgets = async () => {
    setLoading(true);
    try {
      const data = await fetchBudgets();
      if (Array.isArray(data) && data.length > 0) {
        // Enrich with icon/color/bg from defaults
        const enriched = data.map((b: any) => {
          const def = DEFAULT_CATS.find(c => c.name.toLowerCase().includes(b.category_name?.toLowerCase()) || b.category_name?.toLowerCase().includes(c.name.toLowerCase().split(' ')[0]));
          return {
            id: b.id,
            category_name: b.category_name,
            icon: def?.icon ?? '📦',
            bg: def?.bg ?? '#f3f4f6',
            color: def?.color ?? '#6b7280',
            spent: b.amount_spent ?? b.spent ?? 0,
            amount_limit: b.amount_limit ?? b.total ?? 1000,
            period: 'Monthly',
          };
        });
        setBudgets(enriched);
      } else {
        // Use local demo budgets
        setBudgets([
          { id: '1', category_name: 'Food & Dining', icon: '🍽️', bg: '#d1fae5', color: '#10b981', spent: 15320, amount_limit: 20000, period: 'Monthly' },
          { id: '2', category_name: 'Shopping', icon: '🛍️', bg: '#eff6ff', color: '#3b82f6', spent: 9850, amount_limit: 15000, period: 'Monthly' },
          { id: '3', category_name: 'Transportation', icon: '🚗', bg: '#f5f3ff', color: '#8b5cf6', spent: 7450, amount_limit: 10000, period: 'Monthly' },
          { id: '4', category_name: 'Entertainment', icon: '🎬', bg: '#fff7ed', color: '#f59e0b', spent: 5080, amount_limit: 8000, period: 'Monthly' },
          { id: '5', category_name: 'Bills & Utilities', icon: '⚡', bg: '#fef2f2', color: '#ef4444', spent: 6250, amount_limit: 7000, period: 'Monthly' },
        ]);
      }
    } catch {
      setBudgets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBudgets();
    const handler = () => setShowAddModal(true);
    document.addEventListener('sw:add-budget', handler);
    return () => document.removeEventListener('sw:add-budget', handler);
  }, []);

  const handleAdd = async () => {
    if (!form.amount_limit) return showToast('Please enter a budget limit.');
    setSaving(true);
    await new Promise(r => setTimeout(r, 600));
    const def = DEFAULT_CATS.find(c => c.name === form.category_name) ?? DEFAULT_CATS[0];
    const newBudget: Budget = {
      id: Date.now().toString(),
      category_name: form.category_name,
      icon: def.icon,
      bg: def.bg,
      color: def.color,
      spent: 0,
      amount_limit: parseFloat(form.amount_limit),
      period: form.period,
    };
    setBudgets(prev => [...prev, newBudget]);
    setShowAddModal(false);
    setForm({ category_name: 'Food & Dining', amount_limit: '', period: 'Monthly' });
    showToast('✅ Budget added!');
    setSaving(false);
  };

  const handleEdit = async () => {
    if (!editBudget) return;
    if (!form.amount_limit) return showToast('Please enter a budget limit.');
    setSaving(true);
    await new Promise(r => setTimeout(r, 600));
    setBudgets(prev => prev.map(b => b.id === editBudget.id
      ? { ...b, amount_limit: parseFloat(form.amount_limit), period: form.period }
      : b
    ));
    setEditBudget(null);
    showToast('✅ Budget updated!');
    setSaving(false);
  };

  const handleDelete = (id: string) => {
    setBudgets(prev => prev.filter(b => b.id !== id));
    setDeleteId(null);
    showToast('🗑️ Budget removed.');
  };

  const totalBudgeted = budgets.reduce((a, b) => a + b.amount_limit, 0);
  const totalSpent = budgets.reduce((a, b) => a + b.spent, 0);
  const overCount = budgets.filter(b => b.spent > b.amount_limit).length;

  return (
    <div>
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 18px', boxShadow: 'var(--shadow-md)', fontSize: 13.5, fontWeight: 600 }}>
          {toast}
        </div>
      )}

      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h1 className="page-greeting">Budgets 🎯</h1>
            <p className="page-subtitle">Set monthly spending limits and track your progress.</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={loadBudgets}><RefreshCw size={14} /></button>
            <button className="btn btn-primary" onClick={() => { setForm({ category_name: 'Food & Dining', amount_limit: '', period: 'Monthly' }); setShowAddModal(true); }}>
              <Plus size={15} /> Add Budget
            </button>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 4 }}>Total Budgeted</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>₹{totalBudgeted.toLocaleString('en-IN')}</div>
        </div>
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 4 }}>Total Spent</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--red)' }}>₹{totalSpent.toLocaleString('en-IN')}</div>
        </div>
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 4 }}>Remaining</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>₹{(totalBudgeted - totalSpent).toLocaleString('en-IN')}</div>
        </div>
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 4 }}>Over Budget</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: overCount > 0 ? 'var(--red)' : 'var(--accent)' }}>{overCount} categories</div>
        </div>
      </div>

      {overCount > 0 && (
        <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, marginBottom: 20, fontSize: 13, color: '#dc2626' }}>
          ⚠️ You've exceeded your budget in <strong>{overCount} {overCount === 1 ? 'category' : 'categories'}</strong> this month.
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <span className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {budgets.map(b => {
            const pct = b.amount_limit > 0 ? Math.round((b.spent / b.amount_limit) * 100) : 0;
            const over = b.spent > b.amount_limit;
            const remaining = b.amount_limit - b.spent;
            const barColor = over ? 'var(--red)' : pct > 80 ? '#f59e0b' : b.color;

            return (
              <div key={b.id} className="card" style={{ padding: '18px 20px', borderLeft: over ? '3px solid var(--red)' : '3px solid transparent' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 46, height: 46, borderRadius: 12, background: b.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
                    {b.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{b.category_name}</span>
                        <span className="badge" style={{ background: 'var(--bg-input)', color: 'var(--text-muted)', fontSize: 10 }}>{b.period}</span>
                        {over && <span className="badge" style={{ background: '#fef2f2', color: 'var(--red)', fontSize: 10 }}>Over Budget</span>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                          ₹{b.spent.toLocaleString('en-IN')} / ₹{b.amount_limit.toLocaleString('en-IN')}
                        </span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: over ? 'var(--red)' : pct > 80 ? '#f59e0b' : 'var(--text-primary)' }}>
                          {pct}%
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); setForm({ category_name: b.category_name, amount_limit: String(b.amount_limit), period: b.period }); setEditBudget(b); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 6, display: 'flex' }}
                          title="Edit budget"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteId(b.id); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', padding: 4, borderRadius: 6, display: 'flex' }}
                          title="Delete budget"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="budget-progress-bar">
                      <div className="budget-progress-fill"
                        style={{ width: `${Math.min(pct, 100)}%`, background: barColor }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                      <span style={{ fontSize: 11.5, color: over ? 'var(--red)' : 'var(--text-muted)' }}>
                        {over ? `⚠️ Over by ₹${Math.abs(remaining).toLocaleString('en-IN')}` : `₹${remaining.toLocaleString('en-IN')} remaining`}
                      </span>
                      <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Resets monthly</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {budgets.length === 0 && !loading && (
            <div className="card">
              <div className="empty-state">
                <div className="empty-state-icon">🎯</div>
                <div className="empty-state-title">No budgets set</div>
                <div className="empty-state-sub">Add budget limits for your spending categories.</div>
                <button className="btn btn-primary" style={{ margin: '16px auto 0', display: 'flex' }} onClick={() => setShowAddModal(true)}>
                  <Plus size={14} /> Add First Budget
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Modal */}
      {(showAddModal || editBudget) && (
        <div className="modal-overlay" onClick={() => { setShowAddModal(false); setEditBudget(null); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">{editBudget ? 'Edit Budget' : 'Add Budget'}</div>
            {!editBudget && (
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-select" value={form.category_name} onChange={e => setForm(f => ({ ...f, category_name: e.target.value }))}>
                  {DEFAULT_CATS.map(c => <option key={c.name}>{c.name}</option>)}
                </select>
              </div>
            )}
            {editBudget && (
              <div style={{ padding: '10px 14px', background: 'var(--bg-input)', borderRadius: 8, marginBottom: 14, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>{editBudget.icon}</span> {editBudget.category_name}
              </div>
            )}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Budget Limit (₹)</label>
                <input className="form-input" type="number" min="0" step="100" placeholder="e.g. 5000" value={form.amount_limit}
                  onChange={e => setForm(f => ({ ...f, amount_limit: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Period</label>
                <select className="form-select" value={form.period} onChange={e => setForm(f => ({ ...f, period: e.target.value }))}>
                  <option>Monthly</option>
                  <option>Weekly</option>
                  <option>Yearly</option>
                </select>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => { setShowAddModal(false); setEditBudget(null); }}>Cancel</button>
              <button className="btn btn-primary" onClick={editBudget ? handleEdit : handleAdd} disabled={saving}>
                {saving ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : <Save size={14} />}
                {editBudget ? 'Save Changes' : 'Add Budget'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <div className="modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="modal" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🗑️</div>
              <div className="modal-title" style={{ marginBottom: 6 }}>Remove Budget?</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>This will remove the budget limit for this category.</div>
              <div className="modal-actions" style={{ justifyContent: 'center' }}>
                <button className="btn btn-secondary" onClick={() => setDeleteId(null)}>Cancel</button>
                <button className="btn btn-danger" onClick={() => handleDelete(deleteId!)}>Remove</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
