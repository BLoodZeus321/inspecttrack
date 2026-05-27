-- ============================================================
-- InspectTrack - Full Database Schema
-- Paste & run this in Supabase → SQL Editor → New Query
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Users ─────────────────────────────────────────────────────
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(200) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          VARCHAR(20) NOT NULL DEFAULT 'viewer'
                CHECK (role IN ('admin','representative','viewer')),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Categories ────────────────────────────────────────────────
CREATE TABLE categories (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                     VARCHAR(100) NOT NULL UNIQUE,
  description              TEXT,
  inspection_interval_days INTEGER NOT NULL DEFAULT 365,
  alert_lead_days          INTEGER[] NOT NULL DEFAULT '{30,14,7}',
  color                    VARCHAR(7) DEFAULT '#3B82F6',
  department               VARCHAR(100),
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW()
);

-- ── Equipment ─────────────────────────────────────────────────
CREATE TABLE equipment (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(200) NOT NULL,
  asset_tag     VARCHAR(100) UNIQUE,
  serial_number VARCHAR(100),
  category_id   UUID REFERENCES categories(id) ON DELETE SET NULL,
  location      VARCHAR(200),
  manufacturer  VARCHAR(100),
  model         VARCHAR(100),
  purchase_date DATE,
  status        VARCHAR(20) NOT NULL DEFAULT 'active'
                CHECK (status IN ('active','retired','under_repair')),
  notes         TEXT,
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Inspections ───────────────────────────────────────────────
CREATE TABLE inspections (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  equipment_id    UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  inspected_by    VARCHAR(100) NOT NULL,
  inspection_date DATE NOT NULL,
  next_due_date   DATE NOT NULL,
  result          VARCHAR(20) NOT NULL CHECK (result IN ('pass','fail','conditional')),
  notes           TEXT,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Alert Recipients (per category) ──────────────────────────
CREATE TABLE alert_recipients (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  email       VARCHAR(200) NOT NULL,
  name        VARCHAR(100),
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(category_id, email)
);

-- ── Global Recipients (receive ALL alerts) ────────────────────
CREATE TABLE global_recipients (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email      VARCHAR(200) NOT NULL UNIQUE,
  name       VARCHAR(100),
  is_active  BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Alert Log (audit trail + prevents duplicate sends) ────────
CREATE TABLE alert_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  equipment_id    UUID REFERENCES equipment(id) ON DELETE CASCADE,
  recipient_email VARCHAR(200) NOT NULL,
  days_before_due INTEGER NOT NULL,
  alert_type      VARCHAR(20) DEFAULT 'expiry'
                  CHECK (alert_type IN ('expiry','overdue')),
  status          VARCHAR(20) DEFAULT 'sent'
                  CHECK (status IN ('sent','failed')),
  error_message   TEXT,
  sent_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX idx_equipment_category    ON equipment(category_id);
CREATE INDEX idx_equipment_status      ON equipment(status);
CREATE INDEX idx_inspections_equipment ON inspections(equipment_id);
CREATE INDEX idx_inspections_due       ON inspections(next_due_date);
CREATE INDEX idx_alert_log_sent        ON alert_log(equipment_id, sent_at);

-- ── Live Status View ──────────────────────────────────────────
CREATE VIEW equipment_status AS
SELECT
  e.id, e.name, e.asset_tag, e.serial_number, e.location,
  e.manufacturer, e.model, e.purchase_date, e.status,
  e.notes, e.category_id, e.created_at,
  c.name              AS category,
  c.color             AS category_color,
  c.inspection_interval_days,
  c.alert_lead_days,
  i.inspection_date   AS last_inspection_date,
  i.next_due_date,
  i.result            AS last_result,
  i.inspected_by      AS last_inspector,
  (i.next_due_date - CURRENT_DATE) AS days_until_due,
  CASE
    WHEN i.next_due_date IS NULL              THEN 'never_inspected'
    WHEN i.result = 'fail'                    THEN 'failed'
    WHEN i.result = 'conditional'             THEN 'conditional'
    WHEN CURRENT_DATE >  i.next_due_date      THEN 'overdue'
    WHEN CURRENT_DATE >= i.next_due_date -  7 THEN 'critical'
    WHEN CURRENT_DATE >= i.next_due_date - 30 THEN 'warning'
    ELSE 'ok'
  END AS alert_status
FROM equipment e
LEFT JOIN categories c ON e.category_id = c.id
LEFT JOIN LATERAL (
  SELECT inspection_date, next_due_date, result, inspected_by
  FROM   inspections WHERE equipment_id = e.id
  ORDER  BY inspection_date DESC LIMIT 1
) i ON TRUE;

-- ── Seed default categories ───────────────────────────────────
INSERT INTO categories (name, description, inspection_interval_days, alert_lead_days, color, department) VALUES
  ('Fire Extinguisher',  'Fire suppression equipment',       365, '{60,30,7}',   '#EF4444', 'HSE'),
  ('Lifting Equipment',  'Cranes, hoists, slings, shackles', 180, '{30,14,3}',   '#F97316', 'Lifting'),
  ('Pressure Vessel',    'Compressors, tanks, cylinders',     90, '{21,7,2}',    '#EAB308', 'HSE'),
  ('PPE',                'Personal protective equipment',    365, '{30,14}',     '#22C55E', 'HSE'),
  ('Electrical Tools',   'Portable electrical equipment',    365, '{30,7}',      '#3B82F6', 'Operations'),
  ('Hand Tools',         'Manual hand tools',                730, '{60,30}',     '#8B5CF6', 'Operations'),
  ('Vehicle / Forklift', 'Company vehicles and forklifts',   365, '{45,30,14}',  '#06B6D4', 'Operations');

-- ── Migration: Add rig_number column ─────────────────────────
-- Run this in Supabase SQL Editor if upgrading an existing install
-- (already included for fresh installs via the equipment table above)
-- ALTER TABLE equipment ADD COLUMN IF NOT EXISTS rig_number VARCHAR(50);

-- ── Certificates ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS certificates (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title         VARCHAR(200) NOT NULL,
  cert_number   VARCHAR(100),
  issued_by     VARCHAR(200),
  issued_date   DATE,
  expiry_date   DATE,
  file_url      TEXT,
  file_name     VARCHAR(300),
  notes         TEXT,
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS equipment_certificates (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  certificate_id UUID NOT NULL REFERENCES certificates(id) ON DELETE CASCADE,
  equipment_id   UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(certificate_id, equipment_id)
);

CREATE INDEX IF NOT EXISTS idx_eq_certs_cert  ON equipment_certificates(certificate_id);
CREATE INDEX IF NOT EXISTS idx_eq_certs_equip ON equipment_certificates(equipment_id);
