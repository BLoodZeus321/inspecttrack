import { useState, useEffect } from 'react';
import { api } from '../api';
import { Spinner, Empty, AlertBanner, Button, fmtDateTime, fmtDate } from '../components/UI';
import { useAuth } from '../context/AuthContext';

// ── Alert Logs Page ───────────────────────────────────────────
export function AlertLogsPage() {
  const [logs, setLogs]         = useState([]);
  const [summary, setSummary]   = useState({ total: 0, sent: 0, failed: 0 });
  const [loading, setLoading]   = useState(true);
  const [msg, setMsg]           = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterRig, setFilterRig]       = useState('');
  const [filterDays, setFilterDays]     = useState('30');
  const { user } = useAuth();

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterStatus) params.set('status', filterStatus);
    if (filterRig)    params.set('rig', filterRig);
    if (filterDays)   params.set('days', filterDays);

    api.get(`/dashboard/alert-logs?${params}`)
      .then(d => {
        setLogs(d.data || []);
        setSummary({ total: d.total, sent: d.sent, failed: d.failed });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filterStatus, filterRig, filterDays]);

  const trigger = async () => {
    try {
      await api.post('/dashboard/trigger-alerts');
      setMsg('Alert check triggered! Emails will be sent shortly based on today\'s schedule.');
      setTimeout(() => { setMsg(''); load(); }, 5000);
    } catch (err) {
      setMsg('Error: ' + err.message);
    }
  };

  const testEmail = async () => {
    const email = prompt('Send test email to:', user?.email || '');
    if (!email) return;
    try {
      const res = await api.post('/dashboard/test-email', { email });
      setMsg(`✅ ${res.message}`);
    } catch (err) {
      setMsg(`❌ Email failed: ${err.message}`);
    }
    setTimeout(() => setMsg(''), 8000);
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 4px' }}>Alert Logs</h1>
          <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>
            History of all alert emails sent by the system
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={load}>↻ Refresh</Button>
          {user?.role === 'admin' && (
            <>
              <Button variant="secondary" onClick={testEmail}>📧 Test Email</Button>
              <Button onClick={trigger}>▷ Run Alert Check</Button>
            </>
          )}
        </div>
      </div>

      {msg && <AlertBanner type={msg.startsWith('❌') ? 'error' : 'success'} message={msg} onClose={() => setMsg('')} />}

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Alerts', value: summary.total, color: '#1e293b' },
          { label: 'Delivered',    value: summary.sent,  color: '#16a34a' },
          { label: 'Failed',       value: summary.failed, color: '#dc2626' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1.5px solid #e2e8f0',
            borderRadius: 10, padding: '16px 20px', borderTop: `4px solid ${s.color}` }}>
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase',
              letterSpacing: '.5px', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Info box */}
      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10,
        padding: '14px 20px', marginBottom: 20, fontSize: 13, color: '#1e40af' }}>
        <strong>How alerts work:</strong> Every day at <strong>7:00 AM Qatar time</strong>, the system checks all active equipment.
        If an inspection is due within a category's configured alert window, an email is sent to all recipients for that category and rig.
        Overdue equipment gets daily reminders. Each attempt is logged here.
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ padding: '8px 12px', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: 13, background: '#fff' }}>
          <option value="">All Status</option>
          <option value="sent">✓ Delivered</option>
          <option value="failed">✗ Failed</option>
        </select>
        <select value={filterRig} onChange={e => setFilterRig(e.target.value)}
          style={{ padding: '8px 12px', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: 13, background: '#fff' }}>
          <option value="">All Rigs</option>
          {['BHDC-67','BHDC-68','BHDC-117','BHDC-118','BHDC-YARD'].map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <select value={filterDays} onChange={e => setFilterDays(e.target.value)}
          style={{ padding: '8px 12px', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: 13, background: '#fff' }}>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="60">Last 60 days</option>
          <option value="90">Last 90 days</option>
        </select>
        {(filterStatus || filterRig) && (
          <Button variant="ghost" size="sm" onClick={() => { setFilterStatus(''); setFilterRig(''); }}>✕ Clear</Button>
        )}
      </div>

      {/* Logs table */}
      {loading ? <Spinner /> : (
        <div style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
          {logs.length === 0 ? (
            <Empty icon="📧" title="No alerts found"
              sub="Alerts fire automatically each morning, or click 'Run Alert Check' to trigger now" />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  {['Equipment','Category','Rig','Sent To','Type','Timing','Status','Date & Time'].map(h => (
                    <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontWeight: 600,
                      color: '#64748b', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {logs.map(a => (
                    <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '11px 14px' }}>
                        <div style={{ fontWeight: 600 }}>{a.equipment_name}</div>
                        {a.asset_tag && <div style={{ fontSize: 11, color: '#94a3b8' }}>#{a.asset_tag}</div>}
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px',
                          borderRadius: 4, background: '#eff6ff', color: '#1e40af' }}>
                          {a.category || '—'}
                        </span>
                      </td>
                      <td style={{ padding: '11px 14px', color: '#64748b', fontWeight: 600 }}>
                        {a.rig_number || '—'}
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: 12, color: '#374151' }}>
                        {a.recipient_email}
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                          background: a.alert_type === 'overdue' ? '#fef2f2' : '#fefce8',
                          color: a.alert_type === 'overdue' ? '#991b1b' : '#854d0e',
                        }}>
                          {a.alert_type === 'overdue' ? '🚨 Overdue' : '⏰ Expiry'}
                        </span>
                      </td>
                      <td style={{ padding: '11px 14px', color: '#64748b' }}>
                        {a.days_before_due < 0
                          ? `${Math.abs(a.days_before_due)}d overdue`
                          : a.days_before_due === 0
                          ? 'Due today'
                          : `${a.days_before_due}d before due`}
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <div style={{ fontWeight: 700, fontSize: 12,
                          color: a.status === 'sent' ? '#16a34a' : '#dc2626' }}>
                          {a.status === 'sent' ? '✓ Delivered' : '✗ Failed'}
                        </div>
                        {a.error_message && (
                          <div style={{ fontSize: 11, color: '#dc2626', maxWidth: 180,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            title={a.error_message}>
                            {a.error_message}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '11px 14px', color: '#94a3b8', fontSize: 12, whiteSpace: 'nowrap' }}>
                        {fmtDateTime(a.sent_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Users Management Page (Admin only) ────────────────────────
export function UsersPage() {
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [error, setError]     = useState('');
  const { user: me } = useAuth();

  const load = () => {
    api.get('/auth/users')
      .then(r => setUsers(r.data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const updateUser = async (id, changes) => {
    try {
      await api.put(`/auth/users/${id}`, changes);
      setEditing(null);
      load();
    } catch (err) { setError(err.message); }
  };

  if (loading) return <Spinner />;

  const ROLES = ['admin','representative','viewer'];
  const ROLE_DESC = {
    admin:    'Full access — manage users, categories, equipment, log inspections',
    representative:'Can add equipment and log inspections',
    viewer:   'Read-only access to all data',
  };

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '28px 24px' }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 6px' }}>User Management</h1>
      <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 24px' }}>
        Manage who has access to InspectTrack and their permission level.
      </p>

      <AlertBanner type="error" message={error} onClose={() => setError('')} />

      {/* Role descriptions */}
      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10,
        padding: '14px 20px', marginBottom: 20, fontSize: 13, color: '#1e40af' }}>
        <strong>Roles:</strong> &nbsp;
        {ROLES.map(r => (
          <span key={r} style={{ marginRight: 20 }}>
            <strong style={{ textTransform: 'capitalize' }}>{r}</strong> — {ROLE_DESC[r]}
          </span>
        ))}
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
                    <div style={{
                      width: 34, height: 34, borderRadius: '50%',
                      background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)',
                      color: '#fff', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontWeight: 800, fontSize: 13, flexShrink: 0,
                    }}>
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
                    <select defaultValue={u.role}
                      onChange={e => updateUser(u.id, { role: e.target.value })}
                      style={{ padding: '5px 10px', borderRadius: 6,
                        border: '1.5px solid #3b82f6', fontSize: 12, fontFamily: 'inherit' }}>
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  ) : (
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                      background: u.role === 'admin' ? '#fef2f2' : u.role === 'representative' ? '#eff6ff' : '#f8fafc',
                      color: u.role === 'admin' ? '#991b1b' : u.role === 'representative' ? '#1e40af' : '#64748b',
                    }}>{u.role}</span>
                  )}
                </td>
                <td style={{ padding: '13px 16px' }}>
                  <button
                    onClick={() => u.id !== me?.id && updateUser(u.id, { is_active: !u.is_active })}
                    disabled={u.id === me?.id}
                    style={{
                      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                      border: 'none', cursor: u.id === me?.id ? 'not-allowed' : 'pointer',
                      background: u.is_active ? '#f0fdf4' : '#fef2f2',
                      color: u.is_active ? '#166534' : '#991b1b',
                      opacity: u.id === me?.id ? .5 : 1,
                    }}>
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

      {/* Invite section */}
      <div style={{ marginTop: 24, background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 12, padding: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 8px' }}>Inviting New Users</h3>
        <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 10px' }}>
          Share your app URL with colleagues. Their default role will be <strong>viewer</strong>.
          Change their role here after they register.
        </p>
        <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 14px',
          fontFamily: 'monospace', fontSize: 13, color: '#1e293b', wordBreak: 'break-all' }}>
          {window.location.origin}/login
        </div>
      </div>
    </div>
  );
}
