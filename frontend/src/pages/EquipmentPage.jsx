import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { Badge, Button, Modal, Input, Select, Textarea, Spinner, Empty, AlertBanner, fmtDate, daysLabel } from '../components/UI';
import { useAuth } from '../context/AuthContext';

// ── Equipment Form ─────────────────────────────────────────────
function EquipmentForm({ initial = {}, categories, onSave, onClose }) {
  const [form, setForm] = useState({
    name: '', asset_tag: '', serial_number: '', category_id: '',
    location: '', rig_number: '', manufacturer: '', model: '', purchase_date: '',
    status: 'active', notes: '', ...initial,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async e => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const method = initial.id ? 'PUT' : 'POST';
      const path   = initial.id ? `/equipment/${initial.id}` : '/equipment';
      if (method === 'PUT') await api.put(path, form);
      else await api.post(path, form);
      onSave();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  return (
    <form onSubmit={submit}>
      <AlertBanner type="error" message={error} onClose={() => setError('')} />
      <Input label="Equipment / Tool Name *" value={form.name} onChange={set('name')} required placeholder="e.g. Fire Extinguisher - Level 3" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Input label="Asset Tag" value={form.asset_tag || ''} onChange={set('asset_tag')} placeholder="EQ-0042" />
        <Input label="Serial Number *" value={form.serial_number || ''} onChange={set('serial_number')} required placeholder="Manufacturer serial no." />
      </div>
      <Select label="Category *" value={form.category_id || ''} onChange={set('category_id')}>
        <option value="">— Select category —</option>
        {categories.map(c => <option key={c.id} value={c.id}>{c.name} (every {c.inspection_interval_days}d)</option>)}
      </Select>
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Rig / Location *</label>
        <select value={['BHDC-67','BHDC-68','BHDC-117','BHDC-118','BHDC-YARD'].includes(form.rig_number) ? form.rig_number : form.rig_number ? 'custom' : ''}
          onChange={e => {
            if (e.target.value === 'custom') { setForm(f => ({...f, rig_number: 'custom', location: ''})); }
            else { setForm(f => ({...f, rig_number: e.target.value, location: e.target.value})); }
          }}
          required
          style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: 14, background: '#fff', fontFamily: 'inherit', marginBottom: 8 }}>
          <option value="">— Select Rig / Location —</option>
          <option value="BHDC-67">BHDC-67</option>
          <option value="BHDC-68">BHDC-68</option>
          <option value="BHDC-117">BHDC-117</option>
          <option value="BHDC-118">BHDC-118</option>
          <option value="BHDC-YARD">BHDC-YARD</option>
          <option value="custom">Custom Location</option>
        </select>
        {(form.rig_number === 'custom' || (!['BHDC-67','BHDC-68','BHDC-117','BHDC-118','BHDC-YARD','','custom'].includes(form.rig_number))) && (
          <input placeholder="Enter custom location" value={form.location || ''} onChange={e => setForm(f => ({...f, location: e.target.value, rig_number: e.target.value}))}
            required style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: 14, fontFamily: 'inherit' }} />
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Input label="Manufacturer" value={form.manufacturer || ''} onChange={set('manufacturer')} />
        <Input label="Model" value={form.model || ''} onChange={set('model')} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Input label="Purchase Date" type="date" value={form.purchase_date ? form.purchase_date.split('T')[0] : ''} onChange={set('purchase_date')} />
        <Select label="Status" value={form.status} onChange={set('status')}>
          <option value="active">Active</option>
          <option value="under_repair">Under Repair</option>
          <option value="retired">Retired</option>
        </Select>
      </div>
      <Textarea label="Notes" value={form.notes || ''} onChange={set('notes')} placeholder="Additional information…" />
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={saving}>{saving ? 'Saving…' : initial.id ? 'Save Changes' : 'Add Equipment'}</Button>
      </div>
    </form>
  );
}

// ── Main list ─────────────────────────────────────────────────
export default function EquipmentPage() {
  const [items, setItems]         = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [modal, setModal]         = useState(null);
  const [error, setError]         = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate  = useNavigate();
  const { user }  = useAuth();
  const canEdit   = ['admin','representative'].includes(user?.role);

  const search      = searchParams.get('search') || '';
  const alertStatus = searchParams.get('alert_status') || '';
  const category    = searchParams.get('category') || '';

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get(`/equipment?search=${search}&alert_status=${alertStatus}&category=${category}`),
      api.get('/categories'),
    ]).then(([eq, cat]) => {
      setItems(eq.data);
      setCategories(cat.data);
    }).catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [search, alertStatus, category]);

  useEffect(() => { load(); }, [load]);

  const setFilter = (key, val) => {
    const p = new URLSearchParams(searchParams);
    if (val) p.set(key, val); else p.delete(key);
    setSearchParams(p);
  };

  const deleteEquipment = async (id, name) => {
    if (!confirm(`Delete "${name}"? This will remove all inspection records.`)) return;
    try {
      await api.delete(`/equipment/${id}`);
      load();
    } catch (err) { setError(err.message); }
  };

  const STATUS_OPTS = [
    { value: '', label: 'All Statuses' },
    { value: 'overdue', label: '🚨 Overdue' },
    { value: 'critical', label: '🔴 Due This Week' },
    { value: 'warning', label: '🟡 Due This Month' },
    { value: 'ok', label: '✅ OK' },
    { value: 'never_inspected', label: '🔵 Never Inspected' },
  ];

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '28px 24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 4px' }}>Equipment & Tools</h1>
          <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>{items.length} item{items.length !== 1 ? 's' : ''} found</p>
        </div>
        {canEdit && (
          <Button onClick={() => setModal({ type: 'add' })}>+ Add Equipment</Button>
        )}
      </div>

      <AlertBanner type="error" message={error} onClose={() => setError('')} />

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          placeholder="Search name or asset tag…"
          value={search}
          onChange={e => setFilter('search', e.target.value)}
          style={{ padding: '8px 14px', border: '1.5px solid #d1d5db', borderRadius: 8,
            fontSize: 13, width: 240, fontFamily: 'inherit', outline: 'none' }}
        />
        <select value={alertStatus} onChange={e => setFilter('alert_status', e.target.value)}
          style={{ padding: '8px 14px', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: 13, background: '#fff', cursor: 'pointer' }}>
          {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={category} onChange={e => setFilter('category', e.target.value)}
          style={{ padding: '8px 14px', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: 13, background: '#fff', cursor: 'pointer' }}>
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
        <select value={searchParams.get('rig') || ''} onChange={e => setFilter('rig', e.target.value)}
          style={{ padding: '8px 14px', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: 13, background: '#fff', cursor: 'pointer' }}>
          <option value="">All Rigs</option>
          {['BHDC-67','BHDC-68','BHDC-117','BHDC-118','BHDC-YARD'].map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        {(search || alertStatus || category || searchParams.get('rig')) && (
          <Button variant="ghost" size="sm" onClick={() => setSearchParams({})}>✕ Clear filters</Button>
        )}
      </div>

      {/* Table */}
      {loading ? <Spinner /> : (
        <div style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
          {items.length === 0 ? (
            <Empty icon="⚙️" title="No equipment found" sub="Try adjusting your filters or add new equipment" />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    {['Name','Asset Tag','Category','Rig','Location','Last Inspected','Next Due','Status',''].map(h => (
                      <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontWeight: 600,
                        color: '#64748b', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map(eq => (
                    <tr key={eq.id}
                      style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background = ''}
                      onClick={() => navigate(`/equipment/${eq.id}`)}>
                      <td style={{ padding: '13px 16px' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{eq.name}</div>
                        {eq.model && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{eq.model}</div>}
                      </td>
                      <td style={{ padding: '13px 16px', fontFamily: 'monospace', fontSize: 12, color: '#64748b' }}>
                        {eq.asset_tag || '—'}
                      </td>
                      <td style={{ padding: '13px 16px' }}>
                        {eq.category ? (
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 4,
                            background: eq.category_color + '22', color: eq.category_color,
                          }}>{eq.category}</span>
                        ) : '—'}
                      </td>
                      <td style={{ padding: '13px 16px', color: '#64748b' }}>{eq.rig_number || '—'}</td>
                      <td style={{ padding: '13px 16px', color: '#64748b' }}>{eq.location && eq.location !== eq.rig_number ? eq.location : '—'}</td>
                      <td style={{ padding: '13px 16px', color: '#64748b' }}>
                        {eq.last_inspection_date ? (
                          <div>
                            <div>{fmtDate(eq.last_inspection_date)}</div>
                            {eq.last_representative && <div style={{ fontSize: 11, color: '#94a3b8' }}>by {eq.last_representative}</div>}
                          </div>
                        ) : <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Never</span>}
                      </td>
                      <td style={{ padding: '13px 16px' }}>
                        {eq.next_due_date ? (
                          <div>
                            <div style={{ fontWeight: 600, color: eq.alert_status === 'overdue' ? '#dc2626' : '#0f172a' }}>
                              {fmtDate(eq.next_due_date)}
                            </div>
                            <div style={{ fontSize: 11, color: eq.alert_status === 'overdue' ? '#dc2626' : '#94a3b8' }}>
                              {daysLabel(eq.days_until_due)}
                            </div>
                          </div>
                        ) : '—'}
                      </td>
                      <td style={{ padding: '13px 16px' }}><Badge status={eq.alert_status} /></td>
                      <td style={{ padding: '13px 16px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {canEdit && (
                            <Button variant="secondary" size="sm"
                              onClick={() => setModal({ type: 'edit', data: eq })}>Edit</Button>
                          )}
                          {user?.role === 'admin' && (
                            <Button variant="danger" size="sm"
                              onClick={() => deleteEquipment(eq.id, eq.name)}>Del</Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {modal?.type === 'add' && (
        <Modal title="Add Equipment" onClose={() => setModal(null)} width={620}>
          <EquipmentForm categories={categories} onSave={() => { setModal(null); load(); }} onClose={() => setModal(null)} />
        </Modal>
      )}
      {modal?.type === 'edit' && (
        <Modal title="Edit Equipment" onClose={() => setModal(null)} width={620}>
          <EquipmentForm initial={modal.data} categories={categories} onSave={() => { setModal(null); load(); }} onClose={() => setModal(null)} />
        </Modal>
      )}
    </div>
  );
}
