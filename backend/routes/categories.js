const router  = require('express').Router();
const Joi     = require('joi');
const { query } = require('../db/pool');
const { authenticate, requireAdmin } = require('../middleware/auth');

// ── Global Recipients (MUST be before /:id routes) ───────────

router.get('/global/recipients', authenticate, async (req, res) => {
  const { rows } = await query('SELECT * FROM global_recipients ORDER BY name');
  res.json({ data: rows });
});

router.post('/global/recipients', authenticate, requireAdmin, async (req, res) => {
  const { email, name } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  try {
    const { rows } = await query(`
      INSERT INTO global_recipients (email, name) VALUES ($1,$2)
      ON CONFLICT (email) DO UPDATE SET name=$2 RETURNING *
    `, [email.toLowerCase(), name]);
    res.status(201).json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/global/recipients/:id', authenticate, requireAdmin, async (req, res) => {
  await query('DELETE FROM global_recipients WHERE id=$1', [req.params.id]);
  res.json({ message: 'Removed' });
});

// GET /api/categories
router.get('/', authenticate, async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT c.*,
        COUNT(e.id)::int AS equipment_count
      FROM categories c
      LEFT JOIN equipment e ON e.category_id = c.id AND e.status = 'active'
      GROUP BY c.id ORDER BY c.name
    `);
    res.json({ data: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/categories  (admin)
router.post('/', authenticate, requireAdmin, async (req, res) => {
  const schema = Joi.object({
    name:                     Joi.string().max(100).required(),
    description:              Joi.string().allow('', null),
    inspection_interval_days: Joi.number().integer().min(1).required(),
    alert_lead_days:          Joi.array().items(Joi.number().integer().min(1)).min(1).required(),
    color:                    Joi.string().max(7).default('#3B82F6'),
  });
  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  try {
    const { rows } = await query(`
      INSERT INTO categories (name, description, inspection_interval_days, alert_lead_days, color)
      VALUES ($1,$2,$3,$4,$5) RETURNING *
    `, [value.name, value.description, value.inspection_interval_days, value.alert_lead_days, value.color]);
    res.status(201).json({ data: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Category name already exists' });
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/categories/:id  (admin)
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  const { name, description, inspection_interval_days, alert_lead_days, color } = req.body;
  try {
    const { rows } = await query(`
      UPDATE categories SET
        name                     = COALESCE($1, name),
        description              = COALESCE($2, description),
        inspection_interval_days = COALESCE($3, inspection_interval_days),
        alert_lead_days          = COALESCE($4, alert_lead_days),
        color                    = COALESCE($5, color),
        updated_at               = NOW()
      WHERE id = $6 RETURNING *
    `, [name, description, inspection_interval_days, alert_lead_days, color, req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/categories/:id  (admin)
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { rowCount } = await query('DELETE FROM categories WHERE id=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Alert Recipients per category ─────────────────────────────

// GET /api/categories/:id/recipients
router.get('/:id/recipients', authenticate, async (req, res) => {
  const { rows } = await query(
    'SELECT * FROM alert_recipients WHERE category_id=$1 ORDER BY name',
    [req.params.id]
  );
  res.json({ data: rows });
});

// POST /api/categories/:id/recipients  (admin)
router.post('/:id/recipients', authenticate, requireAdmin, async (req, res) => {
  const { email, name } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  try {
    const { rows } = await query(`
      INSERT INTO alert_recipients (category_id, email, name)
      VALUES ($1,$2,$3) ON CONFLICT (category_id, email) DO NOTHING RETURNING *
    `, [req.params.id, email.toLowerCase(), name]);
    res.status(201).json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/categories/:id/recipients/:rid  (admin)
router.delete('/:id/recipients/:rid', authenticate, requireAdmin, async (req, res) => {
  await query('DELETE FROM alert_recipients WHERE id=$1 AND category_id=$2',
    [req.params.rid, req.params.id]);
  res.json({ message: 'Removed' });
});

module.exports = router;
