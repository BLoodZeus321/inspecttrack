const router = require('express').Router();
const { query } = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const { runAlertCheck } = require('../services/alertScheduler');
const { sendEmail } = require('../services/emailService');

// GET /api/dashboard/stats
router.get('/stats', authenticate, async (req, res) => {
  try {
    const [summary, byCategory, recentInspections, recentAlerts, overdueList] = await Promise.all([
      // Overall counts
      query(`
        SELECT
          COUNT(*)::int                                               AS total,
          COUNT(*) FILTER (WHERE alert_status='overdue')::int        AS overdue,
          COUNT(*) FILTER (WHERE alert_status='critical')::int       AS critical,
          COUNT(*) FILTER (WHERE alert_status='warning')::int        AS warning,
          COUNT(*) FILTER (WHERE alert_status='ok')::int             AS ok,
          COUNT(*) FILTER (WHERE alert_status='never_inspected')::int AS never_inspected
        FROM equipment_status WHERE status='active'
      `),

      // By category
      query(`
        SELECT
          es.category, es.category_color,
          COUNT(*)::int                                             AS total,
          COUNT(*) FILTER (WHERE es.alert_status='overdue')::int   AS overdue,
          COUNT(*) FILTER (WHERE es.alert_status='critical')::int  AS critical,
          COUNT(*) FILTER (WHERE es.alert_status='warning')::int   AS warning,
          COUNT(*) FILTER (WHERE es.alert_status='ok')::int        AS ok
        FROM equipment_status es
        WHERE es.status='active'
        GROUP BY es.category, es.category_color
        ORDER BY overdue DESC, critical DESC, es.category
      `),

      // Recent inspections (last 10)
      query(`
        SELECT i.*, e.name AS equipment_name, e.asset_tag, c.name AS category
        FROM inspections i
        JOIN equipment e ON e.id = i.equipment_id
        LEFT JOIN categories c ON c.id = e.category_id
        ORDER BY i.created_at DESC LIMIT 10
      `),

      // Recent alerts sent (last 20)
      query(`
        SELECT al.*, e.name AS equipment_name, e.asset_tag
        FROM alert_log al
        JOIN equipment e ON e.id = al.equipment_id
        ORDER BY al.sent_at DESC LIMIT 20
      `),

      // Full overdue list
      query(`
        SELECT id, name, asset_tag, location, category, category_color,
               next_due_date, days_until_due, last_inspection_date
        FROM equipment_status
        WHERE alert_status='overdue' AND status='active'
        ORDER BY days_until_due ASC
      `),
    ]);

    res.json({
      stats:             summary.rows[0],
      byCategory:        byCategory.rows,
      recentInspections: recentInspections.rows,
      recentAlerts:      recentAlerts.rows,
      overdueList:       overdueList.rows,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/dashboard/trigger-alerts  (admin — manual alert check)
router.post('/trigger-alerts', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  runAlertCheck().catch(console.error);
  res.json({ message: 'Alert check triggered. Watch server logs.' });
});

// POST /api/dashboard/test-email  (admin — sends a real test email immediately)
router.post('/test-email', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

  const to = req.body.email || req.user.email;

  // Check which method will be used
  const usingAPI = !!process.env.BREVO_API_KEY;

  // Check required env vars
  const required = usingAPI
    ? ['BREVO_API_KEY', 'SMTP_FROM']
    : ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length) {
    return res.status(400).json({
      error: `Missing environment variables: ${missing.join(', ')}`,
      hint: usingAPI
        ? 'Add BREVO_API_KEY and SMTP_FROM in Render → Environment.'
        : 'Add SMTP credentials in Render → Environment.',
    });
  }

  try {
    const result = await sendEmail({
      to,
      subject: '✅ InspectTrack — Email Test Successful',
      html: `
        <div style="font-family:sans-serif;max-width:500px;margin:40px auto;padding:32px;
          background:#f0fdf4;border-radius:12px;border:2px solid #86efac;">
          <h2 style="color:#166534;margin:0 0 12px">✅ Email is working!</h2>
          <p style="color:#374151;margin:0 0 8px">InspectTrack email is configured correctly.</p>
          <p style="color:#374151;margin:0 0 8px">Alert emails will fire automatically on schedule.</p>
          <hr style="border:none;border-top:1px solid #bbf7d0;margin:16px 0">
          <p style="color:#6b7280;font-size:12px;margin:0">
            Sent to: <strong>${to}</strong><br>
            Method: ${usingAPI ? 'Brevo HTTP API' : 'SMTP'}<br>
            From: ${process.env.SMTP_FROM}<br>
            Time: ${new Date().toISOString()}
          </p>
        </div>`,
    });
    res.json({
      success: true,
      message: `Test email sent to ${to} via ${result.method}. Check your inbox (and spam folder).`,
      method:  result.method,
      sent_to: to,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error:   err.message,
      hint:    diagnoseSmtpError(err.message),
      method:  usingAPI ? 'brevo-api' : 'smtp',
      smtp_host: process.env.SMTP_HOST,
      smtp_port: process.env.SMTP_PORT,
    });
  }
});

function diagnoseSmtpError(msg) {
  if (msg.includes('Invalid login') || msg.includes('535') || msg.includes('534'))
    return 'Wrong email password. Use an App Password (not your main password). For Office365: myaccount.microsoft.com → Security → App passwords. For Gmail: myaccount.google.com → Security → App passwords.';
  if (msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND'))
    return 'Cannot reach SMTP server. Check SMTP_HOST and SMTP_PORT in Render environment variables.';
  if (msg.includes('ETIMEDOUT') || msg.includes('timeout') || msg.includes('Timeout'))
    return 'Render free tier blocks port 587 for most providers. Fix: Sign up at brevo.com (free), get SMTP credentials, update SMTP_HOST=smtp-relay.brevo.com, SMTP_PORT=587, SMTP_USER=your brevo email, SMTP_PASS=brevo smtp key.';
  if (msg.includes('certificate') || msg.includes('TLS') || msg.includes('SSL'))
    return 'TLS/SSL error. Add SMTP_TLS_REJECT=false to Render environment variables.';
  if (msg.includes('Greeting') || msg.includes('greeting'))
    return 'SMTP server rejected the connection. Double-check SMTP_HOST is correct.';
  return 'Check Render logs for more details.';
}

module.exports = router;
