const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const Joi     = require('joi');
const { query } = require('../db/pool');
const { authenticate } = require('../middleware/auth');

function sign(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// ── POST /api/auth/register ───────────────────────────────────
// First user becomes admin automatically
router.post('/register', async (req, res) => {
  const schema = Joi.object({
    name:     Joi.string().min(2).max(100).required(),
    email:    Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    role:     Joi.string().valid('admin','representative','viewer').default('viewer'),
  });
  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  try {
    // Check if this is the very first user → make admin
    const { rows: count } = await query('SELECT COUNT(*) FROM users');
    const isFirst = parseInt(count[0].count) === 0;

    const hash = await bcrypt.hash(value.password, 12);
    const role = isFirst ? 'admin' : value.role;

    const { rows } = await query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4) RETURNING id, name, email, role`,
      [value.name, value.email, hash, role]
    );
    const user = rows[0];
    res.status(201).json({ token: sign(user), user });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already registered' });
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  try {
    const { rows } = await query(
      'SELECT id, name, email, role, password_hash, is_active FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    const user = rows[0];
    if (!user || !user.is_active) return res.status(401).json({ error: 'Invalid email or password' });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid email or password' });

    const { password_hash, ...safe } = user;
    res.json({ token: sign(safe), user: safe });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT id, name, email, role, is_active, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({ user: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/auth/change-password ─────────────────────────────
router.put('/change-password', authenticate, async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) return res.status(400).json({ error: 'Both fields required' });
  if (new_password.length < 8) return res.status(400).json({ error: 'New password must be 8+ characters' });

  try {
    const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const match = await bcrypt.compare(current_password, rows[0].password_hash);
    if (!match) return res.status(401).json({ error: 'Current password is incorrect' });

    const hash = await bcrypt.hash(new_password, 12);
    await query('UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2', [hash, req.user.id]);
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/auth/users (admin only) ─────────────────────────
router.get('/users', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  try {
    const { rows } = await query(
      'SELECT id, name, email, role, is_active, created_at FROM users ORDER BY created_at DESC'
    );
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/auth/users/:id (admin only) ─────────────────────
router.put('/users/:id', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { name, role, is_active } = req.body;
  try {
    const { rows } = await query(
      `UPDATE users SET
        name      = COALESCE($1, name),
        role      = COALESCE($2, role),
        is_active = COALESCE($3, is_active),
        updated_at = NOW()
       WHERE id = $4 RETURNING id, name, email, role, is_active`,
      [name, role, is_active, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({ data: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
