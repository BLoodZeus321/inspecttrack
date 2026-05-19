const { Pool } = require('pg');

// ── Supabase requires the connection string on port 5432
// ── with SSL enabled but certificate not verified.
// ── Railway injects DATABASE_URL automatically if you add
// ── a Postgres plugin — but for Supabase you set it manually.

// Parse the DATABASE_URL and force correct SSL settings.
// This handles all three Supabase connection string formats:
//   postgresql://postgres:[PASS]@db.[REF].supabase.co:5432/postgres
//   postgres://postgres:[PASS]@db.[REF].supabase.co:5432/postgres
//   postgresql://postgres.[REF]:[PASS]@aws-0-[REGION].pooler.supabase.com:6543/postgres  ← pooler

function buildConfig() {
  const url = process.env.DATABASE_URL;

  if (!url) {
    console.error('❌  DATABASE_URL is not set! Add it to your Railway environment variables.');
    process.exit(1);
  }

  // Always force SSL for Supabase — rejectUnauthorized:false
  // because Supabase uses a self-signed cert chain that Node rejects by default.
  return {
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    max: 10,
    min: 1,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,  // raised from 5s → 10s for Railway cold starts
    allowExitOnIdle: false,
  };
}

const pool = new Pool(buildConfig());

pool.on('error', (err) => {
  console.error('❌  Unexpected DB pool error:', err.message);
});

// ── Verified query wrapper ────────────────────────────────────
const query = (text, params) => pool.query(text, params);

// ── Test connection on startup ────────────────────────────────
async function testConnection() {
  try {
    const res = await pool.query('SELECT NOW() AS now');
    console.log(`✅  Database connected — server time: ${res.rows[0].now}`);
  } catch (err) {
    console.error('❌  Database connection failed:', err.message);
    console.error('    Check your DATABASE_URL in Railway → Variables.');
    console.error('    It should look like:');
    console.error('    postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres');
  }
}

testConnection();

module.exports = { query, pool };
