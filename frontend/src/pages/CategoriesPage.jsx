import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { Button, Modal, Input, Select, Textarea, Spinner, Empty, AlertBanner, Card } from '../components/UI';
import { useAuth } from '../context/AuthContext';

// ── Category Form ──────────────────────────────────────────────
function CategoryForm({ initial = {}, onSave, onClose }) {
  const [form, setForm] = useState({
    name: '', description: '', inspection_interval_days: 365,
    alert_lead_days: '30,14,7', color: '#3B82F6', ...initial,
    alert_lead_days: Array.isArray(initial.alert_lead_days)
      ? initial.alert_lead_days.join(',') : (initial.alert_lead_days || '30,14,7'),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async e => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const payload = {
        ...form,
        inspection_interval_days: parseInt(form.inspection_interval_days),
        alert_lead_days: form.alert_lead_days.split(',').map(n => parseInt(n.trim())).filter(n => n > 0),
      };
      if (initial.id) await api.put(`/categories/${initial.id}`, payload);
      else await api.post('/categories', payload);
      onSave();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  return (
    <form onSubmit={submit}>
      <AlertBanner type="error" message={error} onClose={() => setError('')} />
      <Input label="Category Name *" value={form.name} onChange={set('name')} required placeholder="e.g. Fire Extinguisher" />
      <Textarea label="Description" value={form.description || ''} onChange={set('description')} rows={2} placeholder="What equipment does this cover?" />

      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
        <h4 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: '#1e40af' }}>📅 Inspection Schedule</h4>
        <Input label="Inspection Interval (days) *" type="number" min="1" value={form.inspection_interval_days}
          onChange={set('inspection_interval_days')} required />
        <div style={{ fontSize: 12, color: '#3b82f6', marginTop: -10, marginBottom: 12 }}>
          Common: 90=Quarterly, 180=Semi-annual, 365=Annual, 730=Bi-annual
        </div>
        <Input label="Alert Lead Days (comma-separated) *" value={form.alert_lead_days} onChange={set('alert_lead_days')} required
          placeholder="e.g. 60,30,14,7" />
        <div style={{ fontSize: 12, color: '#3b82f6', marginTop: -10 }}>
          Emails are sent on each of these days before the due date. Example: 60,30,14,7
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Colour</label>
          <input type="color" value={form.color} onChange={set('color')}
            style={{ width: '100%', height: 42, border: '1.5px solid #d1d5db', borderRadius: 8, cursor: 'pointer', padding: 2 }} />
        </div>
        <div style={{ flex: 4 }}>
          <div style={{ background: form.color + '22', border: `2px solid ${form.color}`, borderRadius: 8,
            padding: '10px 14px', fontSize: 13, fontWeight: 700, color: form.color }}>
            {form.name || 'Preview'} — Inspect every {form.inspection_interval_days} days.
            Alert at: {form.alert_lead_days} days before.
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={saving}>{saving ? 'Saving…' : initial.id ? 'Save Changes' : 'Create Category'}</Button>
      </div>
    </form>
  );
}

// ── Recipients Panel ──────────────────────────────────────────
function RecipientsPanel({ category }) {
  const [recipients, setRecipients] = useState([]);
  const [form, setForm]   = useState({ name: '', email: '', rig_number: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const load = useCallback(() => {
    api.get(`/categories/${category.id}/recipients`).then(r => setRecipients(r.data)).catch(console.error);
  }, [category.id]);

  useEffect(() => { load(); }, [load]);

  const add = async e => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      await api.post(`/categories/${category.id}/recipients`, form);
      setForm({ name: '', email: '', rig_number: '' });
      load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const remove = async id => {
    await api.delete(`/categories/${category.id}/recipients/${id}`);
    load();
  };

  return (
    <div>
      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8,
        padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#166534' }}>
        <strong>Alert schedule for {category.name}:</strong> Emails sent {category.alert_lead_days?.join(', ')} days
        before inspection is due. Inspection interval: every {category.inspection_interval_days} days.
      </div>

      {error && <AlertBanner type="error" message={error} onClose={() => setError('')} />}

      <form onSubmit={add} style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input placeholder="Name (optional)" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          style={{ padding: '8px 12px', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: 13, width: 140, fontFamily: 'inherit' }} />
        <input placeholder="email@company.com *" type="email" required value={form.email}
          onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          style={{ padding: '8px 12px', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: 13, flex: 1, minWidth: 180, fontFamily: 'inherit' }} />
        <select value={form.rig_number} onChange={e => setForm(f => ({ ...f, rig_number: e.target.value }))}
          style={{ padding: '8px 12px', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: 13, background: '#fff', fontFamily: 'inherit' }}>
          <option value="">All Rigs</option>
          {['BHDC-67','BHDC-68','BHDC-117','BHDC-118','BHDC-YARD'].map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <Button type="submit" variant="success" disabled={saving} size="sm">
          {saving ? 'Adding…' : '+ Add'}
        </Button>
      </form>

      <div style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
        {recipients.length === 0 ? (
          <Empty icon="📧" title="No recipients yet" sub="Add email addresses to receive alerts for this category" />
        ) : recipients.map((r, i) => (
          <div key={r.id} style={{
            display: 'flex', alignItems: 'center', padding: '12px 16px',
            borderBottom: i < recipients.length - 1 ? '1px solid #f1f5f9' : 'none',
          }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: category.color + '22',
              color: category.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 14, marginRight: 12, flexShrink: 0 }}>
              {(r.name || r.email)[0].toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{r.name || r.email}</div>
              {r.name && <div style={{ fontSize: 12, color: '#64748b' }}>{r.email}</div>}
              {r.rig_number && <div style={{ fontSize: 11, color: '#3b82f6', fontWeight: 600, marginTop: 2 }}>🏗 {r.rig_number} only</div>}
              {!r.rig_number && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>All rigs</div>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, background: '#f0fdf4', color: '#16a34a', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
                Active
              </span>
              <Button variant="danger" size="sm" onClick={() => remove(r.id)}>Remove</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Global Recipients ─────────────────────────────────────────
function GlobalRecipientsSection() {
  const [recipients, setRecipients] = useState([]);
  const [form, setForm]   = useState({ name: '', email: '', rig_number: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const load = () => api.get('/categories/global/recipients').then(r => setRecipients(r.data)).catch(console.error);
  useEffect(() => { load(); }, []);

  const add = async e => {
    e.preventDefault(); setSaving(true); setError('');
    try { await api.post('/categories/global/recipients', form); setForm({ name: '', email: '' }); load(); }
    catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 12, padding: 20 }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 6px' }}>🌐 Global Recipients</h3>
      <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 16px' }}>
        These people receive alerts for ALL equipment categories.
      </p>

      {error && <AlertBanner type="error" message={error} onClose={() => setError('')} />}

      <form onSubmit={add} style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input placeholder="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          style={{ padding: '8px 12px', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: 13, width: 160, fontFamily: 'inherit' }} />
        <input placeholder="email@company.com" type="email" required value={form.email}
          onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          style={{ padding: '8px 12px', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: 13, flex: 1, minWidth: 200, fontFamily: 'inherit' }} />
        <Button type="submit" size="sm" disabled={saving}>{saving ? '…' : '+ Add'}</Button>
      </form>

      {recipients.length === 0 ? (
        <p style={{ color: '#94a3b8', fontSize: 13 }}>No global recipients added yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {recipients.map(r => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: '#f8fafc', borderRadius: 8, padding: '10px 14px' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{r.name || r.email}</div>
                {r.name && <div style={{ fontSize: 12, color: '#64748b' }}>{r.email}</div>}
              </div>
              <Button variant="danger" size="sm"
                onClick={async () => { await api.delete(`/categories/global/recipients/${r.id}`); load(); }}>Remove</Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [selected, setSelected]     = useState(null);
  const [loading, setLoading]       = useState(true);
  const [modal, setModal]           = useState(null);
  const [error, setError]           = useState('');
  const { user } = useAuth();
  const isAdmin  = user?.role === 'admin';

  const load = useCallback(() => {
    setLoading(true);
    api.get('/categories')
      .then(r => { setCategories(r.data); if (r.data.length && !selected) setSelected(r.data[0]); })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const deleteCategory = async (id, name) => {
    if (!confirm(`Delete category "${name}"? Equipment in this category will be uncategorized.`)) return;
    try { await api.delete(`/categories/${id}`); load(); setSelected(null); }
    catch (err) { setError(err.message); }
  };

  if (loading) return <Spinner />;

  return (
    <div style={{ maxWidth: 1300, margin: '0 auto', padding: '28px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 4px' }}>Categories & Alert Rules</h1>
          <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>
            Configure inspection intervals and alert schedules per equipment category
          </p>
        </div>
        {isAdmin && <Button onClick={() => setModal('add')}>+ New Category</Button>}
      </div>

      <AlertBanner type="error" message={error} onClose={() => setError('')} />

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20 }}>

        {/* Category list */}
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {categories.map(c => (
              <div key={c.id}
                onClick={() => setSelected(c)}
                style={{
                  background: selected?.id === c.id ? '#eff6ff' : '#fff',
                  border: `1.5px solid ${selected?.id === c.id ? '#3b82f6' : '#e2e8f0'}`,
                  borderLeft: `5px solid ${c.color}`,
                  borderRadius: 10, padding: '14px 16px', cursor: 'pointer',
                  transition: 'all .15s',
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 4 }}>{c.name}</div>
                  <span style={{ background: '#f1f5f9', color: '#64748b', fontSize: 11,
                    fontWeight: 600, padding: '2px 8px', borderRadius: 10, flexShrink: 0, marginLeft: 8 }}>
                    {c.equipment_count} items
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#64748b', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span>🔄 Every {c.inspection_interval_days} days</span>
                  <span>🔔 Alert at: {c.alert_lead_days?.join(', ')} days before</span>
                </div>
                {isAdmin && selected?.id === c.id && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 10 }} onClick={e => e.stopPropagation()}>
                    <Button variant="secondary" size="sm" onClick={() => setModal({ type: 'edit', data: c })}>Edit</Button>
                    <Button variant="danger" size="sm" onClick={() => deleteCategory(c.id, c.name)}>Delete</Button>
                  </div>
                )}
              </div>
            ))}
            {categories.length === 0 && (
              <Empty icon="🏷️" title="No categories yet" sub="Create your first category to get started" />
            )}
          </div>

          <GlobalRecipientsSection />
        </div>

        {/* Recipients panel */}
        <div>
          {selected ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <span style={{ width: 14, height: 14, borderRadius: '50%', background: selected.color, flexShrink: 0 }} />
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Alert Recipients — {selected.name}</h2>
              </div>
              <RecipientsPanel category={selected} key={selected.id} />
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: 300, color: '#94a3b8', fontSize: 14, background: '#fff',
              border: '1.5px dashed #e2e8f0', borderRadius: 12 }}>
              ← Select a category to manage its alert recipients
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {modal === 'add' && (
        <Modal title="New Category" onClose={() => setModal(null)} width={600}>
          <CategoryForm onSave={() => { setModal(null); load(); }} onClose={() => setModal(null)} />
        </Modal>
      )}
      {modal?.type === 'edit' && (
        <Modal title="Edit Category" onClose={() => setModal(null)} width={600}>
          <CategoryForm initial={modal.data} onSave={() => { setModal(null); load(); }} onClose={() => setModal(null)} />
        </Modal>
      )}
    </div>
  );
}
