import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { Input, Button, AlertBanner } from '../components/UI';

export default function LoginPage() {
  const [mode, setMode]       = useState('login'); // 'login' | 'register'
  const [form, setForm]       = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const { login }   = useAuth();
  const navigate    = useNavigate();

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async e => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      if (mode === 'register') {
        if (form.password !== form.confirmPassword) throw new Error('Passwords do not match');
        const data = await api.post('/auth/register', {
          name: form.name, email: form.email, password: form.password,
        });
        localStorage.setItem('it_token', data.token);
        localStorage.setItem('it_user', JSON.stringify(data.user));
        navigate('/');
      } else {
        await login(form.email, form.password);
        navigate('/');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)', padding: 20,
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img src="/bhdc-logo.png" alt="BHDC" style={{ height: 56, width: 'auto', marginBottom: 16, filter: 'brightness(0) invert(1)' }} />
          <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 800, margin: '0 0 4px', letterSpacing: '-.3px' }}>
            BHDC InspectTrack
          </h1>
          <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>
            Bohai Drilling Engineering Company — Qatar Project
          </p>
        </div>

        {/* Card */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 32,
          boxShadow: '0 24px 64px rgba(0,0,0,.4)' }}>

          {/* Tab switcher */}
          <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 10,
            padding: 4, marginBottom: 24 }}>
            {['login', 'register'].map(m => (
              <button key={m} onClick={() => { setMode(m); setError(''); }} style={{
                flex: 1, padding: '8px 0', border: 'none', borderRadius: 8,
                cursor: 'pointer', fontWeight: 600, fontSize: 14, fontFamily: 'inherit',
                background: mode === m ? '#fff' : 'transparent',
                color: mode === m ? '#0f172a' : '#64748b',
                boxShadow: mode === m ? '0 1px 4px rgba(0,0,0,.1)' : 'none',
                transition: 'all .15s',
              }}>
                {m === 'login' ? 'Sign In' : 'Register'}
              </button>
            ))}
          </div>

          <AlertBanner type="error" message={error} onClose={() => setError('')} />

          <form onSubmit={submit}>
            {mode === 'register' && (
              <Input label="Full Name" type="text" placeholder="John Smith"
                value={form.name} onChange={set('name')} required />
            )}
            <Input label="Email Address" type="email" placeholder="you@company.com"
              value={form.email} onChange={set('email')} required />
            <Input label="Password" type="password" placeholder="••••••••"
              value={form.password} onChange={set('password')} required />
            {mode === 'register' && (
              <Input label="Confirm Password" type="password" placeholder="••••••••"
                value={form.confirmPassword} onChange={set('confirmPassword')} required />
            )}

            {mode === 'login' && (
              <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16, marginTop: -8 }}>
                First time? Switch to Register above — the first account becomes Admin automatically.
              </p>
            )}

            <Button type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center' }} size="lg">
              {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </Button>
          </form>
        </div>

        <p style={{ textAlign: 'center', color: '#475569', fontSize: 12, marginTop: 20 }}>
          InspectTrack v1.0 · Equipment Inspection Management
        </p>
      </div>
    </div>
  );
}
