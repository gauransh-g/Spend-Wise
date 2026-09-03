import { useState, useEffect } from 'react';
import {
  AreaChart, Area, PieChart, Pie, Cell, ResponsiveContainer,
  Tooltip, XAxis, YAxis, BarChart, Bar
} from 'recharts';
import { TrendingUp, TrendingDown, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { fetchMonthlySummary, fetchTransactions, fetchInsights, fetchBudgets } from '../services/api';

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4'];

const CAT_BG: Record<string, string> = {
  Food: '#d1fae5', 'Food & Dining': '#d1fae5',
  Shopping: '#eff6ff', Transport: '#f5f3ff', Transportation: '#f5f3ff',
  Entertainment: '#fff7ed', Bills: '#fef2f2', 'Bills & Utilities': '#fef2f2',
  Income: '#d1fae5', Health: '#ecfdf5', Other: '#f3f4f6', Uncategorized: '#f3f4f6',
};
const CAT_COLOR: Record<string, string> = {
  Food: '#10b981', 'Food & Dining': '#10b981', Shopping: '#3b82f6',
  Transport: '#8b5cf6', Transportation: '#8b5cf6', Entertainment: '#f59e0b',
  Bills: '#ef4444', 'Bills & Utilities': '#ef4444', Income: '#10b981',
  Health: '#059669', Other: '#6b7280', Uncategorized: '#6b7280',
};
function catInitial(name?: string) {
  return (name || '?').slice(0, 1).toUpperCase();
}

function rupee(n: number) {
  return `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function isThisMonth(dateStr?: string) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

function sparkData(base: number, up: boolean) {
  return Array.from({ length: 12 }, (_, i) => ({
    v: Math.max(0, base + (up ? 1 : -1) * i * 150 + (Math.random() - 0.5) * 500)
  }));
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload?.length) {
    return (
      <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
        {payload.map((p: any) => (
          <div key={p.name} style={{ color: p.color }}>{p.name}: ₹{Number(p.value).toLocaleString('en-IN')}</div>
        ))}
      </div>
    );
  }
  return null;
};

export default function DashboardView({ user }: { user?: any }) {
  const [hideBalance, setHideBalance] = useState(false);
  const [spendingTab, setSpendingTab] = useState<'this' | 'last'>('this');
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [insights, setInsights] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [error, setError] = useState('');

  const displayName = (user?.full_name || user?.email || 'there').split(' ')[0];

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [sum, txs, ins, bud] = await Promise.all([
        fetchMonthlySummary(),
        fetchTransactions(),
        fetchInsights().catch(() => []),
        fetchBudgets().catch(() => []),
      ]);
      setSummary(sum && typeof sum === 'object' && !sum.detail ? sum : null);
      setTransactions(Array.isArray(txs) ? txs : []);
      setInsights(Array.isArray(ins) ? ins.slice(0, 3) : []);
      setBudgets(Array.isArray(bud) ? bud.slice(0, 4) : []);
    } catch {
      setError('Could not connect to backend.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const handler = () => loadData();
    document.addEventListener('sw:data-changed', handler);
    return () => document.removeEventListener('sw:data-changed', handler);
  }, []);

  const amt = (t: any) => Number(t.amount) || 0;
  const isIncomeTx = (t: any) => String(t.transaction_type || '').toLowerCase() === 'income';
  const isExpenseTx = (t: any) => String(t.transaction_type || '').toLowerCase() !== 'income';

  const totalIncome = transactions.filter(isIncomeTx).reduce((a, t) => a + amt(t), 0);
  const monthlyIncome = transactions.filter(t => isIncomeTx(t) && isThisMonth(t.transaction_date)).reduce((a, t) => a + amt(t), 0);
  const monthlyExpenses = transactions.filter(t => isExpenseTx(t) && isThisMonth(t.transaction_date)).reduce((a, t) => a + amt(t), 0);
  const totalExpenses = transactions.filter(isExpenseTx).reduce((a, t) => a + amt(t), 0);

  const income = Number(summary?.monthly_income ?? summary?.income ?? monthlyIncome) || monthlyIncome;
  const expenses = Number(summary?.monthly_expenses ?? summary?.expenses ?? monthlyExpenses) || monthlyExpenses;
  const allIncome = Number(summary?.total_income ?? totalIncome) || totalIncome;
  const savings = Number(summary?.savings ?? (income - expenses));
  const savingsRate = income > 0 ? +((savings / income) * 100).toFixed(1) : 0;
  const balance = summary?.total_balance != null ? Number(summary.total_balance) : (allIncome - totalExpenses);

  const catBreakdown: { category: string; amount: number }[] =
    summary?.category_breakdown?.length > 0
      ? summary.category_breakdown
      : Object.entries(
          transactions
            .filter(t => isExpenseTx(t) && isThisMonth(t.transaction_date))
            .reduce((acc: Record<string, number>, t) => {
              const key = t.category_name || 'Other';
              acc[key] = (acc[key] || 0) + amt(t);
              return acc;
            }, {})
        ).map(([category, amount]) => ({ category, amount }));

  const donutTotal = catBreakdown.reduce((a, c) => a + c.amount, 0);

  const stats = [
    {
      label: 'Total Balance', stroke: '#10b981', bg: '#d1fae5', up: balance >= 0, isBalance: true,
      value: rupee(balance),
      change: allIncome > 0 ? `Total income ${rupee(allIncome)}` : 'Add income to get started',
    },
    {
      label: 'Monthly Income', stroke: '#3b82f6', bg: '#eff6ff', up: true, icon: 'I',
      value: rupee(income),
      change: 'This month',
    },
    {
      label: 'Monthly Expenses', stroke: '#ef4444', bg: '#fef2f2', up: false, icon: 'E',
      value: rupee(expenses),
      change: 'This month',
    },
    {
      label: 'Savings Rate', stroke: '#8b5cf6', bg: '#f5f3ff', up: savingsRate >= 20, icon: 'S',
      value: `${savingsRate}%`,
      change: savingsRate >= 20 ? 'On track' : savings < 0 ? 'Over-spending' : 'This month',
    },
  ];

  const recentTx = transactions.slice(0, 5);

  const insightCards = insights;
  const budgetCards = budgets;

  const monthLabel = new Date().toLocaleString('en-IN', { month: 'short' });
  const barData = [
    { month: monthLabel, income, expenses },
  ];

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h1 className="page-greeting">Welcome, {displayName}</h1>
            <p className="page-subtitle">Here's a summary of your finances this month.</p>
          </div>
          <button className="btn btn-secondary" onClick={loadData} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
        {error && (
          <div style={{ marginTop: 10, padding: '8px 14px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, fontSize: 12.5, color: '#92400e' }}>
            {error}
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        {stats.map((s, i) => (
          <div key={s.label} className="stat-card">
            <div className="stat-card-header">
              <span className="stat-card-label">{s.label}</span>
              <div className="stat-card-icon" style={{ background: s.bg }}>
                {s.isBalance
                  ? <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: s.stroke, display: 'flex' }}
                      onClick={() => setHideBalance(h => !h)}>
                      {hideBalance ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  : <span style={{ fontSize: 12, fontWeight: 700, color: s.stroke }}>{s.icon ?? catInitial(s.label)}</span>
                }
              </div>
            </div>
            <div className="stat-card-value">
              {s.isBalance && hideBalance ? '₹••••••••' : loading ? '—' : s.value}
            </div>
            <div className={`stat-card-change ${s.up ? 'up' : 'down'}`}>
              {s.up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {s.change}
            </div>
            <div className="sparkline-container">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sparkData(i === 0 ? balance : i === 1 ? income : i === 2 ? expenses : savingsRate, s.up)}>
                  <defs>
                    <linearGradient id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={s.stroke} stopOpacity={0.25} />
                      <stop offset="100%" stopColor={s.stroke} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="v" stroke={s.stroke} strokeWidth={1.5} fill={`url(#grad-${i})`} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>

      {/* Spending Overview + Budget Progress */}
      <div className="dashboard-grid-wide">
        {/* Donut chart */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Spending Overview</span>
            <div className="card-tabs">
              <button className={`card-tab ${spendingTab === 'this' ? 'active' : ''}`} onClick={() => setSpendingTab('this')}>This Month</button>
              <button className={`card-tab ${spendingTab === 'last' ? 'active' : ''}`} onClick={() => setSpendingTab('last')}>Last Month</button>
            </div>
          </div>
          <div className="spending-overview-inner">
            <div className="donut-wrapper">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={catBreakdown} cx="50%" cy="50%" innerRadius={48} outerRadius={75}
                    dataKey="amount" paddingAngle={2} strokeWidth={0}>
                    {catBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => `₹${Number(v).toLocaleString('en-IN')}`} />
                </PieChart>
              </ResponsiveContainer>
              <div className="donut-center-label">
                <span className="donut-center-value">₹{Math.round(donutTotal / 1000)}k</span>
                <span className="donut-center-sub">Expenses</span>
              </div>
            </div>
            <div className="spending-categories">
              {catBreakdown.map((c, i) => (
                <div key={c.category} className="spending-cat-row">
                  <div className="spending-cat-dot" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="spending-cat-name">{c.category}</span>
                  <span className="spending-cat-amount">₹{c.amount.toLocaleString('en-IN')}</span>
                  <span className="spending-cat-pct">{donutTotal > 0 ? ((c.amount / donutTotal) * 100).toFixed(1) : 0}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Budget Progress */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Budget Progress</span>
            <button className="card-action">View All</button>
          </div>
          <div className="budget-items">
            {budgetCards.map((b: any) => {
              const spent = b.spent ?? b.amount_spent ?? 0;
              const limit = b.amount_limit ?? b.limit ?? b.total ?? 1;
              const pct = Math.min(Math.round((spent / limit) * 100), 999);
              const over = pct > 100;
              const barColor = over ? 'var(--red)' : pct > 80 ? '#f59e0b' : CAT_COLOR[b.category_name] ?? '#10b981';
              return (
                <div key={b.category_name} className="budget-item">
                  <div className="budget-item-header">
                    <div className="budget-item-left">
                      <div className="budget-item-icon" style={{ background: CAT_BG[b.category_name] ?? '#f3f4f6' }}>
                        {catInitial(b.category_name)}
                      </div>
                      <div>
                        <div className="budget-item-name">{b.category_name}</div>
                        <div className="budget-item-amount">₹{spent.toLocaleString('en-IN')} / ₹{limit.toLocaleString('en-IN')}</div>
                      </div>
                    </div>
                    <div className="budget-item-pct" style={{ color: over ? 'var(--red)' : pct > 80 ? '#d97706' : 'var(--text-primary)' }}>
                      {pct}%
                    </div>
                  </div>
                  <div className="budget-progress-bar">
                    <div className="budget-progress-fill" style={{ width: `${Math.min(pct, 100)}%`, background: barColor }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Income vs Expenses Bar + Recent Transactions */}
      <div className="dashboard-grid">
        {/* Income vs Expenses */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Income vs Expenses</span>
            <div style={{ display: 'flex', gap: 12, fontSize: 11.5, color: 'var(--text-muted)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: '#10b981', display: 'inline-block' }} /> Income
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: '#ef4444', display: 'inline-block' }} /> Expenses
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={barData} barSize={14} barGap={4}>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="income" fill="#10b981" radius={[3, 3, 0, 0]} name="Income" />
              <Bar dataKey="expenses" fill="#ef4444" radius={[3, 3, 0, 0]} name="Expenses" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Recent Transactions */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent Transactions</span>
            <button className="card-action">View All</button>
          </div>
          <div className="transactions-list">
            {recentTx.map((t: any, i: number) => {
              const isIncome = t.transaction_type === 'income';
              const cat = t.category_name ?? 'Other';
              return (
                <div key={t.id ?? i} className="transaction-row">
                  <div className="transaction-icon" style={{ background: CAT_BG[cat] ?? '#f3f4f6' }}>
                    {catInitial(cat)}
                  </div>
                  <div className="transaction-info">
                    <div className="transaction-name">{t.merchant ?? t.description}</div>
                    <div className="transaction-cat">{cat}</div>
                  </div>
                  <div className="transaction-date">
                    {t.transaction_date ? new Date(t.transaction_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                  </div>
                  <div className={`transaction-amount ${isIncome ? 'income' : 'expense'}`}>
                    {isIncome ? '+' : '-'}₹{Number(t.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Insights row */}
      {insightCards.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header">
            <span className="card-title">Financial Insights</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {insightCards.map((ins: any, i: number) => {
              const sev = ins.severity ?? 'info';
              const bg = sev === 'warning' ? '#fffbeb' : sev === 'success' ? '#d1fae5' : '#eff6ff';
              const color = sev === 'warning' ? '#d97706' : sev === 'success' ? '#059669' : '#3b82f6';
              return (
                <div key={i} style={{ padding: '14px', background: bg, borderRadius: 10, border: `1px solid ${color}22` }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color, marginBottom: 4 }}>{ins.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{ins.description}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
