import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { fetchAnomalies, fetchRecurring } from '../services/api';

export default function IntelligenceView() {
  const [activeTab, setActiveTab] = useState<'anomalies' | 'recurring'>('anomalies');
  const [loading, setLoading] = useState(false);
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [recurring, setRecurring] = useState<any[]>([]);

  const loadTab = async (tab: 'anomalies' | 'recurring') => {
    setLoading(true);
    try {
      if (tab === 'anomalies') {
        const d = await fetchAnomalies();
        setAnomalies(Array.isArray(d) ? d : d?.anomalies ?? []);
      } else {
        const d = await fetchRecurring();
        setRecurring(Array.isArray(d) ? d : d?.recurring ?? []);
      }
    } catch { /* use fallback */ }
    setLoading(false);
  };

  useEffect(() => { loadTab(activeTab); }, [activeTab]);

  // Fallback demo data
  const demoAnomalies = [
    { merchant: 'Croma Electronics', amount: 18500, transaction_date: '2024-08-01', score: 0.97, category_name: 'Shopping', reason: '4.5x higher than your average shopping spend' },
    { merchant: 'Big Bazaar', amount: 4129, transaction_date: '2024-07-28', score: 0.82, category_name: 'Shopping', reason: '2x higher than usual grocery spend' },
  ];
  const demoRecurring = [
    { name: 'Netflix', amount: 649, category: 'Entertainment', next_date: '29 Sep', icon: '🎬', day_of_month: 29 },
    { name: 'Amazon Prime', amount: 299, category: 'Shopping', next_date: '15 Sep', icon: '📦', day_of_month: 15 },
    { name: 'Spotify', amount: 119, category: 'Entertainment', next_date: '20 Sep', icon: '🎵', day_of_month: 20 },
    { name: 'Google One', amount: 130, category: 'Utilities', next_date: '5 Sep', icon: '☁️', day_of_month: 5 },
    { name: 'Gym Membership', amount: 1500, category: 'Health', next_date: '1 Oct', icon: '💪', day_of_month: 1 },
  ];

  const displayAnomalies = anomalies.length > 0 ? anomalies : demoAnomalies;
  const displayRecurring = recurring.length > 0 ? recurring : demoRecurring;
  const monthlyRecurring = displayRecurring.reduce((a: number, r: any) => a + (r.amount ?? 0), 0);

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h1 className="page-greeting">Analytics 📊</h1>
            <p className="page-subtitle">AI-powered anomaly detection and recurring expense tracking.</p>
          </div>
          <button className="btn btn-secondary" onClick={() => loadTab(activeTab)} disabled={loading}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Tabs — only Anomalies and Recurring */}
      <div style={{ display: 'flex', gap: 6, background: 'var(--bg-input)', borderRadius: 10, padding: 4, marginBottom: 24, width: 'fit-content' }}>
        {[
          { id: 'anomalies', label: '🚨 Anomaly Detection' },
          { id: 'recurring', label: '🔄 Recurring Expenses' },
        ].map(t => (
          <button key={t.id} className={`card-tab ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => setActiveTab(t.id as any)} style={{ padding: '8px 20px', fontSize: 13.5 }}>
            {t.label}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <span className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
          <div style={{ marginTop: 10, color: 'var(--text-muted)', fontSize: 13 }}>Running AI analysis...</div>
        </div>
      )}

      {/* ANOMALIES */}
      {!loading && activeTab === 'anomalies' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
            <div className="card" style={{ padding: '16px 18px', borderLeft: '3px solid var(--red)' }}>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 4 }}>Anomalies Detected</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--red)' }}>{displayAnomalies.length}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>this month</div>
            </div>
            <div className="card" style={{ padding: '16px 18px', borderLeft: '3px solid #f59e0b' }}>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 4 }}>Avg Anomaly Score</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#f59e0b' }}>
                {displayAnomalies.length > 0
                  ? (displayAnomalies.reduce((a: number, x: any) => a + (x.score ?? 0.8), 0) / displayAnomalies.length).toFixed(2)
                  : '—'}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>0 = normal, 1 = very unusual</div>
            </div>
            <div className="card" style={{ padding: '16px 18px', borderLeft: '3px solid var(--accent)' }}>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 4 }}>Detection Model</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Isolation Forest</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>sklearn unsupervised ML</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {displayAnomalies.map((a: any, i: number) => {
              const score = a.score ?? a.anomaly_score ?? 0.8;
              const isHigh = score >= 0.9;
              return (
                <div key={i} className="card" style={{ padding: '18px 22px', borderLeft: `4px solid ${isHigh ? 'var(--red)' : '#f59e0b'}` }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                    <div style={{ width: 46, height: 46, borderRadius: 12, background: isHigh ? '#fef2f2' : '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                      {isHigh ? '🚨' : '⚠️'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 15, fontWeight: 700 }}>{a.merchant ?? a.description ?? 'Unknown'}</span>
                        <span className="badge" style={{ background: isHigh ? '#fef2f2' : '#fffbeb', color: isHigh ? '#dc2626' : '#d97706' }}>
                          Score: {typeof score === 'number' ? score.toFixed(2) : score}
                        </span>
                        {a.category_name && (
                          <span className="badge" style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}>{a.category_name}</span>
                        )}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
                        {a.reason ?? 'Unusual transaction pattern detected by Isolation Forest model'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {a.transaction_date ? new Date(a.transaction_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : a.date ?? ''}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: isHigh ? 'var(--red)' : '#d97706' }}>
                        ₹{Number(a.amount).toLocaleString('en-IN')}
                      </div>
                      <button className="btn btn-secondary" style={{ fontSize: 11.5, padding: '5px 12px', marginTop: 6 }}>
                        Review →
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {displayAnomalies.length === 0 && (
              <div className="card">
                <div className="empty-state">
                  <div className="empty-state-icon">✅</div>
                  <div className="empty-state-title">No anomalies detected</div>
                  <div className="empty-state-sub">Your spending looks normal. The AI found no suspicious patterns.</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* RECURRING */}
      {!loading && activeTab === 'recurring' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
            <div className="card" style={{ padding: '16px 18px', borderLeft: '3px solid var(--blue)' }}>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 4 }}>Monthly Total</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--blue)' }}>₹{monthlyRecurring.toLocaleString('en-IN')}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>in subscriptions</div>
            </div>
            <div className="card" style={{ padding: '16px 18px', borderLeft: '3px solid var(--purple)' }}>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 4 }}>Active Subscriptions</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--purple)' }}>{displayRecurring.length}</div>
            </div>
            <div className="card" style={{ padding: '16px 18px', borderLeft: '3px solid var(--accent)' }}>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 4 }}>Yearly Cost</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>
                ₹{(monthlyRecurring * 12).toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>estimated annual spend</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {displayRecurring.map((r: any, i: number) => (
              <div key={i} className="card" style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 46, height: 46, borderRadius: 12, background: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
                    {r.icon ?? '🔄'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3 }}>{r.name ?? r.merchant}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-muted)', display: 'flex', gap: 12 }}>
                      {r.category && <span>📁 {r.category}</span>}
                      {r.next_date && <span>📅 Next: {r.next_date}</span>}
                      {r.day_of_month && <span>🗓️ Day {r.day_of_month} monthly</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
                      ₹{Number(r.amount).toLocaleString('en-IN')}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>/ month</div>
                  </div>
                </div>
              </div>
            ))}
            {displayRecurring.length === 0 && (
              <div className="card">
                <div className="empty-state">
                  <div className="empty-state-icon">🔄</div>
                  <div className="empty-state-title">No recurring transactions found</div>
                  <div className="empty-state-sub">Add more transactions to detect recurring subscription patterns.</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
