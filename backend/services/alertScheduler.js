const cron   = require('node-cron');
const { query } = require('../db/pool');
const { sendEmail, buildGroupedExpiryEmail, buildGroupedOverdueEmail } = require('./emailService');

// ─────────────────────────────────────────────────────────────
async function runAlertCheck() {
  const ts = new Date().toISOString();
  console.log(`\n[Scheduler] ▶ Alert check started at ${ts}`);

  try {
    // ── Fetch all active equipment with inspection info ───────
    const { rows: items } = await query(`
      SELECT
        e.id, e.name, e.asset_tag, e.serial_number, e.location, e.rig_number,
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

    console.log(`[Scheduler] Found ${items.length} active equipment items`);

    // ── Categorise each item ──────────────────────────────────
    const overdueItems  = [];
    const upcomingItems = []; // {item, daysUntilDue}

    for (const item of items) {
      const days     = parseInt(item.days_until_due);
      const leadDays = (item.alert_lead_days || []).map(Number);

      if (days < 0) {
        overdueItems.push({ item, daysOverdue: Math.abs(days) });
      } else if (leadDays.includes(days)) {
        upcomingItems.push({ item, daysUntilDue: days });
      } else {
        console.log(`[Scheduler] "${item.name}" — ${days}d until due, no match in [${leadDays.join(',')}]`);
      }
    }

    console.log(`[Scheduler] Upcoming: ${upcomingItems.length}, Overdue: ${overdueItems.length}`);

    // ── Build recipient → items map ───────────────────────────
    // Each recipient gets ONE email with ALL their relevant items
    const upcomingByRecipient = {}; // email → [{item, daysUntilDue}]
    const overdueByRecipient  = {}; // email → [{item, daysOverdue}]

    // Populate upcoming map
    for (const entry of upcomingItems) {
      const recipients = await getRecipients(entry.item.category_id, entry.item.rig_number);
      for (const email of recipients) {
        if (!upcomingByRecipient[email]) upcomingByRecipient[email] = [];
        // Check not already sent today for this item at this day count
        const alreadySent = await sentToday(entry.item.id, email, entry.daysUntilDue, 'expiry');
        if (!alreadySent) upcomingByRecipient[email].push(entry);
      }
    }

    // Populate overdue map
    for (const entry of overdueItems) {
      const recipients = await getRecipients(entry.item.category_id, entry.item.rig_number);
      for (const email of recipients) {
        if (!overdueByRecipient[email]) overdueByRecipient[email] = [];
        const alreadySent = await sentTodayOverdue(entry.item.id, email);
        if (!alreadySent) overdueByRecipient[email].push(entry);
      }
    }

    // ── Send one grouped email per recipient ──────────────────
    let sent = 0, skipped = 0, failed = 0;

    // Upcoming emails
    for (const [email, entries] of Object.entries(upcomingByRecipient)) {
      if (entries.length === 0) { skipped++; continue; }
      const { subject, html } = buildGroupedExpiryEmail({ entries });
      const ok = await trySendGrouped(email, subject, html, entries, 'expiry');
      ok ? sent++ : failed++;
    }

    // Overdue emails
    for (const [email, entries] of Object.entries(overdueByRecipient)) {
      if (entries.length === 0) { skipped++; continue; }
      const { subject, html } = buildGroupedOverdueEmail({ entries });
      const ok = await trySendGrouped(email, subject, html, entries, 'overdue');
      ok ? sent++ : failed++;
    }

    console.log(`[Scheduler] ✔ Done — emails sent:${sent} failed:${failed} skipped:${skipped}\n`);
  } catch (err) {
    console.error('[Scheduler] ✗ Fatal error:', err);
  }
}

// ─────────────────────────────────────────────────────────────
async function getRecipients(categoryId, rigNumber) {
  const { rows } = await query(`
    SELECT DISTINCT email FROM (
      SELECT ar.email
      FROM   alert_recipients ar
      WHERE  ar.category_id = $1
        AND  ar.is_active = TRUE
        AND  (ar.rig_number IS NULL OR ar.rig_number = $2)
      UNION
      SELECT email FROM global_recipients WHERE is_active = TRUE
    ) combined
  `, [categoryId, rigNumber || null]);
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

async function sentTodayOverdue(equipmentId, email) {
  const { rows } = await query(`
    SELECT id FROM alert_log
    WHERE equipment_id    = $1
      AND recipient_email = $2
      AND alert_type      = 'overdue'
      AND sent_at::date   = CURRENT_DATE
      AND status          = 'sent'
  `, [equipmentId, email]);
  return rows.length > 0;
}

async function trySendGrouped(email, subject, html, entries, alertType) {
  try {
    await sendEmail({ to: email, subject, html });

    // Log one entry per equipment item in the grouped email
    for (const entry of entries) {
      const days = alertType === 'overdue' ? -entry.daysOverdue : entry.daysUntilDue;
      await query(`
        INSERT INTO alert_log (equipment_id, recipient_email, days_before_due, alert_type, status)
        VALUES ($1,$2,$3,$4,'sent')
      `, [entry.item.id, email, days, alertType]);
    }

    console.log(`  ✉  ${alertType.toUpperCase()} grouped email → ${email} (${entries.length} items)`);
    return true;
  } catch (err) {
    for (const entry of entries) {
      const days = alertType === 'overdue' ? -entry.daysOverdue : entry.daysUntilDue;
      await query(`
        INSERT INTO alert_log (equipment_id, recipient_email, days_before_due, alert_type, status, error_message)
        VALUES ($1,$2,$3,$4,'failed',$5)
      `, [entry.item.id, email, days, alertType, err.message]);
    }
    console.error(`  ✗  Failed → ${email}: ${err.message}`);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
function startScheduler() {
  const expr = process.env.ALERT_CRON || '0 4 * * *';
  console.log(`[Scheduler] Cron set to "${expr}" (UTC)`);
  cron.schedule(expr, runAlertCheck);
}

module.exports = { startScheduler, runAlertCheck };
