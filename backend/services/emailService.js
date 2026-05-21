const nodemailer = require('nodemailer');

function createTransporter() {
  const port   = parseInt(process.env.SMTP_PORT || '587');
  const secure = port === 465;
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port,
    secure,
    auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    tls:    { rejectUnauthorized: false, ciphers: 'SSLv3' },
    connectionTimeout: 20000,
    greetingTimeout:   15000,
    socketTimeout:     20000,
    // Force IPv4 — Render doesn't support IPv6
    family: 4,
  });
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function infoRow(label, value, labelColor, valueColor) {
  const lc = labelColor || '#64748b';
  const vc = valueColor || '#0f172a';
  return `<tr>
    <td style="padding:9px 16px;font-size:13px;color:${lc};font-weight:600;width:150px;vertical-align:top;border-bottom:1px solid rgba(200,200,200,.15);">${label}</td>
    <td style="padding:9px 16px;font-size:13px;color:${vc};vertical-align:top;border-bottom:1px solid rgba(200,200,200,.15);">${value}</td>
  </tr>`;
}

function ctaButton(label, url, bg) {
  return `<div style="text-align:center;margin:28px 0 4px;">
    <a href="${url}" style="background:${bg};color:#fff;text-decoration:none;padding:14px 36px;border-radius:10px;font-weight:700;font-size:15px;display:inline-block;letter-spacing:-.1px;">${label}</a>
  </div>`;
}

function wrapEmail(headerBg, headerContent, bodyBg, bodyContent, footerBg, footerColor) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.12);">
  <tr><td style="background:${headerBg};padding:28px 40px;">${headerContent}</td></tr>
  <tr><td style="background:${bodyBg};padding:32px 40px;">${bodyContent}</td></tr>
  <tr><td style="background:${footerBg};padding:18px 40px;border-top:1px solid rgba(200,200,200,.15);">
    <p style="margin:0;font-size:12px;color:${footerColor};text-align:center;">
      InspectTrack &nbsp;·&nbsp; Automated Equipment Inspection Management<br>
      This is an automated alert — please do not reply to this email.
    </p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

// ── Expiry / Upcoming Alert Email ─────────────────────────────
function buildExpiryEmail({ equipment, daysUntilDue, nextDueDate, lastInspection, category }) {
  const appUrl     = process.env.APP_URL || 'http://localhost:3000';
  const isUrgent   = daysUntilDue <= 7;
  const isCritical = daysUntilDue <= 14;
  const headerBg   = isUrgent ? '#7f1d1d' : isCritical ? '#7c2d12' : '#713f12';
  const accent     = isUrgent ? '#ef4444' : isCritical ? '#f97316' : '#eab308';
  const badgeLabel = isUrgent ? '⚠ URGENT' : isCritical ? '! Important' : '⏰ Reminder';
  const urgency    = isUrgent ? 'URGENT' : isCritical ? 'Important' : 'Reminder';
  const subject    = `[${urgency}] "${equipment.name}" inspection due in ${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''}`;

  const header = `<table width="100%"><tr>
    <td>
      <div style="color:rgba(255,255,255,.7);font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">InspectTrack Alert</div>
      <div style="color:#fff;font-size:22px;font-weight:800;letter-spacing:-.3px;">Equipment Inspection Due</div>
    </td>
    <td align="right" valign="top">
      <span style="background:${accent};color:#fff;font-size:12px;font-weight:700;padding:6px 16px;border-radius:20px;">${badgeLabel}</span>
    </td>
  </tr></table>`;

  const body = `
    <p style="margin:0 0 4px;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.8px;">Equipment</p>
    <h1 style="margin:0 0 6px;font-size:24px;font-weight:800;color:#0f172a;letter-spacing:-.3px;">${equipment.name}</h1>
    <p style="margin:0 0 24px;font-size:15px;color:${accent};font-weight:700;">
      Due in <strong>${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''}</strong> &nbsp;·&nbsp; ${fmtDate(nextDueDate)}
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;margin-bottom:24px;">
      ${infoRow('Asset Tag',      equipment.asset_tag     || '—')}
      ${infoRow('Category',       category)}
      ${infoRow('Location',       equipment.location      || '—')}
      ${infoRow('Serial No.',     equipment.serial_number || '—')}
      ${infoRow('Due Date',       `<strong style="color:${accent}">${fmtDate(nextDueDate)}</strong>`)}
      ${infoRow('Days Remaining', `<strong style="color:${accent}">${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''}</strong>`)}
      ${infoRow('Last Inspected', lastInspection ? fmtDate(lastInspection) : '<em style="color:#94a3b8">Never inspected</em>')}
    </table>
    <p style="margin:0 0 2px;font-size:14px;color:#374151;">
      Please arrange for this equipment to be inspected before the due date.
    </p>
    ${ctaButton('View Equipment &amp; Log Inspection →', `${appUrl}/equipment/${equipment.id}`, accent)}`;

  return { subject, html: wrapEmail(headerBg, header, '#ffffff', body, '#f8fafc', '#94a3b8') };
}

// ── Overdue Alert Email ───────────────────────────────────────
function buildOverdueEmail({ equipment, daysOverdue, lastInspection, category }) {
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const subject = `[OVERDUE] "${equipment.name}" is ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue — Action required`;

  const header = `<table width="100%"><tr>
    <td>
      <div style="color:rgba(255,255,255,.7);font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">InspectTrack Alert</div>
      <div style="color:#fff;font-size:22px;font-weight:800;letter-spacing:-.3px;">Inspection Overdue</div>
    </td>
    <td align="right" valign="top">
      <span style="background:#dc2626;color:#fff;font-size:12px;font-weight:700;padding:6px 16px;border-radius:20px;">🚨 OVERDUE</span>
    </td>
  </tr></table>`;

  const body = `
    <p style="margin:0 0 4px;font-size:12px;color:rgba(255,255,255,.6);font-weight:600;text-transform:uppercase;letter-spacing:.8px;">Equipment</p>
    <h1 style="margin:0 0 6px;font-size:24px;font-weight:800;color:#fff;letter-spacing:-.3px;">${equipment.name}</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#fca5a5;font-weight:700;">
      Overdue by <strong>${daysOverdue} day${daysOverdue !== 1 ? 's' : ''}</strong> — Immediate action required
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(0,0,0,.2);border-radius:10px;border:1px solid rgba(255,255,255,.1);margin-bottom:24px;">
      ${infoRow('Asset Tag',      equipment.asset_tag     || '—',  'rgba(255,255,255,.6)', '#fff')}
      ${infoRow('Category',       category,                         'rgba(255,255,255,.6)', '#fff')}
      ${infoRow('Location',       equipment.location      || '—',  'rgba(255,255,255,.6)', '#fff')}
      ${infoRow('Serial No.',     equipment.serial_number || '—',  'rgba(255,255,255,.6)', '#fff')}
      ${infoRow('Last Inspected', lastInspection ? fmtDate(lastInspection) : '<em style="opacity:.5">Never</em>', 'rgba(255,255,255,.6)', '#fff')}
      ${infoRow('Days Overdue',   `<strong style="color:#fca5a5">${daysOverdue} days</strong>`, 'rgba(255,255,255,.6)', '#fff')}
    </table>
    <p style="margin:0 0 2px;font-size:14px;color:#fecaca;">
      This equipment may not be safe to use until inspected. Please take immediate action.
    </p>
    ${ctaButton('Take Action Now →', `${appUrl}/equipment/${equipment.id}`, '#dc2626')}`;

  return { subject, html: wrapEmail('#991b1b', header, '#7f1d1d', body, 'rgba(0,0,0,.25)', 'rgba(255,255,255,.4)') };
}

// ── Send ──────────────────────────────────────────────────────
async function sendEmail({ to, subject, html }) {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"${process.env.SMTP_FROM_NAME || 'InspectTrack'}" <${process.env.SMTP_FROM}>`,
    to:   Array.isArray(to) ? to.join(', ') : to,
    subject,
    html,
  });
}

module.exports = { sendEmail, buildExpiryEmail, buildOverdueEmail };
