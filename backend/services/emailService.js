const nodemailer = require('nodemailer');
const https = require('https');

// ── Brevo HTTP API ─────────────────────────────────────────────
async function sendViaBrevoAPI({ to, subject, html }) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error('BREVO_API_KEY not set');

  const payload = JSON.stringify({
    sender:      { name: process.env.SMTP_FROM_NAME || 'InspectTrack', email: process.env.SMTP_FROM },
    to:          (Array.isArray(to) ? to : [to]).map(email => ({ email })),
    subject,
    htmlContent: html,
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.brevo.com',
      path:     '/v3/smtp/email',
      method:   'POST',
      headers:  {
        'api-key':        apiKey,
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve({ method: 'brevo-api' });
        else reject(new Error(`Brevo API ${res.statusCode}: ${data}`));
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ── SMTP fallback ──────────────────────────────────────────────
async function sendViaSMTP({ to, subject, html }) {
  const transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_PORT === '465',
    auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    tls:    { rejectUnauthorized: false },
    family: 4,
    connectionTimeout: 20000,
    greetingTimeout:   15000,
    socketTimeout:     20000,
  });
  await transporter.sendMail({
    from: `"${process.env.SMTP_FROM_NAME || 'InspectTrack'}" <${process.env.SMTP_FROM}>`,
    to:   Array.isArray(to) ? to.join(', ') : to,
    subject, html,
  });
  return { method: 'smtp' };
}

async function sendEmail({ to, subject, html }) {
  if (process.env.BREVO_API_KEY) return sendViaBrevoAPI({ to, subject, html });
  return sendViaSMTP({ to, subject, html });
}

// ── Helpers ────────────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function emailShell(headerBg, headerHtml, bodyHtml, footerColor) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
<tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.12);">
  <tr><td style="background:${headerBg};padding:24px 36px;">${headerHtml}</td></tr>
  <tr><td style="padding:28px 36px;">${bodyHtml}</td></tr>
  <tr><td style="background:#f8fafc;padding:16px 36px;border-top:1px solid #e2e8f0;">
    <p style="margin:0;font-size:12px;color:${footerColor};text-align:center;">
      InspectTrack &nbsp;·&nbsp; Equipment Inspection Management &nbsp;·&nbsp; Automated Alert
    </p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function itemTable(entries, accentFn) {
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const rows = entries.map(({ item, daysUntilDue, daysOverdue }) => {
    const accent = accentFn ? accentFn(daysUntilDue) : '#dc2626';
    const timing = daysOverdue != null
      ? `<span style="color:#dc2626;font-weight:700;">${daysOverdue}d overdue</span>`
      : daysUntilDue === 0
        ? `<span style="color:#dc2626;font-weight:700;">Due today</span>`
        : `<span style="color:${accent};font-weight:700;">${daysUntilDue}d remaining</span>`;

    return `<tr style="border-bottom:1px solid #f1f5f9;">
      <td style="padding:12px 14px;vertical-align:top;">
        <div style="font-weight:700;font-size:14px;color:#0f172a;">${item.name}</div>
        ${item.serial_number ? `<div style="font-size:11px;color:#94a3b8;margin-top:2px;">S/N: ${item.serial_number}</div>` : ''}
      </td>
      <td style="padding:12px 14px;vertical-align:top;font-size:13px;color:#374151;">${item.category}</td>
      <td style="padding:12px 14px;vertical-align:top;font-size:13px;color:#374151;">${item.rig_number || item.location || '—'}</td>
      <td style="padding:12px 14px;vertical-align:top;font-size:13px;">${fmtDate(item.next_due_date)}</td>
      <td style="padding:12px 14px;vertical-align:top;font-size:13px;">${timing}</td>
      <td style="padding:12px 14px;vertical-align:top;">
        <a href="${appUrl}/equipment/${item.id}" style="background:#1e293b;color:#fff;text-decoration:none;
          padding:5px 12px;border-radius:6px;font-size:11px;font-weight:600;white-space:nowrap;">View →</a>
      </td>
    </tr>`;
  }).join('');

  return `<table width="100%" cellpadding="0" cellspacing="0"
    style="border-collapse:collapse;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:20px;">
    <thead>
      <tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0;">
        <th style="padding:10px 14px;text-align:left;font-size:12px;color:#64748b;font-weight:600;">Equipment</th>
        <th style="padding:10px 14px;text-align:left;font-size:12px;color:#64748b;font-weight:600;">Category</th>
        <th style="padding:10px 14px;text-align:left;font-size:12px;color:#64748b;font-weight:600;">Rig</th>
        <th style="padding:10px 14px;text-align:left;font-size:12px;color:#64748b;font-weight:600;">Due Date</th>
        <th style="padding:10px 14px;text-align:left;font-size:12px;color:#64748b;font-weight:600;">Status</th>
        <th style="padding:10px 14px;text-align:left;font-size:12px;color:#64748b;font-weight:600;"></th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

// ── Grouped Expiry Email ───────────────────────────────────────
// entries = [{item, daysUntilDue}]
function buildGroupedExpiryEmail({ entries }) {
  const count     = entries.length;
  const hasUrgent = entries.some(e => e.daysUntilDue <= 7);
  const hasCrit   = entries.some(e => e.daysUntilDue <= 14);
  const headerBg  = hasUrgent ? '#7f1d1d' : hasCrit ? '#7c2d12' : '#713f12';
  const urgency   = hasUrgent ? 'URGENT' : hasCrit ? 'Important' : 'Reminder';
  const badgeCol  = hasUrgent ? '#ef4444' : hasCrit ? '#f97316' : '#eab308';

  const subject = `[${urgency}] ${count} equipment item${count !== 1 ? 's' : ''} require inspection`;

  const accentFn = d => d <= 7 ? '#ef4444' : d <= 14 ? '#f97316' : '#eab308';

  const header = `<table width="100%"><tr>
    <td>
      <div style="color:rgba(255,255,255,.7);font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">InspectTrack Alert</div>
      <div style="color:#fff;font-size:20px;font-weight:800;">Inspection Due — ${count} Item${count !== 1 ? 's' : ''}</div>
    </td>
    <td align="right" valign="top">
      <span style="background:${badgeCol};color:#fff;font-size:12px;font-weight:700;padding:5px 14px;border-radius:20px;">${urgency}</span>
    </td>
  </tr></table>`;

  const body = `
    <p style="margin:0 0 16px;font-size:14px;color:#374151;">
      The following <strong>${count} equipment item${count !== 1 ? 's' : ''}</strong> have upcoming inspection due dates.
      Please arrange inspections before the due dates.
    </p>
    ${itemTable(entries, accentFn)}
    <p style="margin:0;font-size:13px;color:#64748b;">
      Click <strong>View →</strong> on any item to open its record and log the inspection.
    </p>`;

  return { subject, html: emailShell(headerBg, header, body, '#94a3b8') };
}

// ── Grouped Overdue Email ─────────────────────────────────────
// entries = [{item, daysOverdue}]
function buildGroupedOverdueEmail({ entries }) {
  const count   = entries.length;
  const subject = `[OVERDUE] ${count} equipment item${count !== 1 ? 's' : ''} overdue — Immediate action required`;

  const header = `<table width="100%"><tr>
    <td>
      <div style="color:rgba(255,255,255,.7);font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">InspectTrack Alert</div>
      <div style="color:#fff;font-size:20px;font-weight:800;">Overdue Inspections — ${count} Item${count !== 1 ? 's' : ''}</div>
    </td>
    <td align="right" valign="top">
      <span style="background:#dc2626;color:#fff;font-size:12px;font-weight:700;padding:5px 14px;border-radius:20px;">🚨 OVERDUE</span>
    </td>
  </tr></table>`;

  const body = `
    <p style="margin:0 0 16px;font-size:14px;color:#fecaca;">
      The following <strong>${count} equipment item${count !== 1 ? 's' : ''}</strong> are overdue for inspection.
      These items may not be safe to use. Immediate action required.
    </p>
    ${itemTable(entries, null)}
    <p style="margin:0;font-size:13px;color:#fca5a5;">
      Click <strong>View →</strong> on any item to open its record and log the inspection.
    </p>`;

  return { subject, html: emailShell('#991b1b', header, body, 'rgba(255,255,255,.4)').replace(
    'background:#fff;', 'background:#7f1d1d;'
  )};
}

// ── Test email (single item) ───────────────────────────────────
function buildTestEmail({ to, smtpFrom, method, time }) {
  return {
    subject: '✅ InspectTrack — Email Test Successful',
    html: `<div style="font-family:sans-serif;max-width:500px;margin:40px auto;padding:32px;
      background:#f0fdf4;border-radius:12px;border:2px solid #86efac;">
      <h2 style="color:#166534;margin:0 0 12px">✅ Email is working!</h2>
      <p style="color:#374151;margin:0 0 8px">InspectTrack email is configured correctly.</p>
      <hr style="border:none;border-top:1px solid #bbf7d0;margin:16px 0">
      <p style="color:#6b7280;font-size:12px;margin:0">
        Sent to: <strong>${to}</strong><br>
        Method: ${method}<br>
        From: ${smtpFrom}<br>
        Time: ${time}
      </p>
    </div>`,
  };
}

module.exports = {
  sendEmail,
  buildGroupedExpiryEmail,
  buildGroupedOverdueEmail,
  buildTestEmail,
};
