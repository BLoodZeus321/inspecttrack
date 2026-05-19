import { useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { Input, Button, AlertBanner, Card } from '../components/UI';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const [form, setForm]   = useState({ current_password: '', new_password: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg]     = useState('');
  const [error, setError] = useState('');
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async e => {
    e.preventDefault();
    if (form.new_password !== form.confirm) { setError('New passwords do not match'); return; }
    if (form.new_password.length < 8) { setError('New password must be at least 8 characters'); return; }
    setSaving(true); setError(''); setMsg('');
    try {
      await api.put('/auth/change-password', {
        current_password: form.current_password,
        new_password:     form.new_password,
      });
      setMsg('Password changed successfully!');
      setForm({ current_password: '', new_password: '', confirm: '' });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const ROLE_DESC = {
    admin:    'Full access — manage users, categories, equipment, log inspections',
    inspector:'Can add equipment and log inspections',
    viewer:   'Read-only access to all data',
  };

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '40px 24px' }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 6px' }}>My Profile</h1>
      <p style={{ color: '#64748b', fontSize: 14, margin: '0 0 28px' }}>Manage your account settings</p>

      {/* Account info */}
      <Card style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 16px', color: '#374151' }}>Account Details</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px' }}>
          {[
            ['Name',  user?.name],
            ['Email', user?.email],
            ['Role',  user?.role],
            ['Access', ROLE_DESC[user?.role]],
          ].map(([label, value]) => (
            <div key={label}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '.5px' }}>{label}</div>
              <div style={{ fontSize: 14, color: '#0f172a', fontWeight: label === 'Role' ? 700 : 400, textTransform: label === 'Role' ? 'capitalize' : 'none' }}>{value}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Change password */}
      <Card>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 16px', color: '#374151' }}>Change Password</h2>
        <AlertBanner type="error"   message={error} onClose={() => setError('')} />
        <AlertBanner type="success" message={msg}   onClose={() => setMsg('')} />
        <form onSubmit={submit}>
          <Input label="Current Password" type="password" value={form.current_password}
            onChange={set('current_password')} required placeholder="Your current password" />
          <Input label="New Password" type="password" value={form.new_password}
            onChange={set('new_password')} required placeholder="At least 8 characters" />
          <Input label="Confirm New Password" type="password" value={form.confirm}
            onChange={set('confirm')} required placeholder="Repeat new password" />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Update Password'}
            </Button>
          </div>
        </form>
      </Card>

      <div style={{ marginTop: 20, textAlign: 'right' }}>
        <Button variant="secondary" onClick={logout}>Sign Out</Button>
      </div>
    </div>
  );
}
