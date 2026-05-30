const router  = require('express').Router();
const Joi     = require('joi');
const { query } = require('../db/pool');
const { authenticate, requireRepresentative } = require('../middleware/auth');

const RIG_LOCATIONS = ['BHDC-67','BHDC-68','BHDC-117','BHDC-118','BHDC-YARD'];

const schema = Joi.object({
  name:          Joi.string().max(200).required(),
  asset_tag:     Joi.string().max(100).allow('', null),
  serial_number: Joi.string().max(100).required(),
  category_id:   Joi.string().uuid().allow(null),
  location:      Joi.string().max(200).required(),
  manufacturer:  Joi.string().max(100).allow('', null),
  model:         Joi.string().max(100).allow('', null),
  purchase_date: Joi.date().allow(null),
  status:        Joi.string().valid('active','retired','under_repair').default('active'),
  notes:         Joi.string().allow('', null),
  rig_number:    Joi.string().max(50).allow('', null),
});

// GET /api/equipment
router.get('/', authenticate, async (req, res) => {
  try {
    const { search, alert_status, category, status, rig } = req.query;
    let conditions = ["e.status != 'retired'"], params = [], i = 1;

    if (search)       { conditions.push(`(e.name ILIKE $${i} OR e.asset_tag ILIKE $${i})`); params.push(`%${search}%`); i++; }
    if (alert_status) { conditions.push(`es.alert_status = $${i++}`); params.push(alert_status); }
    if (category)     { conditions.push(`c.name ILIKE $${i++}`); params.push(`%${category}%`); }
    if (status)       { conditions.push(`e.status = $${i++}`); params.push(status); }
    if (rig)          { conditions.push(`e.rig_number = $${i++}`); params.push(rig); }
    if (req.query.include_retired === 'true') conditions = conditions.filter(c => !c.includes('retired'));

    const where = 'WHERE ' + conditions.join(' AND ');
    const { rows } = await query(`
      SELECT es.*, e.manufacturer, e.model, e.purchase_date, e.notes, e.created_at
      FROM equipment_status es
      JOIN equipment e ON e.id = es.id
      LEFT JOIN categories c ON e.category_id = c.id
      ${where}
      ORDER BY
        CASE es.alert_status
          WHEN 'failed'          THEN 1
          WHEN 'overdue'         THEN 2
          WHEN 'conditional'     THEN 3
          WHEN 'critical'        THEN 4
          WHEN 'warning'         THEN 5
          WHEN 'never_inspected' THEN 6
          ELSE 7
        END, es.next_due_date ASC NULLS LAST
    `, params);
    res.json({ data: rows, total: rows.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/equipment/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT es.*, e.manufacturer, e.model, e.purchase_date, e.notes,
             c.alert_lead_days, c.inspection_interval_days
      FROM equipment_status es
      JOIN equipment e ON e.id = es.id
      LEFT JOIN categories c ON e.category_id = c.id
      WHERE es.id = $1
    `, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });

    const { rows: inspections } = await query(`
      SELECT i.*, u.name AS logged_by_name
      FROM inspections i
      LEFT JOIN users u ON u.id = i.created_by
      WHERE i.equipment_id = $1
      ORDER BY i.inspection_date DESC LIMIT 50
    `, [req.params.id]);

    const { rows: alertHistory } = await query(`
      SELECT * FROM alert_log WHERE equipment_id = $1 ORDER BY sent_at DESC LIMIT 20
    `, [req.params.id]);

    res.json({ data: rows[0], inspections, alertHistory });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/equipment
router.post('/', authenticate, requireRepresentative, async (req, res) => {
  const { error, value } = schema.validate(req.body, { stripUnknown: true });
  if (error) return res.status(400).json({ error: error.details[0].message });
  try {
    const { rows } = await query(`
      INSERT INTO equipment
        (name,asset_tag,serial_number,category_id,location,rig_number,manufacturer,model,purchase_date,status,notes,created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *
    `, [value.name,value.asset_tag,value.serial_number,value.category_id,value.location,
        value.rig_number,value.manufacturer,value.model,value.purchase_date,value.status,value.notes,req.user.id]);
    res.status(201).json({ data: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Asset tag already exists' });
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/equipment/:id
router.put('/:id', authenticate, requireRepresentative, async (req, res) => {
  const { error, value } = schema.validate(req.body, { stripUnknown: true });
  if (error) return res.status(400).json({ error: error.details[0].message });
  try {
    const { rows } = await query(`
      UPDATE equipment SET
        name=$1,asset_tag=$2,serial_number=$3,category_id=$4,location=$5,
        rig_number=$6,manufacturer=$7,model=$8,purchase_date=$9,status=$10,notes=$11,updated_at=NOW()
      WHERE id=$12 RETURNING *
    `, [value.name,value.asset_tag,value.serial_number,value.category_id,value.location,
        value.rig_number,value.manufacturer,value.model,value.purchase_date,value.status,value.notes,req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/equipment/:id  (admin only)
router.delete('/:id', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  try {
    const { rowCount } = await query('DELETE FROM equipment WHERE id=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
