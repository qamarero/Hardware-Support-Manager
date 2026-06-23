-- A5.2 — RMA: estados nuevos + campos de granularidad para métricas
-- Aditivo e idempotente. Ejecutar en el SQL editor de Supabase.
-- NOTA: ALTER TYPE ... ADD VALUE no puede ir dentro de una transacción con su
-- uso; ejecútalo tal cual (cada sentencia por separado si tu editor lo exige).

ALTER TYPE hsm.rma_status ADD VALUE IF NOT EXISTS 'entregado_cliente';
ALTER TYPE hsm.rma_status ADD VALUE IF NOT EXISTS 'rechazado';

ALTER TABLE hsm.rmas ADD COLUMN IF NOT EXISTS outcome      varchar(30);
ALTER TABLE hsm.rmas ADD COLUMN IF NOT EXISTS logistics    varchar(30);
ALTER TABLE hsm.rmas ADD COLUMN IF NOT EXISTS repair_path  varchar(30);
