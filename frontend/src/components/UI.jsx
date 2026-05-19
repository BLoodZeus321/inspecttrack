// ── Design tokens ─────────────────────────────────────────────
export const colors = {
  overdue:        { bg: '#fef2f2', text: '#991b1b', dot: '#ef4444', border: '#fecaca' },
  critical:       { bg: '#fff7ed', text: '#9a3412', dot: '#f97316', border: '#fed7aa' },
  warning:        { bg: '#fefce8', text: '#854d0e', dot: '#eab308', border: '#fef08a' },
  ok:             { bg: '#f0fdf4', text: '#166534', dot: '#22c55e', border: '#bbf7d0' },
  never_inspected:{ bg: '#f5f3ff', text: '#5b21b6', dot: '#8b5cf6', border: '#ddd6fe' },
};

// ── Badge ─────────────────────────────────────────────────────
const STATUS_LABELS = {
  overdue:        'Overdue',
  critical:       'Due Soon',
  warning:        'Upcoming',
  ok:             'OK',
  never_inspected:'Never Inspected',
};

export function Badge({ status, size = 'sm' }) {
  const cfg  = colors[status] || colors.ok;
  const pad  = size === 'lg' ? '5px 14px' : '3px 10px';
  const font = size === 'lg' ? 13 : 11;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: pad, borderRadius: 20, fontSize: font, fontWeight: 700,
      background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}`,
      whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
      {STATUS_LABELS[status] || status}
    </span>
  );
}

// ── ResultBadge ───────────────────────────────────────────────
const RESULT = {
  pass:        { bg: '#f0fdf4', text: '#166534', label: '✓ Pass' },
  fail:        { bg: '#fef2f2', text: '#991b1b', label: '✗ Fail' },
  conditional: { bg: '#fff7ed', text: '#9a3412', label: '⚠ Conditional' },
};
export function ResultBadge({ result }) {
  const cfg = RESULT[result] || RESULT.pass;
  return (
    <span style={{ background: cfg.bg, color: cfg.text, fontWeight: 700, fontSize: 12,
      padding: '3px 10px', borderRadius: 20 }}>
      {cfg.label}
    </span>
  );
}

// ── Button ────────────────────────────────────────────────────
const BTN_STYLES = {
  primary:   { background: '#1e293b', color: '#fff',    border: '1.5px solid #1e293b' },
  danger:    { background: '#dc2626', color: '#fff',    border: '1.5px solid #dc2626' },
  success:   { background: '#16a34a', color: '#fff',    border: '1.5px solid #16a34a' },
  secondary: { background: '#fff',    color: '#374151', border: '1.5px solid #d1d5db' },
  ghost:     { background: 'transparent', color: '#64748b', border: '1.5px solid transparent' },
};

export function Button({ variant = 'primary', size = 'md', children, style = {}, disabled, ...props }) {
  const pad = size === 'sm' ? '6px 14px' : size === 'lg' ? '12px 28px' : '8px 20px';
  const fnt = size === 'sm' ? 12 : size === 'lg' ? 16 : 14;
  return (
    <button disabled={disabled} style={{
      ...BTN_STYLES[variant], padding: pad, fontSize: fnt, fontWeight: 600,
      borderRadius: 8, cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? .6 : 1, display: 'inline-flex', alignItems: 'center',
      gap: 6, fontFamily: 'inherit', transition: 'opacity .1s', ...style,
    }} {...props}>{children}</button>
  );
}

// ── Input ─────────────────────────────────────────────────────
export function Input({ label, error, ...props }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && <label style={{ display: 'block', fontSize: 13, fontWeight: 600,
        color: '#374151', marginBottom: 5 }}>{label}</label>}
      <input style={{
        width: '100%', padding: '9px 12px', border: `1.5px solid ${error ? '#ef4444' : '#d1d5db'}`,
        borderRadius: 8, fontSize: 14, outline: 'none', color: '#0f172a',
        background: '#fff', fontFamily: 'inherit',
      }} {...props} />
      {error && <p style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>{error}</p>}
    </div>
  );
}

// ── Textarea ──────────────────────────────────────────────────
export function Textarea({ label, ...props }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && <label style={{ display: 'block', fontSize: 13, fontWeight: 600,
        color: '#374151', marginBottom: 5 }}>{label}</label>}
      <textarea rows={3} style={{
        width: '100%', padding: '9px 12px', border: '1.5px solid #d1d5db',
        borderRadius: 8, fontSize: 14, outline: 'none', color: '#0f172a',
        background: '#fff', fontFamily: 'inherit', resize: 'vertical',
      }} {...props} />
    </div>
  );
}

// ── Select ────────────────────────────────────────────────────
export function Select({ label, children, ...props }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && <label style={{ display: 'block', fontSize: 13, fontWeight: 600,
        color: '#374151', marginBottom: 5 }}>{label}</label>}
      <select style={{
        width: '100%', padding: '9px 12px', border: '1.5px solid #d1d5db',
        borderRadius: 8, fontSize: 14, outline: 'none', color: '#0f172a',
        background: '#fff', fontFamily: 'inherit', cursor: 'pointer',
      }} {...props}>{children}</select>
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────
export function Modal({ title, onClose, children, width = 560 }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 20, backdropFilter: 'blur(2px)',
    }} onClick={onClose}>
      <div style={{
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: width,
        maxHeight: '92vh', overflow: 'auto',
        boxShadow: '0 24px 64px rgba(0,0,0,.25)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid #e2e8f0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          position: 'sticky', top: 0, background: '#fff', zIndex: 1, borderRadius: '16px 16px 0 0',
        }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: '#0f172a' }}>{title}</h2>
          <button onClick={onClose} style={{
            border: 'none', background: '#f1f5f9', width: 32, height: 32,
            borderRadius: 8, cursor: 'pointer', fontSize: 18, color: '#64748b',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>×</button>
        </div>
        <div style={{ padding: 24 }}>{children}</div>
      </div>
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────
export function Card({ children, style = {}, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 12,
      padding: 20, cursor: onClick ? 'pointer' : 'default',
      transition: 'box-shadow .15s', ...style,
    }}
      onMouseEnter={e => onClick && (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,.1)')}
      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
    >{children}</div>
  );
}

// ── StatCard ──────────────────────────────────────────────────
export function StatCard({ label, value, accent, sub, onClick }) {
  return (
    <Card onClick={onClick} style={{ borderTop: `4px solid ${accent}` }}>
      <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 36, fontWeight: 800, color: '#0f172a',
        fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{value ?? '—'}</div>
      {sub && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>{sub}</div>}
    </Card>
  );
}

// ── Spinner ───────────────────────────────────────────────────
export function Spinner({ size = 32 }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
      <div style={{
        width: size, height: size, border: '3px solid #e2e8f0',
        borderTop: '3px solid #1e293b', borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Empty ─────────────────────────────────────────────────────
export function Empty({ icon = '📦', title, sub }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px', color: '#94a3b8' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>{title}</div>
      {sub && <div style={{ fontSize: 13 }}>{sub}</div>}
    </div>
  );
}

// ── Alert Banner ──────────────────────────────────────────────
export function AlertBanner({ type = 'error', message, onClose }) {
  if (!message) return null;
  const cfg = {
    error:   { bg: '#fef2f2', text: '#991b1b', border: '#fecaca' },
    success: { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0' },
    info:    { bg: '#eff6ff', text: '#1e40af', border: '#bfdbfe' },
  }[type];
  return (
    <div style={{
      background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}`,
      borderRadius: 8, padding: '10px 16px', marginBottom: 16,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14,
    }}>
      <span>{message}</span>
      {onClose && <button onClick={onClose} style={{ border: 'none', background: 'none',
        cursor: 'pointer', color: cfg.text, fontSize: 16 }}>×</button>}
    </div>
  );
}

// ── Format helpers ─────────────────────────────────────────────
export function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function daysLabel(days) {
  if (days == null) return '—';
  const d = parseInt(days);
  if (d < 0) return `${Math.abs(d)}d overdue`;
  if (d === 0) return 'Due today';
  return `${d}d remaining`;
}
