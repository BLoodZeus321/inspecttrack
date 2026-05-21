require('dotenv').config();

// Log uncaught crashes clearly in Render logs
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err.message);
  console.error(err.stack);
});
process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION:', reason);
});
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
// Open CORS — allows all origins
// This is safe for an internal tool behind login (JWT protects all data routes)
app.use(cors({ origin: true, credentials: true }));
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
  keepAlive();
});

// Keep-alive for Render free tier
// Uses http module (built-in) instead of fetch — works on all Node versions
function keepAlive() {
  if (!process.env.RENDER_INTERNAL_HOSTNAME) return;
  const http = require('http');
  setInterval(() => {
    http.get(`http://localhost:${PORT}/health`, (res) => {
      console.log(`[KeepAlive] ping ${res.statusCode} - ${new Date().toISOString()}`);
    }).on('error', (e) => {
      console.warn('[KeepAlive] failed:', e.message);
    });
  }, 14 * 60 * 1000);
  console.log('[KeepAlive] started - pinging every 14 min');
}

module.exports = app;
