-- Migration 005: Add SLA pause tracking and resolution type to incidents
-- Run in Supabase SQL Editor as postgres user

-- 1. Add sla_paused_ms column (stores accumulated pause time in milliseconds)
ALTER TABLE hsm.incidents ADD COLUMN sla_paused_ms varchar(50) NOT NULL DEFAULT '0';

-- 2. Add resolution_type column (null = not resolved, 'standard' = normal resolution, 'derivado_rma' = derived to RMA)
ALTER TABLE hsm.incidents ADD COLUMN resolution_type varchar(50);

-- 3. Set resolution_type for already-resolved incidents
UPDATE hsm.incidents SET resolution_type = 'standard' WHERE status IN ('resuelto', 'cerrado') AND resolved_at IS NOT NULL;

-- Grant permissions to hsm_app
GRANT SELECT, INSERT, UPDATE, DELETE ON hsm.incidents TO hsm_app;
