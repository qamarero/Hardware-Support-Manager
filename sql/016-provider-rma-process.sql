-- ⑨-P1 — Procedimiento de RMA por proveedor.
-- Aditivo e idempotente. Ejecutar en el SQL editor de Supabase.
-- Guarda { method, emailTo, emailCc, requiresForm, formType, formUrl, allowsDirectToClient, steps }.

ALTER TABLE hsm.providers
  ADD COLUMN IF NOT EXISTS rma_process jsonb DEFAULT '{}'::jsonb;
