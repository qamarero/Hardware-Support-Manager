-- Migración W1 — campos de incidencia del prototipo (aditiva, no destructiva).
-- Aplicar en el SQL editor de Supabase.
ALTER TABLE hsm.incidents ADD COLUMN IF NOT EXISTS sla_hours integer;
ALTER TABLE hsm.incidents ADD COLUMN IF NOT EXISTS diagnosis text;
ALTER TABLE hsm.incidents ADD COLUMN IF NOT EXISTS resolution text;
