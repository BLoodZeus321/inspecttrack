import { useState, useEffect } from 'react';
import { api } from '../api';
import { Spinner, Empty, AlertBanner, Button, fmtDateTime, fmtDate } from '../components/UI';
import { useAuth } from '../context/AuthContext';

// ── Alert Logs Page ───────────────────────────────────────────
export function AlertLogsPage() {
  const [logs, setLogs]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg]       = useState('');
  const { user } = useAuth();

  const load = () => {
    setLoading(true);
    // Get recent alerts from dashboard stats
    api.get('/dashboard/stats')
      .then(d => setLogs(d.recentAlerts || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const trigger = async () => {
    await api.post('/dashboard/trigger-alerts');
    setMsg('Alert check triggered! Emails will be sent shortly based on today\'s schedule.');
    setTimeout(() => setMsg(''), 6000);
    setTimeout(load, 3000);
  };

  if (loading) return <Spinner />;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 4px' }}>Alert Logs</h1>
          <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>
            Complete history of all alert emails sent by the system
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="secondary" onClick={load}>↻ Refresh</Button>
          {user?.role === 'admin' && (
            <Button onClick={trigger}>▷ Trigger Alert Check Now</Button>
          )}
        </div>
      </div>

      {msg && <AlertBanner type="success" message={msg} onClose={() => setMsg('')} />}

      {/* Info box about schedule */}
      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10,
        padding: '14px 20px', marginBottom: 20, fontSize: 13, color: '#1e40af' }}>
        <strong>How alerts work:</strong> Every morning at 7:00 AM (UTC), the system checks all active equipment.
        If an inspection is due within a category's configured alert window (e.g. 60, 30, 14, 7 days before),
        an email is sent to all recipients for that category. Overdue equipment gets daily reminders.
        Each alert is logged here with its status.
      </div>

      {logs.length === 0 ? (
        <div style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 12 }}>
          <Empty icon="📧" title="No alerts sent yet"
            sub="Alerts fire automatically each morning, or click 'Trigger Alert Check Now' to test" />
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0',
            fontSize: 13, color: '#64748b', fontWeight: 600 }}>
            Showing {logs.length} most recent alerts
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ borderBottom: '2px solid #e2e8f0' }}>
              {['Equipment','Sent To','Alert Type','Timing','Status','Sent At'].map(h => (
                <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontWeight: 600, color: '#64748b' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {logs.map(a => (
                <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 600 }}>{a.equipment_name}</div>
                    {a.asset_tag && <div style={{ fontSize: 11, color: '#94a3b8' }}>#{a.asset_tag}</div>}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#374151' }}>{a.recipient_email}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                      background: a.alert_type === 'overdue' ? '#fef2f2' : '#fefce8',
                      color: a.alert_type === 'overdue' ? '#991b1b' : '#854d0e',
                    }}>
                      {a.alert_type === 'overdue' ? '🚨 Overdue' : '⏰ Expiry'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#64748b' }}>
                    {a.days_before_due < 0
                      ? `${Math.abs(a.days_before_due)}d overdue`
                      : `${a.days_before_due}d before due`}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      fontWeight: 700, fontSize: 12,
                      color: a.status === 'sent' ? '#16a34a' : '#dc2626',
                    }}>
                      {a.status === 'sent' ? '✓ Delivered' : '✗ Failed'}
                    </span>
                    {a.error_message && (
                      <div style={{ fontSize: 11, color: '#dc2626', maxWidth: 200 }}>{a.error_message}</div>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 12 }}>
                    {fmtDateTime(a.sent_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Users Management Page (Admin only) ────────────────────────
export function UsersPage() {
  const [users, setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [error, setError]   = useState('');
  const { user: me } = useAuth();

  const load = () => {
    api.get('/auth/users')
      .then(r => setUsers(r.data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const updateUser = async (id, changes) => {
    try {
      await api.put(`/auth/users/${id}`, changes);
      setEditing(null);
      load();
    } catch (err) { setError(err.message); }
  };

  if (loading) return <Spinner />;

  const ROLES = ['admin','inspector','viewer'];
  const ROLE_DESC = {
    admin:    'Full access: manage users, categories, equipment, log inspections',
    inspector:'Can add equipment and log inspections',
    viewer:   'Read-only access to all data',
  };

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '28px 24px' }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 6px' }}>User Management</h1>
      <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 24px' }}>
        Manage who has access to InspectTrack and their permission level.
      </p>

      <AlertBanner type="error" message={error} onClose={() => setError('')} />

      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10,
        padding: '14px 20px', marginBottom: 20, fontSize: 13, color: '#1e40af' }}>
        <strong>Roles:</strong> &nbsp;
        {ROLES.map(r => <span key={r} style={{ marginRight: 20 }}><strong style={{ textTransform: 'capitalize' }}>{r}</strong> — {ROLE_DESC[r]}</span>)}
      </div>

      <div style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
            {['User','Email','Role','Status','Joined','Actions'].map(h => (
              <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontWeight: 600, color: '#64748b' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '13px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#1e293b',
                      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                      {u.name[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600 }}>{u.name}</div>
                      {u.id === me?.id && <div style={{ fontSize: 11, color: '#3b82f6' }}>You</div>}
                    </div>
                  </div>
                </td>
                <td style={{ padding: '13px 16px', fontSize: 12, color: '#64748b' }}>{u.email}</td>
                <td style={{ padding: '13px 16px' }}>
                  {editing === u.id ? (
                    <select value={u.role}
                      onChange={e => updateUser(u.id, { role: e.target.value })}
                      style={{ padding: '5px 10px', borderRadius: 6, border: '1.5px solid #3b82f6',
                        fontSize: 12, fontFamily: 'inherit', cursor: 'pointer' }}>
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  ) : (
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                      background: u.role === 'admin' ? '#fef2f2' : u.role === 'inspector' ? '#eff6ff' : '#f8fafc',
                      color: u.role === 'admin' ? '#991b1b' : u.role === 'inspector' ? '#1e40af' : '#64748b',
                    }}>{u.role}</span>
                  )}
                </td>
                <td style={{ padding: '13px 16px' }}>
                  <button onClick={() => updateUser(u.id, { is_active: !u.is_active })}
                    style={{
                      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                      border: 'none', cursor: u.id === me?.id ? 'not-allowed' : 'pointer',
                      background: u.is_active ? '#f0fdf4' : '#fef2f2',
                      color: u.is_active ? '#166534' : '#991b1b',
                      opacity: u.id === me?.id ? .5 : 1,
                    }}
                    disabled={u.id === me?.id}>
                    {u.is_active ? '● Active' : '○ Inactive'}
                  </button>
                </td>
                <td style={{ padding: '13px 16px', color: '#94a3b8', fontSize: 12 }}>
                  {fmtDate(u.created_at)}
                </td>
                <td style={{ padding: '13px 16px' }}>
                  {u.id !== me?.id && (
                    <Button variant="secondary" size="sm"
                      onClick={() => setEditing(editing === u.id ? null : u.id)}>
                      {editing === u.id ? 'Done' : 'Change Role'}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 24, background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 12, padding: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 8px' }}>Inviting New Users</h3>
        <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 8px' }}>
          Share your app URL with colleagues and ask them to register. Their default role will be <strong>viewer</strong>.
          You can then change their role here after they register.
        </p>
        <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 14px', fontFamily: 'monospace',
          fontSize: 13, color: '#1e293b', wordBreak: 'break-all' }}>
          {window.location.origin}/login
        </div>
      </div>
    </div>
  );
}
