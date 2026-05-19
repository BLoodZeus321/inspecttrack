const router  = require('express').Router();
const Joi     = require('joi');
const { query } = require('../db/pool');
const { authenticate, requireInspector } = require('../middleware/auth');

// POST /api/inspections
router.post('/', authenticate, requireInspector, async (req, res) => {
  const schema = Joi.object({
    equipment_id:    Joi.string().uuid().required(),
    inspected_by:    Joi.string().max(100).required(),
    inspection_date: Joi.date().required(),
    result:          Joi.string().valid('pass','fail','conditional').required(),
    notes:           Joi.string().allow('', null),
  });
  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  try {
    // Auto-compute next due date from category interval
    const { rows: cat } = await query(`
      SELECT c.inspection_interval_days
      FROM equipment e
      JOIN categories c ON c.id = e.category_id
      WHERE e.id = $1
    `, [value.equipment_id]);

    const interval = cat[0]?.inspection_interval_days ?? 365;
    const nextDue  = new Date(value.inspection_date);
    nextDue.setDate(nextDue.getDate() + interval);

    const { rows } = await query(`
      INSERT INTO inspections
        (equipment_id, inspected_by, inspection_date, next_due_date, result, notes, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
    `, [value.equipment_id, value.inspected_by, value.inspection_date,
        nextDue.toISOString().split('T')[0], value.result, value.notes, req.user.id]);

    res.status(201).json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/inspections?equipment_id=xxx
router.get('/', authenticate, async (req, res) => {
  try {
    const { equipment_id } = req.query;
    const { rows } = await query(`
      SELECT i.*, e.name AS equipment_name, e.asset_tag
      FROM inspections i
      JOIN equipment e ON e.id = i.equipment_id
      ${equipment_id ? 'WHERE i.equipment_id = $1' : ''}
      ORDER BY i.inspection_date DESC LIMIT 100
    `, equipment_id ? [equipment_id] : []);
    res.json({ data: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/inspections/:id  (admin only)
router.delete('/:id', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  try {
    const { rowCount } = await query('DELETE FROM inspections WHERE id=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
