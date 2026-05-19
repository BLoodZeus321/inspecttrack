const router = require('express').Router();
const { query } = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const { runAlertCheck } = require('../services/alertScheduler');

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

// POST /api/dashboard/trigger-alerts  (admin — for manual testing)
router.post('/trigger-alerts', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  runAlertCheck().catch(console.error);
  res.json({ message: 'Alert check triggered. Watch server logs.' });
});

module.exports = router;
