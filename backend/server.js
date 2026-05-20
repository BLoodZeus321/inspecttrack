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
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Render health checks)
    if (!origin) return callback(null, true);

    const allowed = [
      process.env.FRONTEND_URL,
      process.env.FRONTEND_URL_2,          // optional second frontend URL
      'http://localhost:3000',
      'http://localhost:5173',
    ].filter(Boolean);

    // Allow any Vercel preview URL for this project
    const isVercel = origin.endsWith('.vercel.app');
    const isAllowed = allowed.includes(origin) || isVercel;

    if (isAllowed) return callback(null, true);

    console.warn('[CORS] Blocked origin:', origin);
    console.warn('[CORS] Allowed origins:', allowed);
    callback(new Error('CORS: origin not allowed'));
  },
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
  keepAlive();
});

// Keep-alive for Render free tier
// Render spins down after 15 min idle. Pings every 14 min to prevent it.
// RENDER_INTERNAL_HOSTNAME is only set on Render - so this won't run locally.
function keepAlive() {
  if (!process.env.RENDER_INTERNAL_HOSTNAME) return;
  const url = `http://localhost:${PORT}/health`;
  setInterval(async () => {
    try {
      await fetch(url);
      console.log(`[KeepAlive] ping - ${new Date().toISOString()}`);
    } catch (e) {
      console.warn('[KeepAlive] failed:', e.message);
    }
  }, 14 * 60 * 1000);
  console.log('[KeepAlive] started - pinging every 14 min');
}

module.exports = app;
