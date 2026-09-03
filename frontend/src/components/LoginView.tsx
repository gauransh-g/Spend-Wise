import { useState } from 'react';
import { Eye, EyeOff, TrendingUp, Shield, Zap } from 'lucide-react';
import { login, register } from '../services/api';

interface Props {
  onLogin: (user: any) => void;
}

export default function LoginView({ onLogin }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [form, setForm] = useState({ email: '', password: '', full_name: '', confirm: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const update = (k: string, v: string) => { setForm(f => ({ ...f, [k]: v })); setError(''); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (mode === 'register') {
      if (!form.full_name.trim()) return setError('Please enter your full name.');
      if (form.password.length < 6) return setError('Password must be at least 6 characters.');
      if (form.password !== form.confirm) return setError('Passwords do not match.');
    }
    if (!form.email.includes('@')) return setError('Please enter a valid email address.');
    if (!form.password) return setError('Please enter your password.');

    setLoading(true);
    try {
      const data = mode === 'login'
        ? await login(form.email, form.password)
        : await register(form.email, form.password, form.full_name);
      onLogin(data.user);
    } catch (e: any) {
      setError(mode === 'login' ? 'Invalid email or password. Try demo@spendwise.com / password123' : 'Registration failed. Email may already be in use.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await login('demo@spendwise.com', 'password123');
      onLogin(data.user);
    } catch {
      setError('Could not connect to backend. Make sure the server is running on port 8000.');
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: <TrendingUp size={18} color="#10b981" />, title: 'Smart Analytics', desc: 'AI-powered spending insights and forecasting' },
    { icon: <Shield size={18} color="#3b82f6" />, title: 'Secure Splits', desc: 'Greedy debt simplification for group expenses' },
    { icon: <Zap size={18} color="#8b5cf6" />, title: 'Receipt OCR', desc: 'Auto-extract items from any receipt photo' },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#f4f6f9', fontFamily: 'var(--font)' }}>
      {/* Left — Branding Panel */}
      <div style={{
        width: '45%', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #064e3b 100%)',
        display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px 56px',
        position: 'relative', overflow: 'hidden'
      }}>
        {/* Background circles */}
        <div style={{ position: 'absolute', top: -60, right: -60, width: 240, height: 240, borderRadius: '50%', background: 'rgba(16,185,129,0.08)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: 40, left: -40, width: 180, height: 180, borderRadius: '50%', background: 'rgba(99,102,241,0.08)', pointerEvents: 'none' }} />

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 56 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #10b981, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: 'white' }}>S</div>
          <span style={{ fontSize: 22, fontWeight: 800, color: 'white', letterSpacing: '-0.5px' }}>SpendWise 2.0</span>
        </div>

        <h1 style={{ fontSize: 36, fontWeight: 800, color: 'white', lineHeight: 1.2, marginBottom: 16, letterSpacing: '-0.8px' }}>
          Take control of your finances
        </h1>
        <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, marginBottom: 48 }}>
          AI-powered expense tracking, smart group splits, and real-time financial insights — all in one place.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {features.map(f => (
            <div key={f.title} style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {f.icon}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'white', marginBottom: 2 }}>{f.title}</div>
                <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.5)', lineHeight: 1.4 }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 'auto', paddingTop: 48 }}>
          <div style={{ display: 'flex', gap: 24 }}>
            {[['10K+', 'Users'], ['₹50Cr+', 'Tracked'], ['99.9%', 'Uptime']].map(([v, l]) => (
              <div key={l}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#10b981' }}>{v}</div>
                <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.4)' }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right — Form Panel */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 60px' }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6, letterSpacing: '-0.5px' }}>
              {mode === 'login' ? 'Welcome back 👋' : 'Create your account'}
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
              {mode === 'login' ? 'Sign in to your SpendWise account' : 'Start tracking your finances for free'}
            </p>
          </div>

          {/* Tab Toggle */}
          <div style={{ display: 'flex', background: 'var(--bg-input)', borderRadius: 10, padding: 4, marginBottom: 28 }}>
            {(['login', 'register'] as const).map(m => (
              <button key={m} onClick={() => { setMode(m); setError(''); }}
                style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13.5, fontWeight: 600, fontFamily: 'var(--font)', transition: 'all 0.15s',
                  background: mode === m ? 'white' : 'transparent',
                  color: mode === m ? 'var(--text-primary)' : 'var(--text-muted)',
                  boxShadow: mode === m ? 'var(--shadow-sm)' : 'none'
                }}>
                {m === 'login' ? 'Sign In' : 'Register'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            {mode === 'register' && (
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input className="form-input" placeholder="Arjun Sharma" value={form.full_name}
                  onChange={e => update('full_name', e.target.value)} style={{ fontSize: 14 }} />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input className="form-input" type="email" placeholder="you@example.com" value={form.email}
                onChange={e => update('email', e.target.value)} style={{ fontSize: 14 }} />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <input className="form-input" type={showPass ? 'text' : 'password'} placeholder="••••••••"
                  value={form.password} onChange={e => update('password', e.target.value)} style={{ fontSize: 14, paddingRight: 40 }} />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {mode === 'register' && (
              <div className="form-group">
                <label className="form-label">Confirm Password</label>
                <input className="form-input" type="password" placeholder="••••••••" value={form.confirm}
                  onChange={e => update('confirm', e.target.value)} style={{ fontSize: 14 }} />
              </div>
            )}

            {error && (
              <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: '#dc2626', marginBottom: 16 }}>
                {error}
              </div>
            )}

            <button type="submit" className="btn btn-primary" disabled={loading}
              style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: 14, marginBottom: 12, borderRadius: 10 }}>
              {loading ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2, borderTopColor: 'white' }} /> Please wait...</>
                : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div style={{ position: 'relative', textAlign: 'center', margin: '20px 0' }}>
            <div style={{ height: 1, background: 'var(--border)', position: 'absolute', top: '50%', left: 0, right: 0 }} />
            <span style={{ background: '#f4f6f9', padding: '0 12px', fontSize: 12, color: 'var(--text-muted)', position: 'relative' }}>or</span>
          </div>

          <button onClick={handleDemo} disabled={loading}
            style={{ width: '100%', padding: '11px', borderRadius: 10, border: '1px solid var(--border)', background: 'white', fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'white')}
          >
            🚀 Try Demo Account
          </button>

          <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--bg-input)', borderRadius: 8, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
            Demo: <strong>demo@spendwise.com</strong> / <strong>password123</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
