import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { Badge, ResultBadge, Button, Modal, Input, Select, Textarea, Spinner, AlertBanner, fmtDate, fmtDateTime, daysLabel } from '../components/UI';
import { useAuth } from '../context/AuthContext';

// ── Inspection Form ────────────────────────────────────────────
function InspectionForm({ equipmentId, onSave, onClose }) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    equipment_id:    equipmentId,
    inspected_by:    user?.name || '',
    inspection_date: new Date().toISOString().split('T')[0],
    result:          'pass',
    notes:           '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async e => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      await api.post('/inspections', form);
      onSave();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  return (
    <form onSubmit={submit}>
      <AlertBanner type="error" message={error} onClose={() => setError('')} />
      <Input label="Representative Name *" value={form.inspected_by} onChange={set('inspected_by')} required placeholder="Full name of representative" />
      <Input label="Inspection Date *" type="date" value={form.inspection_date} onChange={set('inspection_date')} required />
      <Select label="Result *" value={form.result} onChange={set('result')}>
        <option value="pass">✓ Pass — Equipment is in good condition</option>
        <option value="conditional">⚠ Conditional — Minor issues, still usable</option>
        <option value="fail">✗ Fail — Equipment must be taken out of service</option>
      </Select>
      <Textarea label="Notes / Observations" value={form.notes} onChange={set('notes')}
        placeholder="Describe the condition, any issues found, actions taken…" rows={4} />
      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8,
        padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#1e40af' }}>
        ℹ The next due date will be automatically calculated from this equipment's category inspection interval.
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="success" disabled={saving}>{saving ? 'Logging…' : '✓ Log Inspection'}</Button>
      </div>
    </form>
  );
}

// ── Info Row ──────────────────────────────────────────────────
function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
      <div style={{ width: 160, fontSize: 13, fontWeight: 600, color: '#64748b', flexShrink: 0 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#0f172a', flex: 1 }}>{value || '—'}</div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function EquipmentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canEdit  = ['admin','representative'].includes(user?.role);

  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [showInspForm, setShowInspForm] = useState(false);
  const [error, setError]       = useState('');
  const [tab, setTab]           = useState('info'); // info | history | alerts

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/equipment/${id}`)
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Spinner />;
  if (!data)   return <div style={{ padding: 40, color: '#94a3b8' }}>Equipment not found.</div>;

  const eq   = data.data;
  const insp = data.inspections || [];
  const logs = data.alertHistory || [];

  const statusColors = { overdue: '#dc2626', critical: '#ea580c', warning: '#d97706', ok: '#16a34a' };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px' }}>

      {/* Breadcrumb */}
      <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
        <span style={{ cursor: 'pointer', color: '#3b82f6' }} onClick={() => navigate('/equipment')}>
          ← Equipment
        </span>
        {' / '}{eq.name}
      </div>

      <AlertBanner type="error" message={error} onClose={() => setError('')} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: 24, flexWrap: 'wrap', gap: 14 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>{eq.name}</h1>
            <Badge status={eq.alert_status} size="lg" />
            {eq.status !== 'active' && (
              <span style={{ fontSize: 12, background: '#f1f5f9', color: '#64748b',
                padding: '3px 10px', borderRadius: 20, fontWeight: 600, textTransform: 'capitalize' }}>
                {eq.status.replace('_', ' ')}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#64748b', flexWrap: 'wrap' }}>
            {eq.asset_tag    && <span>🏷 {eq.asset_tag}</span>}
            {eq.category     && <span style={{ color: eq.category_color, fontWeight: 600 }}>● {eq.category}</span>}
            {eq.rig_number   && <span>🏗 {eq.rig_number}</span>}
            {eq.location && eq.location !== eq.rig_number && <span>📍 {eq.location}</span>}
          </div>
        </div>
        {canEdit && (
          <Button variant="success" onClick={() => setShowInspForm(true)}>+ Log Inspection</Button>
        )}
      </div>

      {/* Due date banner */}
      {eq.next_due_date && (
        <div style={{
          background: eq.alert_status === 'ok' ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${eq.alert_status === 'ok' ? '#bbf7d0' : '#fecaca'}`,
          borderRadius: 10, padding: '14px 20px', marginBottom: 24,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
        }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 2 }}>
              Next Inspection Due
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: statusColors[eq.alert_status] || '#0f172a' }}>
              {fmtDate(eq.next_due_date)} &nbsp;·&nbsp; {daysLabel(eq.days_until_due)}
            </div>
          </div>
          {eq.last_inspection_date && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, color: '#64748b' }}>Last inspected</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{fmtDate(eq.last_inspection_date)} by {eq.last_representative}</div>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #e2e8f0', marginBottom: 24 }}>
        {[['info','📋 Details'], ['history','🔍 Inspection History'], ['alerts','📧 Alert Log']].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer',
            fontWeight: 600, fontSize: 13, fontFamily: 'inherit',
            color: tab === k ? '#0f172a' : '#64748b',
            borderBottom: tab === k ? '2px solid #1e293b' : '2px solid transparent',
            marginBottom: -2,
          }}>{label}</button>
        ))}
      </div>

      {/* ── Details Tab ── */}
      {tab === 'info' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 12, padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px', color: '#64748b',
              textTransform: 'uppercase', letterSpacing: '.6px' }}>Equipment Details</h3>
            <InfoRow label="Name"          value={eq.name} />
            <InfoRow label="Asset Tag"     value={eq.asset_tag} />
            <InfoRow label="Rig"           value={eq.rig_number} />
            <InfoRow label="Location"      value={eq.location && eq.location !== eq.rig_number ? eq.location : null} />
            <InfoRow label="Serial Number" value={eq.serial_number} />
            <InfoRow label="Manufacturer"  value={eq.manufacturer} />
            <InfoRow label="Model"         value={eq.model} />
            <InfoRow label="Purchase Date" value={fmtDate(eq.purchase_date)} />
            <InfoRow label="Status"        value={<span style={{ textTransform: 'capitalize' }}>{eq.status?.replace('_',' ')}</span>} />
          </div>
          <div style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 12, padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px', color: '#64748b',
              textTransform: 'uppercase', letterSpacing: '.6px' }}>Inspection Schedule</h3>
            <InfoRow label="Category"  value={<span style={{ color: eq.category_color, fontWeight: 700 }}>{eq.category}</span>} />
            <InfoRow label="Rig"       value={eq.rig_number} />
            <InfoRow label="Interval"  value={eq.inspection_interval_days ? `Every ${eq.inspection_interval_days} days` : '—'} />
            <InfoRow label="Alert Days" value={eq.alert_lead_days?.join(', ') + ' days before due'} />
            <InfoRow label="Next Due"  value={<span style={{ fontWeight: 700, color: statusColors[eq.alert_status] }}>{fmtDate(eq.next_due_date)}</span>} />
            <InfoRow label="Last Done" value={fmtDate(eq.last_inspection_date)} />
            <InfoRow label="Last Result" value={eq.last_result ? <ResultBadge result={eq.last_result} /> : null} />
            {eq.notes && (
              <div style={{ marginTop: 12, padding: 12, background: '#f8fafc', borderRadius: 8, fontSize: 13, color: '#374151' }}>
                <strong>Notes:</strong> {eq.notes}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Inspection History Tab ── */}
      {tab === 'history' && (
        <div style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
          {insp.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
              <div style={{ fontWeight: 600, color: '#64748b', marginBottom: 4 }}>No inspections recorded yet</div>
              {canEdit && <Button variant="success" onClick={() => setShowInspForm(true)}>Log First Inspection</Button>}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                {['Date','Representative','Result','Next Due','Notes'].map(h => (
                  <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontWeight: 600, color: '#64748b' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {insp.map(ins => (
                  <tr key={ins.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{fmtDate(ins.inspection_date)}</td>
                    <td style={{ padding: '12px 16px', color: '#374151' }}>{ins.inspected_by}</td>
                    <td style={{ padding: '12px 16px' }}><ResultBadge result={ins.result} /></td>
                    <td style={{ padding: '12px 16px', color: '#64748b' }}>{fmtDate(ins.next_due_date)}</td>
                    <td style={{ padding: '12px 16px', color: '#64748b', maxWidth: 280 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ins.notes || '—'}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Alert Log Tab ── */}
      {tab === 'alerts' && (
        <div style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
          {logs.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>📧</div>
              <div style={{ fontWeight: 600, color: '#64748b' }}>No alerts sent for this equipment yet</div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                {['Sent To','Type','Days Before Due','Status','Sent At'].map(h => (
                  <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontWeight: 600, color: '#64748b' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {logs.map(a => (
                  <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: '#374151' }}>{a.recipient_email}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                        background: a.alert_type === 'overdue' ? '#fef2f2' : '#fefce8',
                        color: a.alert_type === 'overdue' ? '#991b1b' : '#854d0e',
                      }}>{a.alert_type === 'overdue' ? '🚨 Overdue' : '⏰ Expiry'}</span>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#64748b' }}>
                      {a.days_before_due < 0 ? `${Math.abs(a.days_before_due)}d overdue` : `${a.days_before_due}d before`}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontWeight: 700, color: a.status === 'sent' ? '#16a34a' : '#dc2626' }}>
                        {a.status === 'sent' ? '✓ Sent' : '✗ Failed'}
                      </span>
                      {a.error_message && <div style={{ fontSize: 11, color: '#dc2626' }}>{a.error_message}</div>}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 12 }}>{fmtDateTime(a.sent_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Inspection Modal */}
      {showInspForm && (
        <Modal title={`Log Inspection — ${eq.name}`} onClose={() => setShowInspForm(false)} width={580}>
          <InspectionForm
            equipmentId={id}
            onSave={() => { setShowInspForm(false); load(); setTab('history'); }}
            onClose={() => setShowInspForm(false)}
          />
        </Modal>
      )}
    </div>
  );
}
