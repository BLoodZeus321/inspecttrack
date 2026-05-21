const cron   = require('node-cron');
const { query } = require('../db/pool');
const { sendEmail, buildExpiryEmail, buildOverdueEmail } = require('./emailService');

// ─────────────────────────────────────────────────────────────
async function runAlertCheck() {
  const ts = new Date().toISOString();
  console.log(`\n[Scheduler] ▶ Alert check started at ${ts}`);

  try {
    // Fetch all active equipment that has an upcoming or overdue inspection
    const { rows: items } = await query(`
      SELECT
        e.id, e.name, e.asset_tag, e.serial_number, e.location,
        c.id           AS category_id,
        c.name         AS category,
        c.alert_lead_days,
        i.next_due_date,
        i.inspection_date AS last_inspection_date,
        (i.next_due_date - CURRENT_DATE) AS days_until_due
      FROM equipment e
      JOIN categories c ON e.category_id = c.id
      LEFT JOIN LATERAL (
        SELECT next_due_date, inspection_date
        FROM   inspections
        WHERE  equipment_id = e.id
        ORDER  BY inspection_date DESC LIMIT 1
      ) i ON TRUE
      WHERE e.status = 'active'
        AND i.next_due_date IS NOT NULL
    `);

    console.log(`[Scheduler] Found ${items.length} active equipment item(s) with inspection records`);

    let sent = 0, skipped = 0, failed = 0;

    for (const item of items) {
      const days = parseInt(item.days_until_due);

      if (days < 0) {
        // Overdue
        const result = await handleOverdue(item, Math.abs(days));
        if (result === 'sent')    sent++;
        if (result === 'skipped') skipped++;
        if (result === 'failed')  failed++;
      } else {
        // Convert to integers — pg may return array elements as strings
        const leadDays = (item.alert_lead_days || []).map(Number);
        if (leadDays.includes(days)) {
          // Today exactly matches a configured alert day
          console.log(`[Scheduler] "${item.name}" matches alert day ${days} (lead days: ${leadDays.join(',')})`);
          const results = await handleUpcoming(item, days);
          sent    += results.sent;
          skipped += results.skipped;
          failed  += results.failed;
        } else {
          console.log(`[Scheduler] "${item.name}" — ${days}d until due, no match in [${leadDays.join(',')}]`);
        }
      }
    }

    console.log(`[Scheduler] ✔ Done — sent:${sent} skipped:${skipped} failed:${failed}\n`);
  } catch (err) {
    console.error('[Scheduler] ✗ Fatal error:', err);
  }
}

// ─────────────────────────────────────────────────────────────
async function handleUpcoming(item, daysUntilDue) {
  const recipients = await getRecipients(item.id, item.category_id);
  let sent = 0, skipped = 0, failed = 0;

  for (const email of recipients) {
    const already = await sentToday(item.id, email, daysUntilDue, 'expiry');
    if (already) { skipped++; continue; }

    const { subject, html } = buildExpiryEmail({
      equipment:     item,
      daysUntilDue,
      nextDueDate:   item.next_due_date,
      lastInspection: item.last_inspection_date,
      category:      item.category,
    });

    const ok = await trySend(item.id, email, subject, html, daysUntilDue, 'expiry');
    ok ? sent++ : failed++;
  }

  return { sent, skipped, failed };
}

async function handleOverdue(item, daysOverdue) {
  const recipients = await getRecipients(item.id, item.category_id);

  for (const email of recipients) {
    const already = await sentToday(item.id, email, -daysOverdue, 'overdue');
    if (already) return 'skipped';

    const { subject, html } = buildOverdueEmail({
      equipment:      item,
      daysOverdue,
      lastInspection: item.last_inspection_date,
      category:       item.category,
    });

    return await trySend(item.id, email, subject, html, -daysOverdue, 'overdue')
      ? 'sent' : 'failed';
  }
  return 'skipped';
}

// ─────────────────────────────────────────────────────────────
async function getRecipients(equipmentId, categoryId) {
  const { rows } = await query(`
    SELECT DISTINCT email FROM (
      SELECT ar.email
      FROM   alert_recipients ar
      WHERE  ar.category_id = $1 AND ar.is_active = TRUE
      UNION
      SELECT email FROM global_recipients WHERE is_active = TRUE
    ) combined
  `, [categoryId]);
  return rows.map(r => r.email);
}

async function sentToday(equipmentId, email, daysBefore, alertType) {
  const { rows } = await query(`
    SELECT id FROM alert_log
    WHERE equipment_id    = $1
      AND recipient_email = $2
      AND days_before_due = $3
      AND alert_type      = $4
      AND sent_at::date   = CURRENT_DATE
      AND status          = 'sent'
  `, [equipmentId, email, daysBefore, alertType]);
  return rows.length > 0;
}

async function trySend(equipmentId, email, subject, html, daysBefore, alertType) {
  try {
    await sendEmail({ to: email, subject, html });
    await query(`
      INSERT INTO alert_log (equipment_id, recipient_email, days_before_due, alert_type, status)
      VALUES ($1,$2,$3,$4,'sent')
    `, [equipmentId, email, daysBefore, alertType]);
    console.log(`  ✉  ${alertType.toUpperCase()} → ${email} (${daysBefore}d)`);
    return true;
  } catch (err) {
    await query(`
      INSERT INTO alert_log (equipment_id, recipient_email, days_before_due, alert_type, status, error_message)
      VALUES ($1,$2,$3,$4,'failed',$5)
    `, [equipmentId, email, daysBefore, alertType, err.message]);
    console.error(`  ✗  Failed → ${email}: ${err.message}`);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
function startScheduler() {
  const expr = process.env.ALERT_CRON || '0 7 * * *';
  console.log(`[Scheduler] Cron set to "${expr}" (UTC)`);
  cron.schedule(expr, runAlertCheck);
}

module.exports = { startScheduler, runAlertCheck };
