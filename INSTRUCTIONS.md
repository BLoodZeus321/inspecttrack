# InspectTrack — Complete Instructions
## Equipment Inspection Management System

---

## ARCHITECTURE

```
Your Browser
     │
     ▼
Vercel (React Frontend) ──► Render (Node.js API + Scheduler)
                                      │
                                      ▼
                               Supabase (PostgreSQL)
                               Brevo (Email via API)
```

All services are FREE tier. No servers to manage.

---

## PART 1 — SUPABASE (DATABASE)

### 1.1 Create Account
1. Go to https://supabase.com → Sign Up
2. Click **New Project**
3. Name: `inspecttrack`
4. Database Password: choose a strong password → **save it**
5. Region: **Middle East (Bahrain)**
6. Click **Create new project** → wait 2 minutes

### 1.2 Run the Schema
1. Click **SQL Editor** in left sidebar → **New query**
2. Open `backend/db/schema.sql` from this project
3. Copy the entire contents → paste → click **Run**
4. You should see: `Success. No rows returned`

### 1.3 Get Connection String
1. **Project Settings** (gear icon) → **Database**
2. Scroll to **Connection Pooling** section
3. Copy the **Connection string** — looks like:
   `postgresql://postgres.xxxx:PASSWORD@aws-0-xxx.pooler.supabase.com:6543/postgres`
4. Replace `PASSWORD` with your actual database password
5. **Save this** — needed for Render

---

## PART 2 — GITHUB (CODE REPOSITORY)

### 2.1 Create GitHub Repository
1. Go to https://github.com → **New repository**
2. Name: `inspecttrack`, set to **Private**
3. Click **Create repository**

### 2.2 Push Code
Open terminal in the `inspecttrack` folder:

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/inspecttrack.git
git branch -M main
git push -u origin main
```

---

## PART 3 — RENDER (BACKEND API)

### 3.1 Create Account
Go to https://render.com → **Sign Up with GitHub**

### 3.2 Create Web Service
1. Click **New → Web Service**
2. Connect GitHub → select `inspecttrack` repo
3. Configure:
   - **Name**: `inspecttrack-backend`
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: Free

### 3.3 Set Environment Variables
Click **Environment** tab → add ALL of these:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Your Supabase pooler connection string |
| `JWT_SECRET` | Random 64-char string (get from: https://generate-secret.vercel.app/64) |
| `JWT_EXPIRES_IN` | `7d` |
| `FRONTEND_URL` | `https://your-app.vercel.app` (update after Step 4) |
| `BREVO_API_KEY` | Your Brevo API key (see Part 5) |
| `SMTP_FROM` | `alerts@yourcompany.com` |
| `SMTP_FROM_NAME` | `InspectTrack Alerts` |
| `APP_URL` | `https://your-app.vercel.app` (update after Step 4) |
| `ALERT_CRON` | `0 4 * * *` (4AM UTC = 7AM Qatar time) |

4. Click **Create Web Service** → wait for deploy
5. Copy your Render URL (e.g. `https://inspecttrack-backend.onrender.com`)

### 3.4 Verify Backend
Open in browser: `https://inspecttrack-backend.onrender.com/health`
Should return: `{"status":"ok","db":"connected"}`

---

## PART 4 — VERCEL (FRONTEND)

### 4.1 Create Account
Go to https://vercel.com → **Sign Up with GitHub**

### 4.2 Deploy
1. Click **Add New Project** → import `inspecttrack` repo
2. Configure:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
3. Add Environment Variable:
   - `VITE_API_URL` = `https://inspecttrack-backend.onrender.com/api`
4. Click **Deploy** → wait ~2 minutes
5. Copy your Vercel URL (e.g. `https://inspecttrack-xyz.vercel.app`)

### 4.3 Update Render with Vercel URL
Render → Environment → update:
- `FRONTEND_URL` = your Vercel URL
- `APP_URL` = your Vercel URL
Render auto-redeploys.

---

## PART 5 — BREVO (EMAIL ALERTS)

### 5.1 Create Account
Go to https://brevo.com → Sign Up (free — 300 emails/day)

### 5.2 Get API Key
1. Top right → your name → **SMTP & API**
2. Click **API Keys** tab → **Generate a new API key**
3. Name it `inspecttrack` → copy the key
4. Add to Render: `BREVO_API_KEY` = `xkeysib-xxxx...`

### 5.3 Verify Sender Email
1. Brevo → **Senders & IP** → **Senders** → **Add a Sender**
2. Add the email you set as `SMTP_FROM` → verify it

---

## PART 6 — UPTIMEROBOT (KEEP SERVER AWAKE)

Render free tier sleeps after 15 min of inactivity.
UptimeRobot pings your server every 5 min to keep it awake.

1. Go to https://uptimerobot.com → Sign Up (free)
2. **Add New Monitor**:
   - Monitor Type: **HTTP(s)**
   - Friendly Name: `InspectTrack`
   - URL: `https://inspecttrack-backend.onrender.com/health`
   - Monitoring Interval: **5 minutes**
3. Click **Create Monitor**

---

## PART 7 — FIRST TIME SETUP IN THE APP

### 7.1 Create Admin Account
1. Open your Vercel URL → click **Register**
2. Enter name, email, password → **Create Account**
3. First registered user is automatically Admin

### 7.2 Default Categories (pre-configured)
- Fire Extinguisher — Annual, alert at 60/30/7 days before
- Lifting Equipment — 6-monthly, alert at 30/14/3 days before
- Pressure Vessel — Quarterly, alert at 21/7 days before
- PPE — Annual, alert at 30/14 days before
- Electrical Tools — Annual, alert at 30/7 days before
- Hand Tools — 2-yearly, alert at 60/30 days before
- Vehicle / Forklift — Annual, alert at 45/30/14 days before

### 7.3 Set Up Alert Recipients
1. Go to **Categories & Alerts**
2. Click a category → add emails on the right panel
3. Set **Rig** to a specific rig to only receive alerts for that rig,
   or leave as "All Rigs" to receive alerts for all rigs
4. Repeat for each category

### 7.4 Add Equipment — Excel Import (recommended)
1. Go to **Import** in the navbar
2. Click **Download Template** → open in Excel
3. Fill the "Equipment Data" sheet:

| Column | Required | Notes |
|---|---|---|
| Equipment / Tool Name | YES | |
| Serial Number | YES | Must be unique per category |
| Category | YES | Must match exactly (case-sensitive) |
| Rig / Location | YES | BHDC-67/68/117/118/BHDC-YARD or custom |
| Asset Tag | no | |
| Manufacturer | no | |
| Model | no | |
| Purchase Date | no | Format: YYYY-MM-DD |
| Notes | no | |

4. Upload file → **Validate Data**
5. All errors shown at once — fix in Excel → re-upload
6. Once 0 errors → **Import**

### 7.5 Log First Inspection
Equipment & Tools → click equipment → **+ Log Inspection**
Next due date is auto-calculated from category interval.

### 7.6 Test Email
Dashboard → **📧 Test Email** → enter your email → check inbox

---

## PART 8 — HOW ALERTS WORK

The scheduler runs every day at **7:00 AM Qatar time** (4AM UTC).

Example — Lifting Equipment (6-monthly, alert at 30/14/3 days):
- 30 days before due → email sent
- 14 days before due → email sent again
- 3 days before due → urgent email sent
- Due date passes → daily overdue email until inspected

Each email contains: equipment name, serial number, rig/location,
category, due date, days remaining, and a link to log the inspection.

Recipients are matched by:
1. Category-specific recipients for that rig (or "All Rigs")
2. Global recipients (receive ALL alerts regardless of category/rig)

---

## PART 9 — USER ROLES

| Role | Can Do |
|---|---|
| Admin | Everything — manage users, categories, equipment, import, log inspections |
| Inspector | Add equipment, log inspections, import, view everything |
| Viewer | View only — no editing or importing |

To invite team members: share your Vercel URL → they register →
you go to **Users** page → change their role from viewer to inspector.

---

## PART 10 — TROUBLESHOOTING

| Problem | Fix |
|---|---|
| Login fails | Make sure you registered first (Register tab) |
| Health check shows DB disconnected | Check DATABASE_URL in Render — use pooler URL (port 6543) |
| Emails not arriving | Dashboard → Test Email → check error message |
| Alerts not sending | Check Alert Logs for Failed entries. Run Debug check from browser console |
| Categories/Alerts page blank | Hard refresh browser (Ctrl+Shift+R). Check Vercel has latest code |
| Import fails | Check category names match exactly. Check serial+category not duplicate |
| Server sleeping | Set up UptimeRobot if not done yet |

### If daily alerts missed a day
1. Supabase SQL Editor: `DELETE FROM alert_log WHERE status = 'failed';`
2. Dashboard → Run Alert Check

### Check what scheduler sees (debug)
Run in browser console:
```javascript
fetch('https://inspecttrack-backend.onrender.com/api/dashboard/debug-alerts', {
  headers: { 'Authorization': 'Bearer ' + localStorage.getItem('it_token') }
}).then(r => r.json()).then(d => console.log(JSON.stringify(d, null, 2)))
```

---

## QUICK REFERENCE

### Render Environment Variables
```
NODE_ENV          = production
DATABASE_URL      = postgresql://postgres.xxx:PASS@aws-xxx.pooler.supabase.com:6543/postgres
JWT_SECRET        = (64-char random string)
JWT_EXPIRES_IN    = 7d
FRONTEND_URL      = https://your-app.vercel.app
APP_URL           = https://your-app.vercel.app
BREVO_API_KEY     = xkeysib-xxxxxxxxxxxx
SMTP_FROM         = alerts@yourcompany.com
SMTP_FROM_NAME    = InspectTrack Alerts
ALERT_CRON        = 0 4 * * *
```

### Vercel Environment Variables
```
VITE_API_URL = https://inspecttrack-backend.onrender.com/api
```

### Cron Schedule Reference
```
0 4 * * *  = 4AM UTC = 7AM Qatar (UTC+3)
0 3 * * *  = 3AM UTC = 6AM Qatar
0 5 * * *  = 5AM UTC = 8AM Qatar
```

### Push code updates
```bash
git add .
git commit -m "describe change"
git push
# Render and Vercel auto-redeploy in ~2 minutes
```

### Run database migration (if a new .sql file is provided)
Supabase → SQL Editor → paste contents → Run
