-- ⑤-AG — Recordatorios recurrentes.
-- Aditivo e idempotente. Ejecutar en el SQL editor de Supabase.

ALTER TABLE hsm.reminders ADD COLUMN IF NOT EXISTS recurrence varchar(20) NOT NULL DEFAULT 'none';
