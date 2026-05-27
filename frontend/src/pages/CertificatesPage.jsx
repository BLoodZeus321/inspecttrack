import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api';
import { Button, Modal, Input, Textarea, Spinner, Empty, AlertBanner, fmtDate, Badge } from '../components/UI';
import { useAuth } from '../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

// ── Certificate Form ───────────────────────────────────────────
function CertForm({ initial = {}, onSave, onClose }) {
  const [form, setForm]           = useState({
    title: '', cert_number: '', issued_by: '', issued_date: '',
    expiry_date: '', notes: '', ...initial,
  });
  const [file, setFile]           = useState(null);
  const [equipment, setEquipment] = useState([]);
  const [selected, setSelected]   = useState(new Set(initial.linked_ids || []));
  const [search, setSearch]       = useState('');
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');
  const fileRef = useRef();
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    api.get('/equipment').then(r => setEquipment(r.data)).catch(console.error);
  }, []);

  const toggleEquip = id => setSelected(s => {
    const n = new Set(s);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const filteredEquip = equipment.filter(e =>
    !search || e.name.toLowerCase().includes(search.toLowerCase()) ||
    (e.serial_number || '').toLowerCase().includes(search.toLowerCase()) ||
    (e.rig_number || '').toLowerCase().includes(search.toLowerCase())
  );

  const submit = async e => {
    e.preventDefault();
    if (!form.title) { setError('Title is required'); return; }
    setSaving(true); setError('');

    try {
      const equipIds = [...selected];
      if (initial.id) {
        // Edit — JSON update
        await api.put(`/certificates/${initial.id}`, { ...form, equipment_ids: equipIds });
        onSave();
      } else if (file) {
        // New with file — multipart
        const fd = new FormData();
        Object.entries(form).forEach(([k, v]) => v && fd.append(k, v));
        fd.append('equipment_ids', JSON.stringify(equipIds));
        fd.append('file', file);

        const token = localStorage.getItem('it_token');
        const res = await fetch(`${API_BASE}/certificates`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: fd,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');
        onSave();
      } else {
        // New without file — JSON
        await api.post('/certificates', { ...form, equipment_ids: equipIds });
        onSave();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <AlertBanner type="error" message={error} onClose={() => setError('')} />

      <Input label="Certificate Title *" value={form.title} onChange={set('title')}
        placeholder="e.g. Sling & Shackle Inspection Certificate" required />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Input label="Certificate Number" value={form.cert_number} onChange={set('cert_number')} placeholder="CERT-2024-001" />
        <Input label="Issued By" value={form.issued_by} onChange={set('issued_by')} placeholder="Inspection authority" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Input label="Issue Date" type="date" value={form.issued_date} onChange={set('issued_date')} />
        <Input label="Expiry Date" type="date" value={form.expiry_date} onChange={set('expiry_date')} />
      </div>
      <Textarea label="Notes" value={form.notes} onChange={set('notes')} rows={2} placeholder="Any additional notes…" />

      {/* File upload */}
      {!initial.id && (
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 5 }}>
            Certificate File (PDF, image)
          </label>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Button type="button" variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
              📎 {file ? 'Change File' : 'Choose File'}
            </Button>
            {file && <span style={{ fontSize: 13, color: '#16a34a' }}>✓ {file.name}</span>}
            {!file && <span style={{ fontSize: 12, color: '#94a3b8' }}>No file selected (you can add later)</span>}
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp"
              style={{ display: 'none' }} onChange={e => setFile(e.target.files[0])} />
          </div>
        </div>
      )}

      {/* Equipment selector */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 5 }}>
          Link to Equipment ({selected.size} selected)
        </label>
        <div style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid #e2e8f0' }}>
            <input placeholder="Search equipment…" value={search} onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', border: 'none', background: 'none', outline: 'none', fontSize: 13 }} />
          </div>
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {filteredEquip.length === 0 ? (
              <div style={{ padding: 16, color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>No equipment found</div>
            ) : filteredEquip.map(eq => (
              <div key={eq.id}
                onClick={() => toggleEquip(eq.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 14px', cursor: 'pointer', fontSize: 13,
                  background: selected.has(eq.id) ? '#eff6ff' : 'transparent',
                  borderBottom: '1px solid #f1f5f9',
                }}>
                <div style={{
                  width: 16, height: 16, borderRadius: 4, border: `2px solid ${selected.has(eq.id) ? '#3b82f6' : '#d1d5db'}`,
                  background: selected.has(eq.id) ? '#3b82f6' : '#fff', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {selected.has(eq.id) && <span style={{ color: '#fff', fontSize: 10, fontWeight: 800 }}>✓</span>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: '#0f172a' }}>{eq.name}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    {eq.serial_number && `S/N: ${eq.serial_number}`}
                    {eq.rig_number && ` · ${eq.rig_number}`}
                    {eq.category && ` · ${eq.category}`}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {selected.size > 0 && (
            <div style={{ padding: '8px 14px', background: '#eff6ff', borderTop: '1px solid #bfdbfe',
              fontSize: 12, color: '#1e40af', fontWeight: 600 }}>
              {selected.size} equipment item{selected.size !== 1 ? 's' : ''} selected
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : initial.id ? 'Save Changes' : 'Upload Certificate'}
        </Button>
      </div>
    </form>
  );
}

// ── Certificate Card ───────────────────────────────────────────
function CertCard({ cert, onClick, onDelete, canEdit }) {
  const isExpired  = cert.expiry_date && new Date(cert.expiry_date) < new Date();
  const expiringSoon = cert.expiry_date && !isExpired &&
    (new Date(cert.expiry_date) - new Date()) < 30 * 24 * 60 * 60 * 1000;

  return (
    <div style={{
      background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 12,
      padding: 20, cursor: 'pointer', transition: 'box-shadow .15s',
      borderTop: `4px solid ${isExpired ? '#ef4444' : expiringSoon ? '#f97316' : '#22c55e'}`,
    }}
      onClick={onClick}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,.08)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0, marginRight: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 2 }}>{cert.title}</div>
          {cert.cert_number && <div style={{ fontSize: 12, color: '#64748b' }}>#{cert.cert_number}</div>}
        </div>
        {isExpired && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
            background: '#fef2f2', color: '#991b1b', flexShrink: 0 }}>EXPIRED</span>
        )}
        {expiringSoon && !isExpired && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
            background: '#fff7ed', color: '#9a3412', flexShrink: 0 }}>EXPIRING SOON</span>
        )}
      </div>

      <div style={{ fontSize: 12, color: '#64748b', display: 'flex', flexDirection: 'column', gap: 3 }}>
        {cert.issued_by   && <span>🏢 {cert.issued_by}</span>}
        {cert.issued_date && <span>📅 Issued: {fmtDate(cert.issued_date)}</span>}
        {cert.expiry_date && (
          <span style={{ color: isExpired ? '#dc2626' : expiringSoon ? '#ea580c' : '#64748b' }}>
            ⏰ Expires: {fmtDate(cert.expiry_date)}
          </span>
        )}
        <span>🔗 Linked to {cert.linked_count} equipment item{cert.linked_count !== 1 ? 's' : ''}</span>
        {cert.file_url && <span style={{ color: '#3b82f6' }}>📄 File attached</span>}
      </div>

      {canEdit && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }} onClick={e => e.stopPropagation()}>
          <Button variant="secondary" size="sm" onClick={onClick}>View / Edit</Button>
          <Button variant="danger" size="sm" onClick={() => onDelete(cert)}>Delete</Button>
        </div>
      )}
    </div>
  );
}

// ── Certificate Detail Modal ───────────────────────────────────
function CertDetail({ cert, onClose, onEdit, onRefresh, canEdit }) {
  const [data, setData]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/certificates/${cert.id}`)
      .then(r => setData(r))
      .finally(() => setLoading(false));
  }, [cert.id]);

  const unlink = async eqId => {
    await api.delete(`/certificates/${cert.id}/link/${eqId}`);
    onRefresh();
    api.get(`/certificates/${cert.id}`).then(setData);
  };

  if (loading) return <Modal title="Loading…" onClose={onClose}><Spinner /></Modal>;

  const c  = data?.data;
  const eq = data?.equipment || [];
  const isExpired = c?.expiry_date && new Date(c.expiry_date) < new Date();

  return (
    <Modal title={c?.title} onClose={onClose} width={680}>
      {/* Status banner */}
      {isExpired && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
          padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#991b1b', fontWeight: 600 }}>
          ⚠️ This certificate has expired on {fmtDate(c.expiry_date)}
        </div>
      )}

      {/* Details */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px', marginBottom: 20 }}>
        {[
          ['Cert Number', c?.cert_number],
          ['Issued By',   c?.issued_by],
          ['Issue Date',  fmtDate(c?.issued_date)],
          ['Expiry Date', fmtDate(c?.expiry_date)],
        ].map(([label, value]) => (
          <div key={label}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: 14, color: '#0f172a' }}>{value || '—'}</div>
          </div>
        ))}
      </div>

      {c?.notes && (
        <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 14px',
          fontSize: 13, color: '#374151', marginBottom: 16 }}>
          {c.notes}
        </div>
      )}

      {/* File */}
      {c?.file_url && (
        <div style={{ marginBottom: 20 }}>
          <a href={c.file_url} target="_blank" rel="noopener noreferrer">
            <Button variant="secondary">
              📄 View Certificate File — {c.file_name}
            </Button>
          </a>
        </div>
      )}

      {/* Linked equipment */}
      <h3 style={{ fontSize: 14, fontWeight: 700, color: '#374151', margin: '0 0 10px' }}>
        Linked Equipment ({eq.length})
      </h3>
      <div style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
        {eq.length === 0 ? (
          <div style={{ padding: 16, color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>No equipment linked</div>
        ) : eq.map((item, i) => (
          <div key={item.id} style={{
            display: 'flex', alignItems: 'center', padding: '10px 14px',
            borderBottom: i < eq.length - 1 ? '1px solid #f1f5f9' : 'none',
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{item.name}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>
                {item.serial_number && `S/N: ${item.serial_number} · `}
                {item.rig_number && `${item.rig_number} · `}
                <span style={{ color: item.category_color, fontWeight: 600 }}>{item.category}</span>
              </div>
            </div>
            {canEdit && (
              <Button variant="ghost" size="sm" onClick={() => unlink(item.id)}>Unlink</Button>
            )}
          </div>
        ))}
      </div>

      {canEdit && (
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <Button onClick={onEdit}>Edit Certificate</Button>
        </div>
      )}
    </Modal>
  );
}

// ── Main Certificates Page ─────────────────────────────────────
export default function CertificatesPage() {
  const [certs, setCerts]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState(null); // 'add' | 'detail' | 'edit'
  const [selected, setSelected] = useState(null);
  const [error, setError]     = useState('');
  const { user } = useAuth();
  const canEdit = ['admin','representative'].includes(user?.role);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/certificates')
      .then(r => setCerts(r.data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const deleteCert = async cert => {
    if (!confirm(`Delete certificate "${cert.title}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/certificates/${cert.id}`);
      load();
    } catch (err) { setError(err.message); }
  };

  // Categorise by expiry
  const expired     = certs.filter(c => c.expiry_date && new Date(c.expiry_date) < new Date());
  const expiringSoon = certs.filter(c => {
    if (!c.expiry_date || new Date(c.expiry_date) < new Date()) return false;
    return (new Date(c.expiry_date) - new Date()) < 30 * 24 * 60 * 60 * 1000;
  });
  const valid = certs.filter(c => !c.expiry_date || new Date(c.expiry_date) >= new Date());

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 4px' }}>Certificates</h1>
          <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>
            Manage inspection certificates — one certificate can cover multiple equipment items
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => setModal('add')}>+ Upload Certificate</Button>
        )}
      </div>

      <AlertBanner type="error" message={error} onClose={() => setError('')} />

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total',        value: certs.length,       color: '#1e293b' },
          { label: 'Valid',        value: valid.length,       color: '#16a34a' },
          { label: 'Expiring Soon', value: expiringSoon.length, color: '#f97316' },
          { label: 'Expired',      value: expired.length,    color: '#dc2626' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1.5px solid #e2e8f0',
            borderRadius: 10, padding: '14px 18px', borderTop: `4px solid ${s.color}` }}>
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {loading ? <Spinner /> : certs.length === 0 ? (
        <div style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 12 }}>
          <Empty icon="📄" title="No certificates yet"
            sub={canEdit ? "Upload a certificate to link it to your equipment" : "No certificates have been uploaded yet"} />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
          {certs.map(cert => (
            <CertCard key={cert.id} cert={cert} canEdit={canEdit}
              onClick={() => { setSelected(cert); setModal('detail'); }}
              onDelete={deleteCert} />
          ))}
        </div>
      )}

      {/* Modals */}
      {modal === 'add' && (
        <Modal title="Upload Certificate" onClose={() => setModal(null)} width={680}>
          <CertForm onSave={() => { setModal(null); load(); }} onClose={() => setModal(null)} />
        </Modal>
      )}

      {modal === 'detail' && selected && (
        <CertDetail
          cert={selected}
          canEdit={canEdit}
          onClose={() => setModal(null)}
          onEdit={() => setModal('edit')}
          onRefresh={load}
        />
      )}

      {modal === 'edit' && selected && (
        <Modal title="Edit Certificate" onClose={() => setModal(null)} width={680}>
          <CertForm
            initial={{ ...selected, linked_ids: [] }}
            onSave={() => { setModal(null); load(); }}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}
