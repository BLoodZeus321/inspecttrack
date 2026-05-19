require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');
const { pool }  = require('./db/pool');
const { startScheduler } = require('./services/alertScheduler');

const app  = express();
const PORT = process.env.PORT || 4000;

// ── Security ──────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: [
    process.env.FRONTEND_URL,
    'http://localhost:3000',
    'http://localhost:5173',
  ].filter(Boolean),
  credentials: true,
}));
app.use(express.json({ limit: '5mb' }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 500 }));

// ── Routes ────────────────────────────────────────────────────
app.use('/api/auth',        require('./routes/auth'));
app.use('/api/equipment',   require('./routes/equipment'));
app.use('/api/inspections', require('./routes/inspections'));
app.use('/api/categories',  require('./routes/categories'));
app.use('/api/dashboard',   require('./routes/dashboard'));

// ── Health check ──────────────────────────────────────────────
app.get('/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() AS now');
    res.json({
      status: 'ok',
      db: 'connected',
      db_time: result.rows[0].now,
      app_time: new Date().toISOString(),
      node: process.version,
    });
  } catch (err) {
    // Return the real error so you can diagnose it
    res.status(503).json({
      status: 'error',
      db: 'disconnected',
      error: err.message,
      hint: 'Check DATABASE_URL in Railway Variables. Must include ?sslmode=require or pool uses ssl:{rejectUnauthorized:false}',
    });
  }
});

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅  InspectTrack API running on port ${PORT}`);
  console.log(`🌍  Environment: ${process.env.NODE_ENV}`);
  startScheduler();
});

module.exports = app;
