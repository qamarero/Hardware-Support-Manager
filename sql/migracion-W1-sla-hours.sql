-- Migración W1 — campos de incidencia del prototipo (aditiva, no destructiva).
-- Aplicar en el SQL editor de Supabase.
ALTER TABLE hsm.incidents ADD COLUMN IF NOT EXISTS sla_hours integer;
ALTER TABLE hsm.incidents ADD COLUMN IF NOT EXISTS diagnosis text;
ALTER TABLE hsm.incidents ADD COLUMN IF NOT EXISTS resolution text;
-- Local/ubicación del cliente afectado (FK a client_locations).
ALTER TABLE hsm.incidents ADD COLUMN IF NOT EXISTS client_location_id uuid REFERENCES hsm.client_locations(id) ON DELETE SET NULL;
