# InspectTrack — Complete Setup & Deployment Guide
## Stack: Supabase (DB) + Railway (Backend) + Vercel (Frontend)
## All free tiers · No servers to manage

---

## What You'll Have After This Guide

```
Users (browser)
      │  HTTPS
      ▼
 ┌─────────────┐        ┌──────────────────┐
 │   Vercel    │  API   │    Railway.app    │
 │  (React UI) │◄──────►│  (Node.js API +  │
 │  FREE       │        │  Alert Scheduler) │
 └─────────────┘        └────────┬─────────┘
                                 │ SQL
                                 ▼
                        ┌──────────────────┐
                        │   Supabase.com   │
                        │  (PostgreSQL DB) │
                        │  FREE            │
                        └──────────────────┘
```

**Time needed:** About 30–45 minutes total.

---

## PART 1 — Supabase (Database)

### Step 1.1 — Create Supabase account
1. Go to **https://supabase.com** → click **Start your project**
2. Sign up with GitHub or email
3. Click **New Project**
4. Fill in:
   - **Name:** `inspecttrack`
   - **Database Password:** Choose a strong password — **save this, you'll need it**
   - **Region:** Middle East (Bahrain) — closest to Qatar
5. Click **Create new project** — wait ~2 minutes

### Step 1.2 — Run the database schema
1. In your Supabase project, click **SQL Editor** in the left sidebar
2. Click **New query**
3. Open the file `backend/db/schema.sql` from your project folder
4. Copy the **entire contents** and paste into the SQL editor
5. Click **Run** (or press Ctrl+Enter)
6. You should see: `Success. No rows returned`
7. Click **Table Editor** in the sidebar — you should see all your tables listed

### Step 1.3 — Get your connection string
1. Go to **Project Settings** (gear icon) → **Database**
2. Scroll down to **Connection string**
3. Select the **URI** tab
4. Copy the string — it looks like:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxxxxxx.supabase.co:5432/postgres
   ```
5. **Replace `[YOUR-PASSWORD]`** with the database password you chose in Step 1.1
6. **Save this string** — you'll paste it into Railway next

---

## PART 2 — Railway (Backend API)

### Step 2.1 — Push code to GitHub
First, put your project on GitHub (Railway deploys from GitHub):

```bash
# On your computer, open terminal in the inspecttrack folder
cd inspecttrack

# Initialize git
git init
git add .
git commit -m "Initial commit - InspectTrack"

# Create a new repo on github.com (name: inspecttrack)
# Then connect and push:
git remote add origin https://github.com/YOUR_USERNAME/inspecttrack.git
git branch -M main
git push -u origin main
```

### Step 2.2 — Create Railway account & project
1. Go to **https://railway.app** → **Login with GitHub**
2. Click **New Project** → **Deploy from GitHub repo**
3. Select your `inspecttrack` repository
4. Railway will detect it — click **Add service** or it may auto-detect

### Step 2.3 — Configure the backend service
1. Railway will try to deploy the root folder. We need to point it to `/backend`:
   - Click your service → **Settings** tab
   - Under **Source**, set **Root Directory** to: `backend`
   - Under **Deploy**, set **Start command** to: `node server.js`

2. Click **Variables** tab → **Add Variable** for each:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Your Supabase connection string from Step 1.3 |
| `JWT_SECRET` | Any 64-character random string (generate at: passwordsgenerator.net) |
| `JWT_EXPIRES_IN` | `7d` |
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | `https://your-app.vercel.app` *(update after Step 3)* |
| `SMTP_HOST` | Your email server (see Email Setup below) |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | Your email address |
| `SMTP_PASS` | Your email app password |
| `SMTP_FROM` | Your email address |
| `SMTP_FROM_NAME` | `InspectTrack Alerts` |
| `ALERT_CRON` | `0 7 * * *` *(7AM UTC = 10AM Qatar time)* |
| `APP_URL` | `https://your-app.vercel.app` *(update after Step 3)* |

3. Click **Deploy** — Railway builds and starts your backend
4. Once deployed, go to **Settings** → **Networking** → **Generate Domain**
5. **Copy your Railway URL** (e.g. `https://inspecttrack-backend.railway.app`)
6. Go back to **Variables** and update `FRONTEND_URL` and `APP_URL` with your final URLs

### Step 2.4 — Verify backend is running
Open in your browser:
```
https://your-backend.railway.app/health
```
You should see:
```json
{"status":"ok","db":"connected","time":"2024-..."}
```

---

## PART 3 — Vercel (Frontend)

### Step 3.1 — Create Vercel account
1. Go to **https://vercel.com** → **Sign Up with GitHub**
2. Click **Add New Project**
3. Import your `inspecttrack` GitHub repository

### Step 3.2 — Configure Vercel
1. Under **Framework Preset**, select **Vite**
2. Under **Root Directory**, click **Edit** and set: `frontend`
3. Under **Environment Variables**, add:

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://your-backend.railway.app/api` |

4. Click **Deploy** — Vercel builds and deploys your React app
5. Once done, you get a URL like: `https://inspecttrack-xyz.vercel.app`

### Step 3.3 — Update Railway with your Vercel URL
Go back to Railway → Variables and update:
- `FRONTEND_URL` → `https://inspecttrack-xyz.vercel.app`
- `APP_URL` → `https://inspecttrack-xyz.vercel.app`

Then click **Redeploy** in Railway.

---

## PART 4 — Email Setup (SMTP)

### Option A: Office 365 / Outlook (Recommended for companies)
```
SMTP_HOST = smtp.office365.com
SMTP_PORT = 587
SMTP_USER = alerts@yourcompany.com
SMTP_PASS = your_password
```
If you have Multi-Factor Authentication (MFA) enabled:
1. Go to https://myaccount.microsoft.com
2. Security → App passwords → Create new app password
3. Use that generated password as `SMTP_PASS`

### Option B: Gmail
1. Enable 2-Step Verification on your Google account
2. Go to: Google Account → Security → 2-Step Verification → App passwords
3. Select **Mail** → Generate
4. Use that 16-character password as `SMTP_PASS`
```
SMTP_HOST = smtp.gmail.com
SMTP_PORT = 587
SMTP_USER = you@gmail.com
SMTP_PASS = xxxx xxxx xxxx xxxx  (the 16-char app password)
```

### Option C: Free transactional email (no company email)
Use **Brevo** (formerly Sendinblue) — free 300 emails/day:
1. Sign up at https://brevo.com
2. Go to SMTP & API → SMTP tab
3. Use their SMTP settings

---

## PART 5 — First Login & Configuration

### Step 5.1 — Create your admin account
1. Open your Vercel URL in the browser
2. Click **Register** tab
3. Fill in your name, email, and password
4. Click **Create Account**
5. **The first registered user automatically becomes Admin**

### Step 5.2 — Configure categories and recipients
1. Click **Categories** in the navigation
2. You'll see 7 pre-configured categories (Fire Extinguisher, Lifting Equipment, etc.)
3. Click any category → Add email recipients on the right side
4. Add the global recipients section at the bottom for people who should get ALL alerts

### Step 5.3 — Add your equipment
1. Click **Equipment** → **+ Add Equipment**
2. Fill in the details — the most important fields are:
   - **Name** — clear descriptive name
   - **Category** — determines the inspection interval and who gets alerted
   - **Asset Tag** — your internal reference number
   - **Location** — where it physically is

### Step 5.4 — Log your first inspection
1. Click any equipment item
2. Click **+ Log Inspection**
3. Fill in inspector name, date, and result
4. The system automatically calculates the next due date based on the category interval

### Step 5.5 — Test email alerts
1. Go to **Dashboard**
2. Click **▷ Run Alert Check** (visible to admins only)
3. Check your email — if any equipment is within an alert window, emails should arrive
4. Check **Alert Logs** page to see what was sent

---

## PART 6 — Invite Your Team

Share the Vercel URL with colleagues. They can:
1. Click **Register** and create their own account
2. Default role is **viewer** (read-only)
3. You (as Admin) go to **Users** page and change their role to **inspector** if they need to log inspections

**Roles:**
| Role | Can Do |
|------|--------|
| Admin | Everything — manage users, categories, equipment, log inspections |
| Inspector | Add equipment, log inspections, view everything |
| Viewer | View all data, no editing |

---

## Understanding Alert Schedule Logic

The scheduler runs **every day at 7 AM UTC** (10 AM Qatar time).

**Example — Fire Extinguisher (Annual, alerts at 60/30/7 days):**
```
Inspection due: 15 March 2025

→ 14 January 2025 (60 days before) → Email sent to fire safety team
→ 13 February 2025 (30 days before) → Email sent again
→ 8 March 2025 (7 days before) → Urgent email sent
→ 15 March 2025 onwards → Daily overdue emails until inspected
```

**Each alert email contains:**
- Equipment name, asset tag, category, location
- Due date and days remaining (or days overdue)
- Last inspection date and inspector
- Direct link to log a new inspection

---

## Updating the App After Code Changes

```bash
# Make your changes locally, then:
git add .
git commit -m "describe your change"
git push

# Railway and Vercel auto-deploy from GitHub — no manual steps needed!
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Login says "Invalid email or password" | Make sure you registered first (Register tab) |
| Backend health check fails | Check Railway logs → Variables tab, ensure DATABASE_URL is correct |
| Emails not arriving | Go to Alert Logs page, check status column for "Failed" errors. Common fix: use an App Password instead of your main email password |
| Frontend shows "Network Error" | Check VITE_API_URL in Vercel matches your Railway URL exactly (no trailing slash) |
| CORS error in browser | Add your Vercel URL to `FRONTEND_URL` in Railway Variables and redeploy |
| Database error on first start | Re-run the schema.sql in Supabase SQL Editor |
| "Asset tag already exists" | Asset tags must be unique — use a different tag |

---

## Project File Structure Reference

```
inspecttrack/
│
├── backend/                      ← Node.js API (deployed to Railway)
│   ├── server.js                 ← Express app entry point
│   ├── package.json
│   ├── railway.json              ← Railway deployment config
│   ├── Procfile
│   ├── .env.example              ← Copy to .env for local dev
│   │
│   ├── db/
│   │   ├── schema.sql            ← Run this in Supabase SQL Editor
│   │   └── pool.js               ← PostgreSQL connection
│   │
│   ├── middleware/
│   │   └── auth.js               ← JWT authentication
│   │
│   ├── routes/
│   │   ├── auth.js               ← Login, register, users
│   │   ├── equipment.js          ← Equipment CRUD
│   │   ├── inspections.js        ← Inspection logging
│   │   ├── categories.js         ← Categories + alert recipients
│   │   └── dashboard.js          ← Stats + alert trigger
│   │
│   └── services/
│       ├── alertScheduler.js     ← Daily cron job
│       └── emailService.js       ← Email templates + sender
│
├── frontend/                     ← React app (deployed to Vercel)
│   ├── index.html
│   ├── vite.config.js
│   ├── vercel.json               ← Vercel SPA routing fix
│   ├── .env.example
│   │
│   └── src/
│       ├── App.jsx               ← Router + protected routes
│       ├── main.jsx              ← React entry point
│       ├── api.js                ← Fetch wrapper with auth
│       │
│       ├── context/
│       │   └── AuthContext.jsx   ← Global login state
│       │
│       ├── components/
│       │   ├── UI.jsx            ← Button, Modal, Badge, etc.
│       │   └── Navbar.jsx        ← Top navigation bar
│       │
│       └── pages/
│           ├── LoginPage.jsx          ← Login + Register
│           ├── DashboardPage.jsx      ← Stats + overdue + activity
│           ├── EquipmentPage.jsx      ← Equipment list + filters
│           ├── EquipmentDetailPage.jsx← Detail + inspection history
│           ├── CategoriesPage.jsx     ← Categories + recipients
│           └── AlertLogsPage.jsx      ← Alert log + Users page
│
└── .gitignore
```

---

## Local Development (Optional)

If you want to run the app on your computer for testing:

```bash
# Terminal 1 — Backend
cd inspecttrack/backend
cp .env.example .env
# Edit .env with your Supabase DATABASE_URL and SMTP settings
npm install
npm run dev
# API runs at http://localhost:4000

# Terminal 2 — Frontend
cd inspecttrack/frontend
cp .env.example .env
# Leave VITE_API_URL empty for local dev (uses Vite proxy)
npm install
npm run dev
# App opens at http://localhost:3000
```
