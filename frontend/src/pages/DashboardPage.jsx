import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { StatCard, Badge, ResultBadge, Spinner, Empty, fmtDate, fmtDateTime, daysLabel, Button, AlertBanner } from '../components/UI';
import { useAuth } from '../context/AuthContext';

export default function DashboardPage() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg]         = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    api.get('/dashboard/stats')
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const triggerAlerts = async () => {
    await api.post('/dashboard/trigger-alerts');
    setMsg('Alert check triggered! Watch Alert Logs page for results.');
    setTimeout(() => setMsg(''), 6000);
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
    setTimeout(() => setMsg(''), 10000);
  };

  if (loading) return <Spinner />;
  const s = data?.stats || {};

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '28px 24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 4px' }}>Dashboard</h1>
          <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>
            Welcome back, {user?.name} — here's your equipment health overview
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="secondary" onClick={load}>↻ Refresh</Button>
          {user?.role === 'admin' && (
            <>
              <Button variant="secondary" onClick={triggerAlerts}>▷ Run Alert Check</Button>
              <Button variant="secondary" onClick={testEmail}>📧 Test Email</Button>
            </>
          )}
        </div>
      </div>

      {msg && <AlertBanner type="success" message={msg} onClose={() => setMsg('')} />}

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 14, marginBottom: 28 }}>
        <StatCard label="Total Active"     value={s.total}          accent="#1e293b" onClick={() => navigate('/equipment')} />
        <StatCard label="Overdue"          value={s.overdue}        accent="#ef4444" sub="Immediate action needed"
          onClick={() => navigate('/equipment?alert_status=overdue')} />
        <StatCard label="Failed Inspection" value={s.failed}        accent="#dc2626" sub="Must be taken out of service"
          onClick={() => navigate('/equipment?alert_status=failed')} />
        <StatCard label="Conditional"      value={s.conditional}    accent="#f97316" sub="Minor issues, monitor closely"
          onClick={() => navigate('/equipment?alert_status=conditional')} />
        <StatCard label="Due This Week"    value={s.critical}       accent="#f97316" sub="Within 7 days"
          onClick={() => navigate('/equipment?alert_status=critical')} />
        <StatCard label="Due This Month"   value={s.warning}        accent="#eab308" sub="Within 30 days"
          onClick={() => navigate('/equipment?alert_status=warning')} />
        <StatCard label="All OK"           value={s.ok}             accent="#22c55e" />
        <StatCard label="Never Inspected"  value={s.never_inspected} accent="#8b5cf6"
          onClick={() => navigate('/equipment?alert_status=never_inspected')} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>

        {/* Action Required list — overdue + failed + conditional */}
        <section>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ background: '#fef2f2', color: '#991b1b', padding: '2px 10px', borderRadius: 6, fontSize: 13 }}>
              🚨 Action Required ({data?.overdueList?.length || 0})
            </span>
          </h2>
          <div style={{ background: '#fff', border: '1.5px solid #fecaca', borderRadius: 12, overflow: 'hidden' }}>
            {data?.overdueList?.length ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ background: '#fef2f2' }}>
                  {['Equipment','Category','Rig','Status','Details'].map(h => (
                    <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontWeight: 600,
                      color: '#991b1b', borderBottom: '1px solid #fecaca', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {data.overdueList.map(eq => (
                    <tr key={eq.id} style={{ borderBottom: '1px solid #fff1f2', cursor: 'pointer' }}
                      onClick={() => navigate(`/equipment/${eq.id}`)}
                      onMouseEnter={e => e.currentTarget.style.background = '#fff5f5'}
                      onMouseLeave={e => e.currentTarget.style.background = ''}>
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0f172a' }}>
                        {eq.name}
                        {eq.asset_tag && <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 6 }}>#{eq.asset_tag}</span>}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: eq.category_color,
                          background: eq.category_color + '22', padding: '2px 8px', borderRadius: 4 }}>
                          {eq.category || '—'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', color: '#64748b' }}>{eq.rig_number || '—'}</td>
                      <td style={{ padding: '10px 14px' }}><Badge status={eq.alert_status} /></td>
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: '#dc2626' }}>
                        {eq.alert_status === 'failed'      ? 'Failed — take out of service' :
                         eq.alert_status === 'conditional' ? 'Conditional — monitor closely' :
                         `${Math.abs(parseInt(eq.days_until_due))}d overdue`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Empty icon="✅" title="No action required" sub="All inspections are up to date!" />
            )}
          </div>
        </section>

        {/* Category breakdown */}
        <section>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 14px' }}>By Category</h2>
          <div style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
            {data?.byCategory?.length ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ background: '#f8fafc' }}>
                  {['Category','Total','OK','Warning','Critical','Failed','Conditional','Overdue'].map(h => (
                    <th key={h} style={{ padding: '9px 14px', textAlign: h === 'Category' ? 'left' : 'center',
                      fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {data.byCategory.map(c => (
                    <tr key={c.category} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ width: 10, height: 10, borderRadius: '50%', background: c.category_color, flexShrink: 0 }} />
                          <span style={{ fontWeight: 600 }}>{c.category || 'Uncategorized'}</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700 }}>{c.total}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', color: '#16a34a', fontWeight: 600 }}>{c.ok}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', color: '#d97706', fontWeight: 600 }}>{c.warning}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', color: '#ea580c', fontWeight: 600 }}>{c.critical}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', color: '#dc2626', fontWeight: 700 }}>{c.failed}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', color: '#ea580c', fontWeight: 600 }}>{c.conditional}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', color: '#991b1b', fontWeight: 700 }}>{c.overdue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <Empty icon="🏷️" title="No categories yet" />}
          </div>
        </section>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* Recent inspections */}
        <section>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 14px' }}>Recent Inspections</h2>
          <div style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
            {data?.recentInspections?.length ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ background: '#f8fafc' }}>
                  {['Equipment','Representative','Date','Result'].map(h => (
                    <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontWeight: 600,
                      color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {data.recentInspections.map(ins => (
                    <tr key={ins.id} style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                      onClick={() => navigate(`/equipment/${ins.equipment_id}`)}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background = ''}>
                      <td style={{ padding: '10px 14px', fontWeight: 600 }}>
                        {ins.equipment_name}
                        {ins.asset_tag && <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 6 }}>#{ins.asset_tag}</span>}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#64748b' }}>{ins.inspected_by}</td>
                      <td style={{ padding: '10px 14px', color: '#64748b' }}>{fmtDate(ins.inspection_date)}</td>
                      <td style={{ padding: '10px 14px' }}><ResultBadge result={ins.result} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <Empty icon="📋" title="No inspections yet" sub="Log your first inspection" />}
          </div>
        </section>

        {/* Recent alerts */}
        <section>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 14px' }}>Recent Alerts Sent</h2>
          <div style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
            {data?.recentAlerts?.length ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ background: '#f8fafc' }}>
                  {['Equipment','Sent To','Type','When'].map(h => (
                    <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontWeight: 600,
                      color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {data.recentAlerts.map(a => (
                    <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 600 }}>{a.equipment_name}</td>
                      <td style={{ padding: '10px 14px', color: '#64748b', fontSize: 12 }}>{a.recipient_email}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                          background: a.alert_type === 'overdue' ? '#fef2f2' : '#fefce8',
                          color: a.alert_type === 'overdue' ? '#991b1b' : '#854d0e',
                        }}>
                          {a.alert_type === 'overdue' ? '🚨 Overdue' : `⏰ ${a.days_before_due}d`}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: 12 }}>{fmtDateTime(a.sent_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <Empty icon="📧" title="No alerts sent yet" sub="Alerts fire automatically each morning" />}
          </div>
        </section>

      </div>
    </div>
  );
}
