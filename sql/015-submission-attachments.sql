-- ⑧ — Adjuntos (imágenes) en el formulario público de soporte.
-- Aditivo e idempotente. Ejecutar en el SQL editor de Supabase.
-- Guarda un array JSON de { url, name, size, type } por sumisión.

ALTER TABLE hsm.support_submissions
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;
