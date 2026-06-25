-- ⑨-P3 — Datos de recogida/envío del RMA (cliente + destino).
-- Aditivo e idempotente. Ejecutar en el SQL editor de Supabase.
-- Guarda { locationName, contactName, contactEmail, contactPhone, address,
--          postalCode, city, province, reference, instructions, destination{...} }.

ALTER TABLE hsm.rmas
  ADD COLUMN IF NOT EXISTS shipping jsonb DEFAULT '{}'::jsonb;
