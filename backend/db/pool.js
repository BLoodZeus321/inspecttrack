const { Pool } = require('pg');
const dns = require('dns');

// ── Force IPv4 DNS resolution ─────────────────────────────────
// Railway does not support IPv6. Supabase's direct connection URL
// (db.xxxx.supabase.co) now resolves to IPv6 → ENETUNREACH error.
// Setting dns.setDefaultResultOrder('ipv4first') forces Node to
// always prefer IPv4 addresses when resolving hostnames.
dns.setDefaultResultOrder('ipv4first');

const url = process.env.DATABASE_URL;

if (!url) {
  console.error('❌  DATABASE_URL is not set!');
  console.error('    Go to Railway → your service → Variables → add DATABASE_URL');
  console.error('    Use the Supabase POOLER connection string (Settings → Database → Connection Pooling)');
  process.exit(1);
}

// ── Detect which Supabase URL format is being used ────────────
const isPooler = url.includes('pooler.supabase.com');
console.log(`[DB] Using ${isPooler ? 'Supabase pooler (IPv4 ✅)' : 'direct connection'}`);

const pool = new Pool({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
  max: isPooler ? 10 : 5,
  min: 1,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,
  allowExitOnIdle: false,
});

pool.on('error', (err) => {
  console.error('❌  DB pool error:', err.message);
});

const query = (text, params) => pool.query(text, params);

// ── Test on startup ───────────────────────────────────────────
async function testConnection() {
  try {
    const res = await pool.query('SELECT NOW() AS now');
    console.log(`✅  Database connected — ${res.rows[0].now}`);
  } catch (err) {
    console.error('❌  Database connection failed:', err.message);
    if (err.message.includes('ENETUNREACH') || err.message.includes('IPv6')) {
      console.error('');
      console.error('    ▶ IPv6 issue detected. Fix:');
      console.error('    1. Go to Supabase → Settings → Database → Connection Pooling');
      console.error('    2. Copy the Pooler connection string (ends with pooler.supabase.com:6543)');
      console.error('    3. Update DATABASE_URL in Railway → Variables with that string');
    } else if (err.message.includes('password')) {
      console.error('    ▶ Wrong password. Reset at: Supabase → Settings → Database → Reset Password');
    } else if (err.message.includes('ECONNREFUSED')) {
      console.error('    ▶ Project may be paused. Go to Supabase dashboard and resume it.');
    }
  }
}

testConnection();

const getClient = () => pool.connect();

module.exports = { query, pool, getClient };
