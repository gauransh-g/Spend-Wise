import { useState, useEffect } from 'react';
import {
  LayoutDashboard, ArrowLeftRight, Users, PiggyBank,
  BarChart2, Settings, Plus, LogOut, ChevronUp, ScanLine, Moon, Sun
} from 'lucide-react';
import DashboardView from './components/DashboardView';
import TransactionsView from './components/TransactionsView';
import GroupsView from './components/GroupsView';
import BudgetsView from './components/BudgetsView';
import IntelligenceView from './components/IntelligenceView';
import ReceiptScannerView from './components/ReceiptScannerView';
import SettingsView from './components/SettingsView';
import LoginView from './components/LoginView';
import { fetchGroups, fetchGroupBalances, fetchReceipts, fetchTransactions, getStoredToken, getStoredUser, logout, fetchMe } from './services/api';
import { applyTheme, getStoredTheme, type Theme } from './theme';

type Tab = 'dashboard' | 'transactions' | 'groups' | 'budgets' | 'analytics' | 'receipts' | 'settings';

const navItems: { id: Tab; label: string; icon: any }[] = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
  { id: 'transactions', label: 'Transactions', icon: ArrowLeftRight },
  { id: 'groups', label: 'Groups & Splits', icon: Users },
  { id: 'budgets', label: 'Budgets', icon: PiggyBank },
  { id: 'analytics', label: 'Analytics', icon: BarChart2 },
  { id: 'receipts', label: 'Receipt Scanner', icon: ScanLine },
  { id: 'settings', label: 'Settings', icon: Settings },
];

function money(n: number) {
  return `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function RightPanel({ user, onNavigate }: { user: any; onNavigate: (tab: Tab) => void }) {
  const [balances, setBalances] = useState<{ name: string; amount: string; type: string; label: string }[]>([]);
  const [receipts, setReceipts] = useState<{ name: string; amount: string; date: string }[]>([]);

  const loadSide = async () => {
    try {
      const groups = await fetchGroups();
      const list = Array.isArray(groups) ? groups.slice(0, 4) : [];
      const rows: { name: string; amount: string; type: string; label: string }[] = [];
      for (const g of list) {
        try {
          const settlements = await fetchGroupBalances(g.id);
          const mine = Array.isArray(settlements)
            ? settlements.filter((s: any) => s.payer_id === user?.id || s.payee_id === user?.id)
            : [];
          if (mine.length === 0) {
            rows.push({ name: g.name, amount: 'Settled up', type: 'settled', label: '' });
          } else {
            const net = mine.reduce((acc: number, s: any) => {
              if (s.payer_id === user?.id) return acc - Number(s.amount || 0);
              if (s.payee_id === user?.id) return acc + Number(s.amount || 0);
              return acc;
            }, 0);
            rows.push({
              name: g.name,
              amount: money(Math.abs(net)),
              type: net < 0 ? 'owe' : net > 0 ? 'owed' : 'settled',
              label: net < 0 ? 'You owe' : net > 0 ? 'You are owed' : '',
            });
          }
        } catch {
          rows.push({ name: g.name, amount: '—', type: 'settled', label: '' });
        }
      }
      setBalances(rows);

      const rec = await fetchReceipts().catch(() => []);
      if (Array.isArray(rec) && rec.length > 0) {
        setReceipts(rec.slice(0, 4).map((r: any) => {
          let merchant = r.image_url || 'Receipt';
          let total = 0;
          try {
            const parsed = r.processed_data ? JSON.parse(r.processed_data) : null;
            merchant = parsed?.merchant || merchant;
            total = Number(parsed?.total || 0);
          } catch { /* ignore */ }
          if (!total && r.items?.length) total = r.items.reduce((a: number, i: any) => a + Number(i.total_price || 0), 0);
          return {
            name: merchant,
            amount: total ? money(total) : '—',
            date: r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '',
          };
        }));
      } else {
        const txs = await fetchTransactions().catch(() => []);
        const recent = (Array.isArray(txs) ? txs : []).filter((t: any) => t.transaction_type !== 'income').slice(0, 4);
        setReceipts(recent.map((t: any) => ({
          name: t.merchant || 'Expense',
          amount: money(t.amount || 0),
          date: t.transaction_date ? new Date(t.transaction_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '',
        })));
      }
    } catch {
      setBalances([]);
      setReceipts([]);
    }
  };

  useEffect(() => {
    loadSide();
    const handler = () => loadSide();
    document.addEventListener('sw:data-changed', handler);
    return () => document.removeEventListener('sw:data-changed', handler);
  }, [user?.id]);

  return (
    <aside className="right-panel">
      <div className="panel-card">
        <div className="panel-card-header">
          <span className="panel-section-title" style={{ marginBottom: 0 }}>Group Balances</span>
          <button className="panel-view-all" onClick={() => onNavigate('groups')}>View All</button>
        </div>
        <div className="balance-items">
          {balances.length === 0 && (
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', padding: '8px 0' }}>No groups yet.</div>
          )}
          {balances.map(b => (
            <div key={b.name} className="balance-item">
              <div className="balance-item-icon" style={{ background: b.type === 'owe' ? '#fef2f2' : b.type === 'owed' ? '#d1fae5' : '#f3f4f6' }}>
                {b.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="balance-item-info">
                <div className="balance-item-name">{b.name}</div>
                {b.label && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{b.label}</div>}
              </div>
              <div className={`balance-item-amount ${b.type}`}>{b.amount}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel-card">
        <div className="panel-card-header">
          <span className="panel-section-title" style={{ marginBottom: 0 }}>Recent Receipts</span>
          <button className="panel-view-all" onClick={() => onNavigate('receipts')}>View All</button>
        </div>
        <div className="receipt-items">
          {receipts.length === 0 && (
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', padding: '8px 0' }}>No receipts yet.</div>
          )}
          {receipts.map((r, i) => (
            <div key={`${r.name}-${i}`} className="receipt-item">
              <div className="receipt-item-logo">{r.name.slice(0, 1).toUpperCase()}</div>
              <div className="receipt-item-info">
                <div className="receipt-item-name">{r.name}</div>
                <div className="receipt-item-date">{r.date}</div>
              </div>
              <div className="receipt-item-amount">{r.amount}</div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [user, setUser] = useState<any>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme());

  useEffect(() => {
    const storedUser = getStoredUser();
    const storedToken = getStoredToken();
    if (!storedToken || !storedUser) {
      setIsAuthenticated(false);
      return;
    }
    setUser(storedUser);
    setIsAuthenticated(true);
    fetchMe()
      .then((fresh) => setUser(fresh))
      .catch((err) => {
        if (String(err?.message || '').includes('Session expired')) {
          setUser(null);
          setIsAuthenticated(false);
        }
      });
  }, []);

  useEffect(() => {
    const onLost = () => {
      setUser(null);
      setIsAuthenticated(false);
    };
    window.addEventListener('sw:auth-lost', onLost);
    return () => window.removeEventListener('sw:auth-lost', onLost);
  }, []);

  const handleLogin = (userData: any) => {
    setUser(userData);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    logout();
    setUser(null);
    setIsAuthenticated(false);
    setShowUserMenu(false);
  };

  const handleUserUpdate = (next: any) => {
    setUser(next);
  };

  if (isAuthenticated === null) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-app)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, #10b981, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700, color: 'white', margin: '0 auto 16px' }}>S</div>
          <span className="spinner" style={{ width: 24, height: 24, borderWidth: 3 }} />
          <div style={{ marginTop: 12, color: 'var(--text-muted)', fontSize: 13 }}>Loading SpendWise...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginView onLogin={handleLogin} />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <DashboardView user={user} />;
      case 'transactions': return <TransactionsView />;
      case 'groups': return <GroupsView />;
      case 'budgets': return <BudgetsView />;
      case 'analytics': return <IntelligenceView />;
      case 'receipts': return <ReceiptScannerView />;
      case 'settings': return <SettingsView user={user} onUserUpdate={handleUserUpdate} />;
      default: return <DashboardView user={user} />;
    }
  };

  const showRightPanel = activeTab === 'dashboard';
  const displayName = user?.full_name || user?.email || 'User';
  const initials = displayName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">S</div>
          <span className="sidebar-logo-text">SpendWise</span>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
                onClick={() => setActiveTab(item.id)}
              >
                <Icon className="nav-icon" size={17} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div style={{ position: 'relative' }}>
          {showUserMenu && (
            <div style={{ position: 'absolute', bottom: '100%', left: 12, right: 12, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow-md)', overflow: 'hidden', zIndex: 100 }}>
              <button
                onClick={() => { setActiveTab('settings'); setShowUserMenu(false); }}
                style={{ width: '100%', padding: '10px 14px', background: 'none', border: 'none', textAlign: 'left', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                <Settings size={14} /> Settings
              </button>
              <div style={{ height: 1, background: 'var(--border)' }} />
              <button
                onClick={handleLogout}
                style={{ width: '100%', padding: '10px 14px', background: 'none', border: 'none', textAlign: 'left', fontSize: 13, color: 'var(--red)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                onMouseEnter={e => (e.currentTarget.style.background = '#fef2f2')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                <LogOut size={14} /> Sign Out
              </button>
            </div>
          )}
          <div className="sidebar-user" onClick={() => setShowUserMenu(v => !v)}>
            <div className="sidebar-user-avatar">{initials}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{displayName}</div>
              <div className="sidebar-user-email">{user?.email ?? ''}</div>
            </div>
            <ChevronUp size={14} style={{ color: 'var(--text-muted)', flexShrink: 0, transform: showUserMenu ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.2s' }} />
          </div>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>
              {navItems.find(n => n.id === activeTab)?.label ?? 'SpendWise'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
            <button
              className="topbar-icon-btn"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              onClick={() => {
                const next = theme === 'dark' ? 'light' : 'dark';
                setTheme(next);
                applyTheme(next);
              }}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                if (activeTab === 'transactions') document.dispatchEvent(new CustomEvent('sw:add-transaction'));
                else if (activeTab === 'groups') document.dispatchEvent(new CustomEvent('sw:add-group'));
                else if (activeTab === 'budgets') document.dispatchEvent(new CustomEvent('sw:add-budget'));
                else setActiveTab('transactions');
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
            >
              <Plus size={15} />
              {activeTab === 'transactions' ? 'Add Transaction'
                : activeTab === 'groups' ? 'New Group'
                : activeTab === 'budgets' ? 'Add Budget'
                : 'Add Transaction'}
            </button>
          </div>
        </header>

        <div className="content-wrapper">
          <main style={{ flex: 1, overflowY: 'auto', padding: '24px', minWidth: 0 }}>
            {renderContent()}
          </main>
          {showRightPanel && <RightPanel user={user} onNavigate={setActiveTab} />}
        </div>
      </div>
    </div>
  );
}
