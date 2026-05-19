#!/usr/bin/env node
/**
 * InspectTrack — Database Connection Diagnostic
 *
 * Run this on Railway to diagnose why DB is disconnected:
 *   node db/diagnose.js
 *
 * Or locally:
 *   DATABASE_URL="your_url_here" node db/diagnose.js
 */

require('dotenv').config();
const { Client } = require('pg');

async function diagnose() {
  console.log('\n═══════════════════════════════════════════');
  console.log('  InspectTrack — DB Connection Diagnostic');
  console.log('═══════════════════════════════════════════\n');

  const url = process.env.DATABASE_URL;

  // ── 1. Check env var exists ──────────────────────────────
  if (!url) {
    console.error('❌  DATABASE_URL is not set!');
    console.error('    → Go to Railway → your backend service → Variables');
    console.error('    → Add DATABASE_URL with your Supabase connection string');
    process.exit(1);
  }

  // ── 2. Parse and display (without password) ──────────────
  try {
    const parsed = new URL(url);
    console.log('📋  Connection string breakdown:');
    console.log(`    Protocol : ${parsed.protocol}`);
    console.log(`    Host     : ${parsed.hostname}`);
    console.log(`    Port     : ${parsed.port || '5432 (default)'}`);
    console.log(`    Database : ${parsed.pathname.replace('/', '')}`);
    console.log(`    User     : ${parsed.username}`);
    console.log(`    Password : ${'*'.repeat(Math.min(parsed.password.length, 8))} (${parsed.password.length} chars)\n`);

    if (parsed.password === '[YOUR-PASSWORD]' || parsed.password === 'your-password') {
      console.error('❌  You forgot to replace [YOUR-PASSWORD] in the connection string!');
      console.error('    → Copy your actual database password from Supabase → Settings → Database → Reset Database Password');
      process.exit(1);
    }

    if (parsed.hostname.includes('[PROJECT-REF]')) {
      console.error('❌  You forgot to replace [PROJECT-REF] with your actual Supabase project reference!');
      process.exit(1);
    }
  } catch (e) {
    console.error('❌  DATABASE_URL is not a valid URL:', e.message);
    console.error('    It should look like: postgresql://postgres:PASSWORD@db.XXXXX.supabase.co:5432/postgres');
    process.exit(1);
  }

  // ── 3. Try connecting without SSL ─────────────────────────
  console.log('🔌  Testing connection without SSL...');
  const clientNoSSL = new Client({ connectionString: url, ssl: false });
  try {
    await clientNoSSL.connect();
    await clientNoSSL.end();
    console.log('    ✅ Connected without SSL\n');
  } catch (e) {
    console.log(`    ℹ  Without SSL: ${e.message}`);
  }

  // ── 4. Try connecting with SSL (rejectUnauthorized: false) ─
  console.log('🔐  Testing connection with SSL (rejectUnauthorized: false)...');
  const clientSSL = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });
  try {
    await clientSSL.connect();
    const res = await clientSSL.query('SELECT NOW() as now, version() as version');
    console.log(`    ✅ Connected with SSL!`);
    console.log(`    🕐 Server time : ${res.rows[0].now}`);
    console.log(`    🐘 PostgreSQL  : ${res.rows[0].version.split(' ').slice(0,2).join(' ')}`);
    await clientSSL.end();

    console.log('\n✅  DATABASE IS WORKING CORRECTLY');
    console.log('    The pool.js in your app uses ssl:{rejectUnauthorized:false}');
    console.log('    If health check still shows disconnected, redeploy Railway.\n');
    process.exit(0);
  } catch (e) {
    console.error(`    ❌ With SSL: ${e.message}\n`);
  }

  // ── 5. Try pooler port 6543 ───────────────────────────────
  console.log('🔄  Trying Supabase connection pooler (port 6543)...');
  try {
    const poolerUrl = url.replace(':5432/', ':6543/');
    const clientPooler = new Client({ connectionString: poolerUrl, ssl: { rejectUnauthorized: false } });
    await clientPooler.connect();
    console.log('    ✅ Pooler connection works!');
    console.log('    → Change your DATABASE_URL port from 5432 to 6543');
    await clientPooler.end();
  } catch (e) {
    console.error(`    ❌ Pooler: ${e.message}`);
  }

  console.log('\n═══════════════════════════════════════════');
  console.log('  TROUBLESHOOTING STEPS');
  console.log('═══════════════════════════════════════════');
  console.log('1. Go to Supabase → Settings → Database → Reset Database Password');
  console.log('   Copy the new password and update DATABASE_URL in Railway Variables');
  console.log('');
  console.log('2. Make sure you used the correct connection string format:');
  console.log('   postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres');
  console.log('');
  console.log('3. In Supabase → Settings → Database → Connection Pooling,');
  console.log('   try the Pooler connection string instead (port 6543)');
  console.log('');
  console.log('4. Check Supabase project is not paused (free tier pauses after 1 week idle)');
  console.log('   → Go to your Supabase project → you may see a "Resume project" button');
  console.log('═══════════════════════════════════════════\n');
  process.exit(1);
}

diagnose().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
