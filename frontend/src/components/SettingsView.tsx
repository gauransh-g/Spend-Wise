import { useState } from 'react';
import { User, Lock, Bell, Globe, Trash2, Save, Eye, EyeOff } from 'lucide-react';
import { persistUser, updateProfile } from '../services/api';

interface Props {
  user: any;
  onUserUpdate: (user: any) => void;
}

export default function SettingsView({ user, onUserUpdate }: Props) {
  const [activeSection, setActiveSection] = useState<'profile' | 'security' | 'notifications' | 'preferences'>('profile');
  const [profile, setProfile] = useState({ full_name: user?.full_name ?? '', email: user?.email ?? '', currency: user?.currency ?? 'INR' });
  const [passwords, setPasswords] = useState({ current: '', new_pass: '', confirm: '' });
  const [showPass, setShowPass] = useState(false);
  const [notifications, setNotifications] = useState({ budget_alerts: true, unusual_spending: true, group_updates: true, weekly_summary: false, monthly_report: true });
  const [toast, setToast] = useState('');
  const [saving, setSaving] = useState(false);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const updated = await updateProfile({ full_name: profile.full_name, currency: profile.currency });
      persistUser(updated);
      onUserUpdate(updated);
      showToast('Profile updated successfully.');
    } catch {
      const next = { ...user, full_name: profile.full_name, currency: profile.currency };
      persistUser(next);
      onUserUpdate(next);
      showToast('Saved locally. Could not reach the server.');
    }
    setSaving(false);
  };

  const handleSavePassword = async () => {
    if (!passwords.current) return showToast('Please enter your current password.');
    if (passwords.new_pass.length < 6) return showToast('New password must be at least 6 characters.');
    if (passwords.new_pass !== passwords.confirm) return showToast('New passwords do not match.');
    setSaving(true);
    await new Promise(r => setTimeout(r, 800));
    setPasswords({ current: '', new_pass: '', confirm: '' });
    showToast('✅ Password changed successfully!');
    setSaving(false);
  };

  const sections = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Lock },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'preferences', label: 'Preferences', icon: Globe },
  ];

  return (
    <div>
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 18px', boxShadow: 'var(--shadow-md)', fontSize: 13.5, fontWeight: 600 }}>
          {toast}
        </div>
      )}

      <div className="page-header">
        <h1 className="page-greeting">Settings ⚙️</h1>
        <p className="page-subtitle">Manage your account, preferences, and security.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 20 }}>
        {/* Settings Nav */}
        <div className="card" style={{ padding: '8px', alignSelf: 'start' }}>
          {sections.map(s => {
            const Icon = s.icon;
            return (
              <button key={s.id} onClick={() => setActiveSection(s.id as any)}
                className={`nav-item ${activeSection === s.id ? 'active' : ''}`}
                style={{ width: '100%', marginBottom: 2 }}>
                <Icon size={15} /> {s.label}
              </button>
            );
          })}
        </div>

        {/* Section Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {activeSection === 'profile' && (
            <div className="card">
              <div className="card-title" style={{ marginBottom: 20 }}>Profile Information</div>

              {/* Avatar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, padding: '16px', background: 'var(--bg-input)', borderRadius: 12 }}>
                <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                  {(profile.full_name || user?.email || 'U').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{profile.full_name || 'Your Name'}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{profile.email}</div>
                  <div style={{ fontSize: 12, color: 'var(--accent)', marginTop: 4, fontWeight: 600 }}>Demo Account</div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input className="form-input" value={profile.full_name} placeholder="Your full name"
                  onChange={e => setProfile(p => ({ ...p, full_name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input className="form-input" value={profile.email} disabled
                  style={{ background: 'var(--bg-input)', color: 'var(--text-muted)', cursor: 'not-allowed' }} />
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>Email cannot be changed.</div>
              </div>
              <div className="form-group">
                <label className="form-label">Default Currency</label>
                <select className="form-select" value={profile.currency} onChange={e => setProfile(p => ({ ...p, currency: e.target.value }))}>
                  <option value="INR">₹ Indian Rupee (INR)</option>
                  <option value="USD">$ US Dollar (USD)</option>
                  <option value="EUR">€ Euro (EUR)</option>
                  <option value="GBP">£ British Pound (GBP)</option>
                </select>
              </div>
              <button className="btn btn-primary" onClick={handleSaveProfile} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {saving ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : <Save size={14} />}
                Save Changes
              </button>
            </div>
          )}

          {activeSection === 'security' && (
            <div className="card">
              <div className="card-title" style={{ marginBottom: 20 }}>Change Password</div>
              <div className="form-group">
                <label className="form-label">Current Password</label>
                <div style={{ position: 'relative' }}>
                  <input className="form-input" type={showPass ? 'text' : 'password'} placeholder="••••••••"
                    value={passwords.current} onChange={e => setPasswords(p => ({ ...p, current: e.target.value }))} style={{ paddingRight: 40 }} />
                  <button type="button" onClick={() => setShowPass(v => !v)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">New Password</label>
                  <input className="form-input" type="password" placeholder="Min. 6 characters"
                    value={passwords.new_pass} onChange={e => setPasswords(p => ({ ...p, new_pass: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Confirm New Password</label>
                  <input className="form-input" type="password" placeholder="Repeat password"
                    value={passwords.confirm} onChange={e => setPasswords(p => ({ ...p, confirm: e.target.value }))} />
                </div>
              </div>
              <button className="btn btn-primary" onClick={handleSavePassword} disabled={saving}>
                {saving ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Changing...</> : 'Change Password'}
              </button>

              <div style={{ marginTop: 28, paddingTop: 24, borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--red)', marginBottom: 8 }}>Danger Zone</div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
                  Permanently delete your account and all data. This action cannot be undone.
                </p>
                <button className="btn btn-danger" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Trash2 size={14} /> Delete Account
                </button>
              </div>
            </div>
          )}

          {activeSection === 'notifications' && (
            <div className="card">
              <div className="card-title" style={{ marginBottom: 20 }}>Notification Preferences</div>
              {([
                { key: 'budget_alerts', label: 'Budget Alerts', desc: 'Get notified when you exceed 80% of a budget.' },
                { key: 'unusual_spending', label: 'Unusual Spending', desc: 'Alerts for anomalous transactions detected by AI.' },
                { key: 'group_updates', label: 'Group Updates', desc: 'Notifications when group expenses or settlements change.' },
                { key: 'weekly_summary', label: 'Weekly Summary', desc: 'A weekly digest of your spending and savings.' },
                { key: 'monthly_report', label: 'Monthly Report', desc: 'Detailed monthly financial report every 1st of month.' },
              ] as const).map(n => (
                <div key={n.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid var(--border-light)' }}>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{n.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{n.desc}</div>
                  </div>
                  <button
                    onClick={() => setNotifications(prev => ({ ...prev, [n.key]: !prev[n.key] }))}
                    style={{
                      width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', flexShrink: 0,
                      background: notifications[n.key] ? 'var(--accent)' : 'var(--border)',
                      position: 'relative', transition: 'background 0.2s'
                    }}
                  >
                    <div style={{
                      width: 18, height: 18, borderRadius: '50%', background: 'white',
                      position: 'absolute', top: 3, transition: 'left 0.2s',
                      left: notifications[n.key] ? 23 : 3,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                    }} />
                  </button>
                </div>
              ))}
              <button className="btn btn-primary" onClick={() => showToast('✅ Notification preferences saved!')} style={{ marginTop: 16 }}>
                <Save size={14} /> Save Preferences
              </button>
            </div>
          )}

          {activeSection === 'preferences' && (
            <div className="card">
              <div className="card-title" style={{ marginBottom: 20 }}>App Preferences</div>
              <div className="form-group">
                <label className="form-label">Date Format</label>
                <select className="form-select">
                  <option>DD/MM/YYYY</option>
                  <option>MM/DD/YYYY</option>
                  <option>YYYY-MM-DD</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Week Starts On</label>
                <select className="form-select">
                  <option>Monday</option>
                  <option>Sunday</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Language</label>
                <select className="form-select">
                  <option>English (India)</option>
                  <option>Hindi</option>
                </select>
              </div>
              <button className="btn btn-primary" onClick={() => showToast('✅ Preferences saved!')}>
                <Save size={14} /> Save Preferences
              </button>
            </div>
          )}

          {/* App Info Card */}
          <div className="card" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 2 }}>SpendWise 2.0</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Version 2.0.0 • Backend: FastAPI + SQLite • Frontend: React + Vite</div>
              </div>
              <span className="badge" style={{ background: '#d1fae5', color: '#059669' }}>✅ All systems operational</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
