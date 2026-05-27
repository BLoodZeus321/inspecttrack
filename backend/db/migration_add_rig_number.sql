-- ============================================================
-- Migration: Add rig_number to equipment
-- Run this in Supabase → SQL Editor for EXISTING installs
-- (Fresh installs don't need this — schema.sql already includes it)
-- ============================================================

-- Add rig_number column
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS rig_number VARCHAR(50);

-- Update the equipment_status view to include rig_number
DROP VIEW IF EXISTS equipment_status;

CREATE VIEW equipment_status AS
SELECT
  e.id, e.name, e.asset_tag, e.serial_number, e.location,
  e.rig_number,
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

-- ── Add rig_number to alert_recipients ───────────────────────
-- Allows setting different recipients per rig per category
-- NULL means "all rigs" (existing behaviour preserved)
ALTER TABLE alert_recipients ADD COLUMN IF NOT EXISTS rig_number VARCHAR(50);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_alert_recipients_rig ON alert_recipients(rig_number);

-- ── Migration: Rename role inspector → representative ─────────
-- Run in Supabase SQL Editor for EXISTING installs
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
UPDATE users SET role = 'representative' WHERE role = 'inspector';
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin','representative','viewer'));

-- ── Migration: Fix equipment_status view to include inspection result ──
-- Run in Supabase SQL Editor
DROP VIEW IF EXISTS equipment_status;

CREATE VIEW equipment_status AS
SELECT
  e.id, e.name, e.asset_tag, e.serial_number, e.location,
  e.rig_number,
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

-- ── Migration: Add department to categories ───────────────────
ALTER TABLE categories ADD COLUMN IF NOT EXISTS department VARCHAR(100);

-- Update existing categories with default departments
UPDATE categories SET department = 'HSE'        WHERE name IN ('Fire Extinguisher','PPE','Pressure Vessel');
UPDATE categories SET department = 'Lifting'    WHERE name IN ('Lifting Equipment');
UPDATE categories SET department = 'Operations' WHERE name IN ('Electrical Tools','Hand Tools','Vehicle / Forklift');

-- ── Migration: Certificate system ────────────────────────────
-- Certificates can be linked to multiple equipment items

CREATE TABLE IF NOT EXISTS certificates (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title         VARCHAR(200) NOT NULL,
  cert_number   VARCHAR(100),
  issued_by     VARCHAR(200),
  issued_date   DATE,
  expiry_date   DATE,
  file_url      TEXT,          -- Supabase Storage public URL
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

CREATE INDEX IF NOT EXISTS idx_eq_certs_cert ON equipment_certificates(certificate_id);
CREATE INDEX IF NOT EXISTS idx_eq_certs_equip ON equipment_certificates(equipment_id);

-- ── Supabase Storage: Create certificates bucket ──────────────
-- Run this in Supabase → SQL Editor
-- This creates a public bucket for certificate file storage

INSERT INTO storage.buckets (id, name, public)
VALUES ('certificates', 'certificates', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload
CREATE POLICY IF NOT EXISTS "Authenticated users can upload certificates"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'certificates');

-- Allow everyone to read/view certificate files
CREATE POLICY IF NOT EXISTS "Public can view certificates"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'certificates');

-- Allow authenticated users to delete their own uploads
CREATE POLICY IF NOT EXISTS "Authenticated users can delete certificates"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'certificates');
