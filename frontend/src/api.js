// ── API base URL ──────────────────────────────────────────────
// In production (Vercel): set VITE_API_URL in Vercel → Settings → Environment Variables
//   Value: https://your-backend.onrender.com/api   (no trailing slash)
//
// In local dev: leave VITE_API_URL empty — Vite proxy handles it via vite.config.js

const BASE = import.meta.env.VITE_API_URL || '/api';

// Warn in console if running in production without VITE_API_URL set
if (import.meta.env.PROD && !import.meta.env.VITE_API_URL) {
  console.error(
    '❌ VITE_API_URL is not set!\n' +
    'Go to Vercel → your project → Settings → Environment Variables\n' +
    'Add: VITE_API_URL = https://your-backend.onrender.com/api\n' +
    'Then redeploy.'
  );
}

export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('it_token');
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${BASE}${path}`, { ...options, headers });
  } catch (networkErr) {
    // Network-level failure (CORS preflight blocked, server down, etc.)
    console.error('Network error hitting:', `${BASE}${path}`);
    console.error('Error:', networkErr.message);
    console.error('VITE_API_URL is:', import.meta.env.VITE_API_URL || '(not set — using /api proxy)');
    throw new Error(
      'Cannot reach the server. ' +
      'Check that VITE_API_URL in Vercel matches your Render backend URL exactly, ' +
      'then redeploy Vercel.'
    );
  }

  // Token expired → force logout
  if (res.status === 401) {
    localStorage.removeItem('it_token');
    localStorage.removeItem('it_user');
    window.location.href = '/login';
    return;
  }

  // Handle empty responses gracefully
  const text = await res.text();
  if (!text) {
    if (!res.ok) throw new Error(`Server returned ${res.status} with empty body`);
    return {};
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    console.error('Non-JSON response from server:', text.slice(0, 200));
    throw new Error('Server returned an unexpected response. Check Render logs.');
  }

  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  get:    (path)       => apiFetch(path),
  post:   (path, body) => apiFetch(path, { method: 'POST',   body: JSON.stringify(body) }),
  put:    (path, body) => apiFetch(path, { method: 'PUT',    body: JSON.stringify(body) }),
  delete: (path)       => apiFetch(path, { method: 'DELETE' }),
};
