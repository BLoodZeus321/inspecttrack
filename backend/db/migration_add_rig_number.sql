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
